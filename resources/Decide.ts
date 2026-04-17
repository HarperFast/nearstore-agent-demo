/**
 * Decide — the main agent endpoint.
 *
 * POST /Decide  { personaKey, lat, lon, now? }
 *
 * Steps:
 *   1. Proximity check via H3 (from Proximity.ts). No store nearby → return early.
 *   2. Load customer (by personaKey), their orders, active campaigns, and rules.
 *   3. Enforce HARD rules in code (promo cooldown, quiet hours).
 *   4. Hand the rest — customer profile, order patterns, campaigns, soft rules —
 *      to Claude Haiku 4.5 with a forced tool_use for structured output.
 *   5. Return { action, store, decision, timing }.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import {
	type RequestTargetOrId,
	Resource,
	tables,
} from 'harperdb';

import { findNearbyStores } from './Proximity.ts';

// Resource files run inside Harper worker threads whose cwd may not be the
// project root. Load .env from the project root explicitly.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath, override: true });

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const DENVER_TZ = 'America/Denver';

// ---- helpers ----

interface DecisionInput {
	should_send: boolean;
	campaign_id: string | null;
	message: string;
	reasoning: string;
}

function getLocalParts(dateIso: string) {
	// Returns parts in America/Denver for rule evaluation.
	const d = new Date(dateIso);
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: DENVER_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		weekday: 'short',
		hour12: false,
	}).formatToParts(d);
	const pick = (t: string) => fmt.find((p) => p.type === t)?.value ?? '';
	return {
		hourLocal: parseInt(pick('hour'), 10),
		minuteLocal: parseInt(pick('minute'), 10),
		dayOfWeek: pick('weekday'),
		localIso: `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')} (${DENVER_TZ})`,
	};
}

function hoursBetween(a: string | null | undefined, b: string): number | null {
	if (!a) return null;
	const ms = new Date(b).getTime() - new Date(a).getTime();
	return ms / 3_600_000;
}

function inQuietHours(hour: number, start: number, end: number) {
	// [start, 24) ∪ [0, end) if start > end; else [start, end)
	if (start > end) return hour >= start || hour < end;
	return hour >= start && hour < end;
}

function summarizeOrders(orders: any[], nowIso: string) {
	const now = new Date(nowIso).getTime();
	const days = (o: any) =>
		(now - new Date(o.timestamp).getTime()) / 86_400_000;

	const last30 = orders.filter((o) => days(o) <= 30);
	const last90 = orders.filter((o) => days(o) <= 90);
	const hourBuckets: Record<string, number> = {
		'00-06': 0,
		'06-10': 0,
		'10-14': 0,
		'14-18': 0,
		'18-22': 0,
		'22-24': 0,
	};
	const itemCount: Record<string, number> = {};
	for (const o of last90) {
		const h = new Date(o.timestamp).getUTCHours(); // rough; UTC is fine for bucketing
		const localH = (h + 18) % 24; // UTC→MDT (-6)
		if (localH < 6) hourBuckets['00-06']++;
		else if (localH < 10) hourBuckets['06-10']++;
		else if (localH < 14) hourBuckets['10-14']++;
		else if (localH < 18) hourBuckets['14-18']++;
		else if (localH < 22) hourBuckets['18-22']++;
		else hourBuckets['22-24']++;
		for (const it of o.items ?? []) {
			itemCount[it.name] = (itemCount[it.name] ?? 0) + 1;
		}
	}
	const topItems = Object.entries(itemCount)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([name, count]) => ({ name, count }));

	const sorted = [...orders].sort((a, b) =>
		a.timestamp < b.timestamp ? 1 : -1
	);

	return {
		orderCount_90d: last90.length,
		orderCount_30d: last30.length,
		avgOrderTotal:
			last90.length > 0
				? Math.round(
						(last90.reduce((s, o) => s + (o.total ?? 0), 0) / last90.length) *
							100
					) / 100
				: 0,
		timeOfDayDistribution_local: hourBuckets,
		topItems,
		lastFiveOrders: sorted.slice(0, 5).map((o) => ({
			timestamp: o.timestamp,
			total: o.total,
			items: (o.items ?? []).map((i: any) => i.name),
		})),
	};
}

async function loadCustomer(personaKey: string) {
	for await (const c of (tables as any).Customer.search({
		conditions: [
			{ attribute: 'personaKey', comparator: 'equals', value: personaKey },
		],
	})) {
		return c; // first match — personaKey is unique in seed
	}
	return null;
}

async function loadOrders(customerId: string) {
	const orders: any[] = [];
	for await (const o of (tables as any).Order.search({
		conditions: [
			{ attribute: 'customerId', comparator: 'equals', value: customerId },
		],
	})) {
		orders.push(o);
	}
	return orders;
}

async function loadEnabled(table: string) {
	const out: any[] = [];
	for await (const r of (tables as any)[table].search({
		conditions: [{ attribute: 'enabled', comparator: 'equals', value: true }],
	})) {
		out.push(r);
	}
	return out;
}

async function loadRules() {
	const all: any[] = [];
	for await (const r of (tables as any).BusinessRule.search({})) {
		all.push(r);
	}
	return all;
}

// ---- agent call ----

const DECIDE_TOOL = {
	name: 'decide_promotion',
	description:
		'Decide whether to send a push promotion to the customer right now, and if so which campaign and what message.',
	input_schema: {
		type: 'object' as const,
		properties: {
			should_send: {
				type: 'boolean',
				description: 'Whether to send a promotion at this moment.',
			},
			campaign_id: {
				type: ['string', 'null'],
				description:
					'The id of the campaign to send, from the enabled campaigns list. Null if should_send is false.',
			},
			message: {
				type: 'string',
				description:
					'Short personalized push message, under 140 characters. Use first-person brand voice. Reference the customer or store only if it adds value.',
			},
			reasoning: {
				type: 'string',
				description:
					'One or two sentences explaining why this decision fits the customer profile and current context.',
			},
		},
		required: ['should_send', 'campaign_id', 'message', 'reasoning'],
	},
};

async function callAgent(context: any): Promise<DecisionInput> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error(
			'ANTHROPIC_API_KEY is not set. Add it to .env and restart `npm run dev`.'
		);
	}
	// 30s timeout so a slow/hanging Anthropic response can't hold the request
	// open indefinitely. Haiku typically responds in 2–4s; 30s is generous
	// enough to survive cold starts and network hiccups during live demos.
	const client = new Anthropic({ apiKey, timeout: 30_000 });

	const systemPrompt =
		'You are the promotion-decision brain for a fictional McDonald\'s mobile app. ' +
		'A customer just triggered a geofence near a store. Given their profile, ' +
		'order history, the nearby store, the current local time, active campaigns, ' +
		'and soft business rules, decide whether to send a push, which campaign, ' +
		'and write a short personalized message. Only pick a campaign if it fits ' +
		'the customer and the time window. When in doubt, do not send — irrelevant ' +
		'pushes cost trust.';

	const userPrompt = [
		'# Context',
		'',
		'## Current time (local)',
		context.now.localIso,
		`(hour ${context.now.hourLocal}, ${context.now.dayOfWeek})`,
		'',
		'## Nearby store',
		JSON.stringify(context.store, null, 2),
		'',
		'## Customer',
		JSON.stringify(context.customer, null, 2),
		'',
		'## Order summary (last 90 days)',
		JSON.stringify(context.orderSummary, null, 2),
		'',
		'## Active campaigns',
		JSON.stringify(context.campaigns, null, 2),
		'',
		'## Soft business rules',
		JSON.stringify(context.softRules, null, 2),
		'',
		'Decide now.',
	].join('\n');

	const response = await client.messages.create({
		model: MODEL,
		max_tokens: 600,
		system: systemPrompt,
		tools: [DECIDE_TOOL],
		tool_choice: { type: 'tool' as const, name: 'decide_promotion' },
		messages: [{ role: 'user', content: userPrompt }],
	});

	const toolUse = response.content.find((b: any) => b.type === 'tool_use') as
		| { input: DecisionInput }
		| undefined;
	if (!toolUse) {
		throw new Error('Agent did not return a tool_use response');
	}
	return toolUse.input;
}

// ---- resource ----

export class Decide extends Resource {
	allowCreate() {
		return true;
	}

	async post(body: any) {
		const started = Date.now();
		const personaKey: string = body?.personaKey;
		const lat: number = Number(body?.lat);
		const lon: number = Number(body?.lon);
		const nowIso: string = body?.now || new Date().toISOString();

		if (!personaKey || Number.isNaN(lat) || Number.isNaN(lon)) {
			return {
				error:
					'Body requires { personaKey: string, lat: number, lon: number }',
			};
		}
		if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
			return {
				error: 'lat must be in [-90, 90] and lon must be in [-180, 180]',
			};
		}
		if (Number.isNaN(new Date(nowIso).getTime())) {
			return { error: 'now must be a valid ISO 8601 timestamp' };
		}

		// 1. Proximity
		const prox = await findNearbyStores(lat, lon);
		const closest = prox.nearbyStores[0];
		if (!closest) {
			return {
				action: 'no_store_nearby',
				message: 'Not close enough to a McDonald\'s.',
				proximity: {
					customerCell: prox.customerCell,
					candidateCount: prox.candidateCount,
					nearestStore: null,
				},
				timing: { totalMs: Date.now() - started },
			};
		}

		// 2. Load customer context
		const customer = await loadCustomer(personaKey);
		if (!customer) {
			return {
				error: `Unknown personaKey: ${personaKey}`,
				timing: { totalMs: Date.now() - started },
			};
		}
		const [orders, campaigns, rules] = await Promise.all([
			loadOrders(customer.id),
			loadEnabled('Campaign'),
			loadRules(),
		]);

		const now = getLocalParts(nowIso);

		// 3. Hard rule enforcement
		const enforcedHard: any[] = [];
		for (const r of rules) {
			if (!r.enabled || r.kind !== 'hard') continue;
			if (r.key === 'promo_cooldown_hours') {
				const since = hoursBetween(customer.lastPromoAt, nowIso);
				if (since !== null && since < (r.params?.hours ?? 0)) {
					return {
						action: 'blocked_cooldown',
						store: closest,
						rule: r.key,
						message: `Promo cooldown — last sent ${since.toFixed(1)}h ago, rule requires ${r.params.hours}h.`,
						proximity: { customerCell: prox.customerCell },
						timing: { totalMs: Date.now() - started },
					};
				}
				enforcedHard.push({ key: r.key, outcome: 'pass' });
			}
			if (r.key === 'quiet_hours') {
				if (
					inQuietHours(
						now.hourLocal,
						r.params?.startLocalHour ?? 22,
						r.params?.endLocalHour ?? 7
					)
				) {
					return {
						action: 'blocked_quiet_hours',
						store: closest,
						rule: r.key,
						message: `Quiet hours — ${r.params.startLocalHour}:00–${r.params.endLocalHour}:00 local.`,
						proximity: { customerCell: prox.customerCell },
						timing: { totalMs: Date.now() - started },
					};
				}
				enforcedHard.push({ key: r.key, outcome: 'pass' });
			}
		}

		// 4. Build context, call agent
		const orderSummary = summarizeOrders(orders, nowIso);
		const softRules = rules
			.filter((r) => r.enabled && r.kind === 'soft')
			.map((r) => ({
				key: r.key,
				description: r.description,
				params: r.params,
			}));

		const agentContext = {
			now,
			store: {
				id: closest.id,
				name: closest.name,
				address: closest.address,
				city: closest.city,
				distanceFeet: closest.distanceFeet,
			},
			customer: {
				id: customer.id,
				personaKey: customer.personaKey,
				name: customer.name,
				signupDate: customer.signupDate,
				lastOrderAt: customer.lastOrderAt,
				totalOrders: customer.totalOrders,
				totalSpend: customer.totalSpend,
				notes: customer.notes,
				daysSinceLastOrder: customer.lastOrderAt
					? Math.round(
							(new Date(nowIso).getTime() -
								new Date(customer.lastOrderAt).getTime()) /
								86_400_000
						)
					: null,
			},
			orderSummary,
			campaigns: campaigns.map((c) => ({
				id: c.id,
				name: c.name,
				headline: c.headline,
				messageTemplate: c.messageTemplate,
				targetPersona: c.targetPersona,
				minVisitsLast30Days: c.minVisitsLast30Days,
				requiresLapsedDays: c.requiresLapsedDays,
				timeWindow: c.timeWindow,
				offer: c.offer,
				notes: c.notes,
			})),
			softRules,
		};

		const agentStart = Date.now();
		let decision: DecisionInput;
		try {
			decision = await callAgent(agentContext);
		} catch (e: any) {
			return {
				action: 'error',
				error: e?.message ?? String(e),
				store: closest,
				timing: { totalMs: Date.now() - started },
			};
		}
		const agentMs = Date.now() - agentStart;

		return {
			action: decision.should_send ? 'send_promo' : 'hold',
			store: closest,
			decision,
			context: {
				hardRulesEnforced: enforcedHard,
				softRulesPassed: softRules.map((r) => r.key),
				customerSummary: {
					personaKey: customer.personaKey,
					ordersLast30d: orderSummary.orderCount_30d,
					ordersLast90d: orderSummary.orderCount_90d,
					daysSinceLastOrder: agentContext.customer.daysSinceLastOrder,
				},
			},
			timing: {
				totalMs: Date.now() - started,
				agentMs,
				model: MODEL,
			},
		};
	}
}

/**
 * Seed script — loads stores, personas, orders, campaigns, and business rules into Harper.
 *
 * Usage:  node scripts/seed.js
 * Requires Harper running on localhost:9926 (from `npm run dev`).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { latLngToCell } from 'h3-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const HDB_URL = process.env.HDB_URL || 'http://localhost:9926';
const HDB_AUTH =
	process.env.HDB_AUTH ||
	'Basic ' + Buffer.from('HDB_ADMIN:password').toString('base64');

// H3 resolution 9 — ~174m hex edge, a good match for a 500ft (~152m) radius.
export const H3_RES = 9;

// "Now" for deterministic seeding. Matches the demo's current date.
const NOW = new Date('2026-04-17T12:00:00Z');

async function hdb(method, path_, body) {
	const res = await fetch(`${HDB_URL}${path_}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: HDB_AUTH,
		},
		body: body == null ? undefined : JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`${method} ${path_} → ${res.status} ${text}`);
	}
	return res.status === 204 ? null : res.json().catch(() => null);
}

async function loadJson(name) {
	return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), 'utf8'));
}

function formatIso(d) {
	return new Date(d).toISOString();
}

/** Deterministic pseudo-random based on a string seed. */
function seededRand(seed) {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return () => {
		h ^= h << 13;
		h ^= h >>> 17;
		h ^= h << 5;
		return ((h >>> 0) % 1_000_000) / 1_000_000;
	};
}

function seedStores(stores) {
	return stores.map((s) => ({
		...s,
		h3Cell: latLngToCell(s.latitude, s.longitude, H3_RES),
	}));
}

/** Generate orders for a persona using its pattern spec. */
function generateOrders(persona) {
	const orders = [];
	const pattern = persona.orderPattern;
	if (!pattern) return orders;

	if (pattern.historicalOrders) {
		for (let i = 0; i < pattern.historicalOrders.length; i++) {
			const o = pattern.historicalOrders[i];
			const d = new Date(NOW);
			d.setUTCDate(d.getUTCDate() - o.daysAgo);
			const [hh, mm] = o.time.split(':').map(Number);
			d.setUTCHours(hh + 6, mm, 0, 0); // local→UTC rough (MDT = UTC-6)
			const total = o.items.reduce((s, it) => s + it.price, 0);
			orders.push({
				id: `${persona.id}-hist-${i}`,
				customerId: persona.id,
				storeId: pattern.homeStoreId,
				timestamp: formatIso(d),
				total: Math.round(total * 100) / 100,
				items: o.items,
			});
		}
		return orders;
	}

	const rand = seededRand(persona.personaKey);
	const [localH, localM] = pattern.timeLocal.split(':').map(Number);
	const daysBack = pattern.daysBack ?? 90;

	for (let dayOffset = 1; dayOffset <= daysBack; dayOffset++) {
		const d = new Date(NOW);
		d.setUTCDate(d.getUTCDate() - dayOffset);
		const dow = d.getUTCDay();
		if (!pattern.weekdays.includes(dow)) continue;
		if (rand() < (pattern.skipProbability ?? 0)) continue;

		const jitter = pattern.jitterMinutes
			? (rand() * 2 - 1) * pattern.jitterMinutes
			: 0;
		// Convert local time to UTC (Denver = UTC-6 during MDT)
		d.setUTCHours(localH + 6, localM + Math.round(jitter), 0, 0);

		const total = pattern.items.reduce((s, it) => s + it.price, 0);
		orders.push({
			id: `${persona.id}-${dayOffset}`,
			customerId: persona.id,
			storeId: pattern.homeStoreId,
			timestamp: formatIso(d),
			total: Math.round(total * 100) / 100,
			items: pattern.items,
		});
	}

	return orders;
}

function customerFromPersona(persona, orders) {
	const sorted = [...orders].sort((a, b) =>
		a.timestamp < b.timestamp ? 1 : -1
	);
	const totalOrders = orders.length;
	const totalSpend = orders.reduce((s, o) => s + o.total, 0);
	return {
		id: persona.id,
		personaKey: persona.personaKey,
		name: persona.name,
		signupDate: persona.signupDate,
		lastOrderAt: sorted[0]?.timestamp ?? null,
		lastPromoAt: null,
		totalOrders,
		totalSpend: Math.round(totalSpend * 100) / 100,
		notes: persona.notes,
	};
}

async function putAll(tableName, records) {
	for (const r of records) {
		await hdb('PUT', `/${tableName}/${encodeURIComponent(r.id ?? r.key)}`, r);
	}
	console.log(`  ✓ ${tableName}: ${records.length} records`);
}

async function main() {
	console.log(`Seeding Harper at ${HDB_URL}`);

	const [stores, personas, campaigns, rules] = await Promise.all([
		loadJson('stores.json'),
		loadJson('personas.json'),
		loadJson('campaigns.json'),
		loadJson('businessRules.json'),
	]);

	const storesWithH3 = seedStores(stores);
	await putAll('Store', storesWithH3);

	// Clear previous orders for deterministic runs (best effort)
	const allOrders = [];
	const customers = [];
	for (const p of personas) {
		const orders = generateOrders(p);
		allOrders.push(...orders);
		customers.push(customerFromPersona(p, orders));
	}
	await putAll('Customer', customers);
	await putAll('Order', allOrders);
	await putAll('Campaign', campaigns);
	await putAll('BusinessRule', rules);

	console.log('\nSummary:');
	console.log(`  Stores:        ${storesWithH3.length}`);
	console.log(`  Customers:     ${customers.length}`);
	console.log(`  Orders:        ${allOrders.length}`);
	console.log(`  Campaigns:     ${campaigns.length}`);
	console.log(`  BusinessRules: ${rules.length}`);
	for (const c of customers) {
		console.log(
			`    - ${c.personaKey.padEnd(16)} ${c.totalOrders} orders / $${c.totalSpend}`
		);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

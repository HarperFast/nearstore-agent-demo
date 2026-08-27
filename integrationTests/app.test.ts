/**
 * Integration tests for nearstore-agent-demo.
 *
 * Tests cover:
 *   - Harper starts successfully
 *   - GET /Stores returns seeded stores
 *   - GET /Personas returns seeded customer personas
 *   - GET /Proximity?lat=&lon= returns proximity result including nearby stores
 *   - GET /Proximity outside any geofence returns empty nearbyStores
 *   - POST /Decide with bad input returns validation error (no Anthropic call)
 *   - POST /Decide with no nearby store returns no_store_nearby (no Anthropic call)
 *   - Automatic REST CRUD on Store table
 */

import { suite, test, before, after } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'node:assert/strict';
import {
	setupHarperWithFixture,
	teardownHarper,
	type ContextWithHarper,
} from '@harperfast/integration-testing';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { latLngToCell } from 'h3-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '..');
const DATA_DIR = resolve(__dirname, '..', 'data');

// harper's `exports` map only exposes ".", so 'harper/dist/bin/harper.js' is
// not resolvable via the standard subpath. Resolve the CLI from the exported
// main entry and pass it explicitly as harperBinPath.
const require = createRequire(import.meta.url);
const harperBinPath = resolve(dirname(require.resolve('harper')), 'bin/harper.js');

const H3_RES = 9;

function authFetch(
	ctx: ContextWithHarper,
	path: string,
	init: RequestInit & { headers?: Record<string, string> } = {}
) {
	const { headers = {}, ...rest } = init;
	const creds = Buffer.from(
		`${ctx.harper.admin.username}:${ctx.harper.admin.password}`
	).toString('base64');
	return fetch(`${ctx.harper.httpURL}${path}`, {
		...rest,
		headers: { Authorization: `Basic ${creds}`, ...headers },
	});
}

/** Seed stores, customers, orders, campaigns, and business rules via REST. */
async function seedData(ctx: ContextWithHarper) {
	const [storesRaw, personas, campaigns, rules] = await Promise.all([
		readFile(resolve(DATA_DIR, 'stores.json'), 'utf8').then(JSON.parse),
		readFile(resolve(DATA_DIR, 'personas.json'), 'utf8').then(JSON.parse),
		readFile(resolve(DATA_DIR, 'campaigns.json'), 'utf8').then(JSON.parse),
		readFile(resolve(DATA_DIR, 'businessRules.json'), 'utf8').then(JSON.parse),
	]);

	// Attach h3Cell to stores (mirrors scripts/seed.js)
	const stores = storesRaw.map((s: any) => ({
		...s,
		h3Cell: latLngToCell(s.latitude, s.longitude, H3_RES),
	}));

	// Each record has a distinct primary key, so the writes are independent and
	// Harper handles them concurrently — issue them in parallel rather than
	// serialising 25+ round trips through the suite's `before` hook.
	async function putAll(tableName: string, records: any[]) {
		await Promise.all(
			records.map(async (r) => {
				const key = encodeURIComponent(r.id ?? r.key);
				const res = await authFetch(ctx, `/${tableName}/${key}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(r),
				});
				if (!res.ok) {
					const text = await res.text();
					throw new Error(`PUT /${tableName}/${key} → ${res.status} ${text}`);
				}
			})
		);
	}

	// Build minimal customers from personas (no orders needed for most tests)
	const customers = personas.map((p: any) => ({
		id: p.id,
		personaKey: p.personaKey,
		name: p.name,
		signupDate: p.signupDate,
		lastOrderAt: null,
		lastPromoAt: null,
		totalOrders: 0,
		totalSpend: 0,
		notes: p.notes,
	}));

	await putAll('Store', stores);
	await putAll('Customer', customers);
	await putAll('Campaign', campaigns);
	await putAll('BusinessRule', rules);
}

void suite('nearstore-agent-demo', (ctx: ContextWithHarper) => {
	before(async () => {
		await setupHarperWithFixture(ctx, FIXTURE_PATH, { harperBinPath });
		await seedData(ctx);
	});

	after(async () => {
		await teardownHarper(ctx);
	});

	void test('Harper starts and responds to HTTP requests', async () => {
		const res = await authFetch(ctx, '/');
		ok(
			[200, 400, 404].includes(res.status),
			`Unexpected status ${res.status}`
		);
	});

	// ── /Stores ─────────────────────────────────────────────────────────────

	void test('GET /Stores returns all 25 seeded stores', async () => {
		const res = await authFetch(ctx, '/Stores');
		strictEqual(res.status, 200);
		const body = (await res.json()) as { stores: any[]; count: number };
		ok(Array.isArray(body.stores), 'stores should be an array');
		strictEqual(body.count, 25, 'expected 25 stores');
		strictEqual(body.stores.length, 25);
		// Each store should have the required fields
		for (const s of body.stores) {
			ok(s.id, 'store should have id');
			ok(s.latitude != null, 'store should have latitude');
			ok(s.longitude != null, 'store should have longitude');
		}
	});

	// ── /Personas ────────────────────────────────────────────────────────────

	void test('GET /Personas returns the 5 seeded customer personas', async () => {
		const res = await authFetch(ctx, '/Personas');
		strictEqual(res.status, 200);
		const body = (await res.json()) as { personas: any[]; count: number };
		ok(Array.isArray(body.personas), 'personas should be an array');
		strictEqual(body.count, 5, 'expected 5 personas');
		const keys = body.personas.map((p: any) => p.personaKey).sort();
		deepStrictEqual(keys, [
			'coffee-regular',
			'family-weekend',
			'lapsed-heavy',
			'late-night',
			'newcomer',
		]);
	});

	// ── /Proximity ───────────────────────────────────────────────────────────

	void test('GET /Proximity?lat=&lon= at 16th St Mall returns nearby store', async () => {
		// Store-001 is at 39.7435, -104.9907 — query from exactly that point
		const res = await authFetch(
			ctx,
			'/Proximity?lat=39.7435&lon=-104.9907'
		);
		strictEqual(res.status, 200);
		const body = (await res.json()) as {
			customerCell: string;
			nearbyStores: any[];
			candidateCount: number;
		};
		ok(body.customerCell, 'should return a customerCell');
		ok(Array.isArray(body.nearbyStores), 'nearbyStores should be an array');
		ok(body.nearbyStores.length > 0, 'should find at least one nearby store');
		const store = body.nearbyStores[0];
		strictEqual(store.id, 'store-001');
		ok(store.distanceFeet != null, 'store should have distanceFeet');
		ok(store.distanceMeters <= 152.4, 'store should be within 500ft (~152m)');
	});

	void test('GET /Proximity in the middle of nowhere returns no nearby stores', async () => {
		// Middle of Denver's City Park lake — no stores within 500ft
		const res = await authFetch(
			ctx,
			'/Proximity?lat=39.7487&lon=-104.9492'
		);
		strictEqual(res.status, 200);
		const body = (await res.json()) as { nearbyStores: any[] };
		ok(Array.isArray(body.nearbyStores), 'nearbyStores should be an array');
		strictEqual(
			body.nearbyStores.length,
			0,
			'should find no stores in the middle of nowhere'
		);
	});

	void test('GET /Proximity without params returns error object', async () => {
		const res = await authFetch(ctx, '/Proximity');
		// The resource returns a 200 with an error body, or a 400 — either is fine
		const body = (await res.json()) as any;
		ok(
			res.status === 400 || (res.status === 200 && body.error),
			`expected error response, got status ${res.status}`
		);
	});

	// ── /Decide input validation ─────────────────────────────────────────────

	void test('POST /Decide with missing required fields returns error', async () => {
		const res = await authFetch(ctx, '/Decide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ lat: 39.74 }), // missing personaKey and lon
		});
		// Should respond without calling Anthropic — error body or 4xx
		ok(
			[200, 400, 422].includes(res.status),
			`expected client error or 200 with error body, got ${res.status}`
		);
		const body = (await res.json()) as any;
		ok(body.error, 'expected error field in response');
	});

	void test('POST /Decide far from any store returns no_store_nearby (no Anthropic call)', async () => {
		// Coordinates in the middle of the Denver reservoir — no stores within 500ft
		const res = await authFetch(ctx, '/Decide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				personaKey: 'coffee-regular',
				lat: 39.7487,
				lon: -104.9492,
				now: '2026-04-17T13:15:00Z',
			}),
		});
		strictEqual(res.status, 200);
		const body = (await res.json()) as { action: string };
		strictEqual(
			body.action,
			'no_store_nearby',
			`expected no_store_nearby, got ${body.action}`
		);
	});

	// ── Automatic CRUD via REST ──────────────────────────────────────────────

	void test('GET /Store/:id returns a seeded store', async () => {
		const res = await authFetch(ctx, '/Store/store-001');
		strictEqual(res.status, 200);
		const body = (await res.json()) as any;
		strictEqual(body.id, 'store-001');
		strictEqual(body.city, 'Denver');
		ok(body.h3Cell, 'store should have h3Cell set by seed');
	});

	void test('PUT + GET /Campaign round-trips a new campaign', async () => {
		const campaign = {
			id: 'test-camp-integration',
			name: 'Integration Test Campaign',
			enabled: true,
			headline: 'Test Headline',
			messageTemplate: 'Test message at {{storeName}}.',
			targetPersona: 'any',
			minVisitsLast30Days: 0,
			requiresLapsedDays: 0,
			timeWindow: 'any',
			offer: 'test_offer',
			notes: 'Created by integration test',
		};
		const putRes = await authFetch(ctx, `/Campaign/${campaign.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(campaign),
		});
		ok(
			[200, 201, 204].includes(putRes.status),
			`expected successful PUT, got ${putRes.status}`
		);

		const getRes = await authFetch(ctx, `/Campaign/${campaign.id}`);
		strictEqual(getRes.status, 200);
		const body = (await getRes.json()) as any;
		strictEqual(body.id, campaign.id);
		strictEqual(body.name, campaign.name);
		strictEqual(body.enabled, true);
	});

	void test('GET /Customer/:id returns a seeded customer', async () => {
		const res = await authFetch(ctx, '/Customer/cust-001');
		strictEqual(res.status, 200);
		const body = (await res.json()) as any;
		strictEqual(body.id, 'cust-001');
		strictEqual(body.personaKey, 'coffee-regular');
	});

	void test('GET /BusinessRule/:id returns a seeded rule', async () => {
		const res = await authFetch(
			ctx,
			'/BusinessRule/promo_cooldown_hours'
		);
		strictEqual(res.status, 200);
		const body = (await res.json()) as any;
		ok(body.params?.hours != null, 'rule should have params.hours');
		strictEqual(body.kind, 'hard');
	});
});

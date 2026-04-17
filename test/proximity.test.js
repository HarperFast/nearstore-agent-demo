import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latLngToCell, gridDisk } from 'h3-js';

// Copy of the haversine used in resources/Proximity.ts — kept in sync by hand.
const EARTH_RADIUS_METERS = 6371008.8;
function haversineMeters(lat1, lon1, lat2, lon2) {
	const toRad = (d) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

test('haversine: identical points → 0', () => {
	assert.strictEqual(haversineMeters(39.74, -104.99, 39.74, -104.99), 0);
});

test('haversine: Denver to Golden ~ 20km', () => {
	const d = haversineMeters(39.7392, -104.9903, 39.7475, -105.1961);
	assert.ok(d > 17000 && d < 19000, `expected ~17-19km, got ${d}`);
});

test('haversine: 500ft (~152m) threshold', () => {
	// Move ~0.0014 degrees of longitude at lat 39.74 ≈ 120m
	const d = haversineMeters(39.74, -104.99, 39.74, -104.9886);
	assert.ok(d > 100 && d < 140, `expected ~100-140m, got ${d}`);
});

test('H3 gridDisk(cell, 1) returns customer cell + 6 neighbors', () => {
	const cell = latLngToCell(39.7435, -104.9907, 9);
	const ring = gridDisk(cell, 1);
	assert.strictEqual(ring.length, 7);
	assert.ok(ring.includes(cell));
});

test('H3 resolution 9 stability', () => {
	// Two points ~10m apart → same cell at res 9
	const a = latLngToCell(39.7435, -104.9907, 9);
	const b = latLngToCell(39.7436, -104.9907, 9);
	assert.strictEqual(a, b);
});

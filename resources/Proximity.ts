/**
 * Proximity — H3-indexed nearest-store lookup.
 *
 * Strategy:
 *   1. Compute customer H3 cell at resolution 9 (~174m hex edge)
 *   2. Expand to gridDisk(cell, 1) — 7 candidate cells
 *   3. Query stores by h3Cell (indexed) for each candidate
 *   4. Filter by exact haversine distance <= PROXIMITY_METERS
 *
 * For 25 stores this is obviously overkill, but it's the same pattern
 * that scales to millions of rows. Inspired by kylebernhardy/geolookup.
 */

import { type RequestTargetOrId, Resource, tables } from 'harperdb';
import { gridDisk, latLngToCell } from 'h3-js';

export const H3_RES = 9;

/** 500 feet, in meters. */
export const PROXIMITY_METERS = 152.4;

const EARTH_RADIUS_METERS = 6371008.8;

export function haversineMeters(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NearbyStore {
	id: string;
	name: string;
	address: string;
	city: string;
	state: string;
	latitude: number;
	longitude: number;
	distanceMeters: number;
	distanceFeet: number;
}

export interface ProximityResult {
	customerCell: string;
	candidateCells: string[];
	candidateCount: number;
	nearbyStores: NearbyStore[];
}

export async function findNearbyStores(
	lat: number,
	lon: number,
	maxMeters: number = PROXIMITY_METERS
): Promise<ProximityResult> {
	const customerCell = latLngToCell(lat, lon, H3_RES);
	const candidateCells = gridDisk(customerCell, 1);

	const candidates: any[] = [];
	for (const cell of candidateCells) {
		for await (const store of (tables as any).Store.search({
			conditions: [
				{ attribute: 'h3Cell', comparator: 'equals', value: cell },
			],
			select: [
				'id',
				'name',
				'address',
				'city',
				'state',
				'latitude',
				'longitude',
			],
		})) {
			candidates.push(store);
		}
	}

	const nearbyStores: NearbyStore[] = candidates
		.map((s) => {
			const meters = haversineMeters(lat, lon, s.latitude, s.longitude);
			return {
				id: s.id,
				name: s.name,
				address: s.address,
				city: s.city,
				state: s.state,
				latitude: s.latitude,
				longitude: s.longitude,
				distanceMeters: Math.round(meters * 10) / 10,
				distanceFeet: Math.round(meters * 3.28084),
			};
		})
		.filter((s) => s.distanceMeters <= maxMeters)
		.sort((a, b) => a.distanceMeters - b.distanceMeters);

	return {
		customerCell,
		candidateCells,
		candidateCount: candidates.length,
		nearbyStores,
	};
}

/** GET /Proximity?lat=39.75&lon=-104.99 */
export class Proximity extends Resource {
	allowRead() {
		return true;
	}

	async get(target?: RequestTargetOrId) {
		if (!target || typeof target === 'string') {
			return { error: 'Provide ?lat=...&lon=... query parameters' };
		}
		const lat = parseFloat(target.get?.('lat') as string);
		const lon = parseFloat(target.get?.('lon') as string);
		if (isNaN(lat) || isNaN(lon)) {
			return { error: 'lat and lon are required numeric parameters' };
		}
		return findNearbyStores(lat, lon);
	}
}

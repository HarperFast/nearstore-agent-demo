/**
 * Stores — lightweight listing for the simulator map.
 */

import { Resource, tables } from 'harperdb';

export class Stores extends Resource {
	allowRead() {
		return true;
	}

	async get() {
		const stores: any[] = [];
		for await (const store of (tables as any).Store.search({
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
			stores.push(store);
		}
		return { stores, count: stores.length };
	}
}

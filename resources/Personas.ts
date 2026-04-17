/**
 * Personas — summary of seeded customers for the simulator dropdown.
 */

import { Resource, tables } from 'harperdb';

export class Personas extends Resource {
	allowRead() {
		return true;
	}

	async get() {
		const personas: any[] = [];
		for await (const c of (tables as any).Customer.search({
			select: [
				'id',
				'personaKey',
				'name',
				'signupDate',
				'lastOrderAt',
				'totalOrders',
				'totalSpend',
				'notes',
			],
		})) {
			personas.push(c);
		}
		personas.sort((a, b) => a.personaKey.localeCompare(b.personaKey));
		return { personas, count: personas.length };
	}
}

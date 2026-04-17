/**
 * Serves the simulator UI at GET /simulator (alias for /index.html).
 * Lowercase class name → lowercase URL path.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type RequestTargetOrId, Resource } from 'harperdb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, '..', 'web', 'index.html');

export class simulator extends Resource {
	allowRead() {
		return true;
	}

	async get(_target?: RequestTargetOrId) {
		const html = await fs.readFile(HTML_PATH, 'utf8');
		return new Response(html, {
			status: 200,
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	}
}

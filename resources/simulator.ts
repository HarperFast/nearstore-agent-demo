/**
 * Serves the simulator UI at GET /simulator (alias for /index.html).
 * Lowercase class name → lowercase URL path.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resource } from 'harper';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, '..', 'web', 'index.html');

export class simulator extends Resource {
	static async get() {
		const html = await fs.readFile(HTML_PATH, 'utf8');
		// v5 turns any returned object carrying a `headers` property into the response
		// envelope, so no Response global is needed here.
		return {
			status: 200,
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
			body: html,
		};
	}
}

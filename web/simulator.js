const API = window.location.origin;

// Denver metro center
const CENTER = [39.74, -104.99];
const ZOOM = 10;
const GEOFENCE_METERS = 152.4; // 500 ft

const map = L.map('map', { zoomControl: true }).setView(CENTER, ZOOM);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '&copy; OpenStreetMap',
	maxZoom: 18,
}).addTo(map);

const storeIcon = L.divIcon({
	className: 'store-marker',
	html: `<svg width="22" height="30" viewBox="0 0 22 30"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.9 17.1 0 11 0z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1.5"/><circle cx="11" cy="10" r="4.5" fill="#fbbf24"/></svg>`,
	iconSize: [22, 30],
	iconAnchor: [11, 30],
});

const customerIcon = L.divIcon({
	className: 'customer-pin',
	html: '<div class="pulse"></div>',
	iconSize: [16, 16],
	iconAnchor: [8, 8],
});

let customerMarker = null;
let stores = [];
let personas = [];
let selectedPersona = null;

async function loadStores() {
	const res = await fetch(`${API}/Stores`);
	const data = await res.json();
	stores = data.stores;
	for (const s of stores) {
		const m = L.marker([s.latitude, s.longitude], { icon: storeIcon }).addTo(
			map
		);
		m.bindPopup(`<strong>${s.name}</strong><br>${s.address}`);
		L.circle([s.latitude, s.longitude], {
			radius: GEOFENCE_METERS,
			color: '#dc2626',
			weight: 1,
			opacity: 0.35,
			fillColor: '#dc2626',
			fillOpacity: 0.08,
			interactive: false,
		}).addTo(map);
	}
}

async function loadPersonas() {
	const res = await fetch(`${API}/Personas`);
	const data = await res.json();
	personas = data.personas;
	const sel = document.getElementById('persona');
	sel.innerHTML = '';
	for (const p of personas) {
		const opt = document.createElement('option');
		opt.value = p.personaKey;
		opt.textContent = `${p.name} (${p.personaKey})`;
		sel.appendChild(opt);
	}
	sel.addEventListener('change', () => selectPersona(sel.value));
	selectPersona(personas[0].personaKey);
}

function selectPersona(key) {
	selectedPersona = personas.find((p) => p.personaKey === key);
	const el = document.getElementById('persona-summary');
	if (!selectedPersona) return;
	el.innerHTML = `
		<div>${escapeHtml(selectedPersona.notes)}</div>
		<div style="margin-top:6px; font-size:12px; color:#64748b;">
			${selectedPersona.totalOrders} orders · $${(selectedPersona.totalSpend || 0).toFixed(2)} spend ·
			last order: ${
				selectedPersona.lastOrderAt
					? new Date(selectedPersona.lastOrderAt).toLocaleDateString()
					: 'never'
			}
		</div>
	`;
}

map.on('click', async (e) => {
	const { lat, lng } = e.latlng;
	if (customerMarker) map.removeLayer(customerMarker);
	customerMarker = L.marker([lat, lng], {
		icon: customerIcon,
		zIndexOffset: 1000,
	}).addTo(map);
	await requestDecision(lat, lng);
});

async function requestDecision(lat, lon) {
	const result = document.getElementById('result');
	result.innerHTML = `<div class="muted"><span class="spinner"></span>Claude is deciding…</div>`;

	if (!selectedPersona) {
		result.innerHTML = `<div class="muted">Pick a persona first.</div>`;
		return;
	}

	const start = performance.now();
	let data;
	try {
		const res = await fetch(`${API}/Decide`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				personaKey: selectedPersona.personaKey,
				lat,
				lon,
			}),
		});
		data = await res.json();
	} catch (err) {
		result.innerHTML = `<div class="action-banner error">Network error: ${escapeHtml(err.message)}</div>`;
		return;
	}
	const clientMs = Math.round(performance.now() - start);
	renderResult(data, clientMs);
}

function renderResult(data, clientMs) {
	const result = document.getElementById('result');
	const action = data.action;

	let banner = '';
	if (action === 'send_promo') {
		banner = `<div class="action-banner send">✅ Send — ${escapeHtml(data.decision?.campaign_id || '')}</div>`;
	} else if (action === 'hold') {
		banner = `<div class="action-banner hold">⏸️ Hold — agent decided not to send</div>`;
	} else if (action === 'no_store_nearby') {
		banner = `<div class="action-banner nostore">📍 No McDonald's within 500 ft</div>`;
	} else if (action === 'blocked_cooldown') {
		banner = `<div class="action-banner blocked">🚫 Blocked by cooldown rule</div>`;
	} else if (action === 'blocked_quiet_hours') {
		banner = `<div class="action-banner blocked">🌙 Blocked by quiet hours rule</div>`;
	} else if (action === 'error') {
		banner = `<div class="action-banner error">⚠️ ${escapeHtml(data.error || 'error')}</div>`;
	} else {
		banner = `<div class="action-banner">${escapeHtml(action || 'unknown')}</div>`;
	}

	let html = banner;

	if (data.store) {
		html += `<div class="card">
			<h3>Store</h3>
			<div class="val"><strong>${escapeHtml(data.store.name)}</strong><br>
				${escapeHtml(data.store.address)}, ${escapeHtml(data.store.city)}, ${escapeHtml(data.store.state)}<br>
				<span class="muted">${data.store.distanceFeet} ft away</span>
			</div>
		</div>`;
	}

	if (data.decision?.message && action === 'send_promo') {
		html += `<div class="push">
			<div class="push-label">Push notification</div>
			${escapeHtml(data.decision.message)}
		</div>`;
	}

	if (data.decision?.reasoning) {
		html += `<div class="card">
			<h3>Agent reasoning</h3>
			<div class="val">${escapeHtml(data.decision.reasoning)}</div>
		</div>`;
	}

	if (data.context) {
		const c = data.context.customerSummary;
		html += `<div class="card">
			<h3>Context passed to agent</h3>
			<div class="val">
				persona: <code>${escapeHtml(c.personaKey)}</code><br>
				orders (30d / 90d): ${c.ordersLast30d} / ${c.ordersLast90d}<br>
				days since last order: ${c.daysSinceLastOrder ?? '—'}<br>
				soft rules passed: ${(data.context.softRulesPassed || []).join(', ') || '—'}
			</div>
		</div>`;
	}

	if (data.timing) {
		html += `<div class="timing-row">
			<span>agent: ${data.timing.agentMs ?? '—'} ms</span>
			<span>total: ${data.timing.totalMs} ms</span>
			<span>roundtrip: ${clientMs} ms</span>
		</div>`;
	}

	result.innerHTML = html;
}

function escapeHtml(s) {
	if (s == null) return '';
	return String(s).replace(/[&<>"']/g, (c) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}[c]));
}

// Init
Promise.all([loadStores(), loadPersonas()]);

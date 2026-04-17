# nearstore-agent

A [Harper](https://harperdb.io) reference app that turns a customer's GPS ping
into a personalized promo decision made by an agent — reasoning over the
customer's profile, order history, and active campaigns in a single Harper
runtime.

**The scenario (fictional):** a McDonald's mobile app. The simulator lets you
drop a pin on a Denver-metro map, pick from five hand-crafted customer
personas, and watch Claude Haiku 4.5 decide what to send — or not — based on
who the customer is and where they just walked.

## Why this demo

Everything the agent reasons over — customer, orders, campaigns, business rules
— lives in Harper tables. One HTTP request does all of the following in a
single process:

1. Finds nearby stores (H3 ring search → haversine filter at 500ft)
2. Loads the customer, 90‑day order history, enabled campaigns, and business
   rules from Harper via indexed reads
3. Enforces hard rules (cooldown, quiet hours) in code
4. Hands the rest to Claude Haiku with a forced tool call for structured output
5. Returns a decision: `send_promo` / `hold` / `blocked_*` / `no_store_nearby`

No service mesh, no cache tier, no external geofence provider — just Harper
plus a small amount of JavaScript.

Inspired by Kyle Bernhardy's [`geolookup`](https://github.com/kylebernhardy/geolookup)
— the same H3-indexed spatial pattern, adapted for a 500ft geofence instead of
reverse-geocoding.

## Run it in three commands

Requires Node 22+ and the Harper CLI installed globally (`npm install -g harperdb`).

```sh
# 1. install deps and set your Anthropic key
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

npm install

# 2. start Harper in dev mode (hot reload on .ts edits)
npm run dev

# 3. seed data (in a second terminal)
npm run seed

# open http://localhost:9926/ or http://localhost:9926/simulator
```

Get an Anthropic API key at <https://console.anthropic.com/settings/keys>.

## What you'll see

The simulator shows a dark map of Denver metro with 25 red McDonald's pins. Each
pin has a faint 500ft geofence ring. Pick a persona from the dropdown, click
anywhere on the map, and watch the right panel:

- **Outside a geofence** → "No McDonald's within 500 ft" (no agent call, ~5ms)
- **Inside a geofence** → spinner, then the agent's decision: action banner,
  the candidate store, the push copy it wrote (or nothing, if it held), its
  reasoning, and timing

Click the same spot with different personas and you get different decisions.
That's the point.

## The five personas

| Key | Story | Typical decision |
|---|---|---|
| `coffee-regular` | Marcus — weekday 7:15am, coffee + Egg McMuffin, 5x/week | Free coffee at his loyalty store in the morning |
| `family-weekend` | Elena — Sat/Sun dinners, 4 value meals, $40+ orders | Family bundle on weekends; hold otherwise |
| `late-night` | Jordan — 22:00–02:00 only, McFlurry + DQP, erratic | $1 McFlurry after 10pm; hold at 9am |
| `lapsed-heavy` | Sam — was 30+/month, zero orders in 180+ days | 20% win-back |
| `newcomer` | Alex — signed up 2 days ago, no orders | 15% off first order |

## Business rules as data (not code)

Rules live as rows in the `BusinessRule` table. Flip one via REST and the next
decision reflects it — no redeploy:

```sh
# Turn on quiet hours (22:00–07:00)
curl -X PATCH http://localhost:9926/BusinessRule/quiet_hours \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n HDB_ADMIN:password | base64)" \
  -d '{"enabled": true}'

# Add a new campaign (agent will consider it on next request)
curl -X PUT http://localhost:9926/Campaign/camp-hot-day-shake \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n HDB_ADMIN:password | base64)" \
  -d '{"id":"camp-hot-day-shake","name":"Hot Day Shake",
       "enabled":true,"headline":"$2 shakes, today only",
       "messageTemplate":"Hot? $2 shakes at {{storeName}} until 6pm.",
       "offer":"2_dollar_shake","timeWindow":"afternoon"}'
```

Hard rules (`kind: "hard"`) are enforced in code and short-circuit before the
agent runs — cheaper, and more testable than relying on the model. Soft rules
(`kind: "soft"`) are passed as context and the agent weighs them.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` or `/simulator` | Simulator UI |
| `GET` | `/Stores` | All 25 stores for the map |
| `GET` | `/Personas` | Seeded customer summaries |
| `GET` | `/Proximity?lat=&lon=` | H3 ring → haversine filter (debug aid) |
| `POST` | `/Decide` | The main agent endpoint |
| `GET`/`PUT`/`PATCH`/`DELETE` | `/Store/...`, `/Customer/...`, `/Order/...`, `/Campaign/...`, `/BusinessRule/...` | Automatic CRUD (requires Basic auth) |

Example `/Decide` call:

```sh
curl -X POST http://localhost:9926/Decide \
  -H "Content-Type: application/json" \
  -d '{
    "personaKey": "coffee-regular",
    "lat": 39.7400,
    "lon": -104.9467
  }'
```

Response shape:

```json
{
  "action": "send_promo",
  "store": { "id": "store-003", "name": "...", "distanceFeet": 0, ... },
  "decision": {
    "should_send": true,
    "campaign_id": "camp-loyalty-free-coffee",
    "message": "Your regular is on us this morning at E Colfax. Tap to redeem.",
    "reasoning": "Marcus is a perfect match for the Loyalty Free Coffee..."
  },
  "context": { "hardRulesEnforced": [...], "softRulesPassed": [...], ... },
  "timing": { "totalMs": 2487, "agentMs": 2461, "model": "claude-haiku-4-5" }
}
```

Pass `"now": "2026-04-17T13:15:00Z"` in the body to override current time for
reproducible demos.

## Performance notes

- H3 ring search at resolution 9 (~174m hex edge) narrows 25 stores down to
  0–2 candidates per request. This is the same pattern that scales to millions
  of rows — it's overkill for 25.
- End-to-end latency is dominated by the Claude API call: expect **2–4s**. The
  first cold call can be slower (~5s). Non-agent paths (no store nearby,
  cooldown blocked) return in <10ms.
- Model is configurable via `ANTHROPIC_MODEL`; defaults to `claude-haiku-4-5`.

## Project layout

```
schemas/*.graphql       — Store, Customer, Order, Campaign, BusinessRule
data/*.json             — seed data (stores, personas with patterns, campaigns, rules)
scripts/seed.js         — expands persona patterns into orders, writes to Harper
resources/
  Proximity.ts          — H3 + haversine helpers + GET /Proximity endpoint
  Stores.ts             — GET /Stores
  Personas.ts           — GET /Personas
  Decide.ts             — POST /Decide (the agent)
  simulator.ts          — GET /simulator (alias for /index.html)
web/
  index.html            — simulator UI
  simulator.js          — Leaflet map + fetch + render
  simulator.css         — dark theme
```

## Re-seeding

`npm run seed` is idempotent — it PUTs by id, so rerunning overwrites cleanly.
"Now" in the seed script is pinned to `2026-04-17T12:00:00Z` so the same data
seeds the same orders every time.

## Deploy to Harper Fabric

Set your cluster credentials in `.env` (`CLI_TARGET*`), then:

```sh
npm run deploy
```

The Anthropic key needs to be set on the cluster too — see the Harper Fabric
docs for setting environment variables.

## Credits

- H3‑based spatial pattern: inspired by Kyle Bernhardy's
  [`geolookup`](https://github.com/kylebernhardy/geolookup).
- Harper conventions in `.agents/skills/harper-best-practices/` — from
  `npm create harper@latest`.
- Map tiles: [OpenStreetMap](https://www.openstreetmap.org/). Map library:
  [Leaflet](https://leafletjs.com/).
- Spatial index: [H3](https://h3geo.org/) by Uber.
- Agent: [Claude Haiku 4.5](https://www.anthropic.com/claude/haiku) via
  [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript).

Store addresses are real street addresses for Denver‑metro McDonald's; lat/lon
and "store IDs" are demo approximations. This is a fictional app, not
affiliated with McDonald's Corporation.

## License

[Apache License 2.0](./LICENSE) — © 2026 HarperDB, Inc.

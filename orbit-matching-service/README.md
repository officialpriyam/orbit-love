# Orbit matching service

Independent Python service for Orbit, developed by priyx. No Next.js dependency or shared Python imports from the web app.

## Responsibilities

- Poll durable Neon matching jobs; Upstash notifications accelerate discovery.
- Claim jobs with expiring ownership leases, heartbeats, and bounded retries.
- Filter mutual age, gender, intention, and city preferences. Orientation labels do not determine eligibility.
- Rank categorical survey similarity, with higher weights for communication, values, and expectations.
- Keep a bounded candidate shortlist per participant, then select up to three symmetric recommendations. This greedy strategy is deterministic, not a globally optimal assignment or a prediction of romantic success. Pair comparisons are quadratic; the candidate edge storage is bounded to avoid a quadratic memory blow-up.
- Generate local explanations, optionally enhanced through OpenRouter with model `openrouter/free` when both people explicitly opt in. Eligibility and scores remain deterministic.
- Save results atomically, leaving publication to the Next.js admin.
- Deliver notifications from a durable outbox using stable provider idempotency keys and exponential retry delays.

## Run

```sh
python -m venv .venv
# Activate the environment, then:
pip install -r requirements.txt
# Copy .env.example to .env and configure it.
uvicorn matching.main:app --host 127.0.0.1 --port 8001
```

For a worker without HTTP: `python -m matching.worker`. For one processing pass: `python -m matching.worker --once`.

Initialize the database from the Next.js project with `npm run db:init` before starting this service. Both services must point to the same Neon database and Upstash instance. Local defaults use `../orbit/.local/orbit.db`. Only Next.js owns the schema migrations.

`GET /health` reports process health. `GET /v1/status` requires `Authorization: Bearer <SERVICE_TOKEN>` and reports queue counts and provider configuration. Run one Uvicorn process per container; horizontal replicas coordinate via database leases.

## Privacy and resilience

No passwords or sessions are read. Matching reads profiles and submitted answers. Optional AI explanations send only fixed coarse shared themes to OpenRouter and its routed provider, never profiles, raw answers or identifiers. Historical consent fields do not enable this feature. Requests deny provider data collection, but retention policies vary. Logs omit profiles, provider payloads and credentials. Invalid responses and unavailable providers fall back locally.

## Separate environment files

Copy this folder’s `.env.example` to `.env` only when setting up a fresh installation; do not overwrite existing credentials. The Next.js app has its own `.env.example` and `.env.local`. Use the same database and Redis instance in both; keep `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=openrouter/free`, `SERVICE_TOKEN` and email credentials in Python only. Restart Python after editing its environment. A blank OpenRouter key disables external inference. The free router dynamically selects available models; availability and rate limits vary. A live inference check requires your own API key.

Round location settings are owned by the Next.js admin API and read by the worker. Disabled fields are ignored. Cross-country matching requires the round switch and both participant preferences. City matching, when enabled, separately requires a shared city or both participants’ any-city preference.

Missing email credentials leave the outbox pending. Failed deliveries retry up to five attempts; admins can explicitly retry failed items. Resend idempotency helps avoid duplicate delivery after a crash, but retries outside the provider's idempotency retention window can still duplicate a notification. Account deletion during an already-started email request cannot recall that message.

## Tests

`python -m pytest tests -q` tests eligibility, symmetry, match caps, deterministic scores, privacy boundaries, and local explanation grounding. The Next.js integration suite invokes this actual worker against an isolated database.

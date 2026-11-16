# Orbit — developed by priyx

A TypeScript Next.js application for personality-first matching rounds. The Python matching service lives in the **separate sibling directory** [`../orbit-matching-service`](../orbit-matching-service/README.md), with its own runtime, dependencies, environment, Dockerfile, API, and worker.

## What is implemented

- Responsive liquid-glass landing page with animated WebGL pearl rings and reduced-motion support.
- Account registration, login, hashed passwords, HttpOnly sessions, logout, and account deletion.
- Inclusive identity and explicit mutual gender/age/location/intention preferences.
- All 40 supplied survey questions, saved drafts, review, and submission.
- Admin schedules, close/reopen controls, durable matching jobs, result publication, email retries, and new rounds.
- Private results with shared-answer scores, explanations, and conversation starters.
- Neon Postgres and Upstash Redis integration. SQLite and in-memory throttling are explicit local-development fallbacks.

## Run locally

Requires Node 24 and Python 3.13+.

```powershell
cd D:\testcodex\orbit
npm ci
Copy-Item .env.example .env.local
npm run db:init
npm run admin:create
npm run dev
```

Open **http://localhost:3000**. Admin creation prompts for credentials; no default admin password exists. Log in with that account and use `/#admin`.

On Windows, `start-nextjs.cmd` starts the web app in Command Prompt. The sibling service's `start-microservice.cmd` starts Python independently in another window. Private connection settings live in `.env.local` and the service's `.env`; both are excluded from Git. The existing `.local/` database is retained as a backup when using Neon; its accounts are not automatically copied to Neon.

Start the matching service in a second terminal:

```powershell
cd D:\testcodex\orbit-matching-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn matching.main:app --host 127.0.0.1 --port 8001
```

The default worker database path points to the sibling app's `.local/orbit.db`. A worker must be running for queued jobs and email notifications to progress. Health checks: Next.js `/api/health`, Python `/health`.

## Production

Deploy the Next.js app to a Node-compatible host (or its Dockerfile). Deploy the Python folder as a separate persistent container/service. **Sites static hosting is used only for the labelled interactive preview; it cannot run this Node + Python backend.**

Set `APP_ENV=production`, a common Neon `DATABASE_URL`, and the same `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` on both services. On Next.js, configure exact HTTPS origins or use automatic Vercel deployment origins as described below. The Python service additionally needs a random `SERVICE_TOKEN` for its protected status endpoint. Keep the Python port private apart from health monitoring.

Run `npm run db:init` with deployment credentials, then create the admin out of band. Do not put credentials in source control or `NEXT_PUBLIC_*` variables. Neon connection strings must include TLS settings, such as `sslmode=require`. Configure trusted proxy rate limiting at your ingress in addition to application throttling.

For email delivery, configure `RESEND_API_KEY`, a verified-domain `EMAIL_FROM`, and `APP_URL` on Python; then set `EMAIL_DELIVERY_CONFIGURED=true` on Next.js. Without email credentials, notifications remain pending and are **never falsely marked sent**.

Orbit’s Python engine determines eligibility and scores locally. Optional OpenRouter explanations use `openrouter/free` only when both people opt in and the Python service has an API key; otherwise local templates are used. AI wording never changes scores or eligibility. Dark mode follows your system initially and remembers your choice through the navigation toggle.

## Verify

### Vercel (Next.js only)

For a repository containing both folders, set **Settings → Build and Deployment → Root Directory** to `orbit`, and disable **Include files outside the root directory in the Build Step**. Root Directory is a Vercel project setting, not a supported `vercel.json` property. If the repository itself contains only the contents of `orbit`, leave Root Directory as `.` instead.

`orbit/vercel.json` selects Next.js, installs with `npm ci`, and builds with `npm run build`. The `.vercelignore` files exclude local secrets and development artifacts from CLI uploads; the workspace-level file also excludes the Python service. No Python worker is started by the Vercel build.

Configure the Next.js variables from `.env.example` in Vercel, using `APP_ENV=production` plus Neon and Upstash credentials. Do not copy localhost `APP_URL` or `ALLOWED_ORIGINS` values to Vercel. Leave those two variables unset to use Vercel system URLs, or set exact HTTPS custom domains. Keep OpenRouter and email provider keys on the separately hosted Python service. That service must remain running against the same Neon and Upstash instances for matching and notifications to progress. Set its `APP_URL` to the deployed web URL as well. Initialize the schema using `npm run db:init` with the target database configured before starting the worker.

See [Vercel Root Directory settings](https://vercel.com/docs/builds/configure-a-build#root-directory). These files prepare deployment; they do not publish the app or change your Vercel project settings.

```powershell
npm run typecheck
npm run build
# For the integration test, point to an interpreter with service dependencies:
$env:TEST_PYTHON='D:\testcodex\orbit-matching-service\.venv\Scripts\python.exe'
npm test
cd ..\orbit-matching-service
.\.venv\Scripts\python.exe -m pytest tests -q
```

The integration test covers registration, authorization, CSRF origin rejection, age validation, complete submission, survey closure, the actual separate Python worker, private publication, email queueing, deletion, logout, and a new round. Tests use an isolated temporary database and send no emails.

## Preview and current limits

`npm run build:preview` exports a clearly labelled fictional demo to `dist/`, without changing the real app's API routes. Demo controls never send email or create real accounts.

Neon and Upstash are configured in private environment files. Email delivery still requires a verified sender and provider credentials. Matching stays local; optional explanations send only coarse shared themes to OpenRouter. Add `OPENROUTER_API_KEY` only to the Python service’s `.env`. Each service has its own `.env.example`; never copy Python secrets into browser variables. Isolated browser checks verify desktop/mobile theme switching, saved preferences, and CSP-enabled hydration. The current product provides match discovery, not messaging or contact exchange. Email verification, password recovery, moderation/reporting workflows, and an independently reviewed privacy policy are future production-hardening work. The greedy matcher supports up to 3,000 submitted participants per round by default; larger pools need partitioning or approximate candidate search.

Implementation references: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [Neon Python](https://neon.com/docs/guides/python), [Upstash REST](https://upstash.com/docs/redis/features/restapi), [FastAPI containers](https://fastapi.tiangolo.com/deployment/docker/).

Admin location controls at `/#admin` independently enable country and city sections. The outside-country switch requires country to be enabled and both participants to opt in. Settings lock after generation starts and carry over to the next round. New required location fields must be completed before generation.

## How Next.js connects to Python

The browser calls only the Next.js `/api` endpoints on its own origin. When an admin generates results, Next.js inserts a durable job into Neon and sends an Upstash wake-up notification. The independent Python worker polls the same database, claims the job, generates matches, and writes results back to Neon. Next.js reads them for the dashboard. Publication queues email work in Neon for Python. Redis accelerates discovery; Neon remains the durable queue. No `PYTHON_API_URL` or browser CORS configuration is required. The Python `/v1/status` endpoint is for authenticated operations, not browser access.

Both services need the same `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. Python must stay running on a persistent host even when Next.js runs on Vercel. Its `APP_URL` must be the public HTTPS website URL so email links open the deployed dashboard. OpenRouter and email provider keys remain only on Python.

On Vercel, enable automatic System Environment Variables. The app accepts exact HTTPS origins from `VERCEL_URL` and `VERCEL_BRANCH_URL`; production also accepts `VERCEL_PROJECT_PRODUCTION_URL`. Additional domains go in comma-separated `ALLOWED_ORIGINS`, and `APP_URL` is also included. No wildcard Vercel domains or request Host headers are trusted. Vercel deployments always use secure cookies and production database checks, even if `APP_ENV` is accidentally set to development. Localhost configuration remains local only. Redeploy after changing environment variables. Use separate database and Redis instances for preview environments if they should not access production participants.

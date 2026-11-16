# Orbit security implementation and limits

## Implemented controls

- Passwords use independent random salts and scrypt. Only hashes are persisted.
- Session tokens use 48 random bytes; only SHA-256 token digests are stored. Cookies are HttpOnly and SameSite=Strict, with Secure in production. Admin sessions expire after one hour; normal sessions expire after seven days.
- Every mutation requires an allowed Origin and application/json. Cross-site Fetch Metadata is rejected. Production requires explicit HTTPS origins, database TLS, and HTTPS Redis configuration.
- JSON bodies are streamed with a 24 KB byte limit; schemas reject unknown properties. SQL uses parameterized queries and critical round changes use transactions/locks.
- Upstash-backed account authentication throttling, a global authentication budget, per-user write limits, and a stricter account-deletion budget. Account deletion requires the current password.
- Server-side ownership and admin authorization; raw answers and contact data are excluded from match results. No-store responses protect private API data from browser/shared caching.
- A per-request CSP nonce protects scripts in the live Next.js app. CSP blocks framing, plugins, external script sources, and foreign form destinations. Additional headers include nosniff, CORP, COOP, referrer limits, permissions restrictions, and production HSTS.
- Matching remains deterministic. Optional OpenRouter explanations require a newly recorded opt-in from both people and a Python-only API key. Only fixed coarse shared themes leave the worker, never identifiers, profiles or raw answers. Requests deny provider data collection; provider retention policies still vary. Responses are bounded and validated, with local fallback. AI wording is not guaranteed to be factual; it never changes eligibility or scores.
- Python status requires a service token; production disables API schema/docs. Durable jobs use leases and fencing tokens, and email delivery uses provider idempotency keys.

## Boundaries and work before a public launch

These controls are not a certification or a guarantee of complete security. The app is currently a local development deployment. Run the production build behind HTTPS with `APP_ENV=production`, a private worker network, restricted database roles, and ingress-level IP/bot throttling. In-memory local-development limits are not suitable for production.

Email address verification, password recovery, admin MFA, reporting/blocking/moderation, operational monitoring, recovery drills, and an independent penetration test remain production-hardening work. Global authentication throttling is a conservative resource guard and can itself be exhausted; add per-client limits at a trusted ingress without trusting arbitrary forwarded headers.

Rotate the database and Redis credentials supplied in chat before public deployment. Never log them or commit `.env.local`/`.env`. Use a secret manager, least-privilege roles, and a rotation procedure. Existing profile/answer rows are protected by database transport/access controls but are not application-level encrypted; deploy database access policies and appropriate retention controls.

CSP permits inline styles for the existing React style attributes and Google Fonts for typography. It does not permit arbitrary inline scripts in the live app. Development enables unsafe-eval for Next.js tooling; production does not. The optional exported fictional preview lacks the server-side nonce policy and must not host live accounts.

## Checks

The current revision passed the production build, strict TypeScript checks, five Node integration/security tests, and eleven Python tests. Isolated headless-browser checks cover persisted light/dark preferences, the inspiration credit, mobile overflow, and CSP-enabled hydration. npm production-dependency and installed Python dependency audits reported no known vulnerabilities on 16 November 2026; this is a point-in-time result, not an ongoing guarantee.

Run `npm run typecheck`, `npm test`, `npm run build`, and the Python tests. Run `npm audit --omit=dev` and `python -m pip_audit -r requirements.txt` before release. Review findings rather than assuming a clean dependency audit proves application security.

References: [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) and the installed Next.js CSP guide in `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`.

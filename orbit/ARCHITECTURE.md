# Orbit · developed by priyx

## Two independent applications

- `orbit/`: TypeScript Next.js App Router frontend and backend. Owns identity, sessions, profile editing, surveys, round administration, and private results.
- `../orbit-matching-service/`: independent Python service. Owns compatibility inference, private deterministic explanations, durable job execution, and email delivery.

## Next.js source boundaries

```
src/
  app/                         Next.js pages, layouts, and HTTP route entrypoints
  features/orbit/
    components/                React experience and WebGL artwork
    types.ts                   Explicit application contracts
  server/
    api.ts                     Authenticated application operations
    db.ts                      Parameterized database transactions
    security.ts                Passwords, sessions, CSRF origin checks, throttling
    validation.ts              Zod request validation
public/questions.json          The original 40-question survey
scripts/                       Database and admin management
tests/                         Application verification
```

Neon is the durable system of record. Upstash provides shared rate limits and matching job notifications. Python must never receive user passwords or sessions. Browser requests terminate at Next.js; the matching worker is not a public browser API.

## Verification and deployment

Strict TypeScript validation and the Next.js production build pass. The integration test runs the separate Python worker against an isolated database and verifies registration through private results and deletion. Python tests cover eligibility, scoring, privacy, and grounded local explanations.

The Next.js app and Python worker each have an independent Dockerfile. Deploy both with the same Neon/Upstash configuration. Static Sites publication is only a labelled fictional preview; live backend deployment requires Node and Python hosting plus credentials. See each application's README for setup and limitations.

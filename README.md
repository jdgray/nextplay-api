# NextPlay API

Serverless soccer team analytics API: AWS Lambda + API Gateway (HTTP API),
Cognito auth, Postgres (Aurora Serverless v2 behind RDS Proxy in production,
docker-compose Postgres locally), Prisma for schema/migrations, and an import
script that loads a team's game-tracking workbook (player minutes,
goals/assists, defensive events, corner kicks) into the database.

## Stack

- Node.js + TypeScript (Lambda runtime pinned to `nodejs18.x` — see the note
  in `serverless.yml`: `serverless-offline` v13+ requires Serverless Framework
  v4, and v12, the last version compatible with the Framework v3 used here,
  only emulates up through `nodejs18.x`. Bump to `nodejs20.x`+ once the
  project moves to Framework v4 / `serverless-offline` v14.)
- Serverless Framework (`serverless-esbuild`, `serverless-offline`)
- Prisma + PostgreSQL
- AWS Cognito (user pool, JWT authorizer on API Gateway)
- zod for request validation, `@asteasolutions/zod-to-openapi` to generate
  `docs/openapi.yaml` from those same schemas

## Local setup

```bash
npm install
cp .env.example .env        # already points at the docker-compose DB on port 5433
docker compose up -d        # local Postgres (port 5433 — see note below)
npm run prisma:migrate      # applies prisma/migrations/, generates the client
npm run offline             # serverless-offline on http://localhost:3000
```

> Local Postgres runs on **5433**, not 5432 — this avoids colliding with any
> Postgres already running on your machine. If you don't have a conflicting
> local Postgres, you can change the port back to 5432 in both
> `docker-compose.yml` and `.env`.

Auth handlers (`/auth/*`) call real AWS Cognito APIs — they need
`COGNITO_USER_POOL_ID` / `COGNITO_USER_POOL_CLIENT_ID` set, which only exist
once you've deployed the `serverless.yml` Cognito resources to an AWS account
(see "Deploying" below). Non-auth endpoints only need the local Postgres
connection and can be exercised without touching AWS at all.

### Testing protected endpoints locally (no Cognito deployed)

The Cognito JWT authorizer's `issuerUrl` is a CloudFormation `!Sub` that only
resolves once the User Pool is actually deployed, so `serverless-offline`
can't validate real tokens against it locally. Run offline with `--noAuth` to
bypass the authorizer gate — `serverless-offline` still decodes any `Bearer`
JWT you send and populates `event.requestContext.authorizer.jwt.claims` from
it (no signature check), so handlers exercise their normal `requireUser` /
`assertHasRole` code paths against real Postgres data:

```bash
npm run offline -- --noAuth
```

Seed a local `User` (e.g. via `prisma:studio` or a one-off script) with a
`cognitoSub`, then craft a matching unsigned JWT:

```bash
python3 -c "
import base64, json
def b64url(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b'=').decode()
print(f\"{b64url({'alg':'none','typ':'JWT'})}.{b64url({'sub':'<cognitoSub>','email':'<email>'})}.sig\")
"
curl http://localhost:3000/auth/me -H "Authorization: Bearer <token from above>"
```

`--noAuth` only affects the local emulator — deployed endpoints still enforce
the real Cognito JWT authorizer.

## Database migrations

Schema changes go through Prisma, not hand-written SQL, except for the one
CHECK constraint Prisma can't express (see
`prisma/migrations/20260729231059_init/migration.sql`, which enforces that a
`UserRole` is scoped to exactly one of `organizationId`/`teamId`).

```bash
npm run prisma:migrate         # create + apply a migration locally
npm run prisma:migrate:deploy  # apply pending migrations (run in CI/deploy, not locally)
npm run prisma:studio          # browse the local DB
```

### Applying migrations against the deployed Aurora cluster

Aurora sits in a private VPC, so nothing outside it (your laptop, CI) can run
`prisma migrate deploy` directly. Rather than fight the well-known pain of
bundling Prisma's schema-engine binary for Linux inside a Lambda (cross-
platform native binaries, not reliably fetched via `binaryTargets` when
`prisma generate` runs on a Mac/Windows dev machine), there's a `dbMigrate`
Lambda (`src/handlers/admin/migrate.ts`, wired in `serverless.yml`) that
applies `prisma/migrations/*/migration.sql` files directly via a plain `pg`
client, tracking state in Prisma's own `_prisma_migrations` table (same
schema/checksums `prisma migrate deploy` itself writes — see
`src/lib/migrate.ts`). Because it writes that exact format, a later
`prisma migrate deploy`/`status` run from somewhere with direct DB access
(a bastion, once you have one) still correctly recognizes what's already
applied — this isn't a permanent workaround, it stays compatible with normal
Prisma tooling. It's not exposed via API Gateway; run it after each deploy:

```bash
npm run db:migrate:remote
```

## Importing the spreadsheet

```bash
npm run import:spreadsheet -- --dry-run --organizationId <uuid>
npm run import:spreadsheet -- --organizationId <uuid>
npm run import:spreadsheet -- --file path/to/other-team.xlsx --organizationId <uuid>
```

- `--organizationId` is required (an existing `Organization` row — create one
  via `POST /organizations` first; skipped entirely in `--dry-run`).
- `--dry-run` parses and validates the `Roster` tab only (team name, season,
  player count) and exits before any database access — it does not preview
  Master/Defensive/Corner-Kick counts, since those require resolving against
  already-created `Game`/`Player` rows. For a full preview, run for real
  against a scratch/test organization first.
- Reads the `Roster`, `Master (Overall)`, `Defensive Events`, and
  `Corner-Kick Analysis` tabs. Everything else in the workbook (dashboards,
  pivot tables, a `Analysis(DEF) Flat View DATA` staging tab) is derived
  output, not source data, and is ignored.
- Rerunning is safe: `Player`/`Game`/`PlayerGameLog` upsert on their natural
  keys; `DefensiveEvent`/`CornerKickEvent` rows for the team are fully
  replaced each run (see the comment at the top of
  `scripts/import-spreadsheet.ts` for the one known edge case around
  unresolved/`needsReview` rows).
- At the end, the script prints any player names it couldn't match to the
  roster and any events where the opponent name didn't resolve to exactly one
  game (`needsReview`) — check both before trusting the import.

## API docs

```bash
npm run docs:build   # regenerates docs/openapi.yaml from the zod schemas
```

Once running (`npm run offline` or deployed), Swagger UI is served at `/docs`
and the raw spec at `/docs/openapi.yaml`.

## Deploying

Not done as part of this build — `serverless.yml` defines the Cognito user
pool/client and (commented out) the Aurora Serverless v2 + RDS Proxy
resources (see the comment above the resource block for why that combo was
chosen over a plain RDS instance despite the higher cost), but provisioning
real AWS infrastructure, filling in VPC/subnet parameters, and running
`serverless deploy` is left as a manual step. See the comments in
`serverless.yml` for what needs to be filled in first.

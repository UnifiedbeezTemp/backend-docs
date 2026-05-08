---
sidebar_position: 2
---

# Getting Started

Local development setup for the UnifiedBeez backend.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | **20.18.1** | Version pinned in `.node-version`. Use `nvm` or `fnm`. |
| Yarn | 4.x | `corepack enable && corepack prepare yarn@stable --activate` |
| PostgreSQL | 14+ | Local instance or Docker |
| Redis | 7.x | Local instance or Docker |
| Docker | Latest | Optional — for running dependencies via `docker-compose` |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/UnifiedbeezTemp/unifiedbeez.git
cd unifiedbeez
yarn install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values. Minimum required for local development:

```bash
NODE_ENV=development
PORT=3030

# PostgreSQL — update to your local DB
DATABASE_URL="postgresql://user:password@localhost:5432/unifiedbeez"

# Redis
REDIS_URL=redis://localhost:6379

# Session
SESSION_SECRET=any-random-string-for-local-dev

# At least one LLM key for AI features
OPENAI_API_KEY=sk-...
# or
GEMINI_API_KEY=...
```

> The `.env.example` file contains all available variables with placeholder values. AI channel integrations (WhatsApp, Facebook, Twilio) can be left empty if you're not testing those flows locally.

### 3. Set up the database

```bash
# Run all pending migrations
yarn db:migrate

# (Optional) Seed with initial data
yarn db:seed
```

### 4. Start the API

```bash
# Development mode (hot reload)
yarn start:dev

# API-only (no worker processes)
yarn start:api
```

The server starts on `http://localhost:3030` (or the port in your `.env`).

### 5. Start the Worker (separate terminal)

```bash
WORKER_MODE=true yarn start:worker
```

The worker process consumes SQS queues. For local development, it can be omitted if you're not testing async features.

---

## Available Scripts

| Script | What it does |
|---|---|
| `yarn start:dev` | Start with hot reload (ts-node-dev, 4 GB heap) |
| `yarn start:api` | Start API process only (no worker) |
| `yarn start:worker` | Start worker process only (`WORKER_MODE=true`) |
| `yarn start:prod` | Run compiled `dist/src/main` |
| `yarn build` | Compile TypeScript + check NestJS version parity |
| `yarn db:migrate` | Run pending Prisma migrations |
| `yarn db:generate` | Regenerate Prisma client after schema changes |
| `yarn db:studio` | Open Prisma Studio (visual DB browser) |
| `yarn db:seed` | Run the seed script |
| `yarn db:reset` | Drop all tables and re-run migrations (**destructive**) |
| `yarn lint` | ESLint with auto-fix |
| `yarn format` | Prettier format |

---

## Running Tests

```bash
# Unit tests (src/**/*.spec.ts)
yarn test:unit

# All unit tests (same but alias)
yarn test

# Integration tests (test/**/*.spec.ts, real DB)
yarn test:integration

# E2E tests
yarn test:e2e

# Watch mode
yarn test:watch

# Coverage report (80% threshold enforced)
yarn test:coverage
```

For integration tests, a separate test database is required:

```bash
# Set up test DB
DATABASE_TEST_URL="postgresql://user:password@localhost:5432/unifiedbeez_test" yarn test:db:setup

# Run integration tests
yarn test:integration
```

See [Testing](./testing) for the full test strategy.

---

## Common Issues

| Problem | Fix |
|---|---|
| `prisma generate` not run | Run `yarn db:generate` after any `schema.prisma` change |
| Port 3030 in use | Change `PORT` in `.env` |
| Redis connection refused | Start Redis locally or via Docker: `docker run -p 6379:6379 redis:7` |
| Postgres connection error | Verify `DATABASE_URL` in `.env`, ensure the DB exists |
| `Cannot find module` after pull | Run `yarn install` — a dependency may have changed |
| TypeScript errors after schema change | Run `yarn db:generate` then `npx tsc --noEmit` |

---

## Project Structure

```
src/
├── main.ts              # API process entrypoint
├── worker-main.ts       # Worker process entrypoint
├── app.module.ts        # Root module — imports all feature modules
├── common/              # Shared guards, filters, interceptors, middleware
├── config/              # Config factories (logging, etc.)
├── database/            # PrismaService, SeedService
├── [feature]/           # One directory per feature module (see Module Catalogue)
prisma/
├── schema.prisma        # Database schema (source of truth)
├── migrations/          # Applied migration files
└── seed.ts              # Seed script
docs/                    # Ad-hoc API docs and design notes
```

---

## Related Docs

- [Module Catalogue](./module-catalogue) — what each `src/` directory does
- [Data Model](./data-model) — entity relationships
- [Testing](./testing) — test layers and strategy

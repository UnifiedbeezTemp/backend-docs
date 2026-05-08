---
sidebar_position: 6
---

# Testing

The backend has three test layers, each with a distinct purpose and scope.

---

## Three Test Layers

| Layer | Config | Location | What it tests | Mocks Prisma? |
|---|---|---|---|---|
| **Unit** | `jest.config.js` | `src/**/*.spec.ts` | Service logic, DTO validation, individual functions | Yes — Prisma and all collaborators are mocked |
| **Integration** | `jest.config.js` | `src/**/__tests__/**/*.spec.ts` | HTTP layer — controller routing, ValidationPipe rejection, auth guards | Yes — minimal TestingModule with mock Prisma |
| **Real-DB integration** | `jest-integration.config.js` | `test/**/*.spec.ts` | Full stack with a real database — actual Prisma queries, constraint violations, FK integrity | No — real Prisma against a test PostgreSQL DB |

---

## Unit Tests

Test individual services with all collaborators mocked. Confirms that the code you wrote matches your intent.

```bash
# Run all unit tests
yarn test:unit

# Run tests for a specific module
NODE_OPTIONS='--max-old-space-size=8192' npx jest --testPathPattern="automation" --no-coverage

# Watch mode
yarn test:watch
```

**What to mock:**
- `PrismaService` — mock every method that the service calls
- External services (SQS, S3, Pinecone, LLM) — mock return values
- Other NestJS services used as dependencies

**What not to mock:**
- The service under test itself
- DTOs and their validators (test these in integration tests)

---

## Integration Tests (HTTP Layer)

Test the full HTTP request/response cycle without hitting a real database. Uses `supertest` against a minimal NestJS `TestingModule`.

```bash
NODE_OPTIONS='--max-old-space-size=8192' npx jest --testPathPattern="<module>.*spec" --no-coverage
```

**Mandatory test cases per endpoint:**

| Scenario | Expected status |
|---|---|
| Happy path with valid payload | 2xx |
| Missing required field | 400 |
| Wrong type (string sent for int) | 400 |
| Extra undeclared fields | 400 |
| Unauthenticated | 401 |
| Authenticated but wrong user's resource | 403 or 404 |
| Resource not found | 404 |
| Referenced resource does not exist | 400 or 404 |
| Duplicate (unique constraint) | 409 |

**Test module setup pattern:**

```typescript
const module = await Test.createTestingModule({
  controllers: [MyController],
  providers: [
    MyService,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: OtherDep, useValue: { method: jest.fn() } },
  ],
})
  .overrideGuard(SessionAuthGuard)
  .useValue({
    canActivate: (ctx) => {
      ctx.switchToHttp().getRequest().user = { id: USER_ID };
      return true;
    },
  })
  .compile();

const app = module.createNestApplication();
app.setGlobalPrefix('api/v1');   // ← required — matches production prefix
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
}));
await app.init();
```

**Key rules:**
- Never import `AppModule` or any feature module that pulls in `MessagesModule` — it pulls in ESM dependencies that break Jest. Always use a minimal `TestingModule`.
- Always call `app.setGlobalPrefix('api/v1')` — without it all route tests silently return 404.
- Mock return values must be realistic — if a mock for `findMany` returns a fixed array regardless of input, count-based assertions will give false positives.

---

## Real-DB Integration Tests

Test actual database interactions — Prisma query correctness, constraint violations, cascade deletes, FK integrity. Uses a dedicated test PostgreSQL database (no mocks).

```bash
# Set up test database
DATABASE_TEST_URL="postgresql://..." yarn test:db:setup

# Run real-DB integration tests
yarn test:integration
```

**When to write real-DB tests:**
- Message recording (confirm rows are actually written)
- Constraint violations (unique, FK, not-null)
- Cascade delete behaviour
- Multi-step transactions
- Any test that unit-test mocks would give a false positive for

**Setup pattern:**

```typescript
beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],   // ← Real AppModule is OK here — real-DB tests use a separate jest config
  }).compile();
  app = module.createNestApplication();
  // ... standard pipe/prefix setup
  prisma = app.get(PrismaService);
  await app.init();
});

afterAll(async () => {
  await prisma.$transaction([...cleanup]);
  await app.close();
});
```

---

## Coverage Requirements

The project enforces **80% coverage** on branches, functions, lines, and statements via `jest.config.js`:

```bash
yarn test:coverage
```

Coverage is collected from `src/**/*.ts`, excluding DTOs, interfaces, modules, config, and `main.ts`.

---

## CI Considerations

- Tests use `--runInBand` (sequential, not parallel) to avoid port and DB connection conflicts.
- `NODE_OPTIONS='--max-old-space-size=8192'` prevents OOM on large test suites.
- Real-DB integration tests require a live PostgreSQL instance — they run against `DATABASE_TEST_URL`.
- Do not run `test:db:reset` in CI without explicit confirmation — it drops the test database.

---

## Related Docs

- [Coding Standards](./coding-standards) — test coverage requirements and what to test
- [Getting Started](./getting-started) — running tests locally

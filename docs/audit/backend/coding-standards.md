---
sidebar_position: 5
---

# Coding Standards

Engineering rules for the UnifiedBeez backend. Every rule either has a known production incident behind it or represents a class of bug that is invisible until it hits prod. Follow them mechanically.

---

## 0. Core Mental Model

**The HTTP boundary is the only trust boundary.** Everything from `JSON.parse()`, Prisma `Json` fields, or untyped config blobs is untrusted at runtime — TypeScript type annotations on these values are developer intent, not runtime guarantees.

**Validation and coercion are different things.** `class-validator` checks that a value *looks right*. `@Type(() => Number)` coerces it *to the right type*. You need both.

---

## 1. DTO Validation

### Global ValidationPipe settings

```typescript
new ValidationPipe({
  transform: true,          // run @Type() transformers
  whitelist: true,          // strip undeclared fields
  forbidNonWhitelisted: true, // reject requests with extra fields
  forbidUnknownValues: true,
  transformOptions: { enableImplicitConversion: true },
})
```

### Mandatory decorator combos

```typescript
// Foreign-key ID (must be positive — rejects 0, which would pass @IsInt() alone)
@IsInt()
@Min(1)
@Type(() => Number)
categoryId: number;

// Optional FK ID
@IsOptional()
@IsInt()
@Min(1)
@Type(() => Number)
parentId?: number;

// Integer array of FK IDs
@IsArray()
@IsInt({ each: true })
@Min(1, { each: true })
@Type(() => Number)
ids: number[];

// Nested object
@ValidateNested()
@Type(() => NestedDto)
config: NestedDto;
```

### Boolean query params — the silent false-bug

`enableImplicitConversion: true` converts the raw string `"false"` to boolean `true` before `@Transform` runs. `?flag=false` silently behaves as `flag=true`.

```typescript
// ✅ Always use obj[key] to read the raw source value
@IsOptional()
@Transform(({ key, obj }) => {
  const raw = (obj as Record<string, unknown>)[key];
  if (raw === undefined || raw === null) return undefined;
  return raw === 'true' || raw === true;
})
@IsBoolean()
isInternal?: boolean;

// ❌ Broken — "false" → Boolean("false") = true before transform sees it
@Transform(({ value }) => value === 'true' || value === true)
@IsBoolean()
isInternal?: boolean;
```

### No `any` in DTOs. Ever.

If a field's shape varies by type, use `@ValidateIf` per field or a discriminated union.

---

## 2. Type Coercion from Config Blobs

Every value extracted from `config: any`, `JSON.parse()`, or a Prisma `Json` field must be explicitly coerced. TypeScript annotations on these values are lies.

```typescript
// ✅ Integer array from config
const listIds = ((config.listIds ?? []) as unknown[])
  .map(Number)
  .filter((n) => Number.isInteger(n) && n > 0);

// ✅ Optional integer from config
const templateId = config.emailTemplateId != null
  ? Number(config.emailTemplateId)
  : undefined;

// ❌ Never — string "2" flows through undetected
const listIds: number[] = config.listIds ?? [];
```

---

## 3. Tenant Isolation

Every Prisma query on user-owned data must include `userId` in `where`. No exceptions.

```typescript
// ✅
const automation = await this.prisma.automation.findFirst({
  where: { id: automationId, userId },
});
if (!automation) throw new NotFoundException('Automation not found');

// ❌ Fetch then check — data exposed before ownership confirmed
const automation = await this.prisma.automation.findUnique({ where: { id } });
if (automation.userId !== userId) throw new ForbiddenException();
```

Cross-resource references must be ownership-validated before use:

```typescript
const list = await this.prisma.campaignList.findFirst({
  where: { id: listId, userId },
  select: { id: true },
});
if (!list) throw new NotFoundException('Campaign list not found or not accessible');
// Only now safe to use listId in a write
```

**If a lookup returns null, throw immediately.** Continuing past a null result and passing the original ID to a Prisma write causes a P2003 FK constraint error.

---

## 4. Prisma Write Safety

### Never pass `undefined` to a Prisma write

Prisma does not treat `undefined` as "omit the field" — it triggers a `PrismaClientValidationError` with a misleading message.

```typescript
// ✅ Conditional spread — Prisma never sees the field when value is absent
await this.prisma.campaign.create({
  data: {
    userId,
    name,
    ...(aiAssistantId != null ? { aiAssistantId } : {}),
  },
});

// ❌ undefined reaches Prisma → confusing error about an unrelated required relation
await this.prisma.campaign.create({
  data: { userId, name, aiAssistantId },  // aiAssistantId may be undefined
});
```

Scan every field in every Prisma `create`/`update` `data` object. If it can be `undefined` at runtime (optional param, `findFirst()?.id`, `config.maybeKey`), use conditional spread.

### No writes inside loops

```typescript
// ❌ N+1 — one DB round-trip per item
for (const page of pages) {
  await this.prisma.websitePage.create({ data: { ...page } });
}

// ✅ One query regardless of count
await this.prisma.websitePage.createMany({
  data: pages.map(p => ({ ... })),
  skipDuplicates: true,
});
```

### Multi-table mutations use transactions

```typescript
await this.prisma.$transaction([
  this.prisma.automation.update({ ... }),
  this.prisma.automationStep.deleteMany({ ... }),
]);
```

---

## 5. Polymorphic Config Guards

For endpoints where the config shape is determined by a type stored in the DB (not sent in the request), DTO validation alone is not enough. Every `case` in a service switch must guard its own required fields before any Prisma call.

```typescript
case 'SMART_RULE': {
  const { conditions, name } = config;
  if (!name || typeof name !== 'string') {
    throw new BadRequestException('name is required for SMART_RULE steps');
  }
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new BadRequestException('conditions are required for SMART_RULE steps');
  }
  await tx.smartRuleStepConfig.create({ data: { stepId, name, ... } });
}
```

---

## 6. Error Handling

- Use NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, `ConflictException`, etc.). Never `throw new Error('...')` in service layer.
- Unauthorised access by a wrong tenant returns **404, not 403** — don't confirm that the resource exists.
- `PrismaClientValidationError` and `PrismaClientKnownRequestError` are caught by the global `PrismaExceptionFilter` — never let them reach the client as raw errors.
- Error response shape: `{ statusCode, message, error }`. Never expose stack traces or Prisma internals.

---

## 7. Database Query Standards

- **Paginate every list endpoint.** Hard cap: `take = Math.min(limit, 100)`.
- **Select only what you need.** Use `select: { id: true, name: true }` — never fetch whole records when you need 2 fields.
- **No N+1 reads.** Use `findMany` with `{ in: [...] }` instead of querying inside a loop.
- **No N+1 external I/O.** Use `sqsQueue.addBatch()` instead of individual `sendMessage` calls per item.
- **Sort fields must be indexed.** If an endpoint sorts by a field, that field must have a DB index.

---

## 8. Security

- Route params (`:id`) are strings. Always coerce with `ParseIntPipe`:
  ```typescript
  @Param('id', ParseIntPipe) id: number
  ```
- Global `ThrottlerGuard` applies to all routes (50 req / 60s). Only add `@Throttle()` to override, never to duplicate.
- Strip HTML from any string stored and later displayed to prevent XSS.
- Never log request bodies containing tokens, passwords, or PII.

---

## 9. NestJS Version Parity

All `@nestjs/*` packages must be on the same major version. A mismatch causes runtime crashes (not TypeScript errors) in framework internals.

```bash
yarn check:nest-versions   # runs automatically as part of yarn build
```

Never bump a single NestJS package in isolation — bump them all together.

---

## 10. Pre-Ship Checklist

Before marking any endpoint done, verify:

**Validation**
- [ ] Route params use `ParseIntPipe`
- [ ] DTO has no `any` or `Record<string, any>`
- [ ] Every numeric field has `@Type(() => Number)`
- [ ] Every FK ID has `@Min(1)`
- [ ] Every optional field has both `@IsOptional()` and a type validator
- [ ] Nested objects use `@ValidateNested()` + `@Type()`
- [ ] For polymorphic configs: chain from `@Body()` through `@ValidateNested()` to every typed DTO is unbroken; service-layer guards exist for every required field

**Type safety**
- [ ] Every config/JSON extraction is explicitly coerced
- [ ] Every Prisma write field checked for possible `undefined` (use conditional spread)

**Authorization**
- [ ] Every query on user-owned data includes `userId` in `where`
- [ ] Cross-resource references are ownership-validated
- [ ] Wrong tenant → 404 (not 403)

**Database**
- [ ] List endpoints paginated (hard cap on limit)
- [ ] `select` used to fetch only needed fields
- [ ] No Prisma calls inside loops
- [ ] Multi-table mutations wrapped in `$transaction`

**Tests (all required before shipping)**
- [ ] Happy path → 2xx
- [ ] Missing required field → 400
- [ ] Wrong type for every numeric field → 400
- [ ] Both `?boolParam=true` and `?boolParam=false` tested separately
- [ ] For polymorphic configs: missing required field for each type variant → 400
- [ ] Unauthenticated → 401
- [ ] Wrong tenant's resource → 403 or 404
- [ ] Not found → 404
- [ ] Referenced resource not found → 400 or 404

---

## Related Docs

- [Testing](./testing) — how to write and run tests
- [Module Catalogue](./module-catalogue) — which module owns which tables

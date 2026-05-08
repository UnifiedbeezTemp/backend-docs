---
sidebar_position: 2
---

# Runbook: WebSocket Gateway Crash / API Process Death

**Trigger:** ECS task failure alarm fires, or all WebSocket connections drop simultaneously.

---

## Symptom

- All connected users lose WebSocket connections at once.
- ECS shows `STOPPED` tasks with `Essential container exited` reason.
- New ECS tasks start (ECS self-heals) but clients need to reconnect.
- API returns 503 during the cold-restart window (typically 30–60 seconds).

---

## Diagnosis

### Step 1 — Confirm it's a process crash (not a deploy)

```bash
# Check recent ECS task stop events
aws ecs describe-services \
  --cluster unifiedbeez-cluster \
  --services unifiedbeez-api \
  --region eu-west-1 \
  --query 'services[0].events[:10]'
```

Look for `service unifiedbeez-api has started X tasks` after a stop event. If there was no recent deploy, it's a crash.

### Step 2 — Find the crash reason in CloudWatch logs

```bash
# Last 100 error lines from the API container
aws logs filter-log-events \
  --log-group-name /ecs/api \
  --start-time $(date -v-30M +%s000) \
  --filter-pattern "ERROR\|uncaughtException\|unhandledRejection\|fatal" \
  --region eu-west-1 \
  --query 'events[*].message' --output text | head -100
```

Common crash causes:
- `TypeError: Right-hand side of 'instanceof' is not an object` — `@nestjs/*` version mismatch between packages (see Prevention)
- `uncaughtException: ...` — unhandled error in WS gateway handler reaching the process level
- `SIGKILL` from OOM — task memory limit (1024 MB) exceeded

### Step 3 — Check for NestJS version skew

```bash
# From unifiedbeez/ repo
node scripts/check-nest-versions.js
```

If this outputs mismatched major versions, the crash is likely caused by framework version skew.

---

## Resolution

### Self-healing

ECS will automatically start replacement tasks. Wait 60–90 seconds for the new tasks to pass health checks. No manual action required unless tasks keep crashing in a loop.

### Crashing in a loop

If new tasks start and immediately crash, a code bug is causing the crash on startup:

1. Do NOT keep ECS running the bad image — it will keep failing.
2. Roll back to the previous task definition revision:
   ```bash
   aws ecs update-service \
     --cluster unifiedbeez-cluster \
     --service unifiedbeez-api \
     --task-definition unifiedbeez-api:<previous-revision> \
     --region eu-west-1
   ```
3. Investigate the crash from logs before re-deploying the new image.

### NestJS version skew

If `check-nest-versions.js` reports mismatched majors:

1. Open `package.json`.
2. Align ALL `@nestjs/*` packages to the same major version.
3. Run `yarn install`, then `yarn build` to confirm `check-nest-versions` passes.
4. Deploy the fixed image.

---

## Prevention

- `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers are registered in `src/main.ts`. These log the error and keep the process alive for non-fatal uncaught errors.
- `GlobalWsExceptionFilter` is applied per-gateway (not globally) to protect against framework filter crashes without affecting HTTP error responses. See [Coding Standards](../../backend/coding-standards).
- `yarn build` runs `check-nest-versions.js` — never bypass this check.

---

## Related

- [Deployment](../../infrastructure/deployment) — how to roll back
- [DR & Backups](../../infrastructure/dr-and-backups) — ECS task monitoring

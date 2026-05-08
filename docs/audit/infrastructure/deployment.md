---
sidebar_position: 3
---

# Deployment

UnifiedBeez is deployed to AWS using CDK. Both the infrastructure stacks and the application containers are deployed separately.

---

## Two Deployment Tracks

| Track | What it deploys | When to use |
|---|---|---|
| **CDK stacks** | AWS resources (VPC, RDS, ECS service definitions, queues, etc.) | Infrastructure changes — schema updates, new queues, config changes |
| **Application containers** | Docker image → ECR → ECS rolling update | Code changes (most deploys) |

Most deploys are **application-only** — you push a new Docker image and ECS rolls it out with no CDK involved.

---

## Stack Deployment Order

Stacks have hard dependencies. Always deploy in this order when deploying multiple stacks:

```
1. UnifiedBeezNetwork       ← VPC, security groups (no dependencies)
2. UnifiedBeezSecrets       ← Secrets Manager (no dependencies)
3. UnifiedBeezStorage       ← S3 + CloudFront (no dependencies)
4. UnifiedBeezQueues        ← SQS queues (no dependencies)
5. BeezaroCopilotOnboarding ← Lambda (depends on: Secrets)
6. UnifiedBeezDatabase      ← RDS (depends on: Network)
7. UnifiedBeezCache         ← Redis (depends on: Network)
8. UnifiedBeezCompute       ← ECS + ALB (depends on: Network, Database, Cache, Storage, Queues, Secrets, CopilotOnboarding)
9. UnifiedBeezMonitoring    ← CloudWatch alarms (depends on: Compute)
10. UnifiedBeezDomainRedirect ← Route 53 (depends on: Compute)
```

When deploying all stacks fresh:

```bash
cd unifiedbeez-infra
npx cdk deploy --all
```

CDK respects the dependency graph and will deploy in the correct order automatically.

---

## Deploying a Single Stack

When only infrastructure changes in one stack:

```bash
# Examples
npx cdk deploy UnifiedBeezCompute
npx cdk deploy UnifiedBeezQueues
npx cdk deploy UnifiedBeezMonitoring
```

Preview what will change before deploying:

```bash
npx cdk diff UnifiedBeezCompute
```

---

## Application Deploy (Most Common)

A standard code deploy does NOT require CDK. It only updates the container image.

### Step 1 — Build the Docker images

```bash
# From unifiedbeez/ repo root
docker build -f Dockerfile.api -t unifiedbeez-api:latest .
docker build -f Dockerfile.worker -t unifiedbeez-worker:latest .
```

### Step 2 — Push to ECR

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region eu-west-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-west-1.amazonaws.com

# Tag and push API image
docker tag unifiedbeez-api:latest <account-id>.dkr.ecr.eu-west-1.amazonaws.com/unifiedbeez-api:latest
docker push <account-id>.dkr.ecr.eu-west-1.amazonaws.com/unifiedbeez-api:latest

# Tag and push Worker image
docker tag unifiedbeez-worker:latest <account-id>.dkr.ecr.eu-west-1.amazonaws.com/unifiedbeez-worker:latest
docker push <account-id>.dkr.ecr.eu-west-1.amazonaws.com/unifiedbeez-worker:latest
```

### Step 3 — Force ECS rolling update

```bash
# Trigger new task deployment (ECS will pull the latest image)
aws ecs update-service \
  --cluster unifiedbeez-cluster \
  --service unifiedbeez-api \
  --force-new-deployment \
  --region eu-west-1

aws ecs update-service \
  --cluster unifiedbeez-cluster \
  --service unifiedbeez-worker \
  --force-new-deployment \
  --region eu-west-1
```

ECS performs a rolling update: new tasks start, health checks pass (`GET /health`), then old tasks are drained and stopped.

### Step 4 — Verify

```bash
# Watch the deployment progress
aws ecs describe-services \
  --cluster unifiedbeez-cluster \
  --services unifiedbeez-api unifiedbeez-worker \
  --region eu-west-1 \
  --query 'services[*].{name:serviceName,running:runningCount,pending:pendingCount,desired:desiredCount}'
```

Wait until `runningCount == desiredCount` and `pendingCount == 0`.

---

## Database Migrations

**Migrations must be applied before the new container starts in prod.** The safe deployment sequence is:

1. Apply the migration against prod RDS:
   ```bash
   DATABASE_URL="postgres://..." npx prisma migrate deploy
   ```
2. Push the new container image.
3. Trigger ECS rolling update.

> `prisma migrate deploy` applies only pre-committed migration files. It never resets the database. Safe to run against prod.

See [database-standards](https://github.com/UnifiedbeezTemp/unifiedbeez/blob/main/CLAUDE.md) for the full migration protocol.

---

## Rollback

### Application rollback

ECS keeps the previous task definition. To roll back to the last known-good image:

```bash
# Find the previous task definition revision
aws ecs list-task-definitions \
  --family-prefix unifiedbeez-api \
  --sort DESC \
  --region eu-west-1

# Update the service to use the previous revision
aws ecs update-service \
  --cluster unifiedbeez-cluster \
  --service unifiedbeez-api \
  --task-definition unifiedbeez-api:<previous-revision-number> \
  --region eu-west-1
```

### Infrastructure rollback

CDK does not have a native rollback command. Options:

1. **CloudFormation rollback** — go to CloudFormation console → select the stack → Actions → Roll back stack (only available if the deployment failed mid-way).
2. **Re-deploy the previous version** — revert the CDK code change in git, then `cdk deploy`.
3. **For destructive changes** — see [DR & Backups](./dr-and-backups) for RDS point-in-time restore.

---

## Health Check

The API container health check pings `GET http://localhost:3000/health` every 30 seconds. If it fails 3 times consecutively (within 60s start period), ECS marks the task as unhealthy and replaces it.

The `HealthModule` checks:
- PostgreSQL connectivity (Prisma ping)
- Redis connectivity

A failed health check will cause the rolling update to stall — new tasks won't replace old ones until the health check passes.

---

## Environment Variables

Environment variables are injected into ECS tasks from two sources:

| Source | Variables |
|---|---|
| Secrets Manager (`unifiedbeez/database`) | `DB_PASSWORD`, `DB_USERNAME` |
| Secrets Manager (`unifiedbeez/app`) | All API keys — Twilio, WhatsApp, Facebook, Google OAuth, OpenAI, Anthropic, Stripe, Pinecone, session secret, SES SMTP, etc. |
| ECS task definition (non-secret) | `NODE_ENV`, `DATABASE_HOST`, `REDIS_ENDPOINT`, queue URLs, `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN` |

To add a new secret: add the key to `unifiedbeez/app` in Secrets Manager, then add the `ecs.Secret.fromSecretsManager(...)` reference in `compute-stack.ts`, and redeploy.

---

## Related Docs

- [Infrastructure Overview](./overview) — stack list and topology
- [Environments](./environments) — dev vs prod configuration
- [DR & Backups](./dr-and-backups) — rollback and restore for data
- [Secrets Management](./secrets) — secret naming and rotation

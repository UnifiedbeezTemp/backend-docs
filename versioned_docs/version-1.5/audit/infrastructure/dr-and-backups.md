---
sidebar_position: 5
---

# DR & Backups

Disaster recovery and backup configuration for UnifiedBeez production infrastructure.

---

## RDS (PostgreSQL)

### Backup configuration

| Setting | Value | Source |
|---|---|---|
| Automated backups | Enabled | `DatabaseStack` |
| Backup retention | **7 days** | `backupRetention: cdk.Duration.days(7)` |
| Backup window | AWS-managed (random window) | Default |
| Storage encryption | Enabled (AES-256) | `storageEncrypted: true` |
| Deletion protection | **ON** | `deletionProtection: true` |
| Removal policy | **SNAPSHOT** — takes a final snapshot before deletion | `removalPolicy: cdk.RemovalPolicy.SNAPSHOT` |
| Multi-AZ | Not configured (single AZ t3.small) | Cost optimisation — upgrade for HA |

### Point-in-Time Recovery (PITR)

RDS supports point-in-time restore to any second within the 7-day retention window.

**To restore to a point in time:**

1. Go to **AWS Console → RDS → Databases → unifiedbeez instance → Actions → Restore to point in time**.
2. Choose the target timestamp.
3. RDS creates a **new DB instance** — it does not overwrite the existing one.
4. Update `DATABASE_URL` in the ECS task definition to point to the new instance endpoint.
5. Redeploy ECS services.

:::warning
PITR creates a new instance with a new endpoint. ECS tasks must be updated to point to the new endpoint before they can reconnect. Plan for ~15–30 minutes of downtime during the cutover.
:::

### Manual snapshots

For pre-deployment safety before a risky migration:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier <rds-instance-id> \
  --db-snapshot-identifier unifiedbeez-pre-migration-$(date +%Y%m%d) \
  --region eu-west-1
```

Wait for snapshot status to become `available` before proceeding with the migration.

---

## ElastiCache (Redis)

Redis is used for **sessions and in-memory caching only** — not as a primary data store. Data in Redis can be rebuilt from PostgreSQL.

| Setting | Value |
|---|---|
| Cluster type | Single-node `cache.t3.micro` |
| Automatic backup | Not configured (data is ephemeral / rebuildable) |
| Recovery path | Restart the ElastiCache cluster; sessions are lost (users must log in again) |

If Redis data needs to be preserved during maintenance, enable automatic backups via `snapshotRetentionLimit` in `cache-stack.ts`.

---

## S3 (Attachments)

| Setting | Value |
|---|---|
| Bucket | `unifiedbeez-attachments-{account}` |
| Versioning | Disabled |
| Lifecycle | Intelligent Tiering after 30 days; Glacier Instant Retrieval after 90 days |
| Encryption | S3-managed (AES-256) |
| Recovery | Objects in Glacier Instant Retrieval restore within milliseconds |

S3 itself is 11-nines durable. No additional cross-region replication is currently configured.

---

## SQS (Queues)

Messages that fail processing after the maximum receive count are moved to the corresponding **Dead-Letter Queue (DLQ)**. DLQs retain messages for **14 days**.

| Recovery path | When to use |
|---|---|
| Re-drive messages from DLQ → source queue | Message processing failure was transient (network blip, downstream outage) |
| Inspect and discard DLQ messages | Messages are invalid or unprocessable |

**To re-drive DLQ messages (AWS Console):**

1. Go to **SQS → [queue-name]-dlq → Dead-letter queue actions → Start DLQ redrive**.
2. Select the source queue as the redrive destination.
3. Monitor the source queue for processing errors.

See the [SQS Backlog runbook](../operations/runbooks/sqs-backlog) for step-by-step diagnosis.

---

## RPO and RTO Targets

:::info Team action required
Confirm and formalise these targets with the team and stakeholders. The values below are estimates based on current configuration.
:::

| System | RPO (max data loss) | RTO (max downtime) |
|---|---|---|
| PostgreSQL (RDS) | ~5 minutes (PITR granularity) | 15–30 minutes (PITR + ECS redeploy) |
| Redis (sessions) | All in-flight sessions lost on failure | ~5 minutes (ElastiCache restart) |
| S3 (attachments) | 0 (11-nines durable) | Immediate (no restore needed) |
| SQS (messages) | 14-day DLQ window | Minutes (DLQ redrive) |

---

## Monitoring & Alerts

The `MonitoringStack` configures CloudWatch alarms that email `olaleye@unifiedbeez.com` via SNS for:

| Alarm | Threshold | Meaning |
|---|---|---|
| `unifiedbeez-rds-high-cpu` | CPU > 80% for 10 min | DB under load — check slow queries |
| `unifiedbeez-rds-low-storage` | Free storage < 2 GB | Add storage or clean up before it auto-scales |
| ECS task failures | Any task stopped unexpectedly | Container crash — check CloudWatch logs |
| SQS DLQ depth | > 0 messages | Processing failure — inspect DLQ |
| ALB unhealthy hosts | > 0 | Health check failing — check `/health` endpoint |

**CloudWatch Logs:** Container logs are retained for **1 week** under log groups `/ecs/api` and `/ecs/worker`.

---

## Related Docs

- [Infrastructure Overview](./overview) — topology and stack list
- [Deployment](./deployment) — how to deploy and roll back code changes
- [SQS Backlog runbook](../operations/runbooks/sqs-backlog) — DLQ investigation and redrive

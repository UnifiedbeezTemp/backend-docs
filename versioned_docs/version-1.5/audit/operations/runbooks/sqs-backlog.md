---
sidebar_position: 1
---

# Runbook: SQS Backlog / DLQ Depth

**Trigger:** CloudWatch alarm `unifiedbeez-sqs-dlq-depth` fires — DLQ message count > 0.

---

## Symptom

- CloudWatch alarm fires via SNS email.
- Messages are not being processed (AI replies delayed, automations stalled, webhooks not acknowledged).
- DLQ in AWS Console shows messages accumulating.

---

## Diagnosis

### Step 1 — Identify which queue has the backlog

```bash
# List all queues and check approximate message counts
aws sqs list-queues --queue-name-prefix unifiedbeez --region eu-west-1 \
  --query 'QueueUrls' --output text | tr '\t' '\n' | while read url; do
  count=$(aws sqs get-queue-attributes --queue-url "$url" \
    --attribute-names ApproximateNumberOfMessages \
    --region eu-west-1 --query 'Attributes.ApproximateNumberOfMessages' --output text)
  echo "$count  $url"
done | sort -rn | head -20
```

Look for DLQ queues (ending in `-dlq`) with count > 0.

### Step 2 — Inspect a failed message

```bash
# Receive a message from the DLQ to inspect its body
aws sqs receive-message \
  --queue-url "https://sqs.eu-west-1.amazonaws.com/<account-id>/<queue-name>-dlq" \
  --region eu-west-1 \
  --max-number-of-messages 1
```

Read the message body. Common failure reasons:
- JSON parse error → malformed webhook payload
- Missing required field → upstream service sent incomplete data
- Foreign key not found → record was deleted before job processed
- External API timeout → downstream service was unavailable

### Step 3 — Check Worker logs

```bash
# Recent Worker container logs
aws logs filter-log-events \
  --log-group-name /ecs/worker \
  --start-time $(date -v-1H +%s000) \
  --filter-pattern "ERROR" \
  --region eu-west-1 \
  --query 'events[*].message' --output text | head -50
```

Look for repeated errors on the same job type.

---

## Resolution

### Option A — Transient failure (network blip, downstream outage): Re-drive

Messages are still valid — re-drive them back to the source queue for reprocessing.

1. AWS Console → **SQS** → select the DLQ → **Dead-letter queue actions** → **Start DLQ redrive**.
2. Set the destination to the source queue.
3. Monitor the source queue for processing — watch Worker logs for success or new errors.

```bash
# Or via CLI
aws sqs start-message-move-task \
  --source-arn "arn:aws:sqs:eu-west-1:<account-id>:<queue-name>-dlq" \
  --destination-arn "arn:aws:sqs:eu-west-1:<account-id>:<queue-name>" \
  --region eu-west-1
```

### Option B — Permanent failure (invalid messages): Purge

If messages are unprocessable (malformed, reference deleted records), purge the DLQ after saving samples for investigation.

```bash
# Save sample messages first
aws sqs receive-message \
  --queue-url "https://sqs.eu-west-1.amazonaws.com/<account-id>/<queue-name>-dlq" \
  --max-number-of-messages 10 \
  --region eu-west-1 > /tmp/dlq-sample.json

# Then purge
aws sqs purge-queue \
  --queue-url "https://sqs.eu-west-1.amazonaws.com/<account-id>/<queue-name>-dlq" \
  --region eu-west-1
```

---

## Prevention

- If the failure is caused by a code bug, fix the bug and deploy before re-driving — re-driving without fixing will immediately push messages back to the DLQ.
- If the failure is caused by a missing DB record, investigate whether a cascade delete or a data cleanup job is hitting records that queued jobs still reference.
- Increase the Worker task's SQS visibility timeout if timeouts are the cause.

---

## Related

- [DR & Backups](../../infrastructure/dr-and-backups) — SQS message retention
- [Infrastructure Overview](../../infrastructure/overview) — queue list

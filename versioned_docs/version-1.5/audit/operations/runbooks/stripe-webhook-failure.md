---
sidebar_position: 5
---

# Runbook: Stripe Webhook Failure

**Trigger:** Billing events are not processing — subscriptions not activating, plan changes not reflected, payment failures not handled.

---

## Symptom

- Users report their plan hasn't updated after payment.
- Stripe Dashboard shows webhook deliveries with error status (non-2xx).
- `webhook-events` SQS queue depth is growing, or DLQ has messages.
- CloudWatch logs show signature verification failures or processing errors.

---

## How Webhooks Flow

```
Stripe → POST /api/v1/webhooks/stripe
         ↓
  Signature verified (STRIPE_WEBHOOK_SECRET)
         ↓
  Message enqueued to SQS webhook-events
         ↓
  Worker processes the event (subscription.updated, payment_intent.succeeded, etc.)
         ↓
  User plan updated in DB
```

Failures can occur at any point in this chain.

---

## Diagnosis

### Step 1 — Check Stripe webhook delivery status

1. Go to **Stripe Dashboard → Developers → Webhooks → unifiedbeez endpoint**.
2. Check the **Recent deliveries** tab for failed attempts.
3. Note the HTTP status code returned by the backend.

| Status | Meaning |
|---|---|
| 400 | Signature verification failed (wrong secret or replay) |
| 401 | Auth guard rejecting the webhook route (should be excluded from auth) |
| 500 | Processing error in the webhook handler |
| Timeout | Worker not processing fast enough; Stripe retried |

### Step 2 — Check the SQS webhook-events queue

```bash
# Check queue depth and DLQ
aws sqs get-queue-attributes \
  --queue-url "https://sqs.eu-west-1.amazonaws.com/<account-id>/webhook-events" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  --region eu-west-1

aws sqs get-queue-attributes \
  --queue-url "https://sqs.eu-west-1.amazonaws.com/<account-id>/webhook-events-dlq" \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-west-1
```

### Step 3 — Check Worker logs for processing errors

```bash
aws logs filter-log-events \
  --log-group-name /ecs/worker \
  --start-time $(date -v-2H +%s000) \
  --filter-pattern "stripe\|webhook\|payment\|subscription" \
  --region eu-west-1 \
  --query 'events[*].message' --output text | head -50
```

### Step 4 — Verify the webhook secret

If Step 1 shows 400 errors (signature failure):

```bash
# Confirm STRIPE_WEBHOOK_SECRET is set in Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id unifiedbeez/app \
  --region eu-west-1 \
  --query SecretString --output text | python3 -c \
  "import sys, json; d=json.load(sys.stdin); print('SET' if d.get('STRIPE_WEBHOOK_SECRET') else 'MISSING')"
```

The webhook secret must match the **signing secret** shown in Stripe Dashboard for the specific webhook endpoint.

---

## Resolution

### Signature verification failure (400)

The `STRIPE_WEBHOOK_SECRET` in Secrets Manager doesn't match what Stripe is using:

1. Go to Stripe Dashboard → Developers → Webhooks → your endpoint → **Signing secret** → Reveal.
2. Update the secret in AWS Secrets Manager (see [Secrets Management](../../infrastructure/secrets) — Rotating a Secret).
3. Trigger ECS rolling update.
4. Retry failed deliveries from Stripe Dashboard: **Recent deliveries → Resend**.

### Processing error (500 in Stripe, messages in DLQ)

1. Identify the failing event type from Stripe Dashboard delivery details.
2. Read the DLQ message body for the specific event payload.
3. Reproduce the error locally with the same payload.
4. Fix the handler and deploy.
5. Re-drive DLQ messages once the fix is deployed (see [SQS Backlog runbook](./sqs-backlog)).

### Stripe retrying old events

If Stripe has been retrying events that failed hours ago:
- Stripe retries with exponential backoff for up to 3 days.
- Once the endpoint returns 2xx consistently, Stripe will stop retrying.
- Manually replay specific events from Stripe Dashboard if needed.

---

## Prevention

- The webhook endpoint (`/api/v1/webhooks/stripe`) must be excluded from `SessionAuthGuard`. Stripe does not send session cookies.
- Always verify the Stripe signature before processing the event body — the handler should fail fast with 400 if the signature doesn't match.
- After rotating the `STRIPE_WEBHOOK_SECRET`, verify with a Stripe test event before closing the incident.

---

## Related

- [SQS Backlog runbook](./sqs-backlog) — DLQ redrive
- [Secrets Management](../../infrastructure/secrets) — rotating secrets

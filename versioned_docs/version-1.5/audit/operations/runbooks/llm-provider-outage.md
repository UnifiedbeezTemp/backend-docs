---
sidebar_position: 4
---

# Runbook: LLM Provider Outage

**Trigger:** AI responses stop generating across all or some accounts; LangSmith shows high error rates; users report the chatbot is not responding.

---

## Symptom

- AI auto-replies are not being sent for incoming messages.
- `ai-response-generation` SQS queue depth is growing (jobs queued but failing).
- LangSmith traces show errors from the primary LLM provider.
- CloudWatch logs for the Worker show repeated `EnhancedLLMService` errors.

---

## How the LLM Fallback Chain Works

`EnhancedLLMService` uses a cascading fallback:

```
1. Gemini (primary)
   ↓ if error or timeout
2. OpenAI (fallback)
   ↓ if error or timeout
3. Anthropic (final fallback)
   ↓ if all fail
4. Error returned — AI reply not sent, message stays in queue
```

A single provider being down should be absorbed by the fallback chain **automatically**. If AI responses have stopped entirely, all three providers are likely failing, or an API key has expired/been revoked.

---

## Diagnosis

### Step 1 — Check LangSmith for error rates

Go to [LangSmith](https://smith.langchain.com) → UnifiedBeez project → Traces.

Filter by time range and look for:
- Which provider is throwing errors (Gemini, OpenAI, Anthropic)
- Error type: timeout, 429 (rate limit), 401 (invalid key), 500 (provider outage)

### Step 2 — Check provider status pages

| Provider | Status page |
|---|---|
| Google Gemini | https://status.cloud.google.com |
| OpenAI | https://status.openai.com |
| Anthropic | https://status.anthropic.com |

### Step 3 — Verify API keys in Secrets Manager

```bash
# Check the app secrets (do not print to terminal — use Console or filter)
aws secretsmanager get-secret-value \
  --secret-id unifiedbeez/app \
  --region eu-west-1 \
  --query 'SecretString' \
  --output text | python3 -c "import sys, json; d=json.load(sys.stdin); print({k: 'SET' if v and v != 'REPLACE_ME' else 'MISSING' for k,v in d.items() if 'KEY' in k or 'SECRET' in k})"
```

Confirm `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` are populated.

### Step 4 — Check Worker logs for error detail

```bash
aws logs filter-log-events \
  --log-group-name /ecs/worker \
  --start-time $(date -v-1H +%s000) \
  --filter-pattern "EnhancedLLMService\|LLM\|Gemini\|OpenAI\|Anthropic" \
  --region eu-west-1 \
  --query 'events[*].message' --output text | head -50
```

---

## Resolution

### Provider outage (their side)

No action needed for a single provider — the fallback chain handles it. Monitor LangSmith until the outage resolves.

If all three providers are down simultaneously (extremely rare):
- AI responses will fail. Messages remain in the queue.
- Users will not receive AI replies until at least one provider recovers.
- Notify affected users if outage is extended.
- Once a provider recovers, messages in the `ai-response-generation` queue will be reprocessed automatically (if within DLQ retention window).

### Expired or revoked API key

1. Obtain a new API key from the provider console.
2. Update the key in AWS Secrets Manager:
   ```bash
   # Retrieve current secret, update the key, re-upload
   aws secretsmanager get-secret-value --secret-id unifiedbeez/app --region eu-west-1 --query SecretString --output text > /tmp/app-secrets.json
   # Edit /tmp/app-secrets.json — update the relevant key
   aws secretsmanager put-secret-value --secret-id unifiedbeez/app --secret-string file:///tmp/app-secrets.json --region eu-west-1
   rm /tmp/app-secrets.json
   ```
3. Trigger ECS rolling update — new tasks will pick up the refreshed secret:
   ```bash
   aws ecs update-service --cluster unifiedbeez-cluster --service unifiedbeez-worker --force-new-deployment --region eu-west-1
   ```
4. Once workers are running with the new key, re-drive any DLQ messages from `ai-response-generation-dlq`.

### Rate limit (429)

If errors are 429s (rate limits), not outages:
- Check if a specific user's automation is flooding the queue — look for a single `userId` dominating `ai-response-generation` queue messages.
- Consider increasing rate limits on the provider account, or adding per-user throttling.

---

## Related

- [SQS Backlog runbook](./sqs-backlog) — re-driving DLQ messages
- [Secrets Management](../../infrastructure/secrets) — updating API keys

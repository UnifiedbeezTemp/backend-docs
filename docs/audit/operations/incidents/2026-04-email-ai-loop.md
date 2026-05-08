---
sidebar_position: 1
---

# Incident: Email AI Auto-Reply Loop (April 30, 2026)

**Date:** April 30, 2026  
**Affected area:** Email AI automation and webchat AI replies  
**Severity:** Medium — no data loss, no external service interruption; one user's AI quota exhausted, causing webchat AI to stop responding for that account.

---

## Executive Summary

AWS Health sent a domain verification notification to a connected email account (`brian@unifiedbeez.com`). The email ingestion pipeline classified it as a normal customer message and triggered an AI reply to `health@aws.com`. Gmail returned a delivery failure (bounce). The system classified the bounce as a new customer message, triggered another AI reply, and the cycle repeated until the user's AI reply allowance was exhausted. Because email and webchat share the same per-user AI quota, the webchat AI also stopped responding once the quota was reached.

The incident was caused by a classification gap in the email ingestion pipeline, not by the AI model itself.

---

## Timeline

1. AWS Health sent a domain verification notification to `brian@unifiedbeez.com`.
2. Email ingestion pipeline classified it as a customer message.
3. AI replied to `health@aws.com` — an address that cannot receive mail.
4. Gmail returned a delivery failure (bounce) to `brian@unifiedbeez.com`.
5. System classified the bounce as a new inbound customer message.
6. AI generated another reply, this time to `brian@unifiedbeez.com` itself.
7. Gmail echoed back the AI-sent activity as new mailbox updates — processed as fresh inbound emails.
8. The cycle repeated until the user's AI reply allowance was exhausted.
9. Webchat AI stopped responding — it shares the same per-user quota.

---

## Root Cause

The email ingestion pipeline did not distinguish between:
- Real customer emails
- Automated system notifications (AWS Health, etc.)
- Bounce / delivery failure emails
- Emails sent by the connected mailbox itself (self-mail)
- Gmail echoes of outbound messages the system had already sent

All were routed into the same automation path, including AI response generation.

---

## Mitigating Factors

- **Semantic cache** reused cached responses for repeated similar messages, reducing raw AI token usage.
- **Per-user AI rate limit** stopped the loop from continuing indefinitely and surfaced the problem (webchat went silent — a visible signal).

---

## Resolution

The email pipeline was updated to detect and gate the following email types:

| Email type | Action |
|---|---|
| Outbound Gmail echoes | Preserved in DB, skipped for automation |
| Self-sent (connected mailbox sends to itself) | Preserved in DB, skipped for automation |
| Delivery failures / bounces | Preserved in DB, skipped for automation |
| Auto-generated system/notification emails | Preserved in DB, skipped for automation |

Additionally, a final outbound safeguard was added: the AI will not send an email when the recipient address matches the connected sending account.

Automation now skips: AI auto-replies, identity resolution, lead/tag automation, and delayed AI response jobs for guarded email types.

---

## Lessons Learned

1. **Email classification must be explicit, not implicit.** Anything not positively identified as a real customer email should be treated as ineligible for automation until proven otherwise.
2. **Shared rate limits across channels create invisible cross-channel impact.** An email loop exhausting the quota caused what looked like a webchat outage — with no direct connection visible to the user.
3. **Rate limits are both a safeguard and a diagnostic signal.** The quota exhaustion surfaced the loop. Monitoring for unusual quota depletion could catch similar incidents earlier.

---

## Related

- [LLM Provider Outage runbook](../runbooks/llm-provider-outage) — when AI replies stop for a different reason
- [SQS Backlog runbook](../runbooks/sqs-backlog) — handling backed-up AI response jobs

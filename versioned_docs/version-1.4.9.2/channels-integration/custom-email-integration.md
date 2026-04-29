---
sidebar_position: 2
---

# Custom Email (AWS SES) Integration Guide

## Overview

Custom email lets you connect one or more of your own domains to UnifiedBeez using AWS SES. The setup is split into two independent capabilities:

- **Receiving** (Phases 1–2) — route inbound emails at your domain into UnifiedBeez
- **Sending** (Phases 3–4) — send outbound emails from a specific address at your domain

Receiving must be verified before sending can be configured. You can add multiple domains — each gets its own `EmailAccount` tracked independently under a single shared `ConnectedChannel`.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Integration Flow](#integration-flow)
3. [Phase 1: Setup Receiving](#phase-1-setup-receiving)
4. [Phase 2: Verify Receiving](#phase-2-verify-receiving)
5. [Phase 3: Setup Sending](#phase-3-setup-sending)
6. [Phase 4: Verify Sending](#phase-4-verify-sending)
7. [Multiple Domains](#multiple-domains)
8. [Disconnecting an Account](#disconnecting-an-account)
9. [DNS Configuration Guide](#dns-configuration-guide)
10. [Error Handling](#error-handling)

---

## Prerequisites

### Backend Requirements

- AWS SES configured in production mode
- S3 bucket for email storage
- SNS topics for email notifications

### User Requirements

- Valid domain name
- Access to domain DNS settings
- Ability to add MX, TXT, and CNAME records

---

## Integration Flow

```
── RECEIVING ──────────────────────────────────────────────
Phase 1: POST /channels/email/custom/setup-receiving
         { domain } → returns emailAccountId + MX + TXT records
         ↓
         User adds MX and TXT records to DNS provider
         ↓
Phase 2: POST /channels/email/custom/:emailAccountId/verify-receiving
         → canReceive = true, inbound routing active

── SENDING (optional, requires Phase 2 complete) ──────────
Phase 3: POST /channels/email/custom/:emailAccountId/setup-sending
         { fromEmail } → returns CNAME records for DKIM
         ↓
         User adds 3 CNAME records to DNS provider
         ↓
Phase 4: POST /channels/email/custom/:emailAccountId/verify-sending
         → canSend = true, outbound via SES active
```

> **Key identifier:** `emailAccountId` (returned from Phase 1) is the handle for all subsequent calls. It is distinct from `connectedChannelId`.

---

## Phase 1: Setup Receiving

**Route:** `POST /channels/email/custom/setup-receiving`

**Payload:**

```json
{
  "domain": "yourdomain.com"
}
```

The domain is automatically cleaned — `https://`, `www.`, and trailing paths are stripped.

**Response:**

```json
{
  "success": true,
  "connectedChannelId": 123,
  "emailAccountId": 456,
  "domain": "yourdomain.com",
  "dnsRecords": {
    "mx": [
      { "priority": 10, "value": "inbound-smtp.us-east-1.amazonaws.com" }
    ],
    "txt": [
      "v=spf1 include:amazonses.com ~all",
      "unifiedbeez-verification=<verification_token>"
    ]
  },
  "instructions": "..."
}
```

**Save both IDs:**
- `connectedChannelId` — the shared channel container for all custom email domains
- `emailAccountId` — identifies this specific domain account; used for all subsequent phases

### What Happens Backend

1. Validates and cleans the domain
2. Registers the domain with AWS SES
3. Generates a verification token
4. Creates or reuses a single `ConnectedChannel` for custom email
5. Creates an `EmailAccount` (`canReceive: false`, `canSend: false`, `verificationStatus: PENDING`)
6. Creates an `EmailConfig` storing the DNS records for verification

---

## Phase 2: Verify Receiving

**Route:** `POST /channels/email/custom/:emailAccountId/verify-receiving`

No request body.

**Success response:**

```json
{
  "success": true,
  "verified": true,
  "domain": "yourdomain.com",
  "verifiedBy": "aws-ses",
  "canReceive": true
}
```

`verifiedBy` is either `"aws-ses"` or `"dns"` depending on which check succeeds first.

**Not yet verified:**

```json
{
  "success": false,
  "verified": false,
  "domain": "yourdomain.com",
  "missing": ["MX records", "SPF record"],
  "instructions": "..."
}
```

This is not an HTTP error — retry after DNS propagation.

### What Happens Backend

1. Checks AWS SES domain verification status
2. If SES reports success: marks `canReceive: true`, activates the `ConnectedChannel`, sets up SES receipt rules
3. If SES is not yet confirmed: falls back to direct DNS resolution (checks MX and TXT records)
4. On success: `EmailConfig.dnsRecords` is updated with `verificationStatus: "verified"` and a timestamp

---

## Phase 3: Setup Sending

Requires Phase 2 to be complete (`canReceive: true`).

**Route:** `POST /channels/email/custom/:emailAccountId/setup-sending`

**Payload:**

```json
{
  "fromEmail": "support@yourdomain.com"
}
```

`fromEmail` must be an address at the same domain that was set up in Phase 1 (e.g. `support@yourdomain.com`, not `support@otherdomain.com`).

**Response:**

```json
{
  "success": true,
  "accountId": 456,
  "domain": "yourdomain.com",
  "fromEmail": "support@yourdomain.com",
  "sendingDnsRecords": {
    "cname": [
      { "name": "tok1._domainkey.yourdomain.com", "value": "tok1.dkim.amazonses.com" },
      { "name": "tok2._domainkey.yourdomain.com", "value": "tok2.dkim.amazonses.com" },
      { "name": "tok3._domainkey.yourdomain.com", "value": "tok3.dkim.amazonses.com" }
    ]
  },
  "instructions": "..."
}
```

Add all three CNAME records to your DNS provider, then trigger Phase 4.

### What Happens Backend

1. Validates `fromEmail` belongs to the same domain
2. Enables DKIM on the domain in AWS SES (`setIdentityDkimEnabled`)
3. Fetches the three DKIM CNAME tokens from SES (`getIdentityDkimAttributes`)
4. Stores `fromEmail` and the CNAME records in `EmailConfig.dnsRecords`
5. Returns the CNAME records for the user to add

---

## Phase 4: Verify Sending

**Route:** `POST /channels/email/custom/:emailAccountId/verify-sending`

No request body.

**Success response:**

```json
{
  "success": true,
  "verified": true,
  "domain": "yourdomain.com",
  "fromEmail": "support@yourdomain.com",
  "canSend": true
}
```

**Not yet verified:**

```json
{
  "success": false,
  "verified": false,
  "domain": "yourdomain.com",
  "dkimStatus": "Pending",
  "instructions": "..."
}
```

`dkimStatus` reflects the raw AWS SES DKIM verification status (`Pending`, `Success`, `Failed`, `TemporaryFailure`, `NotStarted`).

### What Happens Backend

1. Calls `getIdentityDkimAttributes` on SES for the domain
2. If `DkimVerificationStatus === "Success"`: sets `canSend: true` and stores the verified timestamp
3. Otherwise returns the current DKIM status so the caller knows whether to retry or investigate

---

## Multiple Domains

Each call to `POST /channels/email/custom/setup-receiving` with a different domain creates a new `EmailAccount` under the same `ConnectedChannel`. Each domain:

- Gets its own `emailAccountId`
- Must go through Phases 1–4 independently
- Has its own `canReceive`, `canSend`, and verification state
- Can be disconnected independently without affecting other domains

`GET /channels/selected` returns each email account with its embedded `emailConfig` (containing DNS records and verification state).

---

## Disconnecting an Account

**Route:** `POST /channels/email/disconnect/custom`

**Payload:**

```json
{
  "accountId": 456
}
```

> `accountId` is the `emailAccountId` — not the `connectedChannelId`.

**Response:**

```json
{
  "success": true,
  "message": "Custom email account disconnected"
}
```

### What Happens Backend

1. Soft-disables the `EmailAccount` (`isActive: false`)
2. Removes references to this account in related records
3. If no active email accounts remain on the `ConnectedChannel`, deactivates the channel too

---

## DNS Configuration Guide

### Records Required for Receiving (Phases 1–2)

#### MX Record

Routes incoming email to AWS SES.

```
Type:     MX
Name:     @ (root domain)
Value:    inbound-smtp.us-east-1.amazonaws.com
Priority: 10
TTL:      3600
```

> Replace `us-east-1` with your configured AWS region if different.

#### TXT Records

Two TXT records on the root domain (`@`):

```
v=spf1 include:amazonses.com ~all
```
```
unifiedbeez-verification=<token_from_phase1_response>
```

Most DNS providers allow multiple TXT values on the same name — add them as two separate TXT records.

---

### Records Required for Sending (Phase 3)

#### CNAME Records (DKIM)

Three CNAME records for outbound email signing. The exact names and values come from the Phase 3 response:

```
Type:  CNAME
Name:  <token>._domainkey.yourdomain.com
Value: <token>.dkim.amazonses.com
```

Add all three. AWS typically verifies them within a few minutes to a few hours, though it can take up to 72 hours.

---

### Provider Examples

**Cloudflare:**
- MX: Name `@`, Mail server `inbound-smtp.us-east-1.amazonaws.com`, Priority `10`
- TXT: Name `@`, add each value as a separate record
- CNAME: Name = the `name` field (Cloudflare strips the root domain suffix automatically), Target = the `value` field

**GoDaddy:**
- MX: Points to `inbound-smtp.us-east-1.amazonaws.com`, Priority `10`
- TXT: Name `@`, Value = each string
- CNAME: Host = `<token>._domainkey`, Points to = `<token>.dkim.amazonses.com`

**Namecheap:**
- MX: Host `@`, Value `inbound-smtp.us-east-1.amazonaws.com`, Priority `10`
- TXT: Host `@`, Value = each string
- CNAME: Host = `<token>._domainkey`, Value = `<token>.dkim.amazonses.com`

---

## Error Handling

### Domain Already Configured

**Status:** 400 — `"Domain already configured and connected"`

The domain is already active. To re-run setup (e.g. after a token expiry), call Phase 1 again — it upserts and returns fresh records.

### Sender Address Wrong Domain

**Status:** 400 — `"Sender address must be at <domain>"`

`fromEmail` in Phase 3 must be at the same domain registered in Phase 1.

### Sending Setup Not Initiated

**Status:** 400 — `"Sending setup has not been initiated for this account"`

Phase 3 must be called before Phase 4.

### Receiving Not Verified

**Status:** 400 — `"Must verify receiving setup before enabling sending"`

Phase 2 must succeed before Phase 3 can be called.

### Invalid Domain Format

**Status:** 400 — `"Invalid domain format"`

Use bare format: `example.com`, not `https://example.com`.

### Email Account Not Found

**Status:** 400 — `"Invalid custom email account"`

The `emailAccountId` doesn't exist or doesn't belong to the authenticated user.

### AWS SES Quota Exceeded

**Status:** 500 — `"SES domain limit reached"`

Contact support to increase the AWS SES domain limit.

---

## Complete Flow Example

### Phase 1 — Setup Receiving

```bash
POST /channels/email/custom/setup-receiving
{ "domain": "mycompany.com" }
```

```json
{
  "connectedChannelId": 123,
  "emailAccountId": 456,
  "domain": "mycompany.com",
  "dnsRecords": {
    "mx": [{ "priority": 10, "value": "inbound-smtp.us-east-1.amazonaws.com" }],
    "txt": [
      "v=spf1 include:amazonses.com ~all",
      "unifiedbeez-verification=abc123xyz789"
    ]
  }
}
```

Add the MX and TXT records. Wait for DNS propagation.

### Phase 2 — Verify Receiving

```bash
POST /channels/email/custom/456/verify-receiving
```

```json
{ "success": true, "verified": true, "canReceive": true }
```

Inbound emails to `*@mycompany.com` now arrive in UnifiedBeez.

### Phase 3 — Setup Sending

```bash
POST /channels/email/custom/456/setup-sending
{ "fromEmail": "support@mycompany.com" }
```

```json
{
  "fromEmail": "support@mycompany.com",
  "sendingDnsRecords": {
    "cname": [
      { "name": "tok1._domainkey.mycompany.com", "value": "tok1.dkim.amazonses.com" },
      { "name": "tok2._domainkey.mycompany.com", "value": "tok2.dkim.amazonses.com" },
      { "name": "tok3._domainkey.mycompany.com", "value": "tok3.dkim.amazonses.com" }
    ]
  }
}
```

Add the three CNAME records. Wait for DKIM verification.

### Phase 4 — Verify Sending

```bash
POST /channels/email/custom/456/verify-sending
```

```json
{ "success": true, "verified": true, "fromEmail": "support@mycompany.com", "canSend": true }
```

Outbound emails sent through UnifiedBeez will now use `support@mycompany.com` as the sender.

---

## Verification Checklists

### Before Triggering Phase 2 (Receiving)

- [ ] MX record added: `inbound-smtp.<region>.amazonaws.com`, priority 10
- [ ] SPF TXT record added: `v=spf1 include:amazonses.com ~all`
- [ ] Verification TXT record added: `unifiedbeez-verification=<token>`
- [ ] All records saved and published
- [ ] Waited at least 1 hour (24–48 hours recommended)

### Before Triggering Phase 4 (Sending)

- [ ] All three CNAME records added with exact names and values from Phase 3 response
- [ ] Records saved and published
- [ ] Waited at least 15 minutes (can take up to 72 hours)

### DNS Verification Tools

- https://www.whatsmydns.net
- https://dnschecker.org
- https://mxtoolbox.com

---

## Troubleshooting

### Receiving Not Verifying

1. Confirm MX value: `inbound-smtp.{region}.amazonaws.com`
2. Confirm both TXT records are on `@` (root), not a subdomain
3. Confirm the `unifiedbeez-verification` token is copied exactly
4. Wait longer and retry

### Sending Not Verifying

1. Confirm all three CNAME records are present — check each `name` field exactly
2. On Cloudflare: the root domain suffix is stripped automatically from CNAME names — this is expected
3. DKIM verification can take up to 72 hours; check `dkimStatus` in the Phase 4 response for current state
4. If `dkimStatus` is `Failed`, re-run Phase 3 to regenerate tokens and re-add the records

### Emails Not Arriving

1. Verify `canReceive: true` in the Phase 2 response
2. Confirm no conflicting MX records have a lower priority number
3. Check the S3 bucket and SNS subscription are active (contact support)

### Emails Not Sending

1. Verify `canSend: true` in the Phase 4 response
2. Confirm `fromEmail` is set — sending will fail if Phase 3 was never completed
3. Check the recipient is not on the suppression list

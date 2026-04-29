---
sidebar_position: 2
---

# Custom Email (AWS SES) Integration Guide

## Overview

Custom email lets you connect one or more of your own domains to UnifiedBeez using AWS SES for both receiving and sending. The flow is two steps:

1. **Setup** — provide your sender address; the domain is inferred automatically. Returns all DNS records needed for both inbound routing and outbound signing.
2. **Verify** — trigger once DNS has propagated. Activates receiving and sending independently — DKIM (sending) can take longer than MX/TXT (receiving), so `canReceive` and `canSend` may not both be true on the first verify attempt.

You can add multiple domains — each gets its own `EmailAccount` tracked independently under a single shared `ConnectedChannel`.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Integration Flow](#integration-flow)
3. [Step 1: Setup](#step-1-setup)
4. [Step 2: Verify](#step-2-verify)
5. [Multiple Domains](#multiple-domains)
6. [Disconnecting an Account](#disconnecting-an-account)
7. [DNS Configuration Guide](#dns-configuration-guide)
8. [Error Handling](#error-handling)
9. [Troubleshooting](#troubleshooting)

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
POST /channels/email/custom/setup
     { fromEmail: "support@yourdomain.com" }
     → domain inferred from fromEmail
     → returns emailAccountId + MX + TXT + CNAME records
     ↓
User adds all DNS records to their provider
     ↓
POST /channels/email/custom/:emailAccountId/verify
     → canReceive: true  (once MX + TXT propagate)
     → canSend: true     (once CNAME/DKIM propagates — may need a second verify call)
```

> **Key identifier:** `emailAccountId` (returned from setup) is the handle for verify and disconnect. Keep it — it is distinct from `connectedChannelId`.

---

## Step 1: Setup

**Route:** `POST /channels/email/custom/setup`

**Payload:**

```json
{
  "fromEmail": "support@yourdomain.com"
}
```

The domain (`yourdomain.com`) is extracted from `fromEmail` automatically. You do not need to pass it separately.

**Response:**

```json
{
  "success": true,
  "connectedChannelId": 123,
  "emailAccountId": 456,
  "domain": "yourdomain.com",
  "fromEmail": "support@yourdomain.com",
  "dnsRecords": {
    "mx": [
      { "priority": 10, "value": "inbound-smtp.us-east-1.amazonaws.com" }
    ],
    "txt": [
      "v=spf1 include:amazonses.com ~all",
      "unifiedbeez-verification=<verification_token>"
    ],
    "cname": [
      { "name": "tok1._domainkey.yourdomain.com", "value": "tok1.dkim.amazonses.com" },
      { "name": "tok2._domainkey.yourdomain.com", "value": "tok2.dkim.amazonses.com" },
      { "name": "tok3._domainkey.yourdomain.com", "value": "tok3.dkim.amazonses.com" }
    ]
  },
  "instructions": "..."
}
```

**Save both IDs:**
- `connectedChannelId` — the shared channel container for all custom email domains on this account
- `emailAccountId` — identifies this specific domain; use it for verify and disconnect

### What Happens Backend

1. Extracts and validates the domain from `fromEmail`
2. Registers the domain with AWS SES
3. Enables DKIM on the domain and fetches the three CNAME tokens
4. Generates MX, TXT (SPF + verification), and CNAME (DKIM) records
5. Creates or reuses a single `ConnectedChannel` for custom email
6. Creates an `EmailAccount` (`canReceive: false`, `canSend: false`, `verificationStatus: PENDING`)
7. Creates an `EmailConfig` storing all DNS records, the verification token, and `fromEmail`

---

## Step 2: Verify

**Route:** `POST /channels/email/custom/:emailAccountId/verify`

No request body.

**Response:**

```json
{
  "success": true,
  "domain": "yourdomain.com",
  "fromEmail": "support@yourdomain.com",
  "canReceive": true,
  "canSend": true,
  "verifiedBy": "dns"
}
```

`success` is `true` as long as receiving is verified. `canSend` may be `false` on the first call if DKIM is still propagating — call verify again once DKIM has settled.

**Partial response (receiving verified, DKIM still pending):**

```json
{
  "success": true,
  "domain": "yourdomain.com",
  "fromEmail": "support@yourdomain.com",
  "canReceive": true,
  "canSend": false,
  "dkimStatus": "Pending"
}
```

**Not yet verified (neither receiving nor sending):**

```json
{
  "success": false,
  "domain": "yourdomain.com",
  "canReceive": false,
  "canSend": false,
  "missingReceiving": ["MX records", "SPF record"],
  "dkimStatus": "Pending"
}
```

This is not an HTTP error — retry after DNS propagation.

### What Happens Backend

1. Checks receiving: SES domain verification status first, then falls back to direct DNS check (MX + TXT)
2. Checks sending: DKIM verification status via `getIdentityDkimAttributes`
3. Sets `canReceive: true` and/or `canSend: true` for whichever checks pass
4. Activates the `ConnectedChannel` once receiving is verified
5. Sets up SES receipt rules for the domain once receiving is verified

---

## Multiple Domains

Each call to `POST /channels/email/custom/setup` with a different `fromEmail` domain creates a new `EmailAccount` under the same `ConnectedChannel`. Each domain:

- Gets its own `emailAccountId`
- Must be verified independently via `POST /channels/email/custom/:emailAccountId/verify`
- Has its own `canReceive`, `canSend`, verification state, and `fromEmail`
- Can be disconnected independently without affecting other domains

`GET /channels/selected` returns each email account with its embedded `emailConfig` (containing DNS records, verification state, and `fromEmail`).

---

## Disconnecting an Account

**Route:** `POST /channels/email/disconnect/custom`

**Payload:**

```json
{
  "accountId": 456
}
```

> `accountId` is the `emailAccountId` from setup — not the `connectedChannelId`.

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

All records come from the setup response. Add them all at once — you only need to verify once (or twice if DKIM propagates slower than MX/TXT).

### MX Record — Inbound Routing

```
Type:     MX
Name:     @ (root domain)
Value:    inbound-smtp.us-east-1.amazonaws.com
Priority: 10
TTL:      3600
```

> Replace `us-east-1` with your configured AWS region if different.

### TXT Records — SPF + Verification

Two TXT records on the root domain (`@`). Add as two separate entries:

```
v=spf1 include:amazonses.com ~all
```
```
unifiedbeez-verification=<token_from_setup_response>
```

### CNAME Records — DKIM Signing

Three CNAME records for outbound email signing. Names and values come from the `cname` array in the setup response:

```
Type:  CNAME
Name:  <token>._domainkey.yourdomain.com
Value: <token>.dkim.amazonses.com
```

Add all three.

---

### Provider Examples

**Cloudflare:**
- MX: Name `@`, Mail server from `mx[].value`, Priority `10`
- TXT: Name `@`, add each `txt[]` value as a separate record
- CNAME: Name = `cname[].name` (Cloudflare strips the root domain suffix — this is expected), Target = `cname[].value`

**GoDaddy:**
- MX: Host `@`, Points to the MX value, Priority `10`
- TXT: Name `@`, Value = each string
- CNAME: Host = `<token>._domainkey`, Points to = `<token>.dkim.amazonses.com`

**Namecheap:**
- MX: Host `@`, Value = MX value, Priority `10`
- TXT: Host `@`, Value = each string
- CNAME: Host = `<token>._domainkey`, Value = `<token>.dkim.amazonses.com`

---

## Error Handling

### Invalid Sender Address

**Status:** 400 — `"Invalid sender email address"` or `"Invalid domain in sender address"`

`fromEmail` must be a valid email address at a valid domain.

### Domain Already Configured

**Status:** 400 — `"Domain already configured and connected"`

Both `canReceive` and `canSend` are already true for this domain. To re-run setup (e.g. to change `fromEmail` or refresh tokens), disconnect the account first.

### Email Account Not Found

**Status:** 400 — `"Invalid custom email account"`

The `emailAccountId` doesn't exist or doesn't belong to the authenticated user.

### AWS SES Quota Exceeded

**Status:** 500 — `"SES domain limit reached"`

Contact support to increase the AWS SES domain limit.

---

## Complete Example

### Setup

```bash
POST /channels/email/custom/setup
{ "fromEmail": "support@mycompany.com" }
```

```json
{
  "connectedChannelId": 123,
  "emailAccountId": 456,
  "domain": "mycompany.com",
  "fromEmail": "support@mycompany.com",
  "dnsRecords": {
    "mx": [{ "priority": 10, "value": "inbound-smtp.us-east-1.amazonaws.com" }],
    "txt": [
      "v=spf1 include:amazonses.com ~all",
      "unifiedbeez-verification=abc123xyz789"
    ],
    "cname": [
      { "name": "tok1._domainkey.mycompany.com", "value": "tok1.dkim.amazonses.com" },
      { "name": "tok2._domainkey.mycompany.com", "value": "tok2.dkim.amazonses.com" },
      { "name": "tok3._domainkey.mycompany.com", "value": "tok3.dkim.amazonses.com" }
    ]
  }
}
```

Add all DNS records. Wait for propagation (MX/TXT typically within hours, DKIM up to 72 hours).

### Verify (first call — receiving done, DKIM still settling)

```bash
POST /channels/email/custom/456/verify
```

```json
{
  "success": true,
  "canReceive": true,
  "canSend": false,
  "dkimStatus": "Pending"
}
```

Inbound email is now active. Call verify again once DKIM propagates.

### Verify (second call — both active)

```bash
POST /channels/email/custom/456/verify
```

```json
{
  "success": true,
  "canReceive": true,
  "canSend": true,
  "fromEmail": "support@mycompany.com"
}
```

Both inbound and outbound are now fully active.

---

## Verification Checklist

Before the first verify call:

- [ ] MX record added: `inbound-smtp.<region>.amazonaws.com`, priority 10
- [ ] SPF TXT record added: `v=spf1 include:amazonses.com ~all`
- [ ] Verification TXT record added with the exact token from the setup response
- [ ] All three CNAME records added with exact names and values
- [ ] Records saved and published at DNS provider
- [ ] Waited at least 1 hour for MX/TXT; DKIM can take up to 72 hours

### DNS Verification Tools

- https://www.whatsmydns.net
- https://dnschecker.org
- https://mxtoolbox.com

---

## Troubleshooting

### Receiving Not Verifying (`canReceive: false`)

1. Confirm MX value: `inbound-smtp.{region}.amazonaws.com`
2. Confirm both TXT records are on `@` (root), not a subdomain
3. Confirm the `unifiedbeez-verification` token is copied exactly from the setup response
4. Wait longer and retry verify

### Sending Not Verifying (`canSend: false`, `dkimStatus: "Pending"`)

1. Confirm all three CNAME records are present with the correct names and values
2. On Cloudflare: the root domain is stripped from CNAME names automatically — this is correct
3. DKIM propagation can take up to 72 hours; call verify again later
4. If `dkimStatus` is `Failed`, run setup again to regenerate tokens, update the CNAME records, and re-verify

### Emails Not Arriving

1. Verify `canReceive: true` in the verify response
2. Confirm no other MX records exist with a lower priority number
3. Contact support to verify the S3 bucket and SNS subscription are active

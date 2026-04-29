---
sidebar_position: 2
---

# Custom Email (AWS SES) Integration Guide

## Overview

Custom email lets you connect one or more of your own domains to UnifiedBeez using AWS SES for inbound routing. Each domain goes through a two-phase flow: DNS setup then per-account verification. You can add multiple domains — each gets its own `EmailAccount` tracked independently under a single shared `ConnectedChannel`.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Integration Flow](#integration-flow)
3. [Phase 1: Setup Domain](#phase-1-setup-domain)
4. [Phase 2: Verify Domain](#phase-2-verify-domain)
5. [Multiple Domains](#multiple-domains)
6. [Disconnecting an Account](#disconnecting-an-account)
7. [Response Formats](#response-formats)
8. [DNS Configuration Guide](#dns-configuration-guide)
9. [Error Handling](#error-handling)

---

## Prerequisites

### Backend Requirements

- AWS SES configured in production mode
- S3 bucket for email storage
- SNS topics for email notifications
- Domain ownership verification capability

### User Requirements

- Valid domain name
- Access to domain DNS settings
- Ability to add MX, TXT, and CNAME records

---

## Integration Flow

```
1. User provides domain name
   ↓
2. Backend registers domain with AWS SES, generates DNS records
   ↓
3. Backend returns connectedChannelId + emailAccountId + DNS records
   ↓
4. User adds MX, TXT (SPF + verification), and CNAME (DKIM) records
   ↓
5. DNS propagation (24–48 hours)
   ↓
6. User triggers verification using emailAccountId
   ↓
7. Backend checks AWS SES status (falls back to direct DNS check)
   ↓
8. On success: EmailAccount marked canReceive=true, receipt rules activated
   ↓
9. Emails sent to *@yourdomain.com arrive in UnifiedBeez
```

> **Key identifier:** `emailAccountId` (returned from setup) is what identifies a specific domain account. It is distinct from `connectedChannelId`. Use `emailAccountId` for verification and disconnect.

---

## Phase 1: Setup Domain

### Initiate Custom Email Setup

**Route:** `POST /channels/email/custom/setup-receiving`

**Payload:**

```json
{
  "domain": "yourdomain.com"
}
```

The domain is automatically cleaned (strips `https://`, `www.`, trailing paths).

**Response:**

```json
{
  "success": true,
  "connectedChannelId": 123,
  "emailAccountId": 456,
  "domain": "yourdomain.com",
  "dnsRecords": {
    "mx": [
      {
        "priority": 10,
        "value": "inbound-smtp.us-east-1.amazonaws.com"
      }
    ],
    "txt": [
      "v=spf1 include:amazonses.com ~all",
      "unifiedbeez-verification=<verification_token>"
    ],
    "cname": [
      {
        "name": "<dkim_token1>._domainkey.yourdomain.com",
        "value": "<dkim_token1>.dkim.amazonses.com"
      },
      {
        "name": "<dkim_token2>._domainkey.yourdomain.com",
        "value": "<dkim_token2>.dkim.amazonses.com"
      },
      {
        "name": "<dkim_token3>._domainkey.yourdomain.com",
        "value": "<dkim_token3>.dkim.amazonses.com"
      }
    ]
  },
  "instructions": "..."
}
```

**Important — save both IDs:**
- `connectedChannelId` — the channel container (shared across all domains for this account type)
- `emailAccountId` — uniquely identifies this domain's email account; used for verification and disconnect

### What Happens Backend

1. Validates and cleans the domain
2. Registers domain with AWS SES (generates DKIM tokens)
3. Generates DNS records (MX, SPF TXT, verification TXT, DKIM CNAMEs)
4. Creates or reuses a single `ConnectedChannel` for custom email
5. Creates an `EmailAccount` with `canReceive: false`, `verificationStatus: "PENDING"`
6. Creates an `EmailConfig` storing the DNS records for later verification

---

## Phase 2: Verify Domain

### Trigger Verification

**Route:** `POST /channels/email/custom/:emailAccountId/verify-receiving`

> The path parameter is the `emailAccountId` returned from Phase 1 — not the `connectedChannelId`.

**No request body required.**

**Success Response (verified via AWS SES):**

```json
{
  "success": true,
  "verified": true,
  "domain": "yourdomain.com",
  "verifiedBy": "aws-ses",
  "canReceive": true
}
```

**Success Response (verified via direct DNS check):**

```json
{
  "success": true,
  "verified": true,
  "domain": "yourdomain.com",
  "verifiedBy": "dns",
  "canReceive": true
}
```

**Not Yet Verified Response:**

```json
{
  "success": false,
  "verified": false,
  "domain": "yourdomain.com",
  "missing": ["mx", "spf"],
  "instructions": "..."
}
```

### What Happens Backend

1. Looks up the `EmailAccount` by `emailAccountId` (must belong to authenticated user)
2. Checks AWS SES domain verification status first
3. If SES reports `Success`: marks `canReceive: true`, activates the `ConnectedChannel`, sets up SES receipt rules
4. If SES is not yet confirmed: falls back to direct DNS resolution (checks MX and TXT records)
5. On either path succeeding: `EmailConfig.dnsRecords` is updated with `verificationStatus: "verified"` and a `verifiedAt` timestamp

---

## Multiple Domains

Each call to `POST /channels/email/custom/setup-receiving` with a different domain creates a new `EmailAccount` under the same `ConnectedChannel`. Each domain:

- Gets its own `emailAccountId`
- Must be verified independently via `POST /channels/email/custom/:emailAccountId/verify-receiving`
- Has its own DNS records, verification status, and `canReceive` flag
- Can be disconnected independently without affecting other domains

The `GET /channels/selected` response reflects this: each email account under the custom email channel includes its embedded `emailConfig` (with DNS records and verification status).

---

## Disconnecting an Account

Remove a specific domain's email account without affecting others.

**Route:** `POST /channels/email/disconnect/custom`

**Payload:**

```json
{
  "accountId": 456
}
```

> `accountId` is the `emailAccountId` from setup — **not** the `connectedChannelId`.

**Response:**

```json
{
  "success": true,
  "message": "Custom email account disconnected"
}
```

### What Happens Backend

1. Soft-disables the `EmailAccount` (`isActive: false`)
2. Removes any references to this account in related records
3. If no active email accounts remain on the `ConnectedChannel`, deactivates the channel too

---

## Response Formats

### Setup Response

```typescript
{
  success: true;
  connectedChannelId: number;
  emailAccountId: number;       // use this for verify + disconnect
  domain: string;
  dnsRecords: {
    mx: Array<{ priority: number; value: string }>;
    txt: string[];              // SPF record + unifiedbeez-verification token
    cname: Array<{ name: string; value: string }>;  // DKIM records
  };
  instructions: string;
}
```

### Verify Response

```typescript
// Success
{
  success: true;
  verified: true;
  domain: string;
  verifiedBy: 'aws-ses' | 'dns';
  canReceive: true;
}

// Not yet verified
{
  success: false;
  verified: false;
  domain: string;
  missing: string[];    // e.g. ["mx", "spf"]
  instructions: string;
}
```

---

## DNS Configuration Guide

You need to add three types of records. All three must propagate before verification succeeds.

### 1. MX Record

Routes incoming email to AWS SES.

```
Type:     MX
Name:     @ (root domain)
Value:    inbound-smtp.us-east-1.amazonaws.com
Priority: 10
TTL:      3600
```

> Replace `us-east-1` with your configured AWS region if different.

### 2. TXT Records

Two TXT records are required at the root domain (`@`):

**SPF record** — authorises Amazon SES to send on your behalf:
```
v=spf1 include:amazonses.com ~all
```

**Verification token** — proves domain ownership to UnifiedBeez:
```
unifiedbeez-verification=<token_from_setup_response>
```

Most DNS providers allow multiple TXT values on the same name. Add both as separate TXT records on `@`.

### 3. CNAME Records (DKIM)

The setup response includes three CNAME records for DKIM signing. Add each one:

```
Type:  CNAME
Name:  <dkim_token>._domainkey.yourdomain.com
Value: <dkim_token>.dkim.amazonses.com
```

The exact names and values are provided in the `cname` array of the setup response.

---

### Provider Examples

**Cloudflare:**
- DNS → Add Record
- MX: Name `@`, Mail server `inbound-smtp.us-east-1.amazonaws.com`, Priority `10`
- TXT: Name `@`, add each TXT value separately
- CNAME: Name = the `name` field, Target = the `value` field (Cloudflare may strip the root domain suffix automatically)

**GoDaddy:**
- DNS Management → Add Record
- MX: Points to `inbound-smtp.us-east-1.amazonaws.com`, Priority `10`
- TXT: Name `@`, Value = each TXT string
- CNAME: Host = `<token>._domainkey`, Points to = `<token>.dkim.amazonses.com`

**Namecheap:**
- Advanced DNS → Add New Record
- MX: Host `@`, Value `inbound-smtp.us-east-1.amazonaws.com`, Priority `10`
- TXT: Host `@`, Value = each TXT string
- CNAME: Host = `<token>._domainkey`, Value = `<token>.dkim.amazonses.com`

---

## Error Handling

### Domain Already Configured

**Status:** 400

```json
{
  "statusCode": 400,
  "message": "Domain already configured and connected",
  "error": "Bad Request"
}
```

The domain is already active for this account. To re-setup (e.g. after a token expiry), call the setup endpoint again — it will upsert and return fresh DNS records.

---

### Invalid Domain Format

**Status:** 400

```json
{
  "statusCode": 400,
  "message": "Invalid domain format",
  "error": "Bad Request"
}
```

Ensure the domain is bare format: `example.com`, not `https://example.com` or `www.example.com`.

---

### Email Account Not Found

**Status:** 400

```json
{
  "statusCode": 400,
  "message": "Invalid custom email account",
  "error": "Bad Request"
}
```

The `emailAccountId` doesn't exist or doesn't belong to the authenticated user.

---

### DNS Not Yet Propagated

The verify endpoint returns `success: false` (not an HTTP error) with the `missing` field listing which checks failed. Retry after waiting for propagation.

---

### AWS SES Quota Exceeded

**Status:** 500

```json
{
  "statusCode": 500,
  "message": "SES domain limit reached",
  "error": "Internal Server Error"
}
```

Contact support to increase the AWS SES domain limit.

---

## Complete Flow Example

### Step 1 — Setup

```bash
POST /channels/email/custom/setup-receiving
{
  "domain": "mycompany.com"
}
```

```json
{
  "success": true,
  "connectedChannelId": 123,
  "emailAccountId": 456,
  "domain": "mycompany.com",
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

### Step 2 — Add DNS Records

Add all records to your DNS provider (MX, two TXT values, three CNAMEs). Wait 24–48 hours.

### Step 3 — Verify

```bash
POST /channels/email/custom/456/verify-receiving
```

```json
{
  "success": true,
  "verified": true,
  "domain": "mycompany.com",
  "verifiedBy": "aws-ses",
  "canReceive": true
}
```

Emails sent to any address at `mycompany.com` now route into UnifiedBeez.

### Step 4 — Add Another Domain (Optional)

Repeat Steps 1–3 with a different domain. Each call returns a new `emailAccountId`. Both domains appear as separate accounts in `GET /channels/selected` under the same custom email channel.

---

## Verification Checklist

Before triggering verification:

- [ ] MX record added pointing to `inbound-smtp.<region>.amazonaws.com` with priority 10
- [ ] Both TXT records added to root domain (SPF + unifiedbeez-verification token)
- [ ] All three CNAME records added for DKIM
- [ ] Records saved and published at DNS provider
- [ ] Waited at least 1 hour (24–48 hours recommended)
- [ ] Confirmed propagation with an online tool

### DNS Verification Tools

- https://www.whatsmydns.net
- https://dnschecker.org
- https://mxtoolbox.com

---

## Troubleshooting

### DNS Not Verifying

1. Confirm MX value matches exactly: `inbound-smtp.{region}.amazonaws.com`
2. Confirm both TXT records are present on `@` (not a subdomain)
3. Confirm the `unifiedbeez-verification` token matches exactly what was returned in setup
4. Confirm all three CNAME records are present with correct names and values
5. Wait longer — CNAME propagation can be slower than MX/TXT

### Emails Not Arriving

1. Verify `canReceive: true` in the verification response
2. Check that `verificationStatus` is `"verified"` in the account details from `GET /channels/selected`
3. Confirm no conflicting MX records exist that have higher priority (lower number)
4. Check the S3 bucket and SNS subscription are active (contact support if unsure)

### Re-running Setup After Token Expiry

Call the setup endpoint again with the same domain — it will upsert the account and generate a new verification token. Update the `unifiedbeez-verification` TXT record with the new token, then verify again.

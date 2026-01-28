---
sidebar_position: 2
---

# Custom Email (AWS SES) Integration Guide

## Overview

This guide covers setting up custom domain email receiving using AWS SES (Simple Email Service). The setup is a two-phase process requiring DNS configuration.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Integration Flow](#integration-flow)
3. [Phase 1: Setup Receiving](#phase-1-setup-receiving)
4. [Phase 2: Verify Setup](#phase-2-verify-setup)
5. [Setup Email Receiving Webhook](#setup-email-receiving-webhook)
6. [Response Formats](#response-formats)
7. [DNS Configuration Guide](#dns-configuration-guide)
8. [Error Handling](#error-handling)

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
- Ability to add DNS records (MX, TXT)

---

## Integration Flow

### Complete Setup Flow

```
1. User provides domain name
   ↓
2. Backend generates DNS records (MX, TXT verification)
   ↓
3. User receives DNS records to configure
   ↓
4. User adds DNS records to their domain provider
   ↓
5. DNS propagation (can take 24-48 hours)
   ↓
6. User triggers verification
   ↓
7. Backend verifies DNS records with AWS SES
   ↓
8. Backend activates email receiving
   ↓
9. User can now receive emails at domain
```

---

## Phase 1: Setup Receiving

### Initiate Custom Email Setup

**Route:** `POST /channels/email/custom/setup-receiving`

**Headers:**

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Payload:**

```json
{
  "domain": "yourdomain.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Custom email setup initiated",
  "connectedChannelId": 123,
  "domain": "yourdomain.com",
  "status": "pending_verification",
  "dnsRecords": {
    "mx": [
      {
        "type": "MX",
        "name": "@",
        "value": "inbound-smtp.us-east-1.amazonaws.com",
        "priority": 10,
        "ttl": 3600
      }
    ],
    "txt": [
      {
        "type": "TXT",
        "name": "_amazonses.yourdomain.com",
        "value": "verification_token_here",
        "ttl": 3600
      }
    ]
  },
  "instructions": "Add the DNS records to your domain provider and verify within 72 hours"
}
```

### What Happens Backend

1. Creates `ConnectedChannel` with status "pending_verification"
2. Registers domain with AWS SES
3. Generates verification token
4. Returns DNS records for user configuration
5. Domain stored but not yet verified

---

## Phase 2: Verify Setup

### Verify DNS Configuration

**Route:** `POST /channels/email/custom/:channelId/verify-receiving`

**Headers:**

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Path Parameters:**

- `channelId`: The connectedChannelId from Phase 1

**Payload:**

```json
{}
```

**Success Response:**

```json
{
  "success": true,
  "message": "Custom email receiving activated",
  "connectedChannelId": 123,
  "domain": "yourdomain.com",
  "status": "verified",
  "emailAccounts": [
    {
      "id": 456,
      "email": "support@yourdomain.com",
      "canReceive": true,
      "canSend": false
    }
  ],
  "verifiedAt": "2025-12-17T12:00:00.000Z"
}
```

**Failed Verification Response:**

```json
{
  "statusCode": 400,
  "message": "DNS records not yet propagated or incorrectly configured",
  "error": "Bad Request",
  "details": {
    "domain": "yourdomain.com",
    "missingRecords": ["MX", "TXT"],
    "suggestion": "Please wait for DNS propagation (24-48 hours) or check your DNS configuration"
  }
}
```

### What Happens Backend

1. Checks AWS SES domain verification status
2. Verifies MX records point to AWS SES
3. Verifies TXT record for domain ownership
4. If verified:
   - Updates channel status to "verified"
   - Creates EmailAccount for domain
   - Activates SES receipt rules
   - Configures S3 storage for incoming emails
5. If not verified:
   - Returns error with missing records
   - Keeps channel in "pending_verification" state

---

## Setup Email Receiving Webhook

After verification, set up the receiving mechanism (webhook subscription or polling).

**Route:** `POST /channels/email/setup-receiving/:channelId`

**Headers:**

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Path Parameters:**

- `channelId`: The connectedChannelId

**Payload:**

```json
{}
```

**Response:**

```json
{
  "message": "Email receiving setup successful",
  "provider": "custom"
}
```

### What Happens Backend

1. Creates SNS subscription for email notifications
2. Configures webhook endpoint for incoming emails
3. Sets up SES receipt rule set
4. Links S3 bucket to channel for email storage

---

## Response Formats

### Setup Response Structure

```typescript
{
  success: boolean;
  message: string;
  connectedChannelId: number;
  domain: string;
  status: 'pending_verification' | 'verified' | 'failed';
  dnsRecords?: {
    mx: Array<{
      type: string;
      name: string;
      value: string;
      priority?: number;
      ttl: number;
    }>;
    txt: Array<{
      type: string;
      name: string;
      value: string;
      ttl: number;
    }>;
  };
  instructions?: string;
}
```

### Verification Response Structure

```typescript
{
  success: boolean;
  message: string;
  connectedChannelId: number;
  domain: string;
  status: 'verified' | 'pending_verification';
  emailAccounts?: Array<{
    id: number;
    email: string;
    canReceive: boolean;
    canSend: boolean;
  }>;
  verifiedAt?: string; // ISO 8601 format
}
```

---

## DNS Configuration Guide

### Step-by-Step DNS Setup

#### 1. MX Record (Mail Exchange)

Directs incoming emails to AWS SES.

**Example Configuration:**

```
Type:     MX
Name:     @ (or leave blank for root domain)
Value:    inbound-smtp.us-east-1.amazonaws.com
Priority: 10
TTL:      3600 (1 hour)
```

**Common DNS Providers:**

**GoDaddy:**

- Go to DNS Management
- Add Record → MX
- Priority: 10
- Points to: inbound-smtp.us-east-1.amazonaws.com

**Cloudflare:**

- DNS → Add Record
- Type: MX
- Name: @
- Mail server: inbound-smtp.us-east-1.amazonaws.com
- Priority: 10

**Namecheap:**

- Advanced DNS → Add New Record
- Type: MX Record
- Host: @
- Value: inbound-smtp.us-east-1.amazonaws.com
- Priority: 10

#### 2. TXT Record (Domain Verification)

Proves domain ownership to AWS SES.

**Example Configuration:**

```
Type:  TXT
Name:  _amazonses.yourdomain.com
Value: verification_token_from_aws
TTL:   3600 (1 hour)
```

**Common DNS Providers:**

**GoDaddy:**

- DNS Management
- Add Record → TXT
- Name: \_amazonses
- Value: paste verification token

**Cloudflare:**

- DNS → Add Record
- Type: TXT
- Name: \_amazonses
- Content: paste verification token

**Namecheap:**

- Advanced DNS → Add New Record
- Type: TXT Record
- Host: \_amazonses
- Value: paste verification token

---

## Error Handling

### Common Error Scenarios

#### Domain Already Registered

**Status Code:** 400

**Response:**

```json
{
  "statusCode": 400,
  "message": "Domain already registered",
  "error": "Bad Request"
}
```

**Action:** Check if domain is already connected or use different domain

---

#### DNS Records Not Propagated

**Status Code:** 400

**Response:**

```json
{
  "statusCode": 400,
  "message": "DNS records not yet propagated or incorrectly configured",
  "error": "Bad Request",
  "details": {
    "domain": "yourdomain.com",
    "missingRecords": ["MX", "TXT"]
  }
}
```

**Actions:**

1. Wait 24-48 hours for DNS propagation
2. Verify DNS records are correctly configured
3. Use DNS checker tools (whatsmydns.net, dnschecker.org)
4. Retry verification after propagation

---

#### Invalid Domain Format

**Status Code:** 400

**Response:**

```json
{
  "statusCode": 400,
  "message": "Invalid domain format",
  "error": "Bad Request"
}
```

**Action:** Ensure domain is in correct format (e.g., `example.com`, not `https://example.com`)

---

#### Channel Not Found

**Status Code:** 404

**Response:**

```json
{
  "statusCode": 404,
  "message": "Channel not found",
  "error": "Not Found"
}
```

**Action:** Verify channelId is correct and belongs to authenticated user

---

#### AWS SES Quota Exceeded

**Status Code:** 500

**Response:**

```json
{
  "statusCode": 500,
  "message": "SES domain limit reached",
  "error": "Internal Server Error"
}
```

**Action:** Contact support to increase AWS SES domain limit

---

## Verification Checklist

Before triggering verification, ensure:

- [ ] MX record added with correct value and priority
- [ ] TXT record added with correct verification token
- [ ] DNS changes saved at domain provider
- [ ] Waited at least 1 hour for DNS propagation (24-48 hours recommended)
- [ ] Verified DNS propagation using online tools
- [ ] No conflicting MX records exist

### DNS Verification Tools

Check DNS propagation:

- https://www.whatsmydns.net
- https://dnschecker.org
- https://mxtoolbox.com

---

## Complete Flow Example

### Step 1: Setup

**Request:**

```bash
POST /channels/email/custom/setup-receiving
{
  "domain": "mycompany.com"
}
```

**Response:**

```json
{
  "connectedChannelId": 123,
  "domain": "mycompany.com",
  "status": "pending_verification",
  "dnsRecords": {
    "mx": [
      {
        "type": "MX",
        "value": "inbound-smtp.us-east-1.amazonaws.com",
        "priority": 10
      }
    ],
    "txt": [
      {
        "type": "TXT",
        "name": "_amazonses.mycompany.com",
        "value": "abc123xyz789"
      }
    ]
  }
}
```

### Step 2: Configure DNS

Add records to DNS provider (wait 24-48 hours for propagation)

### Step 3: Verify

**Request:**

```bash
POST /channels/email/custom/123/verify-receiving
{}
```

**Response (Success):**

```json
{
  "success": true,
  "status": "verified",
  "emailAccounts": [
    {
      "id": 456,
      "email": "support@mycompany.com",
      "canReceive": true
    }
  ]
}
```

### Step 4: Activate Receiving

**Request:**

```bash
POST /channels/email/setup-receiving/123
{}
```

**Response:**

```json
{
  "message": "Email receiving setup successful",
  "provider": "custom"
}
```

---

## Important Notes

1. **DNS Propagation Time:** Can take 24-48 hours, but often faster (1-4 hours)
2. **Verification Expiry:** AWS SES verification tokens expire after 72 hours
3. **MX Priority:** Use priority 10 unless you have existing mail servers
4. **Multiple Domains:** Each domain requires separate setup
5. **Email Addresses:** After verification, any email sent to `*@yourdomain.com` will be received
6. **Storage:** Incoming emails are stored in S3 and processed via webhooks
7. **Sending:** Custom email receiving does NOT include sending capabilities (requires separate SMTP setup)

---

## Troubleshooting

### DNS Not Verifying

**Check:**

1. Correct MX record value: `inbound-smtp.{region}.amazonaws.com`
2. Correct TXT record name: `_amazonses.yourdomain.com`
3. No typos in verification token
4. Records are saved and published
5. Wait longer for propagation

### Emails Not Being Received

**Check:**

1. Domain verification status is "verified"
2. Receipt rules are active
3. S3 bucket permissions are correct
4. SNS subscription is confirmed
5. Check spam/junk folders

### Need to Re-verify

If verification expires:

1. Call setup endpoint again with same domain
2. New verification token will be generated
3. Update TXT record with new token
4. Trigger verification again

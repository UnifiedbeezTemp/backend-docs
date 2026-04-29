---
sidebar_position: 4
---

# Two-Factor Authentication (2FA) – Frontend Integration Guide

This document describes the **end-to-end 2FA lifecycle** in UnifiedBeez, including **setup, login verification, recovery options, and management**.

---

## 1️⃣ 2FA SETUP FLOW (Logged-in User)

### Step 1: Initiate 2FA Setup

**Endpoint**

```http
POST /auth/2fa/setup
```

**Auth**

- Requires active session (`SessionAuthGuard`)
- Cookie-based (web) or `session_id` (mobile)

**Response**

```json
{
  "qrCodeUrl": "data:image/png;base64,...",
  "secret": "BASE32_SECRET",
  "backupCodes": ["12345678", "..."]
}
```

**Frontend Responsibilities**

- Display QR code for authenticator apps (Google Authenticator, Authy, etc.)
- Instruct user to scan QR code
- Display **backup codes ONCE**
- Force user to save backup codes (download / confirm checkbox)

---

### Step 2: Verify & Enable 2FA

**Endpoint**

```http
POST /auth/2fa/verify-setup
```

**Payload**

```json
{
  "token": "123456",
  "backupCodes": ["12345678", "..."]
}
```

**Response**

```json
{
  "message": "Two-factor authentication enabled successfully",
  "backupCodes": ["12345678", "..."]
}
```

**Frontend Responsibilities**

- Collect 6-digit TOTP code from authenticator
- Submit verification
- Confirm success
- Optionally re-display backup codes one final time

---

## 2️⃣ LOGIN FLOW WITH 2FA ENABLED

### Step 1: Primary Login (Email / Password or Social)

**Endpoint**

```http
POST /auth/login
POST /auth/login/social
```

If user **has 2FA enabled**, backend responds with:

```json
{
  "requiresTwoFactor": true,
  "tempToken": "JWT_TEMP_TOKEN",
  "message": "Two-factor authentication required"
}
```

⚠️ **User is NOT logged in yet**

---

### Step 2: Complete 2FA Verification

**Endpoint**

```http
POST /auth/2fa/verify
```

**Payload**

```json
{
  "tempToken": "JWT_TEMP_TOKEN",
  "token": "123456",
  "type": "totp",
  "remember_me": true,
  "deviceInfo": {
    "user_agent": "...",
    "ip_address": "...",
    "device_name": "MacBook Chrome"
  }
}
```

**Supported `type` values**

- `"totp"` → Authenticator app
- `"backup"` → Recovery backup code
- `"email"` → Email backup code

**Response (Success)**

```json
{
  "session_id": "SESSION_ID",
  "user": { ... },
  "verified": true
}
```

**Frontend Responsibilities**

- If web → session cookie is set automatically
- If mobile → store `session_id`
- Redirect user to dashboard

---

## 3️⃣ EMAIL BACKUP CODE (Login Recovery)

Used when user **cannot access authenticator app**.

### Step 1: Request Email Backup Code

**Endpoint**

```http
POST /auth/2fa/backup-email
```

**Payload**

```json
{
  "tempToken": "JWT_TEMP_TOKEN"
}
```

**Response**

```json
{
  "message": "Backup code sent to your email"
}
```

Frontend:

- Show input for 6-digit email code

---

### Step 2: Verify Email Backup Code

Call the **same verify endpoint**:

```http
POST /auth/2fa/verify
```

**Payload**

```json
{
  "tempToken": "JWT_TEMP_TOKEN",
  "token": "654321",
  "type": "email"
}
```

---

## 4️⃣ BACKUP CODES (Recovery)

- Backup codes are **8-digit**, **single-use**
- Stored hashed on backend
- Removed immediately after use

### Verify via:

```json
{
  "tempToken": "JWT_TEMP_TOKEN",
  "token": "12345678",
  "type": "backup"
}
```

---

## 5️⃣ VIEW 2FA STATUS (Settings Page)

**Endpoint**

```http
GET /auth/2fa/status
```

**Response**

```json
{
  "enabled": true,
  "setupAt": "2026-01-09T12:00:00Z",
  "lastUsed": "2026-01-09T14:30:00Z",
  "backupCodesRemaining": 5
}
```

Frontend:

- Show 2FA enabled badge
- Show remaining backup codes count
- Show last used timestamp

---

## 6️⃣ REGENERATE BACKUP CODES

**Endpoint**

```http
POST /auth/2fa/regenerate-backup
```

**Response**

```json
{
  "backupCodes": ["87654321", "..."]
}
```

Frontend:

- Warn user old backup codes are invalid
- Display new codes ONCE
- Encourage secure storage

---

## 7️⃣ DISABLE 2FA

**Endpoint**

```http
POST /auth/2fa/disable
```

**Payload**

```json
{
  "password": "currentPassword"
}
```

**Response**

```json
{
  "message": "Two-factor authentication disabled"
}
```

**Effects**

- 2FA turned off
- All active sessions invalidated
- User must log in again

---

## 8️⃣ ERROR STATES FRONTEND MUST HANDLE

### Common Responses

| Scenario                 | Response                      |
| ------------------------ | ----------------------------- |
| Invalid 2FA code         | `401 / 400`                   |
| Too many attempts        | `400` with rate-limit message |
| Temp token expired       | `401`                         |
| Backup code already used | Verification fails            |
| Setup expired            | Must restart setup            |

Frontend should:

- Show clear retry messaging
- Offer email backup option
- Provide “restart setup” CTA when needed

---

## 9️⃣ UX RECOMMENDED FLOW

**Login**

```
Email/Password
   ↓
2FA Prompt
   ↓
Authenticator / Backup / Email
   ↓
Authenticated Session
```

**Settings**

```
Enable 2FA
   ↓
Scan QR
   ↓
Verify Code
   ↓
Save Backup Codes
   ↓
2FA Enabled
```

---

## ✅ Summary

- 2FA is **session-based**, not JWT-based
- `tempToken` is required for all 2FA login steps
- Backup & email codes are **recovery paths**
- Frontend controls the UX, backend enforces security

---

If you want next, I can:

- Turn this into **sequence diagrams**
- Create **frontend state machines**
- Provide **error-handling UX copy**
- Generate **OpenAPI examples per endpoint**

Just say the word.

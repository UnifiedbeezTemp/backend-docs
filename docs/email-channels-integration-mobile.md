---
sidebar_position: 8
---

# Email OAuth Integration Guide for React Native

## Overview

This guide covers integrating Gmail and Outlook OAuth authentication in React Native applications. The backend supports both iOS and Android platforms with platform-specific OAuth configurations.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Authentication Flow](#authentication-flow)
3. [Gmail Integration](#gmail-integration)
4. [Outlook Integration](#outlook-integration)
5. [Enable Sending Permissions](#enable-sending-permissions)
6. [Response Formats](#response-formats)
7. [Error Handling](#error-handling)

---

## Prerequisites

### Required Headers

All mobile API requests must include:

```
Authorization: Bearer {userAccessToken}
Content-Type: application/json
x-client-type: mobile
x-platform: ios | android
```

### Dependencies

```bash
npm install react-native-app-auth
```

### Backend Environment Variables

```bash
# Google - iOS/Android
GOOGLE_CLIENT_ID_IOS=
GOOGLE_IOS_REDIRECT_URI=
GOOGLE_CLIENT_ID_ANDROID=
GOOGLE_CLIENT_SECRET_ANDROID=
GOOGLE_ANDROID_REDIRECT_URI=

# Microsoft - iOS/Android
MICROSOFT_CLIENT_ID_IOS=
MICROSOFT_CLIENT_SECRET_IOS=
MICROSOFT_IOS_REDIRECT_URI=
MICROSOFT_CLIENT_ID_ANDROID=
MICROSOFT_CLIENT_SECRET_ANDROID=
MICROSOFT_ANDROID_REDIRECT_URI=
```

---

## Authentication Flow

### High-Level Steps

1. **Mobile App**: Initiate OAuth flow using `react-native-app-auth`
2. **OAuth Provider**: User authenticates and grants permissions
3. **Mobile App**: Receives authorization code or tokens
4. **Mobile App**: Sends code/tokens to backend with mobile headers
5. **Backend**: Exchanges code for tokens (if needed) and stores credentials
6. **Backend**: Returns connection details

---

## Gmail Integration

### Step 1: OAuth Configuration

```typescript
{
  issuer: 'https://accounts.google.com',
  clientId: Platform.OS === 'ios' ? 'IOS_CLIENT_ID' : 'ANDROID_CLIENT_ID',
  redirectUrl: 'your-app-scheme:/oauth2redirect/google',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send', // optional
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  additionalParameters: {
    access_type: 'offline',
    prompt: 'consent',
  },
}
```

### Step 2: Get Authorization Code

Use `react-native-app-auth` to get the authorization code from the OAuth flow.

### Step 3: Connect Gmail

**Route:** `POST /channels/email/google/connect`

**Headers:**

```
Authorization: Bearer {userAccessToken}
Content-Type: application/json
x-client-type: mobile
x-platform: ios | android
```

**Payload:**

```json
{
  "authCode": "authorization_code_from_oauth",
  "channelId": 123 // optional: existing channel ID
}
```

**Response:**

```json
{
  "success": true,
  "message": "Gmail connected successfully",
  "connectedChannelId": 456,
  "emailAccountId": 789,
  "email": "user@gmail.com",
  "name": "John Doe",
  "displayName": "John Doe",
  "provider": "gmail",
  "scopes": [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send"
  ],
  "expiresAt": "2025-12-17T12:00:00.000Z",
  "canSend": true,
  "canReceive": true
}
```

---

## Outlook Integration

### Step 1: OAuth Configuration

```typescript
{
  issuer: 'https://login.microsoftonline.com/common/v2.0',
  clientId: Platform.OS === 'ios' ? 'IOS_CLIENT_ID' : 'ANDROID_CLIENT_ID',
  redirectUrl: Platform.OS === 'ios'
    ? 'msauth.com.yourapp://auth'
    : 'msauth://com.yourapp/signature_hash',
  scopes: [
    'offline_access',
    'User.Read',
    'Mail.Read',
    'Mail.Send', // optional
  ],
  additionalParameters: {
    prompt: 'consent',
  },
}
```

### Step 2: Get Tokens

Use `react-native-app-auth` to get access and refresh tokens from the OAuth flow.

### Step 3: Connect Outlook

**Route:** `POST /channels/email/microsoft/connect`

**Headers:**

```
Authorization: Bearer {userAccessToken}
Content-Type: application/json
x-client-type: mobile
x-platform: ios | android
```

**Payload Option 1 (Recommended for Mobile):**

Send tokens directly as JSON string:

```json
{
  "authCode": "{\"access_token\":\"token\",\"refresh_token\":\"token\",\"expires_in\":3600,\"scope\":\"Mail.Read Mail.Send\"}",
  "channelId": 123 // optional
}
```

**Payload Option 2:**

Send authorization code:

```json
{
  "authCode": "authorization_code_from_oauth",
  "channelId": 123 // optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "Outlook connected successfully",
  "connectedChannelId": 456,
  "emailAccountId": 789,
  "email": "user@outlook.com",
  "name": "Jane Smith",
  "displayName": "Jane Smith",
  "provider": "outlook",
  "scopes": ["offline_access", "User.Read", "Mail.Read", "Mail.Send"],
  "expiresAt": "2025-12-17T12:00:00.000Z",
  "canSend": true,
  "canReceive": true
}
```

---

## Enable Sending Permissions

If an email account was initially connected with read-only permissions, you can upgrade to include sending permissions.

### Gmail - Enable Sending

**Route:** `POST /channels/email/enable-sending/google`

**Headers:**

```
Authorization: Bearer {userAccessToken}
Content-Type: application/json
x-client-type: mobile
x-platform: ios | android
```

**Payload:**

```json
{
  "emailAccountId": 789,
  "authCode": "new_authorization_code_with_send_scope"
}
```

**OAuth Scopes Required:**

```
https://www.googleapis.com/auth/gmail.send
```

**Response:**

```json
{
  "success": true,
  "emailAccountId": 789,
  "canSend": true
}
```

---

### Outlook - Enable Sending

**Route:** `POST /channels/email/enable-sending/microsoft`

**Headers:**

```
Authorization: Bearer {userAccessToken}
Content-Type: application/json
x-client-type: mobile
x-platform: ios | android
```

**Payload:**

```json
{
  "emailAccountId": 789,
  "authCode": "new_authorization_code_with_send_scope"
}
```

**OAuth Scopes Required:**

```
Mail.Send
```

**Response:**

```json
{
  "success": true,
  "emailAccountId": 789,
  "canSend": true
}
```

---

## Response Formats

### Successful Connection Response

Both Gmail and Outlook return the same structure:

```typescript
{
  success: boolean;
  message: string;
  connectedChannelId: number;
  emailAccountId: number;
  email: string;
  name: string;
  displayName: string;
  provider: 'gmail' | 'outlook';
  scopes: string[];
  expiresAt: string; // ISO 8601 format
  canSend: boolean;
  canReceive: boolean;
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Failed to connect Gmail",
  "error": "Bad Request"
}
```

---

## Error Handling

### Common Error Codes

| Status Code | Description                         | Action                   |
| ----------- | ----------------------------------- | ------------------------ |
| 400         | Invalid auth code or missing tokens | Re-initiate OAuth flow   |
| 401         | Unauthorized - invalid user token   | Re-authenticate user     |
| 404         | Email account not found             | Check emailAccountId     |
| 500         | Server error                        | Retry or contact support |

### OAuth Flow Errors

| Error                   | Description                        | Action                  |
| ----------------------- | ---------------------------------- | ----------------------- |
| `user_cancelled`        | User cancelled OAuth               | Allow retry             |
| `authentication_failed` | OAuth authentication failed        | Show error, allow retry |
| Missing `refresh_token` | Google didn't return refresh token | Use `prompt: 'consent'` |

---

## Flow Diagrams

### Gmail Connection Flow

```
1. App calls react-native-app-auth.authorize()
   ↓
2. User authenticates with Google
   ↓
3. App receives authorizationCode
   ↓
4. App sends POST /channels/email/google/connect
   Headers: x-client-type: mobile, x-platform: ios/android
   Body: { authCode: "code" }
   ↓
5. Backend:
   - Determines platform from headers
   - Uses iOS/Android client credentials
   - Exchanges code for tokens
   - Stores encrypted tokens in database
   - Creates ConnectedChannel + EmailAccount
   ↓
6. Backend returns connection details
   ↓
7. App stores emailAccountId for future use
```

### Outlook Connection Flow

```
1. App calls react-native-app-auth.authorize()
   ↓
2. User authenticates with Microsoft
   ↓
3. App receives accessToken + refreshToken
   ↓
4. App formats tokens as JSON string
   ↓
5. App sends POST /channels/email/microsoft/connect
   Headers: x-client-type: mobile, x-platform: ios/android
   Body: { authCode: "{tokens_json}" }
   ↓
6. Backend:
   - Detects JSON format (starts with "{")
   - Extracts tokens directly (no exchange needed)
   - OR exchanges auth code if format is not JSON
   - Stores encrypted tokens in database
   - Creates ConnectedChannel + EmailAccount
   ↓
7. Backend returns connection details
   ↓
8. App stores emailAccountId for future use
```

---

## Key Differences: Gmail vs Outlook

| Aspect               | Gmail               | Outlook                             |
| -------------------- | ------------------- | ----------------------------------- |
| **Auth Code Format** | String code         | String code OR JSON tokens          |
| **Client Secret**    | Optional for mobile | Optional for mobile                 |
| **Token Exchange**   | Always on backend   | Optional (can send tokens directly) |
| **Scopes Format**    | URLs                | Simple names                        |
| **Send Scope**       | `gmail.send`        | `Mail.Send`                         |

---

## Best Practices

1. **Always include mobile headers** (`x-client-type`, `x-platform`)
2. **Store `emailAccountId`** for future operations
3. **Check `canSend`** before attempting to send emails
4. **Handle token expiration** by checking `expiresAt`
5. **Use `prompt: 'consent'`** to ensure refresh tokens
6. **Request minimal scopes** initially, upgrade later if needed
7. **Validate responses** before storing connection details

---

## Testing Checklist

- [ ] iOS Gmail connection
- [ ] Android Gmail connection
- [ ] iOS Outlook connection
- [ ] Android Outlook connection
- [ ] Gmail send permission upgrade
- [ ] Outlook send permission upgrade
- [ ] Error handling for cancelled flows
- [ ] Error handling for invalid tokens
- [ ] Token expiration detection
- [ ] Reconnection flow

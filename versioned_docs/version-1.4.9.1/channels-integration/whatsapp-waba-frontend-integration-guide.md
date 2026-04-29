# WhatsApp Business (WABA) Frontend Integration Guide

This guide walks through the complete WhatsApp Business Account (WABA) Embedded Signup integration — from loading the Facebook SDK to displaying connected channels and sending messages.

---

## Table of Contents

1. [How the Flow Works](#1-how-the-flow-works)
2. [Prerequisites](#2-prerequisites)
3. [Authentication](#3-authentication)
4. [Step-by-Step Integration](#4-step-by-step-integration)
   - [4.1 Load Facebook SDK](#41-load-facebook-sdk)
   - [4.2 Fetch App Config](#42-fetch-app-config)
   - [4.3 Initialise Setup Token](#43-initialise-setup-token)
   - [4.4 Launch WhatsApp Embedded Signup](#44-launch-whatsapp-embedded-signup)
   - [4.5 Handle the Embedded Signup PostMessage](#45-handle-the-embedded-signup-postmessage)
   - [4.6 Exchange the Code with the Backend](#46-exchange-the-code-with-the-backend)
5. [Managing Connected Channels](#5-managing-connected-channels)
   - [5.1 List Channels](#51-list-channels)
   - [5.2 Disconnect a Channel](#52-disconnect-a-channel)
6. [Sending a Message](#6-sending-a-message)
7. [API Reference](#7-api-reference)
8. [TypeScript Types](#8-typescript-types)
9. [Error Handling](#9-error-handling)
10. [Security Notes](#10-security-notes)

---

## 1. How the Flow Works

```
User clicks "Connect WhatsApp"
        │
        ▼
POST /waba/setup/init         ← get a short-lived setup token (10 min, stored in Redis)
        │
        ▼
Store token in sessionStorage
        │
        ▼
window.FB.login(...)          ← launch Facebook Embedded Signup popup
        │
        ▼
User completes Facebook flow
        │
        ├─► window.postMessage (WA_EMBEDDED_SIGNUP / FINISH)
        │       └─ captures { phone_number_id, waba_id, business_id }
        │           stored in sessionStorage
        │
        ▼
fbLoginCallback fires with response.authResponse.code
        │
        ▼
POST /waba/callback?token=<setupToken>
        body: { code, signupData: { phoneNumberId, wabaId, businessId } }
        │
        ▼
Backend:
  1. Validates setup token from Redis
  2. Exchanges code for Facebook access token
  3. Fetches phone number + WABA details from Graph API
  4. Registers phone number for WhatsApp Cloud API
  5. Persists ConnectedChannel + WhatsappAccount in DB
  6. Subscribes to webhook events
        │
        ▼
Returns { success: true, channelId, wabaData }
        │
        ▼
Reload channel list → show connected account
```

---

## 2. Prerequisites

### Facebook App Setup

The backend requires a properly configured Facebook App. The frontend does **not** need direct access to any Facebook credentials — all secrets stay on the server. The frontend only needs what is returned from `GET /waba/config`.

### Required Permissions for the Logged-in User

The user must be logged into the backend session before making any WABA API calls. All `/waba/*` endpoints are protected by `SessionAuthGuard` and rely on cookie-based sessions.

### HTTPS Requirement

Facebook Embedded Signup only runs on HTTPS origins. In development, use a tunnel (e.g. ngrok) or a local HTTPS setup.

---

## 3. Authentication

All WABA endpoints require an active session cookie. The backend uses session-based auth (not JWT headers for these endpoints).

```typescript
// All requests must include credentials (sends the session cookie)
const response = await fetch(`${API_BASE}/waba/config`, {
  credentials: "include",
});
```

If the session has expired, the backend returns `401`. Redirect the user to login.

---

## 4. Step-by-Step Integration

### 4.1 Load Facebook SDK

Load the SDK **after** you have fetched the app config (you need `appId` and `version`).

```typescript
function loadFacebookSDK(appId: string, version: string) {
  // Prevent double-loading
  if (document.getElementById("facebook-jssdk")) return;

  const script = document.createElement("script");
  script.id = "facebook-jssdk";
  script.src = "https://connect.facebook.net/en_US/sdk.js";
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);

  window.fbAsyncInit = () => {
    window.FB.init({
      appId,
      autoLogAppEvents: true,
      xfbml: true,
      version,
    });
  };
}
```

Also register the `postMessage` listener **once** at this point (see [4.5](#45-handle-the-embedded-signup-postmessage)).

---

### 4.2 Fetch App Config

Call this on component mount. The response provides the `appId`, `configId`, and `version` needed to initialise the Facebook SDK and launch the signup flow.

```
GET /api/v1/waba/config
```

**Response:**

```json
{
  "appId": "123456789",
  "configId": "your_config_id",
  "version": "v18.0",
  "redirectUri": "https://backend.unifiedbeez.com/api/v1/waba/callback"
}
```

```typescript
const response = await fetch(`${API_BASE}/waba/config`, {
  credentials: "include",
});
const config = await response.json();
// { appId, configId, version, redirectUri }
```

---

### 4.3 Initialise Setup Token

Before launching the Facebook popup, get a one-time setup token from the backend. This token is validated server-side when the callback fires to prevent CSRF.

```
POST /api/v1/waba/setup/init
Body: {} (empty)
```

**Response:**

```json
{
  "token": "abc123xyz..."
}
```

```typescript
const res = await fetch(`${API_BASE}/waba/setup/init`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const { token } = await res.json();

// Store it — you'll need it in the callback
sessionStorage.setItem("waba_token", token);
```

The token expires in **10 minutes**. If the user takes too long, the callback will fail with `400 Invalid or expired token`. In that case, re-initialise.

---

### 4.4 Launch WhatsApp Embedded Signup

After obtaining the token, call `window.FB.login()` with the WABA config ID.

```typescript
window.FB.login(fbLoginCallback, {
  config_id: config.configId, // from GET /waba/config
  response_type: "code",
  override_default_response_type: true,
  extras: {
    setup: {},
    featureType: "",
    sessionInfoVersion: "3",
  },
});
```

This opens the Facebook popup where the user logs in, selects/creates their WhatsApp Business Account, and completes verification.

---

### 4.5 Handle the Embedded Signup PostMessage

While the popup is open, Facebook sends `window.postMessage` events from `*.facebook.com` with signup progress. Register this listener once when loading the SDK.

```typescript
window.addEventListener("message", (event) => {
  // Only trust messages from facebook.com
  if (!event.origin.endsWith("facebook.com")) return;

  try {
    const data = JSON.parse(event.data);
    if (data.type !== "WA_EMBEDDED_SIGNUP") return;

    if (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA") {
      // data.data contains the WABA identifiers — store them
      sessionStorage.setItem("waba_signup_data", JSON.stringify(data.data));
      // Shape: { phone_number_id, waba_id, business_id }
    } else if (data.event === "CANCEL") {
      // User cancelled — data.data.current_step tells you where they stopped
      console.log("Signup cancelled at step:", data.data.current_step);
      setConnecting(false);
    }
  } catch {
    // Non-JSON messages are expected (Facebook sends other postMessages)
  }
});
```

**Important:** The `FINISH` event fires **before** the `FB.login` callback. By the time `fbLoginCallback` fires, `waba_signup_data` will already be in `sessionStorage`.

---

### 4.6 Exchange the Code with the Backend

`fbLoginCallback` is invoked by `FB.login` after the user completes or dismisses the flow.

```typescript
function fbLoginCallback(response: any) {
  setConnecting(false);

  if (!response.authResponse?.code) {
    // User closed the popup without completing
    console.error("No auth code returned", response);
    return;
  }

  const code = response.authResponse.code;
  const signupDataRaw = sessionStorage.getItem("waba_signup_data");
  const token = sessionStorage.getItem("waba_token");

  if (!signupDataRaw || !token) {
    // Missing data — prompt user to try again
    return;
  }

  const rawData = JSON.parse(signupDataRaw);
  const signupData = {
    phoneNumberId: rawData.phone_number_id,
    wabaId: rawData.waba_id,
    businessId: rawData.business_id,
  };

  // Send to backend
  const res = await fetch(`${API_BASE}/waba/callback?token=${token}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, signupData }),
  });

  const result = await res.json();

  if (res.ok && result.success) {
    // Channel is now connected — clean up and reload
    sessionStorage.removeItem("waba_signup_data");
    sessionStorage.removeItem("waba_token");
    await loadChannels();
  } else {
    // Show error: result.message
  }
}
```

**Request:**

```
POST /api/v1/waba/callback?token=<setupToken>
Content-Type: application/json

{
  "code": "<facebook_auth_code>",
  "signupData": {
    "phoneNumberId": "123456789",
    "wabaId": "987654321",
    "businessId": "111222333"
  }
}
```

**Success Response (200):**

```json
{
  "success": true,
  "channelId": 42,
  "wabaData": {
    "accessToken": "EAABwzL...",
    "wabaId": "987654321",
    "phoneNumberId": "123456789",
    "businessId": "111222333",
    "displayPhoneNumber": "+447700900123",
    "verifiedName": "My Business",
    "permissions": [
      "whatsapp_business_management",
      "whatsapp_business_messaging"
    ]
  }
}
```

**Error Responses:**
| Status | Reason |
|--------|--------|
| `400` | Invalid/expired token, bad code, or missing `signupData` fields |
| `401` | User session expired |
| `500` | Graph API error or database failure |

---

## 5. Managing Connected Channels

### 5.1 List Channels

```
GET /api/v1/waba/channels
```

**Response:**

```json
{
  "channels": [
    {
      "id": 42,
      "name": "WhatsApp Business",
      "phoneNumber": "+447700900123",
      "verifiedName": "My Business",
      "businessName": "My Business Ltd",
      "isActive": true,
      "connectedAt": "2025-03-01T12:00:00.000Z"
    }
  ]
}
```

```typescript
const res = await fetch(`${API_BASE}/waba/channels`, {
  credentials: "include",
});
const { channels } = await res.json();
```

Call this on mount and after a successful callback to keep the UI in sync.

---

### 5.2 Disconnect a Channel

```
DELETE /api/v1/waba/channels/:channelId
```

This deregisters the phone number from the WhatsApp Cloud API and marks the account inactive. If it is the only account on the channel, the channel itself is also deactivated.

```typescript
const res = await fetch(`${API_BASE}/waba/channels/${channelId}`, {
  method: "DELETE",
  credentials: "include",
});

if (res.ok) {
  await loadChannels(); // refresh list
}
```

**Responses:**
| Status | Meaning |
|--------|---------|
| `200` | Disconnected successfully |
| `404` | Channel not found or not owned by current user |

---

## 6. Sending a Message

Once a channel is connected you can send outbound messages using the unified messages endpoint.

```
POST /api/v1/messages
Content-Type: application/json

{
  "channelId": 42,
  "channelType": "WHATSAPP",
  "direction": "outbound",
  "type": "text",
  "content": "Hello from UnifiedBeez!",
  "recipientId": "+447700900456",
  "recipientName": "John Doe"
}
```

**Success Response (201):**

```json
{
  "_id": "msg_abc123",
  "status": "SENT",
  "channelId": 42,
  "content": "Hello from UnifiedBeez!",
  "createdAt": "2025-04-13T10:00:00.000Z"
}
```

> **Note on 24-hour window:** WhatsApp requires a business to initiate conversations using an approved **template message** outside of the 24-hour customer service window. Free-form text (`type: "text"`) can only be sent within 24 hours of the customer's last message. For template-based messaging see [WhatsApp Templates](../automations/whatsapp-templates.md).

---

## 7. API Reference

All endpoints are prefixed `/api/v1`. All require a valid session cookie (`credentials: 'include'`).

| Method   | Path                                          | Auth    | Description                                           |
| -------- | --------------------------------------------- | ------- | ----------------------------------------------------- |
| `GET`    | `/waba/config`                                | Session | Returns `appId`, `configId`, `version` for SDK init   |
| `POST`   | `/waba/setup/init`                            | Session | Issues a short-lived setup token (10 min)             |
| `POST`   | `/waba/callback?token=<t>`                    | Session | Exchanges Facebook auth code for a connected channel  |
| `GET`    | `/waba/channels`                              | Session | Lists all connected WABA channels for the user        |
| `DELETE` | `/waba/channels/:channelId`                   | Session | Disconnects and deregisters a channel                 |
| `POST`   | `/waba/accounts/:accountId/validate`          | Session | Checks whether the stored access token is still valid |
| `POST`   | `/waba/accounts/:accountId/send-message`      | Session | Sends a test message via a specific account           |
| `POST`   | `/waba/accounts/:accountId/register-phone`    | Session | Manually re-registers a phone number for Cloud API    |
| `POST`   | `/waba/accounts/:accountId/subscribe-webhook` | Session | Re-subscribes an existing WABA to webhook events      |
| `POST`   | `/messages`                                   | Session | Send a message through any connected channel          |

### Webhook (server-to-server, no frontend action needed)

| Method | Path                 | Auth                | Description                                      |
| ------ | -------------------- | ------------------- | ------------------------------------------------ |
| `GET`  | `/webhooks/whatsapp` | None (verify token) | Facebook hub verification                        |
| `POST` | `/webhooks/whatsapp` | HMAC signature      | Receives incoming messages and delivery receipts |

---

## 8. TypeScript Types

```typescript
// Returned by GET /waba/config
interface WabaConfig {
  appId: string;
  configId: string;
  version: string;
  redirectUri: string;
}

// The WABA identifiers captured from the postMessage event
interface EmbeddedSignupData {
  phoneNumberId: string;
  wabaId: string;
  businessId: string;
}

// Raw postMessage shape from Facebook (field names use snake_case)
interface FacebookEmbeddedSignupMessage {
  type: "WA_EMBEDDED_SIGNUP";
  event: "FINISH" | "FINISH_ONLY_WABA" | "CANCEL";
  data: {
    phone_number_id: string; // map to EmbeddedSignupData.phoneNumberId
    waba_id: string; // map to EmbeddedSignupData.wabaId
    business_id: string; // map to EmbeddedSignupData.businessId
    current_step?: string; // present on CANCEL
  };
}

// Returned by GET /waba/channels
interface WabaChannel {
  id: number;
  name: string;
  phoneNumber: string;
  verifiedName: string;
  businessName: string;
  isActive: boolean;
  connectedAt: string; // ISO 8601
}

// Returned by POST /waba/callback
interface WabaCallbackResponse {
  success: boolean;
  channelId: number;
  wabaData: {
    accessToken: string;
    wabaId: string;
    phoneNumberId: string;
    businessId: string;
    displayPhoneNumber: string;
    verifiedName: string;
    permissions: string[];
  };
}

// Body for POST /messages
interface SendMessageRequest {
  channelId: number;
  channelType: "WHATSAPP";
  direction: "outbound";
  type: "text";
  content: string;
  recipientId: string; // E.164 phone number e.g. "+447700900456"
  recipientName?: string;
}
```

---

## 9. Error Handling

### Common Error Scenarios

| Scenario                 | HTTP Status  | Cause                                       | Recommended Action                                                                                            |
| ------------------------ | ------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Session expired          | `401`        | Cookie missing or expired                   | Redirect to login                                                                                             |
| Expired setup token      | `400`        | User took > 10 min in the Facebook popup    | Call `/waba/setup/init` again and re-launch `FB.login`                                                        |
| No `signupData` captured | `400`        | `FINISH` postMessage never arrived          | Ensure the `window.addEventListener('message', ...)` listener is registered **before** `FB.login()` is called |
| Facebook code invalid    | `400`        | Code already consumed or expired            | Show error; user must repeat the flow                                                                         |
| Graph API error          | `500`        | Facebook service issue or wrong permissions | Retry after a short delay; log `result.message`                                                               |
| `FB` not defined         | Client error | SDK not yet loaded                          | Wait for `window.fbAsyncInit` before enabling the connect button                                              |

### Defensive Checks Before Calling `launchWhatsAppSignup`

```typescript
function launchWhatsAppSignup() {
  if (!window.FB) {
    // SDK still loading — disable button until ready
    return;
  }
  if (!config) {
    // Config not fetched yet
    return;
  }
  // Proceed...
}
```

### Session Storage Cleanup

Always clean up `sessionStorage` after a successful or failed flow:

```typescript
sessionStorage.removeItem("waba_signup_data");
sessionStorage.removeItem("waba_token");
```

Leaving stale data can cause a "phantom" code submission if the user abandons the flow mid-way and starts again.

---

## 10. Security Notes

- **Never** put `FACEBOOK_APP_SECRET` or any server-side credentials in the frontend. The frontend only uses the `appId` (public) and `configId` (public) returned by `/waba/config`.
- The **setup token** (`POST /waba/setup/init`) is a CSRF guard. The backend verifies it before processing the callback. Do not skip it.
- The `window.postMessage` listener **must** check `event.origin.endsWith('facebook.com')` before trusting the message content.
- All API requests must use `credentials: 'include'` so the session cookie is sent. Without it every request returns `401`.
- Phone numbers should be sent in **E.164 format** (`+` followed by country code and number, no spaces or dashes).

---

## Complete Example Component

Below is a minimal but complete React component that implements the full flow.

```tsx
import React, { useState, useEffect, useRef } from "react";

const API_BASE = "https://your-backend.com/api/v1";

interface WabaConfig {
  appId: string;
  configId: string;
  version: string;
}
interface WabaChannel {
  id: number;
  verifiedName: string;
  phoneNumber: string;
  businessName: string;
  isActive: boolean;
  connectedAt: string;
}

export function WhatsAppConnect() {
  const [config, setConfig] = useState<WabaConfig | null>(null);
  const [channels, setChannels] = useState<WabaChannel[]>([]);
  const [connecting, setConnecting] = useState(false);
  const listenerRegistered = useRef(false);

  useEffect(() => {
    fetch(`${API_BASE}/waba/config`, { credentials: "include" })
      .then((r) => r.json())
      .then(setConfig);
    loadChannels();
  }, []);

  useEffect(() => {
    if (!config || window.FB) return;

    // Load SDK
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);

    window.fbAsyncInit = () => {
      window.FB.init({
        appId: config.appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: config.version,
      });
    };

    // Register postMessage listener once
    if (!listenerRegistered.current) {
      listenerRegistered.current = true;
      window.addEventListener("message", (event) => {
        if (!event.origin.endsWith("facebook.com")) return;
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === "WA_EMBEDDED_SIGNUP" &&
            (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA")
          ) {
            sessionStorage.setItem(
              "waba_signup_data",
              JSON.stringify(data.data)
            );
          }
        } catch {
          /* ignore */
        }
      });
    }
  }, [config]);

  const loadChannels = async () => {
    const res = await fetch(`${API_BASE}/waba/channels`, {
      credentials: "include",
    });
    if (res.ok) {
      const { channels } = await res.json();
      setChannels(channels);
    }
  };

  const connect = async () => {
    if (!window.FB || !config) return;
    setConnecting(true);

    // 1. Get setup token
    const tokenRes = await fetch(`${API_BASE}/waba/setup/init`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const { token } = await tokenRes.json();
    sessionStorage.setItem("waba_token", token);

    // 2. Launch Facebook Embedded Signup
    window.FB.login(
      async (response: any) => {
        setConnecting(false);
        if (!response.authResponse?.code) return;

        const signupRaw = sessionStorage.getItem("waba_signup_data");
        const setupToken = sessionStorage.getItem("waba_token");
        if (!signupRaw || !setupToken) return;

        const raw = JSON.parse(signupRaw);
        const callbackRes = await fetch(
          `${API_BASE}/waba/callback?token=${setupToken}`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: response.authResponse.code,
              signupData: {
                phoneNumberId: raw.phone_number_id,
                wabaId: raw.waba_id,
                businessId: raw.business_id,
              },
            }),
          }
        );

        sessionStorage.removeItem("waba_signup_data");
        sessionStorage.removeItem("waba_token");

        if (callbackRes.ok) await loadChannels();
      },
      {
        config_id: config.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  };

  const disconnect = async (channelId: number) => {
    await fetch(`${API_BASE}/waba/channels/${channelId}`, {
      method: "DELETE",
      credentials: "include",
    });
    await loadChannels();
  };

  return (
    <div>
      <h2>WhatsApp Business</h2>

      {channels.length === 0 ? (
        <button onClick={connect} disabled={connecting || !config}>
          {connecting ? "Connecting..." : "Connect WhatsApp Business"}
        </button>
      ) : (
        <>
          {channels.map((ch) => (
            <div key={ch.id}>
              <strong>{ch.verifiedName}</strong> — {ch.phoneNumber}
              <span>{ch.isActive ? " (Active)" : " (Inactive)"}</span>
              <button onClick={() => disconnect(ch.id)}>Disconnect</button>
            </div>
          ))}
          <button onClick={connect} disabled={connecting || !config}>
            Add Another Account
          </button>
        </>
      )}
    </div>
  );
}
```

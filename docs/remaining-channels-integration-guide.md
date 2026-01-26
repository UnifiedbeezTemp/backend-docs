---
sidebar_position: 14
---

# Calendly OAuth Integration - Frontend Documentation

## Overview

Calendly integration uses OAuth 2.0 authorization code flow to connect user accounts. The frontend handles OAuth redirect and exchanges the authorization code with the backend.

## OAuth Flow

### 1. Initiate Authentication

```typescript
const handleCalendlyAuth = () => {
  setStatus("Redirecting to Calendly...");
  window.location.href = `${API_BASE}/auth`;
};
```

**Process:**

- Redirects to `GET /api/v1/channels/calendly/auth`
- Backend generates OAuth URL and redirects to Calendly
- User authorizes on Calendly's consent screen

### 2. Handle OAuth Callback

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    connectCalendly(code);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
```

**Process:**

- Calendly redirects back with authorization code in URL
- Frontend extracts `code` query parameter
- Automatically triggers connection
- Cleans code from browser history

### 3. Complete Connection

```typescript
const connectCalendly = async (authCode: string) => {
  setLoading(true);
  setStatus("Connecting Calendly...");

  const res = await fetch(`${API_BASE}/connect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authCode }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  setStatus(`✅ Calendly connected (${data.email})`);
};
```

**Process:**

- Sends authorization code to backend
- Backend exchanges code for access/refresh tokens
- Stores encrypted credentials in database
- Returns connected account details including email

## Disconnect Flow

```typescript
const handleDisconnect = async (accountId: number) => {
  if (!confirm("Disconnect this Calendly account?")) return;

  setLoading(true);

  const res = await fetch(`${API_BASE}/disconnect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  setStatus("✅ Calendly disconnected");
};
```

Revokes tokens and removes the account connection from the database.

## API Endpoints

| Endpoint                               | Method | Auth Required | Purpose                     |
| -------------------------------------- | ------ | ------------- | --------------------------- |
| `/api/v1/channels/calendly/auth`       | GET    | Yes (Session) | Initiate OAuth flow         |
| `/api/v1/channels/calendly/connect`    | POST   | Yes (Session) | Exchange authorization code |
| `/api/v1/channels/calendly/disconnect` | POST   | Yes (Session) | Remove connection           |

## Key Implementation Details

- **Authentication**: All endpoints require session authentication via cookies (`credentials: "include"`)
- **Query Parameter**: Uses standard `code` parameter for OAuth callback
- **URL Cleanup**: Uses `replaceState` to remove OAuth parameters after processing
- **Error Handling**: Backend returns error messages in response body

# PayPal OAuth Integration - Frontend Documentation

## Overview

PayPal OAuth uses state parameter encoding for session management. The backend handles the callback and redirects to frontend with success/error indicators.

## OAuth Flow

### 1. Initiate Authentication

```typescript
const handlePayPalAuth = () => {
  setStatus("Redirecting to PayPal...");
  window.location.href = `${API_BASE}/auth`;
};
```

**Process:**

- Redirects to `GET /api/v1/channels/paypal/auth`
- Backend extracts session from cookie/header
- Generates OAuth URL with encoded state containing session ID
- Redirects to PayPal authorization

### 2. Handle OAuth Callback

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");

  if (code && state) {
    connectPayPal(code, state);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
```

**Backend Callback Flow:**

- PayPal redirects to: `/api/v1/channels/paypal/connect?code={code}&state={state}`
- Backend decodes state to extract session ID
- Validates session and exchanges code for token
- Redirects to frontend: `/integrations?paypal=success` or `/integrations?paypal=error`

**Frontend can also handle direct parameters:**

- If `code` and `state` are present, calls connect endpoint directly
- Otherwise checks for `paypal=success` or `paypal=error` indicators

### 3. Complete Connection

```typescript
const connectPayPal = async (code: string, state: string) => {
  setLoading(true);
  setStatus("Connecting PayPal...");

  const res = await fetch(`${API_BASE}/connect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authCode: code, state }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  setStatus(`✅ PayPal connected (${data.email})`);
};
```

**Process:**

- Sends authorization code and state
- Backend verifies state contains valid session
- Exchanges code for tokens
- Stores encrypted credentials
- Returns account email and merchant ID

## Disconnect Flow

```typescript
const handleDisconnect = async (accountId: number) => {
  if (!confirm("Disconnect this PayPal account?")) return;

  const res = await fetch(`${API_BASE}/disconnect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  setStatus("✅ PayPal disconnected");
};
```

## API Endpoints

| Endpoint                             | Method | Auth Required | Purpose                    |
| ------------------------------------ | ------ | ------------- | -------------------------- |
| `/api/v1/channels/paypal/auth`       | GET    | Yes (Session) | Initiate OAuth             |
| `/api/v1/channels/paypal/connect`    | GET    | No            | OAuth callback (redirects) |
| `/api/v1/channels/paypal/connect`    | POST   | Yes (Session) | Exchange code              |
| `/api/v1/channels/paypal/disconnect` | POST   | Yes (Session) | Remove connection          |

## Key Implementation Details

- **State Encoding**: Backend encodes session ID in base64 state parameter
- **Dual Callback Handling**: Backend GET callback processes OAuth, or frontend can POST directly
- **Session Validation**: State parameter verified against active session
- **Success Indicators**: Check `paypal=success` or `paypal=error` query parameters

# Shopify OAuth Integration - Frontend Documentation

## Overview

Shopify OAuth requires the shop domain as input and uses HMAC signature verification for security. The flow includes backend HMAC validation before completing the connection.

## OAuth Flow

### 1. Collect Shop Domain

```typescript
const [shopDomain, setShopDomain] = useState("");

const handleShopifyAuth = () => {
  if (!shopDomain) {
    setError("Please enter your shop domain");
    return;
  }

  const domain = shopDomain.includes(".myshopify.com")
    ? shopDomain
    : `${shopDomain}.myshopify.com`;

  window.location.href = `${API_BASE}/auth?shop=${domain}`;
};
```

**Process:**

- User enters shop domain (e.g., "yourstore" or "yourstore.myshopify.com")
- Frontend normalizes to `.myshopify.com` format
- Redirects to `GET /api/v1/channels/shopify/auth?shop={domain}`

### 2. Handle OAuth Callback

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const shop = params.get("shop");
  const state = params.get("state");
  const verified = params.get("verified");
  const error = params.get("error");

  if (error === "invalid_hmac") {
    setError("Authentication failed: Invalid signature from Shopify");
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  if (code && shop && state && verified === "true") {
    connectShopify(shop, code, state);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
```

**Process:**

- Shopify redirects to backend callback: `/api/v1/channels/shopify/callback?code={code}&shop={shop}&state={state}&hmac={hmac}`
- Backend verifies HMAC signature
- Backend redirects to frontend with `verified=true` if valid, or `error=invalid_hmac` if invalid
- Frontend proceeds to connection only if verified

### 3. Complete Connection

```typescript
const connectShopify = async (shop: string, code: string, state: string) => {
  setLoading(true);
  setStatus("Connecting Shopify...");

  const res = await fetch(`${API_BASE}/connect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop, code, state }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  setStatus(`✅ Shopify connected (${data.shopName})`);
};
```

**Process:**

- Sends shop domain, code, and state to backend
- Backend exchanges code for access token
- Stores encrypted credentials and configures webhooks
- Returns shop details

## Disconnect Flow

```typescript
const handleDisconnect = async (storeId: number) => {
  if (!confirm("Disconnect this Shopify store?")) return;

  const res = await fetch(`${API_BASE}/disconnect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  setStatus("✅ Shopify disconnected");
};
```

Removes webhooks and deletes the store connection.

## API Endpoints

| Endpoint                              | Method | Auth Required | Purpose                         |
| ------------------------------------- | ------ | ------------- | ------------------------------- |
| `/api/v1/channels/shopify/auth`       | GET    | Yes (Session) | Initiate OAuth with shop domain |
| `/api/v1/channels/shopify/callback`   | GET    | No            | Verify HMAC and redirect        |
| `/api/v1/channels/shopify/connect`    | POST   | Yes (Session) | Exchange code for token         |
| `/api/v1/channels/shopify/disconnect` | POST   | Yes (Session) | Remove connection               |

## Key Implementation Details

- **Shop Domain Input**: Required before OAuth can begin
- **HMAC Verification**: Backend validates Shopify's signature before allowing connection
- **Verified Parameter**: Frontend only proceeds if `verified=true` is present
- **Error Handling**: `invalid_hmac` error indicates security validation failure
- **State Parameter**: Used for CSRF protection

# Stripe Connect OAuth Integration - Frontend Documentation

## Overview

Stripe Connect uses OAuth 2.0 with state parameter for CSRF protection. The integration connects Stripe accounts to enable payment processing within conversations.

## OAuth Flow

### 1. Initiate Authentication

```typescript
const handleStripeAuth = () => {
  setStatus("Redirecting to Stripe...");
  window.location.href = `${API_BASE}/auth`;
};
```

**Process:**

- Redirects to `GET /api/v1/channels/stripe/auth`
- Backend generates OAuth URL with state parameter
- Redirects to Stripe Connect authorization screen

### 2. Handle OAuth Callback

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");

  if (code && state) {
    connectStripe(code, state);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
```

**Process:**

- Stripe redirects back with `code` and `state` parameters
- Frontend extracts both values
- Automatically triggers connection
- Cleans parameters from URL

### 3. Complete Connection

```typescript
const connectStripe = async (authCode: string, state: string) => {
  setLoading(true);
  setStatus("Connecting Stripe...");

  const res = await fetch(`${API_BASE}/connect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authCode, state }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  setStatus(`✅ Stripe connected (${data.stripeAccountId})`);
};
```

**Process:**

- Sends both authorization code and state to backend
- Backend verifies state for CSRF protection
- Exchanges code for access token
- Stores account details and webhook configuration
- Returns connected account ID

## Disconnect Flow

```typescript
const handleDisconnect = async (accountId: number) => {
  if (!confirm("Disconnect this Stripe account?")) return;

  setLoading(true);

  const res = await fetch(`${API_BASE}/disconnect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  setStatus("✅ Stripe disconnected");
};
```

Revokes Stripe access and removes the connected account.

## API Endpoints

| Endpoint                             | Method | Auth Required | Purpose               |
| ------------------------------------ | ------ | ------------- | --------------------- |
| `/api/v1/channels/stripe/auth`       | GET    | Yes (Session) | Initiate OAuth flow   |
| `/api/v1/channels/stripe/connect`    | POST   | Yes (Session) | Exchange code & state |
| `/api/v1/channels/stripe/disconnect` | POST   | Yes (Session) | Remove connection     |

## Key Implementation Details

- **State Parameter**: Required for CSRF protection, must be sent back to backend
- **Authentication**: Session-based via cookies (`credentials: "include"`)
- **Response Data**: Returns `stripeAccountId`, `accountType`, and `scope`
- **URL Cleanup**: Removes sensitive OAuth parameters after processing

# Zoom OAuth Integration - Frontend Documentation

## Overview

The Zoom integration uses OAuth 2.0 authorization code flow to connect user Zoom accounts. The frontend handles the OAuth redirect and exchanges the authorization code with the backend.

## OAuth Flow

### 1. Initiate Authentication

```typescript
const handleZoomAuth = () => {
  window.location.href = `${API_BASE}/auth`;
};
```

**What happens:**

- Redirects user to `GET /api/v1/channels/zoom/auth`
- Backend generates OAuth URL and redirects to Zoom
- User authorizes the application on Zoom's consent screen

### 2. Handle OAuth Callback

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("zoom_code");

  if (code) {
    connectZoom(code);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
```

**What happens:**

- Zoom redirects back to `/integrations?zoom_code={authCode}`
- Frontend extracts the `zoom_code` parameter
- Automatically triggers connection process
- Cleans the code from URL history

### 3. Complete Connection

```typescript
const connectZoom = async (code: string) => {
  setLoading(true);

  const res = await fetch(`${API_BASE}/connect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authCode: code }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  // Returns: { email: string, ... }
  setStatus(`✅ Zoom connected (${data.email})`);
};
```

**What happens:**

- Sends authorization code to backend
- Backend exchanges code for access/refresh tokens
- Stores encrypted credentials in database
- Returns connected account details

## Disconnect Flow

```typescript
const handleDisconnect = async (accountId: number) => {
  await fetch(`${API_BASE}/disconnect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
};
```

Removes the Zoom account connection and revokes stored tokens.

## Error Handling

The callback endpoint handles errors via query parameters:

```typescript
// On OAuth failure, Zoom redirects to:
// /integrations?error=missing_code

const params = new URLSearchParams(window.location.search);
const error = params.get("error");
```

## Key Implementation Notes

1. **Parameter naming**: Uses `zoom_code` instead of generic `code` to avoid conflicts with other OAuth integrations
2. **Credentials**: All API calls require `credentials: "include"` for session authentication
3. **URL cleanup**: Uses `replaceState` to remove OAuth parameters after processing
4. **Security**: Authentication handled server-side via session cookies

## API Endpoints

| Endpoint                           | Method | Purpose            |
| ---------------------------------- | ------ | ------------------ |
| `/api/v1/channels/zoom/auth`       | GET    | Start OAuth flow   |
| `/api/v1/channels/zoom/connect`    | POST   | Exchange auth code |
| `/api/v1/channels/zoom/disconnect` | POST   | Remove connection  |

# Telegram User Account Integration - Frontend Documentation

## Overview

Telegram integration supports two authentication methods: phone-based (multi-step) and QR code. Unlike other integrations, this uses Telegram's user account API (gramjs/MTProto), not bot API.

## Phone Authentication Flow

### Step 1: Send Code

```typescript
const handlePhoneAuth = async () => {
  const res = await fetch(`${API_BASE}/connect/phone`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });

  const data = await res.json();
  setSessionId(data.sessionId);
  setAwaitingCode(true);
};
```

Backend sends verification code via SMS/Telegram app and returns `sessionId` for subsequent steps.

### Step 2: Verify Code

```typescript
const handleVerifyCode = async () => {
  const res = await fetch(`${API_BASE}/connect/verify-code`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, code }),
  });

  const data = await res.json();

  if (data.passwordNeeded) {
    setAwaiting2FA(true);
  } else {
    // Connection complete
    await loadConnectedAccounts();
  }
};
```

If 2FA is enabled, response includes `passwordNeeded: true`.

### Step 3: Verify 2FA (if needed)

```typescript
const handleVerify2FA = async () => {
  const res = await fetch(`${API_BASE}/connect/verify-2fa`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, password }),
  });

  // Connection complete
  await loadConnectedAccounts();
};
```

## QR Code Authentication Flow

### Generate QR Code

```typescript
const handleQRAuth = async () => {
  const res = await fetch(`${API_BASE}/connect/qr`, {
    method: "POST",
    credentials: "include",
  });

  const data = await res.json();
  setQrUrl(data.qrUrl);
  setQrSessionId(data.sessionId);
  startQRPolling(data.sessionId);
};
```

### Poll for Scan

```typescript
const startQRPolling = (sessionId: string) => {
  const interval = setInterval(async () => {
    const res = await fetch(
      `${API_BASE}/connect/qr/check?sessionId=${sessionId}`,
      { credentials: "include" }
    );

    const data = await res.json();

    if (data.success) {
      clearInterval(interval);
      await loadConnectedAccounts();
    }
  }, 2000);

  // Timeout after 30 seconds
  setTimeout(() => clearInterval(interval), 30000);
};
```

Display QR as image: `https://api.qrserver.com/v1/create-qr-code/?data=${qrUrl}`

## Disconnect Flow

```typescript
const handleDisconnect = async (accountId: number) => {
  const res = await fetch(`${API_BASE}/disconnect`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
};
```

## API Endpoints

| Endpoint                                        | Method | Purpose                |
| ----------------------------------------------- | ------ | ---------------------- |
| `/api/v1/channels/telegram/connect/phone`       | POST   | Send verification code |
| `/api/v1/channels/telegram/connect/verify-code` | POST   | Verify code            |
| `/api/v1/channels/telegram/connect/verify-2fa`  | POST   | Verify 2FA password    |
| `/api/v1/channels/telegram/connect/qr`          | POST   | Generate QR code       |
| `/api/v1/channels/telegram/connect/qr/check`    | GET    | Poll QR status         |
| `/api/v1/channels/telegram/disconnect`          | POST   | Remove connection      |

## Key Implementation Details

- **Multi-step auth**: Phone flow requires 2-3 API calls
- **Session tracking**: `sessionId` persists across verification steps
- **QR polling**: Poll every 2 seconds with 30-second timeout
- **2FA detection**: Backend indicates if password needed
- **State management**: Track current step (code/2FA/complete)

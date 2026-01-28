---
sidebar_position: 5
---

# REMAINING CHANNELS INTEGRATION

## Contains integration for - calendly, shopify, paypal, zoom, telegram, stripe

## Calendly OAuth Integration

### Overview

Calendly uses OAuth 2.0 with backend-managed redirect flow. Frontend only needs to initiate auth and handle success/error redirects.

### Flow

**1. Initiate Authentication**

```typescript
const handleCalendlyAuth = () => {
  window.location.href = `${API_BASE}/auth`;
};
```

**2. Handle Backend Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("calendly_connected") === "true") {
    setStatus("✅ Calendly connected successfully");
    loadConnectedAccounts();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

Backend handles the OAuth callback, connects the account, and redirects to frontend with `?calendly_connected=true` or `?error=...`.

### Disconnect

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

### Endpoints

| Endpoint                        | Method | Auth    | Purpose                           |
| ------------------------------- | ------ | ------- | --------------------------------- |
| `/channels/calendly/auth`       | GET    | Session | Initiate OAuth                    |
| `/channels/calendly/callback`   | GET    | No      | Backend callback (auto-redirects) |
| `/channels/calendly/disconnect` | POST   | Session | Remove connection                 |

---

## PayPal OAuth Integration

### Flow

**1. Initiate**

```typescript
const handlePayPalAuth = () => {
  window.location.href = `${API_BASE}/auth`;
};
```

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("paypal_connected") === "true") {
    setStatus("✅ PayPal connected");
    loadConnectedAccounts();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

### Endpoints

| Endpoint                      | Method | Auth    | Purpose           |
| ----------------------------- | ------ | ------- | ----------------- |
| `/channels/paypal/auth`       | GET    | Session | Initiate OAuth    |
| `/channels/paypal/callback`   | GET    | No      | Backend callback  |
| `/channels/paypal/disconnect` | POST   | Session | Remove connection |

---

## Shopify OAuth Integration

### Flow

**1. Initiate with Shop Domain**

```typescript
const handleShopifyAuth = () => {
  const domain = shopDomain.includes(".myshopify.com")
    ? shopDomain
    : `${shopDomain}.myshopify.com`;

  window.location.href = `${API_BASE}/auth?shop=${domain}`;
};
```

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("shopify_connected") === "true") {
    setStatus("✅ Shopify connected");
    loadConnectedAccounts();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

Backend verifies HMAC signature before connecting.

### Endpoints

| Endpoint                       | Method | Auth    | Purpose                  |
| ------------------------------ | ------ | ------- | ------------------------ |
| `/channels/shopify/auth`       | GET    | Session | Initiate OAuth with shop |
| `/channels/shopify/callback`   | GET    | No      | Verify HMAC & connect    |
| `/channels/shopify/disconnect` | POST   | Session | Remove connection        |

---

## Stripe Connect Integration

### Flow

**1. Initiate**

```typescript
const handleStripeAuth = () => {
  window.location.href = `${API_BASE}/auth`;
};
```

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("stripe_connected") === "true") {
    setStatus("✅ Stripe connected");
    loadConnectedAccounts();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

### Endpoints

| Endpoint                      | Method | Auth    | Purpose           |
| ----------------------------- | ------ | ------- | ----------------- |
| `/channels/stripe/auth`       | GET    | Session | Initiate OAuth    |
| `/channels/stripe/callback`   | GET    | No      | Backend callback  |
| `/channels/stripe/disconnect` | POST   | Session | Remove connection |

---

## Zoom OAuth Integration

### Flow

**1. Initiate**

```typescript
const handleZoomAuth = () => {
  window.location.href = `${API_BASE}/auth`;
};
```

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("zoom_connected") === "true") {
    setStatus("✅ Zoom connected");
    loadConnectedAccounts();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

### Endpoints

| Endpoint                    | Method | Auth    | Purpose           |
| --------------------------- | ------ | ------- | ----------------- |
| `/channels/zoom/auth`       | GET    | Session | Initiate OAuth    |
| `/channels/zoom/callback`   | GET    | No      | Backend callback  |
| `/channels/zoom/disconnect` | POST   | Session | Remove connection |

## Telegram Integration

### Overview

Telegram uses **phone/2FA or QR authentication** (not OAuth).
The frontend drives multi-step flows by calling backend endpoints directly.

---

## Phone Authentication Flow

### Step 1: Send Code

```ts
const res = await fetch(`${API_BASE}/connect/phone`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phoneNumber }),
});

const { sessionId } = await res.json();
```

---

### Step 2: Verify Code

```ts
const res = await fetch(`${API_BASE}/connect/verify-code`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId, code }),
});

const data = await res.json();

if (data.passwordNeeded) {
  // Proceed to 2FA
}
```

---

### Step 3: Verify 2FA (if required)

```ts
await fetch(`${API_BASE}/connect/verify-2fa`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId, password }),
});
```

---

## QR Authentication Flow

### Generate QR Code

```ts
const res = await fetch(`${API_BASE}/connect/qr`, {
  method: "POST",
  credentials: "include",
});

const { qrUrl, sessionId } = await res.json();
```

- Backend generates a Telegram login token.
- Token is embedded in a `tg://login?token=...` QR code.
- Token expires automatically (short TTL).

---

### Poll QR Status (state-only)

```ts
const interval = setInterval(async () => {
  const res = await fetch(
    `${API_BASE}/connect/qr/check?sessionId=${sessionId}`,
    { credentials: "include" }
  );

  const { status } = await res.json();

  if (status === "SUCCESS") {
    clearInterval(interval);
    loadConnectedAccounts();
  }

  if (status === "EXPIRED") {
    clearInterval(interval);
    // Regenerate QR
  }
}, 2000);
```

**Status values**

- `PENDING` – waiting for user to scan and accept
- `SUCCESS` – Telegram account connected
- `EXPIRED` – QR token expired, generate a new one

**Important**

- This endpoint is **read-only**
- It does **not** call Telegram APIs
- Frontend never controls expiry timing

---

## Endpoints

| Endpoint                                 | Method | Purpose                     |
| ---------------------------------------- | ------ | --------------------------- |
| `/channels/telegram/connect/phone`       | POST   | Send login code             |
| `/channels/telegram/connect/verify-code` | POST   | Verify login code           |
| `/channels/telegram/connect/verify-2fa`  | POST   | Verify 2FA password         |
| `/channels/telegram/connect/qr`          | POST   | Generate QR login session   |
| `/channels/telegram/connect/qr/check`    | GET    | Poll QR session status      |
| `/channels/telegram/disconnect`          | POST   | Disconnect Telegram account |

---

## Key Differences

### OAuth Channels

(Calendly, PayPal, Shopify, Stripe, Zoom, Facebook)

- Redirect-based authentication
- Backend handles OAuth callbacks
- Success via query params:

  - `?{channel}_connected=true`
  - `?error=...`

---

### Telegram

- No OAuth
- Multi-step authentication
- Frontend directly calls backend endpoints
- QR login uses **MTProto updates**, not HTTP callbacks
- Frontend polling is **state-only**

---

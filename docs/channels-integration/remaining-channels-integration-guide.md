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

---

## Telegram Integration

### Overview

Telegram uses phone/2FA or QR authentication (not OAuth). Frontend must handle multi-step flows.

### Phone Flow

**Step 1: Send Code**

```typescript
const res = await fetch(`${API_BASE}/connect/phone`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phoneNumber }),
});

const { sessionId } = await res.json();
```

**Step 2: Verify Code**

```typescript
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

**Step 3: 2FA (if needed)**

```typescript
await fetch(`${API_BASE}/connect/verify-2fa`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId, password }),
});
```

### QR Flow

**Generate QR**

```typescript
const res = await fetch(`${API_BASE}/connect/qr`, {
  method: "POST",
  credentials: "include",
});

const { qrUrl, sessionId } = await res.json();
```

**Poll for Completion**

```typescript
const interval = setInterval(async () => {
  const res = await fetch(
    `${API_BASE}/connect/qr/check?sessionId=${sessionId}`,
    {
      credentials: "include",
    }
  );

  const { success } = await res.json();
  if (success) {
    clearInterval(interval);
    loadConnectedAccounts();
  }
}, 2000);
```

### Endpoints

| Endpoint                                 | Method | Purpose           |
| ---------------------------------------- | ------ | ----------------- |
| `/channels/telegram/connect/phone`       | POST   | Send code         |
| `/channels/telegram/connect/verify-code` | POST   | Verify code       |
| `/channels/telegram/connect/verify-2fa`  | POST   | Verify 2FA        |
| `/channels/telegram/connect/qr`          | POST   | Generate QR       |
| `/channels/telegram/connect/qr/check`    | GET    | Poll QR status    |
| `/channels/telegram/disconnect`          | POST   | Remove connection |

---

## Key Differences

**OAuth Channels (Calendly, PayPal, Shopify, Stripe, Zoom, Facebook):**

- Frontend only initiates auth and handles redirect
- Backend manages OAuth callback and connection
- Success: `?{channel}_connected=true`
- Error: `?error=...`

**Telegram:**

- Multi-step authentication flow
- Frontend calls connect endpoints directly
- No OAuth redirect handling

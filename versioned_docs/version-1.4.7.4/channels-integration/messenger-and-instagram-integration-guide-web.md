---
sidebar_position: 6
---

# Facebook Messenger & Instagram Integration Guide for Web

## Facebook Messenger Integration

### Flow

**1. Initiate**

```typescript
const handleMessengerAuth = () => {
  const currentPath = window.location.pathname + window.location.search;
  const encodedPath = encodeURIComponent(currentPath);
  window.location.href = `${API_BASE}/auth/facebook/connect?redirect_path=${encodedPath}`;
};
```

> This endpoint is session-protected. Backend builds the OAuth URL and redirects to Facebook. Optionally pass `&origin=https://yourapp.com` to control the redirect base URL.

---

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (
    params.get("facebook_connected") === "true" &&
    params.get("type") === "messenger"
  ) {
    setStatus("✅ Facebook Messenger connected");
    loadConnectedChannels();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error") as string));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

Backend redirects back with:

- **Success**
  `?facebook_connected=true&type=messenger`
- **Error**
  `?error=...`

---

### Disconnect

```typescript
// Disconnect specific account
await fetch(`${API_BASE}/auth/facebook/account/${accountId}`, {
  method: "DELETE",
  credentials: "include",
});

// Or disconnect entire channel
await fetch(`${API_BASE}/auth/facebook/channel/${channelId}`, {
  method: "DELETE",
  credentials: "include",
});
```

---

### Endpoints

| Endpoint                            | Method | Auth    | Purpose                        |
| ----------------------------------- | ------ | ------- | ------------------------------ |
| `/auth/facebook/connect`            | GET    | Session | Initiate OAuth                 |
| `/auth/facebook/callback`           | GET    | No      | OAuth callback                 |
| `/auth/facebook/pages`              | GET    | Session | List connected Facebook pages  |
| `/auth/facebook/account/:accountId` | DELETE | Session | Remove a specific page/account |
| `/auth/facebook/channel/:channelId` | DELETE | Session | Remove channel and all pages   |

---

## Instagram Integration

Instagram uses its **own separate OAuth controller** (`/auth/instagram/*`). It is not the same flow as Messenger — do not use `/auth/facebook/*` endpoints for Instagram.

### Flow

**1. Initiate**

```typescript
const handleInstagramAuth = () => {
  const currentPath = window.location.pathname + window.location.search;
  const encodedPath = encodeURIComponent(currentPath);
  window.location.href = `${API_BASE}/auth/instagram/connect?redirect_path=${encodedPath}`;
};
```

> Optionally pass `&origin=https://yourapp.com` to control which base URL the callback redirects to. If omitted, the backend uses the request's `Origin` or `Referer` header.

---

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (params.get("instagram_connected") === "true") {
    setStatus("✅ Instagram connected");
    loadConnectedChannels();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error") as string));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

Backend redirects back with:

- **Success**
  `?instagram_connected=true`
- **Error**
  `?error=...`

---

### Get Connected Accounts

```typescript
const accounts = await fetch(`${API_BASE}/auth/instagram/accounts`, {
  credentials: "include",
}).then((r) => r.json());
```

---

### Disconnect

```typescript
// Disconnect a specific Instagram account
await fetch(`${API_BASE}/auth/instagram/account/${accountId}`, {
  method: "DELETE",
  credentials: "include",
});
```

> There is no channel-level disconnect for Instagram (unlike Messenger). Disconnect individual accounts via the account endpoint above.

---

### Endpoints

| Endpoint                              | Method | Auth    | Purpose                    |
| ------------------------------------- | ------ | ------- | -------------------------- |
| `/auth/instagram/connect`             | GET    | Session | Initiate OAuth             |
| `/auth/instagram/callback`            | GET    | No      | OAuth callback             |
| `/auth/instagram/accounts`            | GET    | Session | List connected accounts    |
| `/auth/instagram/account/:accountId`  | DELETE | Session | Remove Instagram account   |

---

## Key Points

- Messenger and Instagram use **separate OAuth controllers** with separate endpoints — `/auth/facebook/*` for Messenger, `/auth/instagram/*` for Instagram
- Instagram requires a Facebook Page with a linked Instagram Business Account (managed entirely by the backend)
- Backend fully manages OAuth scopes, tokens, page selection, and Instagram linking
- Messenger success redirect: `?facebook_connected=true&type=messenger`
- Instagram success redirect: `?instagram_connected=true` (different key, no `type` param)
- Messenger supports both account-level and channel-level disconnect; Instagram only supports account-level disconnect
- Single `ConnectedChannel` can have multiple `FacebookAccount` records (one per page)
- Session-based authentication required (`credentials: "include"`) for all protected endpoints

---

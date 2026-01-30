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
  window.location.href = `${API_BASE}/connect?type=messenger&redirect_path=${encodedPath}`;
};
```

> This endpoint is session-protected. Backend builds the OAuth URL and redirects to Facebook.

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

| Endpoint                                | Method | Auth    | Purpose             |
| --------------------------------------- | ------ | ------- | ------------------- |
| `/auth/facebook/connect?type=messenger` | GET    | Session | Initiate OAuth      |
| `/auth/facebook/callback`               | GET    | No      | OAuth callback      |
| `/auth/facebook/account/:accountId`     | DELETE | Session | Remove page/account |
| `/auth/facebook/channel/:channelId`     | DELETE | Session | Remove all pages    |

---

## Instagram Integration

### Flow

**1. Initiate**

```typescript
const handleInstagramAuth = () => {
  const currentPath = window.location.pathname + window.location.search;
  const encodedPath = encodeURIComponent(currentPath);
  window.location.href = `${API_BASE}/connect?type=instagram&redirect_path=${encodedPath}`;
};
```

---

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (
    params.get("facebook_connected") === "true" &&
    params.get("type") === "instagram"
  ) {
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
  `?facebook_connected=true&type=instagram`
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
```

---

### Endpoints

| Endpoint                                | Method | Auth    | Purpose                  |
| --------------------------------------- | ------ | ------- | ------------------------ |
| `/auth/facebook/connect?type=instagram` | GET    | Session | Initiate OAuth           |
| `/auth/facebook/callback`               | GET    | No      | OAuth callback           |
| `/auth/facebook/account/:accountId`     | DELETE | Session | Remove Instagram account |

---

## Key Points

- Backend fully manages OAuth (scopes, tokens, page selection, Instagram linking)
- Both Messenger and Instagram use the same Facebook OAuth flow, differentiated by `type` parameter
- Instagram requires a Facebook Page with a linked Instagram Business Account
- Single `ConnectedChannel` can have multiple `FacebookAccount` records (one per page)
- Frontend only:
  - Initiates auth with type parameter
  - Reads redirect query params
- Session-based authentication required (`credentials: "include"`)
- Consistent success & error handling across both types

---

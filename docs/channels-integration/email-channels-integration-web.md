---
sidebar_position: 3
---

# Email channels integration guide for web

## Gmail Integration

### Flow

**1. Initiate**

```typescript
const handleGmailAuth = () => {
  window.location.href = `${API_BASE}/email/google/auth`;
};
```

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (
    params.get("email_connected") === "true" &&
    params.get("provider") === "gmail"
  ) {
    setStatus("✅ Gmail connected");
    loadConnectedAccounts();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

Backend handles OAuth callback and redirects with `?email_connected=true&provider=gmail` or `?error=...`.

### Disconnect

```typescript
await fetch(`${API_BASE}/email/disconnect/gmail`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accountId }),
});
```

### Endpoints

| Endpoint                           | Method | Auth    | Purpose           |
| ---------------------------------- | ------ | ------- | ----------------- |
| `/channels/email/google/auth`      | GET    | Session | Initiate OAuth    |
| `/channels/email/google/callback`  | GET    | No      | Backend callback  |
| `/channels/email/disconnect/gmail` | POST   | Session | Remove connection |

---

## Outlook Integration

### Flow

**1. Initiate**

```typescript
const handleOutlookAuth = () => {
  window.location.href = `${API_BASE}/email/microsoft/auth`;
};
```

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (
    params.get("email_connected") === "true" &&
    params.get("provider") === "outlook"
  ) {
    setStatus("✅ Outlook connected");
    loadConnectedAccounts();
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (params.get("error")) {
    setError(decodeURIComponent(params.get("error")));
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

### Disconnect

```typescript
await fetch(`${API_BASE}/email/disconnect/outlook`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accountId }),
});
```

### Endpoints

| Endpoint                             | Method | Auth    | Purpose           |
| ------------------------------------ | ------ | ------- | ----------------- |
| `/channels/email/microsoft/auth`     | GET    | Session | Initiate OAuth    |
| `/channels/email/microsoft/callback` | GET    | No      | Backend callback  |
| `/channels/email/disconnect/outlook` | POST   | Session | Remove connection |

---

**Key Points:**

- Backend manages entire OAuth flow
- Frontend only initiates and handles redirects
- Success: `?email_connected=true&provider=...`
- Error: `?error=...`
- All require session authentication (`credentials: "include"`)

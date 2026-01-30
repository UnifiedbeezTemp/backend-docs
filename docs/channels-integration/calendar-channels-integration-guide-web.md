---
sidebar_position: 4
---

# Calendar Channels Integration Guide for Web

## Google Calendar Integration

### Flow

**1. Initiate**

```typescript
const handleGoogleCalendarAuth = () => {
  const currentPath = window.location.pathname + window.location.search;
  const encodedPath = encodeURIComponent(currentPath);
  window.location.href = `${API_BASE}/google/auth?redirect_path=${encodedPath}`;
};
```

> This endpoint is session-protected. Backend builds the OAuth URL and redirects to Google.

---

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (
    params.get("calendar_connected") === "true" &&
    params.get("provider") === "google"
  ) {
    setStatus("✅ Google Calendar connected");
    loadConnectedCalendars();
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
  `?calendar_connected=true&provider=google`
- **Error**
  `?error=...`

---

### Disconnect

```typescript
await fetch(`${API_BASE}/channels/calendar/disconnect/google_calendar`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accountId }),
});
```

---

### Endpoints

| Endpoint                                        | Method | Auth    | Purpose           |
| ----------------------------------------------- | ------ | ------- | ----------------- |
| `/channels/calendar/google/auth`                | GET    | Session | Initiate OAuth    |
| `/channels/calendar/google/callback`            | GET    | No      | OAuth callback    |
| `/channels/calendar/disconnect/google_calendar` | POST   | Session | Remove connection |

---

## Microsoft Calendar (Outlook) Integration

### Flow

**1. Initiate**

```typescript
const handleMicrosoftCalendarAuth = () => {
  const currentPath = window.location.pathname + window.location.search;
  const encodedPath = encodeURIComponent(currentPath);
  window.location.href = `${API_BASE}/microsoft/auth?redirect_path=${encodedPath}`;
};
```

---

**2. Handle Redirect**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  if (
    params.get("calendar_connected") === "true" &&
    params.get("provider") === "microsoft"
  ) {
    setStatus("✅ Microsoft Calendar connected");
    loadConnectedCalendars();
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
  `?calendar_connected=true&provider=microsoft`
- **Error**
  `?error=...`

---

### Disconnect

```typescript
await fetch(`${API_BASE}/channels/calendar/disconnect/microsoft_calendar`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accountId }),
});
```

---

### Endpoints

| Endpoint                                           | Method | Auth    | Purpose           |
| -------------------------------------------------- | ------ | ------- | ----------------- |
| `/channels/calendar/microsoft/auth`                | GET    | Session | Initiate OAuth    |
| `/channels/calendar/microsoft/callback`            | GET    | No      | OAuth callback    |
| `/channels/calendar/disconnect/microsoft_calendar` | POST   | Session | Remove connection |

---

## Shared Disconnect Endpoint

Both Email and Calendar channels use a **single unified disconnect handler**.

```typescript
POST /channels/calendar/disconnect/:provider
```

### Supported Providers

- `google_calendar`
- `microsoft_calendar`
- `gmail`
- `outlook`
- `custom`

### Request Body

```json
{
  "accountId": 123
}
```

---

## Key Points

- Backend fully manages OAuth (scopes, tokens, refresh, revocation)
- Frontend only:

  - Initiates auth
  - Reads redirect query params

- Session-based authentication required
  (`credentials: "include"`)
- Consistent success & error handling across Email and Calendar
- Same UI logic can be reused for both channels

---

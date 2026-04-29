# Dashboard — Frontend Integration Guide

> **Auth:** All endpoints require an active session cookie (same as all other authenticated endpoints).
> **Base path:** `/api/v1`
> **Error shape** for all errors:
> ```json
> { "statusCode": 400, "message": "Human-readable description", "error": "Bad Request" }
> ```

---

## Table of Contents

1. [Dashboard Insights](#1-dashboard-insights)
2. [Diary](#2-diary)
   - [Moods Reference](#21-moods-reference)
   - [Diary CRUD](#22-diary-entries)
3. [Alerts](#3-alerts)
4. [Notifications](#4-notifications)
5. [Calendar](#5-calendar)
6. [Sales & Analytics](#6-sales--analytics)

---

## 1. Dashboard Insights

Single endpoint that returns the four insight cards — each with a count and a week-over-week comparison.

### `GET /api/v1/dashboard/insights`

No query parameters.

**Response `200`**

```json
{
  "contacts": {
    "count": 1284,
    "changeFromLastWeek": 47,
    "percentageChange": 3.8,
    "trend": "up"
  },
  "automations": {
    "count": 12,
    "changeFromLastWeek": 2,
    "percentageChange": 20.0,
    "trend": "up"
  },
  "teamMembers": {
    "count": 5,
    "changeFromLastWeek": 0,
    "percentageChange": 0.0,
    "trend": "neutral"
  },
  "tagsCreated": {
    "count": 38,
    "changeFromLastWeek": -3,
    "percentageChange": -7.3,
    "trend": "down"
  }
}
```

**Field reference**

| Field | Type | Description |
|---|---|---|
| `count` | `number` | Current total count |
| `changeFromLastWeek` | `number` | Absolute difference vs. 7 days ago (can be negative) |
| `percentageChange` | `number` | Percentage change rounded to 1 decimal (can be negative) |
| `trend` | `"up" \| "down" \| "neutral"` | Use to pick the colour/arrow on the UI card |

**Errors**

| Status | When |
|---|---|
| `401` | Not authenticated |

---

## 2. Diary

The diary is a private space for each user to log daily entries with a mood and optional tags. Tags are pulled from the user's existing tag library.

### 2.1 Moods Reference

Moods are a predefined list seeded by the server. Fetch this once on app load and cache it.

#### `GET /api/v1/diary/moods`

No query parameters.

**Response `200`**

```json
[
  { "id": 1, "name": "Happy",     "emoji": "😊" },
  { "id": 2, "name": "Excited",   "emoji": "🤩" },
  { "id": 3, "name": "Motivated", "emoji": "💪" },
  { "id": 4, "name": "Grateful",  "emoji": "🙏" },
  { "id": 5, "name": "Neutral",   "emoji": "😐" },
  { "id": 6, "name": "Focused",   "emoji": "🎯" },
  { "id": 7, "name": "Tired",     "emoji": "😴" },
  { "id": 8, "name": "Stressed",  "emoji": "😤" },
  { "id": 9, "name": "Anxious",   "emoji": "😟" },
  { "id": 10, "name": "Sad",      "emoji": "😔" }
]
```

---

### 2.2 Diary Entries

#### `GET /api/v1/diary`

Returns paginated diary entries for the authenticated user, newest first.

**Query parameters**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | `number` | No | `1` | Page number |
| `limit` | `number` | No | `20` | Items per page (max `100`) |

**Response `200`**

```json
{
  "items": [
    {
      "id": 14,
      "text": "Had a productive day. Closed two deals.",
      "mood": { "id": 3, "name": "Motivated", "emoji": "💪" },
      "tags": [
        { "id": 7, "name": "Sales" },
        { "id": 12, "name": "Personal" }
      ],
      "createdAt": "2026-03-25T09:30:00.000Z",
      "updatedAt": "2026-03-25T09:30:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

#### `POST /api/v1/diary`

Creates a new diary entry.

**Request body**

```json
{
  "text": "Had a productive day. Closed two deals.",
  "moodId": 3,
  "tagIds": [7, 12]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `text` | `string` | Yes | The entry content |
| `moodId` | `number` | Yes | Must be a valid mood ID from `/api/v1/diary/moods` |
| `tagIds` | `number[]` | No | Array of tag IDs from the user's tag library. Defaults to `[]` |

**Response `201`** — the created entry (same shape as an item in the list response)

**Errors**

| Status | When |
|---|---|
| `400` | `text` missing, `moodId` invalid, or a `tagId` does not belong to the user |
| `401` | Not authenticated |

---

#### `GET /api/v1/diary/:id`

Fetches a single diary entry.

**Response `200`** — same shape as a list item

**Errors**

| Status | When |
|---|---|
| `401` | Not authenticated |
| `404` | Entry not found or belongs to another user |

---

#### `PATCH /api/v1/diary/:id`

Updates an existing entry. All fields are optional — only include what you want to change.

**Request body**

```json
{
  "text": "Updated reflection on the day.",
  "moodId": 6,
  "tagIds": [7]
}
```

**Response `200`** — the updated entry

**Errors**

| Status | When |
|---|---|
| `400` | Invalid `moodId` or a `tagId` not owned by user |
| `401` | Not authenticated |
| `404` | Entry not found or belongs to another user |

---

#### `DELETE /api/v1/diary/:id`

Permanently deletes an entry.

**Response `200`**

```json
{ "message": "Diary entry deleted" }
```

**Errors**

| Status | When |
|---|---|
| `401` | Not authenticated |
| `404` | Entry not found or belongs to another user |

---

## 3. Alerts

Alerts are short-lived, system-generated notifications grouped by the area of the app that produced them. They are displayed on the Dashboard alerts panel.

**Alert groups**

| Group | `group` value | Example alerts |
|---|---|---|
| Messaging | `messaging` | New message received, delivery failure |
| Automations | `automations` | Step execution failed, trigger error |
| Campaigns | `campaigns` | Campaign send failure, bounce threshold exceeded |
| Billing | `billing` | Payment failed, approaching usage limit |
| System | `system` | Integration connectivity, webhook failures |

**Alert severity levels:** `info`, `warning`, `error`

---

### `GET /api/v1/alerts`

Returns all unread/active alerts for the authenticated user, optionally filtered by group.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `group` | `string` | No | Filter by group slug (see table above) |
| `page` | `number` | No | Default `1` |
| `limit` | `number` | No | Default `20`, max `100` |

**Response `200`**

```json
{
  "items": [
    {
      "id": 5,
      "group": "automations",
      "severity": "error",
      "title": "Automation step failed",
      "message": "The 'Send Email' step in 'Welcome Flow' could not deliver to 3 contacts.",
      "isRead": false,
      "metadata": {
        "automationId": 18,
        "stepId": 42
      },
      "createdAt": "2026-03-25T08:15:00.000Z"
    }
  ],
  "total": 7,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Field reference**

| Field | Type | Description |
|---|---|---|
| `group` | `string` | Which area of the app produced the alert |
| `severity` | `"info" \| "warning" \| "error"` | Use for icon / colour coding |
| `metadata` | `object \| null` | Optional deep-link data (e.g. `automationId` to navigate to the offending automation) |

---

### `PATCH /api/v1/alerts/:id/read`

Marks a single alert as read.

**No request body.**

**Response `200`**

```json
{ "id": 5, "isRead": true }
```

**Errors**

| Status | When |
|---|---|
| `401` | Not authenticated |
| `404` | Alert not found or belongs to another user |

---

### `PATCH /api/v1/alerts/read-all`

Marks all alerts as read. Optionally scoped to a group.

**Request body** (optional)

```json
{ "group": "automations" }
```

**Response `200`**

```json
{ "updated": 7 }
```

---

### `DELETE /api/v1/alerts/:id`

Dismisses (permanently deletes) a single alert.

**Response `200`**

```json
{ "message": "Alert dismissed" }
```

---

## 4. Notifications

Notifications are user-facing events with a persistent read/unread state. They are displayed on the Notifications page and support filtering by category.

**Notification categories**

| Category | `category` value | Examples |
|---|---|---|
| Channels | `channels` | New channel connected, channel disconnected |
| Automations | `automations` | Automation published, automation paused |
| Campaigns | `campaigns` | Campaign completed, campaign scheduled |
| System | `system` | Account upgrade, password changed, team member joined |

> **Difference from Alerts:** Alerts are operational/real-time and are shown on the dashboard panel. Notifications are persistent, categorised user events shown on the dedicated Notifications page. The "All" tab on the notifications page is simply the full list with no category filter. The "Unread" tab is `?unread=true`.

---

### `GET /api/v1/notifications`

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `category` | `string` | No | Filter by category (`channels`, `automations`, `campaigns`, `system`) |
| `unread` | `boolean` | No | Pass `true` to return only unread notifications |
| `page` | `number` | No | Default `1` |
| `limit` | `number` | No | Default `20`, max `100` |

**Response `200`**

```json
{
  "items": [
    {
      "id": 31,
      "category": "automations",
      "title": "Automation Published",
      "body": "Your automation 'Welcome Flow' is now live and running.",
      "isRead": false,
      "metadata": {
        "automationId": 18
      },
      "createdAt": "2026-03-25T07:00:00.000Z"
    }
  ],
  "total": 24,
  "unreadCount": 8,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

> `unreadCount` is always the total unread count across **all** categories, regardless of any active filter. Use it for the badge on the Notifications nav item.

---

### `PATCH /api/v1/notifications/:id/read`

Marks a single notification as read.

**No request body.**

**Response `200`**

```json
{ "id": 31, "isRead": true }
```

---

### `PATCH /api/v1/notifications/read-all`

Marks all notifications as read. Optionally scoped to a category.

**Request body** (optional)

```json
{ "category": "automations" }
```

**Response `200`**

```json
{ "updated": 6 }
```

---

### `DELETE /api/v1/notifications/:id`

Permanently deletes a notification.

**Response `200`**

```json
{ "message": "Notification deleted" }
```

---

## 5. Calendar

A personal calendar for scheduling events with guests and reminders. Reminders are delivered via the system email service at the specified time before the event.

**Event types:** `meeting`, `call`, `viewing`

---

### `GET /api/v1/calendar/events`

Returns a list of calendar events. By default returns events for the current month. Use `from`/`to` to specify a date range.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | `ISO 8601 date string` | No | Start of date range (inclusive). Default: first day of current month |
| `to` | `ISO 8601 date string` | No | End of date range (inclusive). Default: last day of current month |
| `page` | `number` | No | Default `1` |
| `limit` | `number` | No | Default `50`, max `200` |

**Example:** `GET /api/v1/calendar/events?from=2026-03-01&to=2026-03-31`

**Response `200`**

```json
{
  "items": [
    {
      "id": 9,
      "title": "Product demo with Acme Corp",
      "type": "meeting",
      "startTime": "2026-03-28T14:00:00.000Z",
      "endTime": "2026-03-28T15:00:00.000Z",
      "location": "Zoom",
      "description": "Walk through the new dashboard features.",
      "reminderMinutes": 30,
      "guests": [
        { "id": 3, "email": "jane@acmecorp.com" },
        { "id": 4, "email": "bob@acmecorp.com" }
      ],
      "createdAt": "2026-03-20T10:00:00.000Z",
      "updatedAt": "2026-03-20T10:00:00.000Z"
    }
  ],
  "total": 4,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

---

### `POST /api/v1/calendar/events`

Creates a new calendar event.

**Request body**

```json
{
  "title": "Product demo with Acme Corp",
  "type": "meeting",
  "startTime": "2026-03-28T14:00:00.000Z",
  "endTime": "2026-03-28T15:00:00.000Z",
  "location": "Zoom",
  "description": "Walk through the new dashboard features.",
  "reminderMinutes": 30,
  "guestEmails": ["jane@acmecorp.com", "bob@acmecorp.com"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | Yes | Event name |
| `type` | `"meeting" \| "call" \| "viewing"` | Yes | Event type |
| `startTime` | `ISO 8601 string` | Yes | Event start (UTC) |
| `endTime` | `ISO 8601 string` | Yes | Must be after `startTime` |
| `location` | `string` | No | Free-text location or URL |
| `description` | `string` | No | Event notes |
| `reminderMinutes` | `number` | No | Minutes before event to send reminder email. `null` = no reminder |
| `guestEmails` | `string[]` | No | Guest email addresses. Defaults to `[]` |

**Response `201`** — the created event (same shape as a list item)

**Errors**

| Status | When |
|---|---|
| `400` | Missing required fields, `endTime` before `startTime`, invalid `type`, invalid email in `guestEmails` |
| `401` | Not authenticated |

---

### `GET /api/v1/calendar/events/:id`

Fetches a single event.

**Response `200`** — same shape as a list item

**Errors**

| Status | When |
|---|---|
| `401` | Not authenticated |
| `404` | Event not found or belongs to another user |

---

### `PATCH /api/v1/calendar/events/:id`

Updates an existing event. All fields are optional.

> **Guests:** `guestEmails` replaces the entire guest list on the event. To remove all guests send `"guestEmails": []`. If `guestEmails` is omitted entirely, existing guests are unchanged.

**Request body** — same fields as POST, all optional

**Response `200`** — the updated event

**Errors**

| Status | When |
|---|---|
| `400` | `endTime` before `startTime`, invalid `type`, invalid email |
| `401` | Not authenticated |
| `404` | Event not found or belongs to another user |

---

### `DELETE /api/v1/calendar/events/:id`

Deletes an event and all its guests. Cancels any pending reminder email.

**Response `200`**

```json
{ "message": "Event deleted" }
```

---

## 6. Sales & Analytics

> **Requires a connected ecommerce channel.** Sales data is populated from connected Shopify stores, Stripe accounts, and PayPal accounts. If the user has not connected any ecommerce channel, the endpoint returns empty data with a `channelsRequired` flag so the UI can prompt the user to connect a channel.
>
> **How data is populated:** When the user connects a channel (Shopify/Stripe/PayPal), the backend registers webhook listeners. Shopify fires `orders/create` and `orders/updated`; Stripe fires `payment_intent.succeeded`; PayPal fires `PAYMENT.CAPTURE.COMPLETED`. These webhooks write into the central `SalesTransaction` store, which this endpoint reads from.

---

### `GET /api/v1/dashboard/sales`

Returns the sales overview cards and the monthly graph for the specified period.

**Query parameters**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `from` | `ISO 8601 date string` | No | First day of current year | Start of analysis window |
| `to` | `ISO 8601 date string` | No | Today | End of analysis window |
| `channel` | `string` | No | All channels | Filter by source: `shopify`, `stripe`, `paypal` |

**Example:** `GET /api/v1/dashboard/sales?from=2026-01-01&to=2026-03-31`

**Response `200` — with data**

```json
{
  "channelsRequired": false,
  "connectedChannels": ["shopify", "stripe"],
  "currency": "USD",
  "summary": {
    "totalSales": 48320.00,
    "averageSaleValue": 128.51,
    "totalOrders": 376,
    "totalCustomers": 214
  },
  "graph": [
    { "month": "Jan 2026", "sales": 14200.00, "orders": 112 },
    { "month": "Feb 2026", "sales": 16890.00, "orders": 130 },
    { "month": "Mar 2026", "sales": 17230.00, "orders": 134 }
  ]
}
```

**Response `200` — no ecommerce channel connected**

```json
{
  "channelsRequired": true,
  "connectedChannels": [],
  "currency": null,
  "summary": {
    "totalSales": 0,
    "averageSaleValue": 0,
    "totalOrders": 0,
    "totalCustomers": 0
  },
  "graph": []
}
```

**Field reference**

| Field | Type | Description |
|---|---|---|
| `channelsRequired` | `boolean` | `true` if no ecommerce channel is connected. Show an empty-state CTA pointing to the Channels page |
| `connectedChannels` | `string[]` | List of ecommerce channel slugs currently connected for this user |
| `currency` | `string \| null` | ISO 4217 currency code. If the user has channels in multiple currencies, this is the primary channel's currency and all values are normalised to it |
| `summary.totalSales` | `number` | Total revenue in the selected period |
| `summary.averageSaleValue` | `number` | Mean order value |
| `summary.totalOrders` | `number` | Total order/transaction count |
| `summary.totalCustomers` | `number` | Unique customer count |
| `graph` | `array` | One entry per calendar month within the requested date range |
| `graph[].month` | `string` | Display label, format `"MMM YYYY"` |
| `graph[].sales` | `number` | Total revenue for that month |
| `graph[].orders` | `number` | Total order count for that month |

**Errors**

| Status | When |
|---|---|
| `400` | `to` is before `from`, or `channel` value is not a recognised slug |
| `401` | Not authenticated |

---

## Common Error Reference

| Status | Meaning |
|---|---|
| `400 Bad Request` | Validation failed — check `message` field for details |
| `401 Unauthorized` | No active session — redirect to login |
| `404 Not Found` | Resource doesn't exist or belongs to another user |
| `409 Conflict` | Duplicate record (unique constraint) |
| `500 Internal Server Error` | Unexpected server error — do not display raw message to user |

All error responses follow this shape:

```json
{
  "statusCode": 404,
  "message": "Diary entry not found",
  "error": "Not Found"
}
```

# LiveChat & Webchat - Frontend Integration Guide

> **Base URL:** `https://your-api.com/api/v1`
> All authenticated endpoints require a valid session cookie (`connect.sid`) obtained from `POST /auth/login`.
> All error responses follow the shape: `{ "statusCode": number, "message": string | string[], "error": string }`

---

## Overview

The architecture separates two concerns:

- **LiveChat** — a named inbox account (like a WhatsApp account). Each LiveChat is a distinct channel identity that agents use to receive and respond to widget conversations. Users can have multiple LiveChat accounts (e.g. "Sales", "Support").
- **Webchat** — a website widget configuration. Controls appearance, branding, and which labels/channels are shown to visitors. Linked to LiveChat accounts via communication labels.

```
User
├── LiveChatConfig[]         (inbox accounts — one ConnectedChannel auto-provisioned)
│     └── ChannelAiConfig   (AI settings per LiveChat account)
└── WebchatConfig[]          (widget configs — one per website)
      └── CommunicationLabel[]
            ├── WebchatLabelChannel → LiveChatConfig   (routes to live chat)
            └── WebchatLabelLink                       (external links: website / email / phone)
```

**Typical setup flow:**

1. Create a LiveChat account
2. (Optional) Assign an AI assistant to it
3. Create a Webchat widget for your website
4. Add a communication label to the widget
5. Attach the LiveChat account to the label
6. Embed the widget script on your website

---

## Common Patterns

### Authentication

Every request (except public endpoints marked `🌐 Public`) requires:

```
Cookie: connect.sid=<session>
```

### File uploads

Endpoints that accept files use `multipart/form-data`. Accepted types: `image/png`, `image/jpeg`, `image/svg+xml`, `image/webp`. Max size: **2 MB**.

### Numeric IDs in route params

All `:id` parameters must be integers. Sending a non-numeric string returns `400 Bad Request`.

### Tenant isolation

All queries are scoped to the authenticated user. Requesting another user's resource returns `404` (not `403`) — the API does not confirm existence to other tenants.

---

## LiveChat Endpoints

### Create a LiveChat account

```
POST /livechat
Content-Type: multipart/form-data
```

Auto-provisions a `LIVECHAT` `ConnectedChannel` for the user on first call (shared across all LiveChat accounts). Subsequent calls reuse the same channel.

**Request fields**

| Field          | Type    | Required | Notes                                                             |
| -------------- | ------- | -------- | ----------------------------------------------------------------- |
| `teamName`     | string  | ✅       | Internal name shown to agents                                     |
| `chatName`     | string  | ✅       | Display name shown to visitors                                    |
| `readReceipts` | boolean | —        | Send as string `"true"` / `"false"` in multipart. Default `false` |
| `profilePic`   | file    | —        | PNG, JPEG, SVG, or WebP · max 2 MB                                |

**Response `201`**

```json
{
  "id": 3,
  "connectedChannelId": 1,
  "teamName": "Support Team",
  "chatName": "Help Chat",
  "profilePic": null,
  "readReceipts": false,
  "isActive": true,
  "createdAt": "2026-04-03T10:00:00.000Z",
  "updatedAt": "2026-04-03T10:00:00.000Z",
  "connectedChannel": {
    "id": 1,
    "userId": 7,
    "channelName": "Live Chat",
    "isActive": true,
    "isConnected": true
  }
}
```

**Errors**

| Status | Condition                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| `400`  | Missing `teamName` or `chatName`                                                                                |
| `400`  | Invalid or oversized `profilePic`                                                                               |
| `400`  | Plan does not support LiveChat: `"Your plan does not support Live Chat. Please upgrade to Business or higher."` |
| `404`  | LiveChat channel type not seeded in system: `"LiveChat channel type is not available. Please contact support."` |

---

### List LiveChat accounts

```
GET /livechat
```

Returns all LiveChat accounts owned by the authenticated user, ordered by `createdAt` ascending.

**Response `200`** — array of LiveChat objects (same shape as create response)

---

### Get a LiveChat account

```
GET /livechat/:id
```

**Response `200`** — single LiveChat object

**Errors**

| Status | Condition                            |
| ------ | ------------------------------------ |
| `400`  | `:id` is not a number                |
| `404`  | Not found or belongs to another user |

---

### Update a LiveChat account

```
PATCH /livechat/:id
Content-Type: application/json
```

**Request body** — all fields optional

| Field          | Type    | Notes                     |
| -------------- | ------- | ------------------------- |
| `teamName`     | string  |                           |
| `chatName`     | string  |                           |
| `readReceipts` | boolean | JSON boolean (not string) |

**Response `200`** — updated LiveChat object

**Errors**

| Status | Condition                                               |
| ------ | ------------------------------------------------------- |
| `400`  | Extra undeclared fields in body                         |
| `400`  | `readReceipts` sent as string `"yes"` — must be boolean |
| `404`  | Not found                                               |

---

### Delete a LiveChat account

```
DELETE /livechat/:id
```

Cascades: deletes associated `WebchatLabelChannel` rows and `ChannelAiConfig` entries.

**Response `200`**

```json
{ "message": "Live chat deleted successfully" }
```

**Errors**

| Status | Condition             |
| ------ | --------------------- |
| `400`  | `:id` is not a number |
| `404`  | Not found             |

---

### Upload / replace LiveChat profile picture

```
PATCH /livechat/:id/profile-pic
Content-Type: multipart/form-data
```

Replaces any existing profile picture.

**Request fields**

| Field        | Type | Required |
| ------------ | ---- | -------- |
| `profilePic` | file | ✅       |

**Response `200`** — updated LiveChat object with new `profilePic` URL

**Errors**

| Status | Condition                              |
| ------ | -------------------------------------- |
| `400`  | Invalid file type or size exceeds 2 MB |
| `404`  | LiveChat not found                     |

---

## Webchat Endpoints

### Create a Webchat widget

```
POST /webchat
Content-Type: multipart/form-data
```

**Request fields**

| Field        | Type         | Required | Notes                                             |
| ------------ | ------------ | -------- | ------------------------------------------------- |
| `websiteUrl` | string (URI) | ✅       | URL of the site where the widget will be embedded |
| `chatName`   | string       | —        | Display name shown to visitors                    |
| `profilePic` | file         | —        | PNG, JPEG, SVG, or WebP · max 2 MB                |

**Response `201`**

```json
{
  "id": 5,
  "userId": 7,
  "websiteUrl": "https://acme.com",
  "chatName": "Acme Support",
  "profilePic": null,
  "chatIcon": null,
  "bubbleColor": "#4F46E5",
  "greetingText": "Hi there! How can we help?",
  "backgroundType": "SOLID",
  "backgroundColor": "#FFFFFF",
  "alignment": "RIGHT",
  "distanceFromRight": 24,
  "distanceFromBottom": 24,
  "widgetBgColor": "#1F2937",
  "widgetFontColor": "#FFFFFF",
  "removeUnifiedBeezLogo": false,
  "isActive": true,
  "createdAt": "2026-04-03T10:00:00.000Z",
  "updatedAt": "2026-04-03T10:00:00.000Z"
}
```

**Errors**

| Status | Condition                                                                   |
| ------ | --------------------------------------------------------------------------- |
| `400`  | Missing `websiteUrl`                                                        |
| `400`  | `websiteUrl` is not a valid URL                                             |
| `400`  | Invalid or oversized `profilePic`                                           |
| `400`  | Plan does not support Webchat: `"Webchat requires Business plan or higher"` |

---

### List Webchat widgets

```
GET /webchat
```

**Response `200`** — array of Webchat objects

---

### Get a Webchat widget

```
GET /webchat/:id
```

Returns full config including labels with their channels and links.

**Response `200`** — full Webchat object with nested `communicationLabels`

**Errors**

| Status | Condition                            |
| ------ | ------------------------------------ |
| `400`  | `:id` is not a number                |
| `404`  | Not found or belongs to another user |

---

### Update Webchat settings

```
PATCH /webchat/:id
Content-Type: application/json
```

**Request body** — all fields optional

| Field                          | Type      | Constraints               | Notes                                             |
| ------------------------------ | --------- | ------------------------- | ------------------------------------------------- |
| `websiteUrl`                   | string    | valid URI                 |                                                   |
| `chatName`                     | string    |                           | Display name for visitors                         |
| `bubbleColor`                  | string    |                           | Hex color e.g. `"#4F46E5"`                        |
| `greetingText`                 | string    |                           | Greeting message in widget header                 |
| `greetingLanguage`             | string    |                           | Language code e.g. `"en"`                         |
| `backgroundType`               | enum      | `"SOLID"` \| `"GRADIENT"` |                                                   |
| `backgroundColor`              | string    |                           | Hex color — used when `backgroundType` is `SOLID` |
| `backgroundGradient`           | object    |                           | Used when `backgroundType` is `GRADIENT`          |
| `backgroundGradient.start`     | string    |                           | Start hex color                                   |
| `backgroundGradient.end`       | string    |                           | End hex color                                     |
| `backgroundGradient.direction` | string    |                           | e.g. `"to-right"`, `"to-bottom"`                  |
| `alignment`                    | enum      | `"LEFT"` \| `"RIGHT"`     | Widget position                                   |
| `distanceFromRight`            | integer   | 0–500                     | Pixels from right (or left if `alignment=LEFT`)   |
| `distanceFromBottom`           | integer   | 0–500                     | Pixels from bottom                                |
| `widgetBgColor`                | string    |                           | Widget panel background color                     |
| `widgetFontColor`              | string    |                           | Widget panel font color                           |
| `textColor`                    | string    |                           | Chat bubble text color                            |
| `avatarPhoto`                  | string    |                           | URL to avatar photo                               |
| `introduceTeam`                | boolean   |                           | Show team member avatars                          |
| `teamMemberAccess`             | integer[] | each ≥ 1                  | IDs of team members who can see this widget       |
| `defaultLanguage`              | string    |                           | Default language code                             |
| `removeUnifiedBeezLogo`        | boolean   |                           | Requires White Label Portal addon                 |

**Response `200`** — updated Webchat object

**Errors**

| Status | Condition                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| `400`  | Invalid field types or values                                                                                |
| `400`  | `removeUnifiedBeezLogo: true` without addon: `"Removing UnifiedBeez logo requires White Label Portal addon"` |
| `400`  | Team member IDs not found: `"Team members not found: 1,2"`                                                   |
| `404`  | Webchat not found                                                                                            |

---

### Delete a Webchat widget

```
DELETE /webchat/:id
```

Cascades: deletes all labels, channels, links, languages, and localizations.

**Response `200`**

```json
{ "message": "Webchat deleted successfully" }
```

---

### Upload chat icon

```
POST /webchat/:id/upload-icon
Content-Type: multipart/form-data
```

**Request fields**

| Field  | Type | Required |
| ------ | ---- | -------- |
| `icon` | file | ✅       |

**Response `200`**

```json
{ "chatIcon": "https://cdn.example.com/icons/abc.png" }
```

---

### Upload profile picture

```
POST /webchat/:id/upload-profile-pic
Content-Type: multipart/form-data
```

**Request fields**

| Field        | Type | Required                             |
| ------------ | ---- | ------------------------------------ |
| `profilePic` | file | ✅ — PNG, JPEG, SVG, WebP · max 2 MB |

**Response `200`**

```json
{ "profilePic": "https://cdn.example.com/pics/abc.png" }
```

---

## Webchat — Labels

Labels represent the routing options presented to visitors in the widget (e.g. "Sales", "Support"). Each label can have LiveChat channels attached to it, and/or external links.

### Add a label

```
POST /webchat/:id/labels
Content-Type: application/json
```

**Request body**

| Field           | Type    | Required | Notes                                 |
| --------------- | ------- | -------- | ------------------------------------- |
| `name`          | string  | ✅       | Shown to visitors                     |
| `displayOrder`  | integer | —        | Default `0`                           |
| `showCtaButton` | boolean | —        | Default `false`                       |
| `ctaButtonText` | string  | —        | Required if `showCtaButton` is `true` |
| `ctaButtonLink` | string  | —        | URL for CTA button                    |

**Response `201`** — label object with `id`

---

### Update a label

```
PATCH /webchat/labels/:labelId
Content-Type: application/json
```

**Request body** — all optional, same fields as Add

**Response `200`** — updated label object

---

### Delete a label

```
DELETE /webchat/labels/:labelId
```

Cascades: deletes attached channels and links.

**Response `200`** — success message

**Errors**

| Status | Condition       |
| ------ | --------------- |
| `404`  | Label not found |

---

### Attach a LiveChat account to a label

```
POST /webchat/labels/:labelId/channels
Content-Type: application/json
```

This is the key step that routes a visitor who picks a label to a LiveChat inbox.

**Request body**

| Field              | Type    | Required | Constraints                                 |
| ------------------ | ------- | -------- | ------------------------------------------- |
| `liveChatConfigId` | integer | ✅       | ≥ 1 — must belong to the authenticated user |
| `displayName`      | string  | ✅       | Label shown in the widget for this channel  |
| `icon`             | string  | —        | Optional icon URL                           |

**Response `201`** — label channel object with `id`

**Errors**

| Status | Condition                                            |
| ------ | ---------------------------------------------------- |
| `400`  | `liveChatConfigId` is `0` or missing                 |
| `404`  | LiveChat config not found or belongs to another user |

---

### Remove a LiveChat from a label

```
DELETE /webchat/label-channels/:id
```

**Response `200`** — success message

---

### Add an external link to a label

```
POST /webchat/labels/:labelId/links
Content-Type: application/json
```

**Request body**

| Field          | Type           | Required    | Notes                                   |
| -------------- | -------------- | ----------- | --------------------------------------- |
| `linkType`     | enum           | ✅          | `"WEBSITE"` \| `"EMAIL"` \| `"PHONE"`   |
| `text`         | string         | ✅          | Display text for the link               |
| `websiteUrl`   | string (URI)   | Conditional | Required when `linkType` is `"WEBSITE"` |
| `emailAddress` | string (email) | Conditional | Required when `linkType` is `"EMAIL"`   |
| `phoneNumber`  | string         | Conditional | Required when `linkType` is `"PHONE"`   |
| `icon`         | string         | —           | Optional icon URL                       |
| `displayOrder` | integer        | —           | Default `0`                             |

**Response `201`** — label link object with `id`

**Errors**

| Status | Condition                                          |
| ------ | -------------------------------------------------- |
| `400`  | `linkType` missing or invalid enum value           |
| `400`  | `websiteUrl` missing for `WEBSITE` link            |
| `400`  | `emailAddress` missing or invalid for `EMAIL` link |

---

### Remove a link from a label

```
DELETE /webchat/labels/:linkId/links
```

**Response `200`** — success message

---

### Reorder label items

```
PATCH /webchat/labels/:labelId/items/reorder
Content-Type: application/json
```

Sets `displayOrder` for any mix of channels and links within a label.

**Request body**

```json
{
  "items": [
    { "type": "channel", "id": 3, "displayOrder": 0 },
    { "type": "link", "id": 7, "displayOrder": 1 },
    { "type": "channel", "id": 5, "displayOrder": 2 }
  ]
}
```

| Field                  | Type    | Required | Constraints             |
| ---------------------- | ------- | -------- | ----------------------- |
| `items`                | array   | ✅       |                         |
| `items[].type`         | enum    | ✅       | `"channel"` \| `"link"` |
| `items[].id`           | integer | ✅       | ≥ 1                     |
| `items[].displayOrder` | integer | ✅       | ≥ 0                     |

**Response `200`** — updated items

**Errors**

| Status | Condition                      |
| ------ | ------------------------------ |
| `400`  | `items` missing or empty array |
| `400`  | `id` is `0`                    |
| `400`  | Invalid `type` enum value      |

---

## Webchat — Languages & Localizations

### Add a language

```
POST /webchat/:id/languages
Content-Type: application/json
```

| Field          | Type    | Required                 |
| -------------- | ------- | ------------------------ |
| `languageCode` | string  | ✅ — e.g. `"en"`, `"es"` |
| `languageName` | string  | ✅ — e.g. `"English"`    |
| `displayOrder` | integer | —                        |

**Response `201`** — language object

---

### Update a language

```
PATCH /webchat/languages/:languageId
Content-Type: application/json
```

All fields optional (same as Add). **Response `200`**.

---

### Delete a language

```
DELETE /webchat/languages/:languageId
```

**Response `200`** — success message

---

### Add a content localization

```
POST /webchat/:id/localizations
Content-Type: application/json
```

| Field          | Type   | Required |
| -------------- | ------ | -------- |
| `languageCode` | string | ✅       |
| `title`        | string | ✅       |
| `body`         | string | ✅       |

**Response `201`** — localization object

---

### Delete a content localization

```
DELETE /webchat/localizations/:localizationId
```

**Response `200`** — success message

---

## Webchat — Installation

### Get embed code

```
GET /webchat/:webchatId/embed
🌐 Public — no auth required
```

Returns the script tag to paste into a website's `<head>`.

**Response `200`**

```json
{
  "embedCode": "<script src=\"https://cdn.example.com/widget.js\" data-webchat-id=\"5\" data-api-url=\"https://api.example.com/api/v1\" data-ws-url=\"wss://api.example.com\" async></script>"
}
```

---

### Generate install script (saves websiteUrl)

```
POST /webchat/:id/install-script
Content-Type: application/json
```

Same as embed code but also persists `websiteUrl` on the webchat config.

| Field        | Type         | Required |
| ------------ | ------------ | -------- |
| `websiteUrl` | string (URI) | ✅       |

**Response `200`** — same shape as embed code response

---

### Verify installation

```
POST /webchat/:id/verify-install
```

Fetches the configured `websiteUrl` and checks for the BeeBot script tag.

**Response `200`**

```json
{
  "installed": true,
  "message": "BeeBot script found on https://acme.com"
}
```

**Errors**

| Status | Condition                                     |
| ------ | --------------------------------------------- |
| `400`  | Website URL not yet configured on the webchat |
| `404`  | Webchat not found                             |

---

### Send installation instructions by email

```
POST /webchat/:id/send-instructions-by-email
Content-Type: application/json
```

| Field    | Type     | Required                        |
| -------- | -------- | ------------------------------- |
| `emails` | string[] | ✅ — each must be a valid email |

**Response `200`**

```json
{
  "message": "Instructions sent",
  "sent": 2,
  "failed": 0,
  "results": [{ "email": "dev@acme.com", "success": true, "error": null }]
}
```

---

### Send installation instructions to team members

```
POST /webchat/:id/send-instructions-to-team
Content-Type: application/json
```

| Field           | Type      | Required |
| --------------- | --------- | -------- |
| `teamMemberIds` | integer[] | ✅       |

**Response `200`** — same shape as email instructions response

---

## Webchat — Visitor (Public API)

### Create or get visitor

```
POST /webchat/:webchatId/visitor
Content-Type: application/json
🌐 Public — no auth required
```

Call on first load to obtain a persistent visitor ID. Store the returned `visitorId` in `localStorage`.

**Request body** — all optional

| Field       | Type           | Notes                                            |
| ----------- | -------------- | ------------------------------------------------ |
| `visitorId` | string         | Pass existing ID to retrieve instead of creating |
| `email`     | string (email) | Associate visitor with an email address          |
| `name`      | string         | Visitor display name                             |

**Response `201`**

```json
{
  "visitorId": "visitor_4ec4a268-8eb7-4f8d-8db6-e349027f1ec1",
  "email": null,
  "name": null
}
```

---

### Get public widget configuration

```
GET /webchat/:webchatId/config
🌐 Public — no auth required
```

Returns the configuration the widget needs to render (branding, labels, languages). Safe to call from the browser.

**Response `200`** — public config object (no sensitive fields)

---

### Mark message as read

```
POST /webchat/messages/:messageId/read
Content-Type: application/json
🌐 Public — no auth required (called by widget)
```

Records that a visitor has read a message. Only meaningful when `readReceipts` is enabled on the LiveChat account.

**Request body**

| Field       | Type    | Required |
| ----------- | ------- | -------- |
| `webchatId` | integer | ✅       |
| `visitorId` | string  | ✅       |

**Response `201`**

```json
{ "readAt": "2026-04-03T10:15:00.000Z" }
```

**Side effect:** emits `message_read` event via WebSocket to the dashboard for the agent.

---

## Channel AI Configuration

These endpoints manage the AI assistant assigned to a LiveChat account. Use `?liveChatId=` to target a LiveChat account.

### Get AI config

```
GET /channels/:channelId/ai-config/:aiId?liveChatId=3
```

**Query params for LiveChat**

| Param        | Type    | Notes                                                |
| ------------ | ------- | ---------------------------------------------------- |
| `liveChatId` | integer | LiveChat config ID — use this for LiveChat AI config |

> For other channel types (WhatsApp, Facebook, etc.) use `?accountId=&accountType=` instead.

**Response `200`** — AI config object

**Errors**

| Status | Condition                                                     |
| ------ | ------------------------------------------------------------- |
| `400`  | Neither `liveChatId` nor `(accountId + accountType)` provided |
| `404`  | Config not found                                              |

---

### Update AI config

```
PATCH /channels/:channelId/ai-config/:aiId?liveChatId=3
Content-Type: application/json
```

**Request body** — all optional

| Field                         | Type     | Constraints                                                              |
| ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `escalationEnabled`           | boolean  |                                                                          |
| `unansweredMessagesThreshold` | integer  | ≥ 1                                                                      |
| `escalationTimeAmount`        | integer  | ≥ 1                                                                      |
| `escalationTimeUnit`          | enum     | `"MINUTES"` \| `"HOURS"` \| `"DAYS"`                                     |
| `escalateToAllMembers`        | boolean  |                                                                          |
| `escalationKeywords`          | string[] |                                                                          |
| `escalationContacts`          | object[] | `[{ "email": string, "fullName": string }]`                              |
| `followUpEnabled`             | boolean  |                                                                          |
| `followUpDelayAmount`         | integer  | ≥ 1                                                                      |
| `followUpDelayUnit`           | enum     | `"MINUTES"` \| `"HOURS"` \| `"DAYS"`                                     |
| `followUpContentType`         | enum     | `"GENERIC"` \| `"CONTEXTUAL"` \| `"CUSTOM"`                              |
| `replyDelayAmount`            | integer  | ≥ 0                                                                      |
| `replyDelayUnit`              | enum     | `"SECONDS"` \| `"MINUTES"`                                               |
| `openingHour`                 | integer  | 0–23                                                                     |
| `closingHour`                 | integer  | 0–23                                                                     |
| `timezone`                    | string   | e.g. `"America/New_York"`                                                |
| `workingDays`                 | enum[]   | `"MONDAY"` … `"SUNDAY"`                                                  |
| `industryType`                | string   |                                                                          |
| `teamAccess`                  | object[] | `[{ "teamMemberId": number, "canView": boolean, "canModify": boolean }]` |

**Response `200`** — updated AI config object

---

### Switch AI assistant

```
PATCH /channels/:channelId/switch-ai/:newAiId?liveChatId=3
```

**Response `200`** — updated config with new AI assistant

**Errors**

| Status | Condition                                                     |
| ------ | ------------------------------------------------------------- |
| `400`  | Neither `liveChatId` nor `(accountId + accountType)` provided |
| `404`  | AI assistant not found                                        |

---

## WebSocket — Visitor Widget

Connect to the `/webchat` Socket.IO namespace. The widget SDK handles reconnection automatically.

### Connection

```
ws://your-api.com/webchat
  ?webchatId=5
  &visitorId=visitor_4ec4a268-8eb7-4f8d-8db6-e349027f1ec1
```

The origin of the request must match the `websiteUrl` configured on the webchat. `localhost` is always allowed.

**On connect — server emits `connected`**

```json
{
  "visitorId": "visitor_4ec4a268...",
  "webchatId": 5,
  "config": {
    /* same as GET /webchat/:id/config */
  }
}
```

**Disconnect reasons**

- Missing or invalid `webchatId`
- Origin not allowed (domain mismatch)
- Webchat has no active LiveChat attached to any label

---

### Events: client → server

#### `send_message`

First message in a new conversation — include `labelId`:

```json
{ "content": "Hello!", "labelId": 2 }
```

Follow-up in an existing conversation — include `conversationId`:

```json
{ "content": "What are your hours?", "conversationId": "123" }
```

> The widget stores `conversationId` in `localStorage` (key: `unifiedbeez_conv_{webchatId}`) after the first message and uses it for all subsequent messages.

**Server acknowledgement (callback)**

```json
{
  "messageId": "456",
  "conversationId": "123",
  "timestamp": "2026-04-03T10:15:00.000Z"
}
```

**Errors**

```json
{ "message": "Rate limit exceeded" }
{ "message": "Failed to send message" }
```

---

#### `load_history`

Request conversation history after a page refresh. The widget calls this automatically on `connected` if a `conversationId` is in `localStorage`.

```json
{ "conversationId": "123", "limit": 50 }
```

**Server acknowledgement (callback)**

```json
{
  "success": true,
  "messages": [
    {
      "id": "10",
      "content": "Hello!",
      "direction": "outbound",
      "createdAt": "2026-04-03T10:14:00.000Z",
      "isAiGenerated": false
    },
    {
      "id": "11",
      "content": "Hi there! How can I help?",
      "direction": "inbound",
      "createdAt": "2026-04-03T10:14:05.000Z",
      "isAiGenerated": true
    }
  ]
}
```

> `direction` is from the **visitor's perspective**: `"outbound"` = visitor sent, `"inbound"` = agent/AI sent. Messages are ordered oldest first.

---

#### `typing_start` / `typing_stop`

No body required. Notifies the dashboard that the visitor is typing. Has no effect if no `conversationId` is active yet.

---

### Events: server → client

#### `new_message`

Sent when the AI or an agent replies.

```json
{
  "id": "11",
  "content": "Hi there! How can I help?",
  "direction": "inbound",
  "createdAt": "2026-04-03T10:14:05.000Z",
  "isAiGenerated": true
}
```

#### `message_read`

Sent when a dashboard agent marks a visitor message as read (requires `readReceipts` enabled on the LiveChat account).

```json
{
  "messageId": "10",
  "readAt": "2026-04-03T10:14:10.000Z"
}
```

---

## End-to-End Setup Example

```
# 1. Create a LiveChat account
POST /livechat
  teamName=Support Team  chatName=Help Chat

→ liveChatId = 3

# 2. Get the connectedChannelId (returned in step 1 response)
→ connectedChannelId = 1

# 3. (Optional) Assign AI assistant
PATCH /channels/1/switch-ai/2?liveChatId=3

# 4. Create a webchat widget for your site
POST /webchat
  websiteUrl=https://acme.com  chatName=Acme Support

→ webchatId = 5

# 5. Style the widget
PATCH /webchat/5
  { "bubbleColor": "#10B981", "greetingText": "Hi! How can we help?" }

# 6. Add a communication label
POST /webchat/5/labels
  { "name": "Support", "displayOrder": 0 }

→ labelId = 8

# 7. Attach the LiveChat account to the label
POST /webchat/labels/8/channels
  { "liveChatConfigId": 3, "displayName": "Support Chat" }

# 8. Get the embed script
GET /webchat/5/embed

→ paste <script ...> into site <head>

# 9. Verify installation
POST /webchat/5/verify-install

→ { "installed": true }
```

---

## Reference

### Enums

| Enum                    | Values                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| `WebchatAlignment`      | `LEFT`, `RIGHT`                                                              |
| `WebchatBackgroundType` | `SOLID`, `GRADIENT`                                                          |
| `WebchatLinkType`       | `WEBSITE`, `EMAIL`, `PHONE`                                                  |
| `WorkingDay`            | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` |
| `TimeUnit`              | `MINUTES`, `HOURS`, `DAYS`                                                   |
| `ReplyTimeUnit`         | `SECONDS`, `MINUTES`                                                         |
| `FollowUpContentType`   | `GENERIC`, `CONTEXTUAL`, `CUSTOM`                                            |

### Plan requirements

| Feature                     | Minimum plan             |
| --------------------------- | ------------------------ |
| LiveChat                    | Business                 |
| Webchat widget              | Business                 |
| Remove UnifiedBeez branding | White Label Portal addon |

### localStorage keys (widget)

| Key                                  | Content                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| `unifiedbeez_visitor_id`             | Persistent visitor ID (shared across all widgets on the domain) |
| `unifiedbeez_conv_{webchatId}`       | Active conversation ID for this widget                          |
| `unifiedbeez_label_id_{webchatId}`   | Last selected label ID                                          |
| `unifiedbeez_label_name_{webchatId}` | Last selected label name                                        |

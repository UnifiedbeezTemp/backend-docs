# Live Dashboard Inbox — Frontend API Reference

> **Base URL:** All endpoints are relative to `/api/v1`
>
> **Authentication:** Session cookie (`session_id` httpOnly cookie sent automatically with `withCredentials: true`). For mobile/non-browser clients, pass the session token as `Authorization: Bearer <session_token>`.
>
> **ID types:** Conversation IDs and Message IDs are **BigInt strings**. Always send and receive them as strings — never parse them as JavaScript `number` (precision loss). Channel IDs and User IDs are regular integers.

---

## Table of Contents

1. [Conversation Endpoints](#1-conversation-endpoints)
2. [Message Endpoints](#2-message-endpoints)
3. [Conversation Sidebar](#3-conversation-sidebar)
4. [Team Inbox](#4-team-inbox)
5. [WhatsApp Template Messages](#5-whatsapp-template-messages)
6. [WebSocket — Connection Guide](#6-websocket--connection-guide)
7. [WebSocket — Namespace `/messages`](#7-websocket--namespace-messages)
8. [WebSocket — Namespace `/channel-status`](#8-websocket--namespace-channel-status)
9. [Enums Reference](#9-enums-reference)
10. [Error Responses](#10-error-responses)

---

## 1. Conversation Endpoints

### GET `/conversations`

List conversations with optional filters and pagination.

**Query Parameters**

| Param              | Type    | Description                                                                           |
| ------------------ | ------- | ------------------------------------------------------------------------------------- |
| `status`           | string  | `ACTIVE` \| `RESOLVED` \| `ESCALATED` \| `ARCHIVED`                                  |
| `channelType`      | string  | `WHATSAPP` \| `FACEBOOK_MESSENGER` \| `INSTAGRAM` \| `TELEGRAM` \| `EMAIL` \| `SMS` \| `WEBCHAT` |
| `assignedToUserId` | integer | Filter by assigned agent ID                                                           |
| `unreadOnly`       | `"true"` | Only return conversations with unread messages                                       |
| `isInternal`       | `"false"` | Pass `"false"` to exclude team inbox (internal) conversations                       |
| `page`             | integer | Default: `1`                                                                          |
| `limit`            | integer | Default: `20`, max: `100`                                                             |

**Response `200`**

```json
{
  "conversations": [
    {
      "id": "9007199254740993",
      "userId": 42,
      "organizationId": 42,
      "channelId": 3,
      "channelType": "WHATSAPP",
      "accountId": 7,
      "participantId": "447700900000",
      "participantName": "John Customer",
      "participantAvatar": null,
      "status": "ACTIVE",
      "isInternal": false,
      "isGroupChat": false,
      "groupName": null,
      "allParticipants": ["447700900000"],
      "assignedToUserId": null,
      "assignedToTeamMemberId": null,
      "isAiEnabled": true,
      "unreadCount": 3,
      "lastMessageId": "9007199254740994",
      "lastMessageAt": "2026-04-14T10:30:00.000Z",
      "lastMessagePreview": "Hi, I need help with my order",
      "escalatedAt": null,
      "escalatedReason": null,
      "resolvedAt": null,
      "archivedAt": null,
      "isDeleted": false,
      "createdAt": "2026-04-14T09:00:00.000Z",
      "updatedAt": "2026-04-14T10:30:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

---

### GET `/conversations/stats`

Returns aggregate counts across all conversations for the authenticated user.

**Response `200`**

```json
{
  "total": 45,
  "active": 30,
  "resolved": 10,
  "escalated": 2,
  "unreadCount": 8
}
```

---

### GET `/conversations/:id`

Get a single conversation by ID.

**Path params:** `id` — BigInt string conversation ID

**Response `200`** — Single conversation object (same shape as items in the list above)

**Errors**
- `400` — Invalid conversation ID format
- `404` — Conversation not found or does not belong to your organisation

---

### POST `/conversations`

Create a new conversation manually.

**Request body**

```json
{
  "channelId": 3,
  "channelType": "WHATSAPP",
  "participantId": "447700900000",
  "participantName": "John Customer",
  "assignedToUserId": 7,
  "isAiEnabled": true
}
```

| Field                   | Required | Description                                                      |
| ----------------------- | -------- | ---------------------------------------------------------------- |
| `channelId`             | ✅       | The connected channel to use                                     |
| `channelType`           | ✅       | Must match the channel's type                                    |
| `participantId`         | ✅       | Phone number, email, Telegram ID, etc.                           |
| `participantName`       |          | Display name for the contact                                     |
| `assignedToUserId`      |          | Assign to a specific agent on creation                           |
| `assignedToTeamMemberId`|          | Assign to a team member (org member)                             |
| `isAiEnabled`           |          | Whether the AI assistant responds automatically. Default: `true` |

**Response `201`** — The created conversation object

---

### POST `/conversations/from-contact`

Start a conversation by selecting an existing contact (from a Campaign List).

**Request body**

```json
{
  "contactId": 101,
  "channelType": "WHATSAPP",
  "channelId": 3
}
```

The contact must have a configured identifier for the selected channel (e.g. phone number for WhatsApp, email for Email). If a non-archived conversation already exists for this participant on this channel/account, it is returned instead of creating a new one.

**Response `201`** — The created or existing conversation object

**Errors**
- `404` — Contact not found, or contact has no identifier for the selected channel

---

### PUT `/conversations/:id/status`

Update the status of a conversation.

**Request body**

```json
{
  "status": "RESOLVED",
  "reason": "Issue resolved via phone call"
}
```

`reason` is optional but recommended for `ESCALATED` status.

**Response `200`** — Updated conversation object

---

### PUT `/conversations/:id/assign`

Assign a conversation to an agent or team member.

**Request body** — provide one of:

```json
{ "assignedToUserId": 7 }
```

```json
{ "assignedToTeamMemberId": 12 }
```

**Response `200`** — Updated conversation object

---

### PUT `/conversations/:id/resolve`

Shortcut to set status to `RESOLVED`.

**Response `200`** — Updated conversation object

---

### PUT `/conversations/:id/archive`

Shortcut to set status to `ARCHIVED`.

**Response `200`** — Updated conversation object

---

### PUT `/conversations/:id/escalate`

Shortcut to set status to `ESCALATED`.

**Request body**

```json
{ "reason": "Customer threatening legal action" }
```

**Response `200`** — Updated conversation object

---

### DELETE `/conversations/:id`

Permanently delete a conversation and all its messages.

**Response `200`**

```json
{ "message": "Conversation deleted successfully" }
```

---

### GET `/conversations/conversation/:conversationId`

Fetch paginated messages inside a conversation. Prefer this over `GET /messages?conversationId=` when rendering a conversation view — it's scoped to a single conversation.

**Query params:** `page` (default: `1`), `limit` (default: `50`, max: `100`)

**Response `200`**

```json
{
  "messages": [ /* array of message objects — see Message Object below */ ],
  "total": 120,
  "page": 1,
  "limit": 50
}
```

---

## 2. Message Endpoints

### Message Object

Every endpoint that returns messages uses this shape:

```json
{
  "id": "9007199254740994",
  "conversationId": "9007199254740993",
  "userId": 42,
  "organizationId": 42,
  "channelId": 3,
  "channelType": "WHATSAPP",
  "accountId": 7,
  "direction": "INBOUND",
  "type": "TEXT",
  "status": "DELIVERED",
  "content": "Hi, I need help with my order",
  "senderId": "447700900000",
  "senderName": "John Customer",
  "recipientId": "+447700123456",
  "recipientName": "Support",
  "attachments": [
    {
      "type": "IMAGE",
      "url": "https://cdn.unifiedbeez.com/message-attachments/...",
      "filename": "receipt.jpg",
      "size": 204800,
      "mimeType": "image/jpeg",
      "caption": null,
      "thumbnail": null
    }
  ],
  "metadata": {
    "channelMessageId": "wamid.abc123",
    "timestamp": 1713088200
  },
  "isAiGenerated": false,
  "aiTokensUsed": null,
  "userIntent": null,
  "escalationScore": null,
  "isPinned": false,
  "pinnedAt": null,
  "pinnedBy": null,
  "isDeleted": false,
  "threadId": null,
  "threadRootOf": null,
  "deliveredAt": "2026-04-14T10:30:01.000Z",
  "readAt": null,
  "failureReason": null,
  "createdAt": "2026-04-14T10:30:00.000Z",
  "updatedAt": "2026-04-14T10:30:01.000Z"
}
```

---

### GET `/messages`

List messages with filters. Use this for search or cross-conversation queries.

**Query Parameters**

| Param            | Type    | Description                                                                  |
| ---------------- | ------- | ---------------------------------------------------------------------------- |
| `conversationId` | string  | BigInt string — filter to a single conversation                              |
| `channelId`      | integer | Filter by channel                                                            |
| `channelType`    | string  | See enums                                                                    |
| `direction`      | string  | `INBOUND` \| `OUTBOUND`                                                      |
| `type`           | string  | `TEXT` \| `IMAGE` \| `VIDEO` \| `AUDIO` \| `DOCUMENT` \| `TEMPLATE` \| etc. |
| `status`         | string  | `PENDING` \| `SENT` \| `DELIVERED` \| `READ` \| `FAILED`                     |
| `isAiGenerated`  | boolean | Filter AI-generated messages                                                 |
| `startDate`      | ISO8601 | Created at or after this date                                                |
| `endDate`        | ISO8601 | Created at or before this date                                               |
| `search`         | string  | Full-text search across content, senderName, recipientName                  |
| `page`           | integer | Default: `1`                                                                 |
| `limit`          | integer | Default: `20`, max: `100`                                                    |

**Response `200`**

```json
{
  "messages": [ /* array of message objects */ ],
  "total": 87,
  "page": 1,
  "limit": 20
}
```

---

### GET `/messages/stats`

Message statistics for the authenticated user.

**Query params:** `days` — number of days to include (default: `30`, max: `365`)

**Response `200`**

```json
{
  "totalMessages": 1240,
  "inbound": 820,
  "outbound": 420,
  "aiGenerated": 310,
  "byChannel": {
    "WHATSAPP": 600,
    "EMAIL": 400,
    "FACEBOOK_MESSENGER": 240
  },
  "byStatus": {
    "DELIVERED": 980,
    "READ": 200,
    "FAILED": 60
  }
}
```

---

### GET `/messages/:id`

Get a single message by ID.

**Response `200`** — Single message object

**Errors**
- `404` — Message not found

---

### POST `/messages`

Send a message in a conversation.

> **Beehive mode restriction:** Returns `403` when `isBeehive = true`. Team inbox messages (`isInternal: true` conversations) are exempt.

**Request body**

```json
{
  "conversationId": "9007199254740993",
  "channelId": 3,
  "channelType": "WHATSAPP",
  "accountId": 7,
  "content": "Hello! How can I help you today?",
  "type": "TEXT",
  "direction": "OUTBOUND",
  "attachments": []
}
```

| Field            | Required | Description                                                                       |
| ---------------- | -------- | --------------------------------------------------------------------------------- |
| `conversationId` | ✅       | BigInt string                                                                     |
| `channelId`      | ✅       | The connected channel ID                                                          |
| `channelType`    | ✅       | Must match the channel type                                                       |
| `accountId`      |          | Required when the channel has multiple accounts (e.g. multiple WhatsApp numbers) |
| `content`        | ✅       | Message text                                                                      |
| `type`           | ✅       | `TEXT` \| `IMAGE` \| `VIDEO` \| `AUDIO` \| `DOCUMENT`                            |
| `direction`      | ✅       | Always `OUTBOUND` when sending from the dashboard                                 |
| `attachments`    |          | Array of attachment objects (see below)                                           |

**Attachment object**

```json
{
  "type": "IMAGE",
  "url": "https://cdn.unifiedbeez.com/...",
  "filename": "photo.jpg",
  "size": 102400,
  "mimeType": "image/jpeg",
  "caption": "See attached",
  "thumbnail": null
}
```

**Response `201`** — The created message object

**Errors**
- `403` — Messaging disabled in Beehive mode
- `404` — Conversation not found

---

### POST `/messages/with-attachments`

Send a message and upload files in the same request. `multipart/form-data`. Max 5 files.

**Form fields**

| Field            | Type   | Description                        |
| ---------------- | ------ | ---------------------------------- |
| `conversationId` | string | BigInt string                      |
| `channelId`      | number | The connected channel ID           |
| `channelType`    | string | Channel type enum                  |
| `content`        | string | Message text (can be empty string) |
| `direction`      | string | `OUTBOUND`                         |
| `files`          | File[] | Up to 5 files, field name `files`  |

**Response `201`** — The created message object including uploaded attachment URLs

**Errors**
- `403` — Beehive mode

---

### POST `/messages/template`

Send a pre-approved WhatsApp template message. Required when initiating a conversation outside the 24h service window.

**Request body**

```json
{
  "channelId": 3,
  "recipientId": "447700900000",
  "templateName": "order_confirmation",
  "languageCode": "en_US",
  "parameters": [
    { "type": "text", "text": "ORD-12345" },
    { "type": "text", "text": "£49.99" }
  ]
}
```

**Response `201`** — The created message object

**Errors**
- `403` — Beehive mode

---

### PUT `/messages/:id/status`

Update message delivery status.

**Request body**

```json
{
  "status": "READ",
  "deliveredAt": "2026-04-14T10:30:01.000Z",
  "readAt": "2026-04-14T10:35:00.000Z",
  "failureReason": null
}
```

**Response `200`** — Updated message object

---

### PUT `/messages/:id/read`

Mark a single message as read.

**Response `200`** — Updated message object

---

### PUT `/messages/conversation/:conversationId/read`

Mark all unread inbound messages in a conversation as read and reset the `unreadCount` to `0`. Also triggers a `conversation.updated` WebSocket event to the user room.

**Response `200`**

```json
{ "message": "All messages marked as read" }
```

---

### DELETE `/messages/:id`

Soft-delete a message.

**Response `200`**

```json
{ "message": "Message deleted successfully" }
```

---

### PUT `/messages/:id/pin`

Pin a message in a conversation.

**Response `200`**

```json
{
  "id": "9007199254740994",
  "isPinned": true,
  "pinnedAt": "2026-04-14T10:40:00.000Z",
  "pinnedBy": 42
}
```

---

### DELETE `/messages/:id/pin`

Unpin a message.

**Response `200`**

```json
{ "id": "9007199254740994", "isPinned": false }
```

---

### POST `/messages/typing/:conversationId/start`

Signal that the agent has started typing. Broadcasts a `user_typing` event to other members of the conversation room.

**Request body**

```json
{
  "participantId": "447700900000",
  "channelType": "WHATSAPP"
}
```

**Response `200`**

```json
{ "message": "Typing indicator started" }
```

---

### POST `/messages/typing/:conversationId/stop`

Signal that the agent stopped typing.

**Request body**

```json
{ "participantId": "447700900000" }
```

**Response `200`**

```json
{ "message": "Typing indicator stopped" }
```

---

### GET `/messages/typing/:conversationId`

Get the current set of users actively typing in a conversation.

**Response `200`**

```json
{
  "users": [
    {
      "userId": 42,
      "participantId": "447700900000",
      "channelType": "WHATSAPP",
      "startedAt": "2026-04-14T10:45:00.000Z"
    }
  ]
}
```

---

## 3. Conversation Sidebar

Each conversation has a sidebar with Comments, Notes, and Files.

---

### Comments

Internal notes visible to agents only — never sent to the customer.

#### GET `/conversations/:conversationId/comments`

**Response `200`**

```json
[
  {
    "id": 1,
    "conversationId": "9007199254740993",
    "content": "Customer is a VIP — escalate if unresolved.",
    "createdAt": "2026-04-14T10:00:00.000Z",
    "updatedAt": "2026-04-14T10:00:00.000Z",
    "user": {
      "id": 42,
      "fullName": "Jane Smith",
      "email": "jane@acme.com"
    }
  }
]
```

#### POST `/conversations/:conversationId/comments`

**Request body**

```json
{ "content": "Customer is a VIP — escalate if unresolved." }
```

**Response `201`** — The created comment object

#### DELETE `/conversations/:conversationId/comments/:commentId`

Agents can only delete their own comments.

**Response `200`**

```json
{ "message": "Comment deleted" }
```

**Errors**
- `403` — Not your comment
- `404` — Comment not found

---

### Notes

Rich internal notes with coloured backgrounds for visual organisation.

#### GET `/conversations/:conversationId/notes`

**Response `200`**

```json
[
  {
    "id": 1,
    "conversationId": "9007199254740993",
    "content": "Refund approved, awaiting confirmation.",
    "backgroundColor": "#FFF3CD",
    "createdAt": "2026-04-14T10:00:00.000Z",
    "updatedAt": "2026-04-14T10:00:00.000Z",
    "user": {
      "id": 42,
      "fullName": "Jane Smith",
      "email": "jane@acme.com"
    }
  }
]
```

#### POST `/conversations/:conversationId/notes`

**Request body**

```json
{
  "content": "Refund approved, awaiting confirmation.",
  "backgroundColor": "#FFF3CD"
}
```

**Response `201`** — The created note object

#### PUT `/conversations/:conversationId/notes/:noteId`

**Request body** (all fields optional)

```json
{
  "content": "Updated note text.",
  "backgroundColor": "#D1FAE5"
}
```

**Response `200`** — The updated note object

#### DELETE `/conversations/:conversationId/notes/:noteId`

**Response `200`**

```json
{ "message": "Note deleted" }
```

---

### Files

All file attachments sent or received within a conversation.

#### GET `/conversations/:conversationId/files`

**Response `200`**

```json
[
  {
    "type": "IMAGE",
    "url": "https://cdn.unifiedbeez.com/message-attachments/...",
    "filename": "receipt.jpg",
    "size": 204800,
    "mimeType": "image/jpeg",
    "messageId": "9007199254740994",
    "sentAt": "2026-04-14T11:00:00.000Z",
    "senderName": "John Customer",
    "direction": "INBOUND"
  }
]
```

---

## 4. Team Inbox

Internal-only conversations between team members. Messages here do **not** go to external channels. Team messaging works even in Beehive mode.

### GET `/team-inbox/members`

Returns all active organisation members available to message.

**Response `200`**

```json
[
  {
    "id": 7,
    "email": "alice@acme.com",
    "fullName": "Alice Johnson",
    "isOwner": false,
    "isActive": true,
    "roles": [
      { "id": 2, "name": "Support Agent", "type": "SUPPORT" }
    ]
  }
]
```

---

### GET `/team-inbox/conversations`

List all internal conversations (DMs and group chats) for the current user.

**Query params:** `page` (default: `1`), `limit` (default: `20`)

**Response `200`**

```json
{
  "conversations": [
    {
      "id": "9007199254740995",
      "isInternal": true,
      "isGroupChat": false,
      "groupName": null,
      "allParticipants": ["42", "7"],
      "lastMessageAt": "2026-04-14T11:30:00.000Z",
      "lastMessagePreview": "Can you take this one?",
      "unreadCount": 2,
      "createdAt": "2026-04-14T09:00:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

---

### POST `/team-inbox/conversations`

Create a new DM or group chat. If a DM between the same two users already exists, the existing conversation is returned.

**Request body — DM**

```json
{ "participantUserIds": [7] }
```

**Request body — Group chat**

```json
{
  "participantUserIds": [7, 9, 14],
  "isGroupChat": true,
  "groupName": "Sales Team"
}
```

**Response `201`** — The created (or existing) conversation object

**Errors**
- `400` — Fewer than 2 participants provided

---

### GET `/team-inbox/conversations/:id`

Get a single internal conversation.

**Response `200`** — Conversation object

---

### PUT `/team-inbox/conversations/:id/participants`

Update the participant list for a group chat.

**Request body**

```json
{ "participantUserIds": [7, 9, 14, 22] }
```

**Response `200`** — Updated conversation object

---

### Sending messages in Team Inbox

Use the same standard message endpoints — they work for both external and internal conversations:

| Action              | Endpoint                                              |
| ------------------- | ----------------------------------------------------- |
| Send message        | `POST /messages`                                      |
| Fetch messages      | `GET /conversations/conversation/:conversationId`     |
| Delete message      | `DELETE /messages/:id`                                |
| Pin/Unpin           | `PUT /messages/:id/pin` / `DELETE /messages/:id/pin`  |
| Comments sidebar    | `GET /conversations/:id/comments`                     |
| Notes sidebar       | `GET /conversations/:id/notes`                        |
| Files sidebar       | `GET /conversations/:id/files`                        |

For `POST /messages` in a team inbox conversation, `channelType` should be `WEBCHAT` and `direction` should be `OUTBOUND`.

---

## 5. WhatsApp Template Messages

Required when initiating a conversation outside the 24h service window.

### GET `/whatsapp/templates?channelId=:id&status=APPROVED`

Fetch templates for a channel. Optional `status` filter: `APPROVED` \| `PENDING` \| `REJECTED` \| `PAUSED` \| `DISABLED`.

**Response `200`**

```json
{
  "templates": [
    {
      "id": "template_meta_id_123",
      "name": "order_confirmation",
      "status": "APPROVED",
      "category": "UTILITY",
      "language": "en_US",
      "components": [
        {
          "type": "HEADER",
          "format": "TEXT",
          "text": "Order Confirmation"
        },
        {
          "type": "BODY",
          "text": "Your order {{1}} has been placed. Total: {{2}}."
        },
        {
          "type": "FOOTER",
          "text": "Thank you for shopping with us."
        }
      ]
    }
  ]
}
```

---

### POST `/messages/template`

Send a template message. Parameters must map to the template's `{{1}}`, `{{2}}` placeholders in order.

**Request body**

```json
{
  "channelId": 3,
  "recipientId": "447700900000",
  "templateName": "order_confirmation",
  "languageCode": "en_US",
  "parameters": [
    { "type": "text", "text": "ORD-12345" },
    { "type": "text", "text": "£49.99" }
  ]
}
```

**Response `201`** — Message object

---

## 6. WebSocket — Connection Guide

### Authentication

The WebSocket gateways authenticate via the **same session cookie** used by the REST API. For browsers, the cookie is sent automatically when you connect with `withCredentials: true`. For mobile or non-browser clients, pass the session token explicitly.

```javascript
import { io } from "socket.io-client";

// Browser (session cookie sent automatically)
const socket = io("https://api.yourdomain.com/messages", {
  withCredentials: true,
});

// Mobile / non-browser (session token from login response)
const socket = io("https://api.yourdomain.com/messages", {
  auth: { sessionId: "your_session_token" },
  // OR via header:
  extraHeaders: { Authorization: "Bearer your_session_token" },
});
```

### Lifecycle

```javascript
// 1. Connected and authenticated — server confirms identity
socket.on("connected", ({ userId, timestamp }) => {
  console.log("Connected as user", userId);
  // At this point you are subscribed to your user:{userId} room automatically.
  // You'll receive user-level events (new conversations, unread counts, etc.)
  // without any further action.
});

// 2. Connection error (e.g. session expired)
socket.on("error", ({ message }) => {
  if (message === "Unauthorized") {
    // Redirect to login
  }
});

// 3. Disconnected
socket.on("disconnect", (reason) => {
  // Attempt reconnect if reason !== "io client disconnect"
});
```

### Opening a Conversation

When the user navigates to a conversation, join its room to receive real-time messages and typing indicators.

```javascript
// Join when conversation view mounts
socket.emit("join_conversation", { conversationId: "9007199254740993" });

socket.on("conversation_joined", ({ conversationId }) => {
  // Room joined — now receiving message.created, user_typing, message.status_updated
});

// Leave when conversation view unmounts
socket.emit("leave_conversation", { conversationId: "9007199254740993" });
```

### Typing Indicators

```javascript
// Agent starts typing
socket.emit("start_typing", {
  conversationId: "9007199254740993",
  participantId: "447700900000",
  channelType: "WHATSAPP",
});

// Agent stops typing (or on blur / send)
socket.emit("stop_typing", {
  conversationId: "9007199254740993",
  participantId: "447700900000",
});

// Another agent's typing state
socket.on("user_typing", ({ conversationId, userId, participantId, isTyping, timestamp }) => {
  // isTyping: true = show indicator, false = hide
});
```

### Marking Messages Read

The WebSocket `mark_messages_read` event notifies **other sessions in the same conversation room** that messages were read (peer notification). To actually clear the unread count in the database, call the REST endpoint separately.

```javascript
// Notify peers (WS only — does not update DB)
socket.emit("mark_messages_read", {
  conversationId: "9007199254740993",
  messageIds: ["9007199254740994", "9007199254740995"],
});

// Clear unread count in DB (also fires conversation.updated to your user room)
fetch("/api/v1/messages/conversation/9007199254740993/read", { method: "PUT" });
```

### Checking Online Status

```javascript
socket.emit("get_online_users", { userIds: [7, 9, 14] });

socket.on("online_users", ({ users }) => {
  // users: { 7: true, 9: false, 14: true }
});
```

---

## 7. WebSocket — Namespace `/messages`

**URL:** `wss://api.yourdomain.com/messages`

This is the primary realtime namespace. All inbox events flow through here.

---

### Rooms

| Room | Who is in it | Purpose |
|------|-------------|---------|
| `user:{userId}` | All sessions for this user | User-level events: new conversations, unread count updates |
| `conversation:{id}` | Clients that called `join_conversation` | Per-conversation events: new messages, typing, read receipts |

---

### Client → Server Events

#### `join_conversation`

Join a conversation room. Must be called before you receive `message.created` for that conversation.

```javascript
socket.emit("join_conversation", {
  conversationId: "9007199254740993"  // string BigInt
});
```

**Server confirms:**
```javascript
socket.on("conversation_joined", {
  conversationId: "9007199254740993"
});
// + immediately sends typing_indicators (see below)
```

---

#### `leave_conversation`

Leave a conversation room. Call when the conversation view unmounts.

```javascript
socket.emit("leave_conversation", {
  conversationId: "9007199254740993"
});
```

**Server confirms:**
```javascript
socket.on("conversation_left", {
  conversationId: "9007199254740993"
});
```

---

#### `start_typing`

```javascript
socket.emit("start_typing", {
  conversationId: "9007199254740993",
  participantId: "447700900000",
  channelType: "WHATSAPP"
});
```

---

#### `stop_typing`

```javascript
socket.emit("stop_typing", {
  conversationId: "9007199254740993",
  participantId: "447700900000"
});
```

---

#### `mark_messages_read`

Peer notification only — does not write to DB.

```javascript
socket.emit("mark_messages_read", {
  conversationId: "9007199254740993",
  messageIds: ["9007199254740994", "9007199254740995"]
});
```

---

#### `get_online_users`

```javascript
socket.emit("get_online_users", {
  userIds: [7, 9, 14]
});
```

---

### Server → Client Events

---

#### `connected`

Fired once immediately after successful authentication.

**Room:** direct to client

```json
{
  "userId": 42,
  "timestamp": "2026-04-14T09:00:00.000Z"
}
```

---

#### `conversation.created`

A brand new conversation appeared (first inbound message from a new contact, or a new conversation was manually created). Use this to prepend a row to the conversation list without polling.

**Room:** `user:{userId}`

```json
{
  "id": "9007199254740993",
  "status": "ACTIVE",
  "participantId": "447700900000",
  "participantName": "John Customer",
  "channelType": "WHATSAPP",
  "channelId": 3,
  "accountId": 7,
  "unreadCount": 1,
  "lastMessageAt": "2026-04-14T10:30:00.000Z",
  "lastMessagePreview": "Hi, I need help with my order",
  "lastMessage": null,
  "assignedToUserId": null,
  "assignedToTeamMemberId": null,
  "createdAt": "2026-04-14T10:30:00.000Z"
}
```

---

#### `conversation.updated`

A conversation row changed — new message arrived, status changed, assignment changed, or unread count was reset. Use this to update the corresponding row in the conversation list in-place.

The payload is a **partial snapshot**: always contains `id`. Other fields are present only when they changed. Merge it into your local conversation state by `id`.

**Room:** `user:{userId}`

**On new inbound/outbound message:**

```json
{
  "id": "9007199254740993",
  "status": "ACTIVE",
  "participantId": "447700900000",
  "participantName": "John Customer",
  "channelType": "WHATSAPP",
  "channelId": 3,
  "accountId": 7,
  "unreadCount": 4,
  "lastMessageAt": "2026-04-14T10:35:00.000Z",
  "lastMessagePreview": "Can you check my tracking number?",
  "lastMessage": {
    "id": "9007199254740996",
    "content": "Can you check my tracking number?",
    "direction": "INBOUND",
    "type": "TEXT",
    "senderName": "John Customer",
    "createdAt": "2026-04-14T10:35:00.000Z",
    "attachments": []
  },
  "assignedToUserId": null,
  "assignedToTeamMemberId": null
}
```

**On unread count reset (after `PUT /messages/conversation/:id/read`):**

```json
{
  "id": "9007199254740993",
  "unreadCount": 0
}
```

---

#### `conversation.status_updated`

**Room:** `conversation:{id}` **and** `user:{userId}`

```json
{
  "id": "9007199254740993",
  "status": "RESOLVED",
  "reason": "Issue resolved via phone call"
}
```

---

#### `conversation.assigned`

**Room:** `conversation:{id}` **and** `user:{userId}`

```json
{
  "id": "9007199254740993",
  "assignedToUserId": 7,
  "assignedToTeamMemberId": null
}
```

---

#### `message.created`

A new message was sent or received in a conversation. Only fires for conversations you have joined.

**Room:** `conversation:{id}`

```json
{
  "id": "9007199254740996",
  "conversationId": "9007199254740993",
  "content": "Can you check my tracking number?",
  "direction": "INBOUND",
  "type": "TEXT",
  "status": "DELIVERED",
  "senderId": "447700900000",
  "senderName": "John Customer",
  "channelType": "WHATSAPP",
  "accountId": 7,
  "attachments": [],
  "createdAt": "2026-04-14T10:35:00.000Z",
  "isAiGenerated": false,
  "metadata": {
    "channelMessageId": "wamid.xyz789",
    "timestamp": 1713091500
  }
}
```

---

#### `message.status_updated`

A previously sent message's delivery or read status changed (e.g. WhatsApp delivery receipt).

**Room:** `conversation:{id}`

```json
{
  "messageId": "9007199254740994",
  "status": "READ",
  "updatedAt": "2026-04-14T10:36:00.000Z",
  "deliveredAt": "2026-04-14T10:30:01.000Z",
  "readAt": "2026-04-14T10:36:00.000Z"
}
```

---

#### `user_typing`

Another agent or the same user started or stopped typing.

**Room:** `conversation:{id}` (broadcast to others in the room — you do not receive your own)

```json
{
  "conversationId": "9007199254740993",
  "userId": 9,
  "participantId": "447700900000",
  "isTyping": true,
  "timestamp": "2026-04-14T10:37:00.000Z"
}
```

---

#### `typing_indicators`

Sent immediately after `join_conversation` with the current typing state.

**Room:** direct to joining client

```json
{
  "conversationId": "9007199254740993",
  "typing": [
    {
      "userId": 9,
      "participantId": "447700900000",
      "channelType": "WHATSAPP",
      "startedAt": "2026-04-14T10:37:00.000Z"
    }
  ]
}
```

---

#### `messages_read`

Another session in the conversation marked messages as read (peer notification only — DB state is updated via REST).

**Room:** `conversation:{id}` (broadcast to others in room)

```json
{
  "conversationId": "9007199254740993",
  "userId": 9,
  "messageIds": ["9007199254740994", "9007199254740995"],
  "readAt": "2026-04-14T10:38:00.000Z"
}
```

---

#### `online_users`

Response to `get_online_users`.

**Room:** direct to requesting client

```json
{
  "users": {
    "7": true,
    "9": false,
    "14": true
  }
}
```

---

#### `error`

Sent when a server-side operation fails (e.g. failed to join a conversation you don't own).

**Room:** direct to client

```json
{
  "message": "Failed to join conversation",
  "conversationId": "9007199254740993"
}
```

---

## 8. WebSocket — Namespace `/channel-status`

**URL:** `wss://api.yourdomain.com/channel-status`

Monitors the health and connectivity status of all connected channels. Useful for showing connection status indicators in the sidebar or channel settings.

**Authentication:** Same session cookie / token as the `/messages` namespace.

```javascript
const statusSocket = io("https://api.yourdomain.com/channel-status", {
  withCredentials: true,
});
```

On connect, the server automatically joins the client to `org-{organizationId}` and sends the current status snapshot.

---

### Client → Server Events

#### `subscribe-channel-status`

Subscribe to status updates for specific channels. If `channelIds` is omitted, subscribes to all organisation channels.

```javascript
statusSocket.emit("subscribe-channel-status", {
  channelIds: [3, 7]   // optional — omit to subscribe to all
});
```

**Server confirms:**
```javascript
statusSocket.on("subscription-confirmed", {
  channelIds: [3, 7],   // or "all"
  timestamp: "2026-04-14T09:00:00.000Z"
});
```

---

#### `unsubscribe-channel-status`

```javascript
statusSocket.emit("unsubscribe-channel-status", {
  channelIds: [3]   // optional — omit to unsubscribe from all
});
```

**Server confirms:**
```javascript
statusSocket.on("unsubscription-confirmed", {
  channelIds: [3],
  timestamp: "2026-04-14T09:00:00.000Z"
});
```

---

#### `get-channel-status`

Request the current status of a specific channel.

```javascript
statusSocket.emit("get-channel-status", { channelId: 3 });
```

---

### Server → Client Events

#### `current-channel-statuses`

Sent immediately on connection with the current status of all channels in the organisation.

```json
{
  "organizationId": 42,
  "channels": [
    {
      "channelId": 3,
      "status": "HEALTHY",
      "lastCheckedAt": "2026-04-14T10:00:00.000Z"
    }
  ],
  "timestamp": "2026-04-14T10:00:00.000Z"
}
```

---

#### `channel-status-changed`

Fired whenever a channel's health status changes.

```json
{
  "channelId": 3,
  "status": "DEGRADED",
  "responseTime": 4200,
  "error": "Timeout connecting to WhatsApp API",
  "issueType": "TIMEOUT",
  "metadata": {},
  "timestamp": "2026-04-14T10:05:00.000Z"
}
```

`status` values: `HEALTHY` \| `DEGRADED` \| `UNHEALTHY` \| `UNKNOWN`

---

#### `channel-metrics-update`

Periodic performance metrics for a channel.

```json
{
  "channelId": 3,
  "metrics": {
    "responseTime": 320,
    "errorRate": 0.02,
    "uptime": 0.998,
    "throughput": 142
  },
  "timestamp": "2026-04-14T10:10:00.000Z"
}
```

---

#### `system-alert`

A system-wide or channel-specific alert.

```json
{
  "type": "HIGH_ERROR_RATE",
  "severity": "WARNING",
  "message": "WhatsApp channel error rate above threshold",
  "channelId": 3,
  "details": {},
  "timestamp": "2026-04-14T10:15:00.000Z"
}
```

`severity` values: `INFO` \| `WARNING` \| `CRITICAL`

---

#### `maintenance-notification`

Advance notice of scheduled maintenance affecting specific channels.

```json
{
  "type": "maintenance",
  "channelIds": [3, 7],
  "message": "WhatsApp infrastructure maintenance window: 02:00–04:00 UTC",
  "scheduledTime": "2026-04-15T02:00:00.000Z",
  "timestamp": "2026-04-14T12:00:00.000Z"
}
```

---

#### `channel-status-response`

Response to a `get-channel-status` request.

```json
{
  "channelId": 3,
  "status": "HEALTHY",
  "message": "Status check requested",
  "timestamp": "2026-04-14T10:00:00.000Z"
}
```

---

## 9. Enums Reference

### `ChannelType`

| Value               | Description              |
| ------------------- | ------------------------ |
| `WHATSAPP`          | WhatsApp Business API    |
| `FACEBOOK_MESSENGER`| Facebook Messenger       |
| `INSTAGRAM`         | Instagram DMs            |
| `TELEGRAM`          | Telegram                 |
| `SMS`               | SMS via Twilio           |
| `EMAIL`             | Email (Gmail/Outlook/SES)|
| `WEBCHAT`           | Webchat widget / Team inbox |

### `ConversationStatus`

| Value      | Description                          |
| ---------- | ------------------------------------ |
| `ACTIVE`   | Open and active                      |
| `RESOLVED` | Marked as resolved by an agent       |
| `ESCALATED`| Escalated for urgent attention       |
| `ARCHIVED` | Archived (hidden from main inbox)    |

### `MessageDirection`

| Value      | Description                          |
| ---------- | ------------------------------------ |
| `INBOUND`  | Received from the customer           |
| `OUTBOUND` | Sent by an agent or the AI           |

### `MessageType`

| Value          | Description                        |
| -------------- | ---------------------------------- |
| `TEXT`         | Plain text                         |
| `IMAGE`        | Image attachment                   |
| `VIDEO`        | Video attachment                   |
| `AUDIO`        | Audio/voice message                |
| `DOCUMENT`     | File/document attachment           |
| `TEMPLATE`     | WhatsApp template message          |
| `INTERACTIVE`  | Interactive button/list message    |
| `LOCATION`     | Location share                     |
| `CONTACT`      | Contact card                       |
| `MARKETING_EMAIL` | Marketing email (campaign)      |

### `MessageStatus`

| Value       | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| `PENDING`   | Created locally, not yet sent to the channel API              |
| `SENT`      | Accepted by the channel API                                   |
| `DELIVERED` | Delivered to the recipient's device                           |
| `READ`      | Read by the recipient                                         |
| `FAILED`    | Delivery failed — check `failureReason`                       |

---

## 10. Error Responses

All errors follow this shape:

```json
{
  "statusCode": 404,
  "message": "Conversation not found",
  "error": "Not Found"
}
```

| Status | When                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| `400`  | Invalid request body, missing required field, invalid ID format                 |
| `401`  | Not authenticated (session missing or expired)                                  |
| `403`  | Authenticated but not permitted — e.g. messaging in Beehive mode                |
| `404`  | Resource not found or belongs to a different organisation                        |
| `409`  | Conflict — duplicate record                                                     |
| `500`  | Internal server error — report to backend team with the request ID if available |

For validation errors (`400`), `message` may be an array:

```json
{
  "statusCode": 400,
  "message": [
    "channelId must be an integer",
    "channelType must be a valid enum value"
  ],
  "error": "Bad Request"
}
```

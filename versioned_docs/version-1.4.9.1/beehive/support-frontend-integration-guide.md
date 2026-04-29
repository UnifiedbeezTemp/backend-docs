# Frontend Integration Guide: Live Support System

This guide covers everything the dashboard frontend needs to integrate with the Live Support system — HTTP endpoints, WebSocket events, data types, and error handling.

---

## Authentication

The Live Support system uses the same session-based authentication as the rest of the platform. There is no JWT involved — authentication is via the `session_id` issued at login.

### Browser (web dashboard)

The session cookie (`session_id`) is set as an httpOnly cookie on login and is sent automatically by the browser for all same-origin requests. No `Authorization` header is needed for HTTP calls. For the WebSocket connection, use `withCredentials: true` — the browser attaches the cookie automatically.

### Mobile (React Native / Flutter / etc.)

The login response body contains a `session_id` string. Store it securely (e.g. encrypted storage).

- **HTTP:** Pass it as `Authorization: Bearer <sessionId>` on every request.
- **WebSocket:** Pass it via `extraHeaders` or the `auth` object (see below).

---

## Connecting via WebSocket

### Browser

```typescript
import { io, Socket } from "socket.io-client";

const socket: Socket = io("/support", {
  withCredentials: true, // sends session_id cookie automatically
  transports: ["websocket"],
});
```

### Mobile

```typescript
// Option A — Authorization header (recommended, mirrors HTTP pattern)
const socket: Socket = io("/support", {
  extraHeaders: { Authorization: `Bearer ${sessionId}` },
  transports: ["websocket"],
});

// Option B — explicit auth object
const socket: Socket = io("/support", {
  auth: { sessionId },
  transports: ["websocket"],
});
```

On successful connection the server immediately emits `support:connected` with the user's current active conversation (or a new one if none exists).

```typescript
socket.on(
  "support:connected",
  ({ conversation }: { conversation: SupportConversation }) => {
    // Store conversation.id — you will need it for the attachment upload event
    setConversation(conversation);
  }
);
```

> **Reconnection:** If the user refreshes the page and reconnects, `support:connected` returns the existing open conversation, not a new one. Display the existing message history rather than clearing the chat.

---

## HTTP Endpoints

Base URL: `/support`
All endpoints require an active session. Browser: cookie is sent automatically. Mobile: include `Authorization: Bearer <sessionId>`.

### POST /start

Initiate a support session or retrieve the current active one. Safe to call on page load as a fallback if the WebSocket `support:connected` event has not yet fired.

**Body:**

```json
{
  "category": "billing"
}
```

> Note: `category` is optional. An `initialMessage` field is accepted by the schema but is not currently processed by the server — do not rely on it.

**Response:** `SupportConversation`

---

### GET /conversations/:id

Retrieve a conversation by ID including the last 50 messages.

**Response:** `SupportConversation` with `messages` populated.

**Errors:**

- `401 Unauthorized` — missing or invalid JWT
- `403 Forbidden` — conversation does not belong to the authenticated user
- `404 Not Found` — conversation ID does not exist

---

### POST /switch-mode

Switch the conversation between Beezora AI and Live Support via HTTP. Alternatively use the `support:switch_mode` WebSocket event (see below).

**Body:**

```json
{
  "conversationId": "cuid_here",
  "mode": "AI"
}
```

`mode` must be `"AI"` or `"LIVE"`.

**Response:** Updated `SupportConversation`

**Errors:**

- `403 Forbidden` — conversation does not belong to the authenticated user
- `404 Not Found` — conversation not found

---

## WebSocket Events

### Emitting: `support:message`

Send a user message. The server saves it, broadcasts it back, and — if the conversation is in AI mode — generates and streams an AI response.

```typescript
socket.emit("support:message", { content: "Hello, I need help." });
```

No `conversationId` is required — the server resolves it from the authenticated session.

---

### Listening: `support:message`

All inbound messages (user echo, AI replies, agent replies, system messages) arrive on this event.

```typescript
socket.on("support:message", (message: SupportMessage) => {
  appendMessage(message);
});
```

Use `message.senderType` to determine how to render the message:

| `senderType` | Render as                                              |
| ------------ | ------------------------------------------------------ |
| `"USER"`     | Outgoing bubble (right-aligned)                        |
| `"AI"`       | Incoming bubble — Beezora AI                           |
| `"AGENT"`    | Incoming bubble — human agent name                     |
| `"SYSTEM"`   | Inline status notice (e.g. "Switched to Live Support") |

Hide messages where `isSystemMessage: true` from the visible chat if you prefer — they are informational and not user-authored.

---

### Listening: `support:ai_typing`

Show or hide a typing indicator while Beezora AI is generating a response.

```typescript
socket.on("support:ai_typing", ({ isTyping }: { isTyping: boolean }) => {
  setAiTyping(isTyping);
});
```

This event is only emitted when the conversation is in AI mode.

---

### Emitting: `support:switch_mode`

Switch mode directly over the WebSocket without an HTTP round-trip.

```typescript
socket.emit("support:switch_mode", { mode: "LIVE" });
```

The server responds by broadcasting `support:mode_changed` to all of the user's connected sessions.

---

### Listening: `support:mode_changed`

Fired after a mode switch — whether triggered by `POST /switch-mode` HTTP or `support:switch_mode` WebSocket.

```typescript
socket.on(
  "support:mode_changed",
  ({
    mode,
    conversation,
  }: {
    mode: "AI" | "LIVE";
    conversation: SupportConversation;
  }) => {
    updateConversationMode(mode, conversation);
  }
);
```

When `mode` switches to `"LIVE"` and no agents are available, the server automatically adds a system message with an estimated wait time — listen for it on `support:message`.

---

### Emitting: `support:attachment`

Upload a file (screenshot, document) associated with the current conversation.

> **Important:** Socket.IO serialises event payloads as JSON. Binary `Buffer` objects **cannot** be sent directly — convert the file to a base64 string first. This approach is suitable for small images (< 1 MB). For larger files, consider a dedicated HTTP multipart upload endpoint.

```typescript
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const base64Data = await toBase64(selectedFile);

socket.emit("support:attachment", {
  conversationId: conversation.id, // required
  file: {
    originalname: selectedFile.name,
    mimetype: selectedFile.type,
    buffer: base64Data, // base64-encoded string
    size: selectedFile.size,
  },
  analyzeWithVision: true, // triggers Gemini vision analysis for images
});
```

---

### Listening: `support:attachment_uploaded`

Fired when the attachment has been uploaded and stored.

```typescript
socket.on(
  "support:attachment_uploaded",
  ({ attachment }: { attachment: SupportAttachment }) => {
    addAttachmentToMessage(attachment);
  }
);
```

If `analyzeWithVision` was `true` and the file is an image, the server will also emit a `support:message` with `senderType: "SYSTEM"` containing the AI's description of the screenshot.

---

### Listening: `support:error`

Listen on this event for all real-time error notifications.

```typescript
socket.on("support:error", ({ message }: { message: string }) => {
  showErrorToast(message);
});
```

**Common error messages:**

| Message                                                         | Suggested UI action                              |
| --------------------------------------------------------------- | ------------------------------------------------ |
| `"No active conversation."`                                     | Prompt the user to refresh or call `POST /start` |
| `"AI failed to respond. Please try switching to Live Support."` | Show a button to switch to LIVE mode             |
| `"Failed to upload attachment."`                                | Show an inline upload error                      |

---

## Data Structures

### SupportConversation

```typescript
interface SupportConversation {
  id: string;
  userId: number;
  mode: "AI" | "LIVE";
  status:
    | "OPEN"
    | "WAITING_FOR_AGENT"
    | "AGENT_ASSIGNED"
    | "RESOLVED"
    | "CLOSED";
  category?: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedAgentId?: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  closedAt?: string; // ISO 8601
  messages: SupportMessage[];
}
```

### SupportMessage

```typescript
interface SupportMessage {
  id: string;
  conversationId: string;
  content: string;
  senderType: "USER" | "AI" | "AGENT" | "SYSTEM";
  senderId?: string;
  isSystemMessage: boolean;
  createdAt: string; // ISO 8601
  metadata?: {
    visionAnalysis?: boolean;
    attachmentId?: string;
    [key: string]: unknown;
  };
}
```

### SupportAttachment

```typescript
interface SupportAttachment {
  id: string;
  conversationId: string;
  messageId?: string;
  fileName: string; // original filename for display
  fileType: string; // MIME type, e.g. "image/png"
  fileSize: number; // bytes
  fileUrl: string; // signed CloudFront URL — expires; do not cache long-term
  thumbnailUrl?: string;
  uploadedAt: string; // ISO 8601
}
```

> `fileUrl` is a time-limited signed URL. Do not store it persistently — call `GET /conversations/:id` to retrieve a fresh URL when needed.

---

## HTTP Error Reference

| Status             | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| `401 Unauthorized` | Session missing, expired, or invalidated (logged out)      |
| `403 Forbidden`    | Authenticated user does not own the requested conversation |
| `404 Not Found`    | Conversation ID does not exist                             |
| `400 Bad Request`  | Invalid request body (e.g. unknown `mode` value)           |

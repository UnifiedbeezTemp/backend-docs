# Beehive Dashboard — API Reference

> All endpoints require `Authorization: Bearer <session_token>` header.
> All IDs for conversations and messages are **BigInt strings** — send and receive them as strings.

---

## Beehive / Live Mode

Beehive is a staging environment all new accounts start in. Users cannot send messages to external contacts while in Beehive mode. The **Go Live** button in the navbar calls the go-live endpoint.

### GET `/beehive/status`

Returns the current mode for the authenticated user.

**Response**

```json
{
  "isBeehive": true,
  "wentLiveAt": null
}
```

---

### POST `/beehive/go-live`

Transitions the account from Beehive → Live mode. Sends a confirmation email. The `isBeehive` field in the auth user object will flip to `false`.

**Response**

```json
{
  "isBeehive": false,
  "wentLiveAt": "2026-03-06T12:00:00.000Z",
  "message": "Your dashboard is now live!"
}
```

**Errors**

- `400` — Account is already live

---

## Home — Brand Kit

Brand Kit stores visual identity: logo, colours, fonts, social links. One brand kit per user/organisation.

### GET `/brand-kit`

Returns the current brand kit (or `null` if not yet created).

**Response**

```json
{
  "id": 1,
  "userId": 42,
  "websiteUrl": "https://acme.com",
  "companyLogoUrl": "https://cdn.unifiedbeez.com/brand-kits/logos/42/logo.png",
  "detectedLogoUrl": "https://acme.com/og-image.png",
  "lightPrimary": "#1A56DB",
  "lightBackground": "#F9FAFB",
  "darkPrimary": "#3F83F8",
  "darkBackground": "#111928",
  "accentColor": "#0E9F6E",
  "buttonColor": "#1A56DB",
  "buttonStrokeColor": "#1e429f",
  "headerFontStyle": "Inter",
  "headerFontWeight": "700",
  "bodyFontStyle": "Inter",
  "bodyFontWeight": "400",
  "instagram": "https://instagram.com/acme",
  "whatsapp": "+447700900000",
  "twitter": "https://twitter.com/acme",
  "youtube": null,
  "facebook": null,
  "linkedin": "https://linkedin.com/company/acme",
  "createdAt": "2026-03-06T10:00:00.000Z",
  "updatedAt": "2026-03-06T10:00:00.000Z"
}
```

---

### PUT `/brand-kit`

Create or update the brand kit (upsert). Send only the fields you want to change.

**Request body** (all fields optional)

```json
{
  "websiteUrl": "https://acme.com",
  "lightPrimary": "#1A56DB",
  "lightBackground": "#F9FAFB",
  "darkPrimary": "#3F83F8",
  "darkBackground": "#111928",
  "accentColor": "#0E9F6E",
  "buttonColor": "#1A56DB",
  "buttonStrokeColor": "#1e429f",
  "headerFontStyle": "Inter",
  "headerFontWeight": "700",
  "bodyFontStyle": "Inter",
  "bodyFontWeight": "400",
  "instagram": "https://instagram.com/acme",
  "whatsapp": "+447700900000",
  "twitter": "https://twitter.com/acme",
  "youtube": "https://youtube.com/@acme",
  "facebook": "https://facebook.com/acme",
  "linkedin": "https://linkedin.com/company/acme"
}
```

**Response** — returns the updated brand kit object.

---

### POST `/brand-kit/upload-logo`

Upload a company logo. `multipart/form-data`, field name `file`. Max 5 MB.

**Response**

```json
{
  "logoUrl": "https://cdn.unifiedbeez.com/brand-kits/logos/42/1234567890-logo.png"
}
```

---

### DELETE `/brand-kit/logo`

Remove the uploaded company logo (deletes from S3).

**Response**

```json
{ "message": "Logo removed" }
```

---

### POST `/brand-kit/detect`

Auto-detect brand colours and logo from a website URL. Returns suggestions — user must accept and save via `PUT /brand-kit`.

**Request body**

```json
{ "websiteUrl": "https://acme.com" }
```

**Response**

```json
{
  "detectedLogoUrl": "https://acme.com/og-image.png",
  "detectedPrimaryColor": "#1A56DB",
  "detectedFaviconUrl": "https://acme.com/favicon.ico"
}
```

> Fields will be `null` if they couldn't be detected from the page.

---

## Inbox — General

### Listing Conversations

### GET `/conversations`

List conversations with optional filters.

**Query params**

| Param              | Type                                                | Description                                                        |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------ |
| `status`           | `ACTIVE` \| `RESOLVED` \| `ESCALATED` \| `ARCHIVED` | Filter by status                                                   |
| `channelType`      | string                                              | Filter by channel (e.g. `WHATSAPP`, `FACEBOOK_MESSENGER`, `EMAIL`) |
| `assignedToUserId` | number                                              | Filter by assigned agent                                           |
| `unreadOnly`       | `true`                                              | Only return conversations with unread messages                     |
| `isInternal`       | `false`                                             | Set `false` to exclude team inbox conversations from general inbox |
| `page`             | number                                              | Page number (default: 1)                                           |
| `limit`            | number                                              | Items per page (default: 20, max: 100)                             |

**Response**

```json
{
  "conversations": [
    /* array of conversation objects */
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

---

### Starting a New Conversation

### POST `/conversations`

Create a new conversation manually.

**Request body**

```json
{
  "channelId": 3,
  "participantId": "447700900000",
  "channelType": "WHATSAPP"
}
```

---

### POST `/conversations/from-contact`

Start a conversation by selecting a contact from the contact list (CampaignList/LeadCapture).

**Request body**

```json
{
  "contactId": 101,
  "channelType": "WHATSAPP",
  "channelId": 3
}
```

> The contact must have a configured identifier for the selected channel (e.g. phone for WhatsApp, email for Email).

**Errors**

- `404` — Contact not found, or no identifier for the selected channel

---

### Messaging restrictions in Beehive mode

> While `isBeehive = true`, the following endpoints return `403 Forbidden`:
>
> - `POST /messages`
> - `POST /messages/template`
> - `POST /messages/with-attachments`

The user sees the message compose UI, but sending is disabled. Go Live to unlock messaging.

---

### Message Actions

### PUT `/messages/:id/pin`

Pin a message in a conversation.

**Response**

```json
{
  "id": "9007199254740993",
  "isPinned": true,
  "pinnedAt": "2026-03-06T12:00:00.000Z",
  "pinnedBy": 42
}
```

---

### DELETE `/messages/:id/pin`

Unpin a message.

**Response**

```json
{ "id": "9007199254740993", "isPinned": false }
```

---

### DELETE `/messages/:id`

Delete a message from a conversation. (Existing endpoint.)

---

### PUT `/conversations/:id/assign`

Assign a conversation to an agent or team member. (Existing endpoint.)

**Request body**

```json
{ "assignedToUserId": 7 }
```

or

```json
{ "assignedToTeamMemberId": 12 }
```

---

### Conversation Info Sidebar

Each conversation has a sidebar with **Comments**, **Notes**, and **Files**.

#### Comments

Comments are internal notes visible to agents only (not customers).

### GET `/conversations/:conversationId/comments`

**Response**

```json
[
  {
    "id": 1,
    "conversationId": "9007199254740993",
    "content": "Customer is a VIP — escalate if unresolved.",
    "createdAt": "2026-03-06T10:00:00.000Z",
    "updatedAt": "2026-03-06T10:00:00.000Z",
    "user": { "id": 42, "fullName": "Jane Smith", "email": "jane@acme.com" }
  }
]
```

### POST `/conversations/:conversationId/comments`

**Request body**

```json
{ "content": "Customer is a VIP — escalate if unresolved." }
```

### DELETE `/conversations/:conversationId/comments/:commentId`

Agents can only delete their own comments.

---

#### Notes

Notes support a coloured background for visual organisation.

### GET `/conversations/:conversationId/notes`

**Response**

```json
[
  {
    "id": 1,
    "conversationId": "9007199254740993",
    "content": "Refund approved, awaiting confirmation.",
    "backgroundColor": "#FFF3CD",
    "createdAt": "2026-03-06T10:00:00.000Z",
    "user": { "id": 42, "fullName": "Jane Smith", "email": "jane@acme.com" }
  }
]
```

### POST `/conversations/:conversationId/notes`

**Request body**

```json
{
  "content": "Refund approved, awaiting confirmation.",
  "backgroundColor": "#FFF3CD"
}
```

### PUT `/conversations/:conversationId/notes/:noteId`

**Request body** (partial update)

```json
{
  "content": "Updated note text.",
  "backgroundColor": "#D1FAE5"
}
```

### DELETE `/conversations/:conversationId/notes/:noteId`

---

#### Files

Returns all file attachments sent or received within a conversation.

### GET `/conversations/:conversationId/files`

**Response**

```json
[
  {
    "type": "IMAGE",
    "url": "https://cdn.unifiedbeez.com/message-attachments/...",
    "filename": "receipt.jpg",
    "size": 204800,
    "messageId": "9007199254740994",
    "sentAt": "2026-03-06T11:00:00.000Z",
    "senderName": "John Customer",
    "direction": "INBOUND"
  }
]
```

---

## Inbox — Team Inbox

Team Inbox is for internal communication between invited team members. Messages sent here do **not** go to external channels. Team messaging is allowed even in Beehive mode.

### GET `/team-inbox/members`

Returns active org members available to message.

**Response**

```json
[
  {
    "id": 7,
    "email": "alice@acme.com",
    "fullName": "Alice Johnson",
    "isOwner": false,
    "isActive": true,
    "roles": [{ "id": 2, "name": "Support Agent", "type": "SUPPORT" }]
  }
]
```

---

### GET `/team-inbox/conversations`

List all internal team conversations (DMs and group chats) for the current user.

**Query params**: `page`, `limit`

**Response**

```json
{
  "conversations": [
    {
      "id": "9007199254740995",
      "isInternal": true,
      "isGroupChat": false,
      "groupName": null,
      "allParticipants": ["42", "7"],
      "lastMessageAt": "2026-03-06T11:30:00.000Z",
      "unreadCount": 2
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

---

### POST `/team-inbox/conversations`

Create a new direct message or group chat.

**Request body — DM**

```json
{
  "participantUserIds": [7]
}
```

**Request body — Group chat**

```json
{
  "participantUserIds": [7, 9, 14],
  "isGroupChat": true,
  "groupName": "Sales Team"
}
```

> If a DM between the same two users already exists, the existing conversation is returned instead.

**Errors**

- `400` — At least 2 participants required

---

### GET `/team-inbox/conversations/:id`

Get a single internal conversation by ID.

---

### PUT `/team-inbox/conversations/:id/participants`

Update the participant list for a group chat.

**Request body**

```json
{
  "participantUserIds": [7, 9, 14, 22]
}
```

---

### Sending messages in Team Inbox

Use the standard message endpoints — they work the same for internal conversations:

- `POST /messages` — Send a message (use the team conversation ID)
- `GET /conversations/conversation/:conversationId` — Fetch messages in a conversation
- `DELETE /messages/:id` — Delete a message
- `PUT /messages/:id/pin` / `DELETE /messages/:id/pin` — Pin/unpin
- `GET /conversations/:id/comments` — Comments sidebar
- `GET /conversations/:id/notes` — Notes sidebar
- `GET /conversations/:id/files` — Files sidebar

---

## Messaging Channels — Initiating Conversations

> The following restrictions apply when starting a **new** conversation (not a reply):

| Channel            | Requires pre-approved template to initiate?            |
| ------------------ | ------------------------------------------------------ |
| WhatsApp           | ✅ Yes — if customer has not messaged first within 24h |
| Facebook Messenger | ✅ Yes — outside the 24h standard messaging window     |
| Instagram DM       | ✅ Yes — outside the 24h messaging window              |
| Telegram           | ✅ Yes — bot cannot initiate first                     |
| SMS                | ❌ No restriction                                      |
| Email              | ❌ No restriction                                      |
| Webchat            | ❌ No restriction                                      |

Use `POST /whatsapp/templates/send` or check `GET /whatsapp/templates/service-window/:channelId/:participantId` to determine if you're within the service window before sending.

---

## Inbox Settings — WhatsApp Templates

### GET `/whatsapp/templates?channelId=:id&status=APPROVED`

Fetch all templates for a channel. Optional `status` filter: `APPROVED | PENDING | REJECTED | PAUSED | DISABLED`.

**Response**

```json
{
  "templates": [
    {
      "id": "template_meta_id_123",
      "name": "order_confirmation",
      "status": "APPROVED",
      "category": "UTILITY",
      "language": "en_US",
      "components": [...]
    }
  ]
}
```

---

### POST `/whatsapp/templates`

Create a new template. Submitted to Meta for review. See existing documentation above.

---

### PUT `/whatsapp/templates/:templateId`

Edit an existing template via Meta Graph API. Only `PENDING` or `REJECTED` templates can be edited.

**Request body**

```json
{
  "channelId": 3,
  "components": [...],
  "category": "UTILITY"
}
```

**Response**

```json
{ "success": true }
```

**Errors**

- Meta Graph API errors are forwarded as `{ "success": false, "error": "..." }`

---

### DELETE `/whatsapp/templates/:templateId?channelId=3&name=order_confirmation`

Delete a template from Meta. All templates sharing the given `name` are removed.

**Query params:** `channelId` (required), `name` (required — the template name)

**Response**

```json
{ "success": true }
```

---

## Inbox Settings — Inbox Files

Shared file library. Agents pre-upload files here for quick attachment in conversations.

### GET `/inbox-files?page=1&limit=20`

List all files for the organisation.

**Response**

```json
{
  "files": [
    {
      "id": 1,
      "originalName": "brochure.pdf",
      "mimeType": "application/pdf",
      "size": 204800,
      "url": "https://cdn.unifiedbeez.com/inbox-files/42/...",
      "uploadedBy": { "id": 7, "fullName": "Alice Johnson" },
      "createdAt": "2026-03-06T10:00:00.000Z"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

---

### POST `/inbox-files/upload`

Upload a file. `multipart/form-data`, field name `file`. Max 10 MB.

**Response** — returns the uploaded file object (same shape as items in the list above).

---

### DELETE `/inbox-files/:id`

Delete a file (S3 + DB). Only the uploader can delete their file.

**Response**

```json
{ "message": "File deleted" }
```

**Errors**

- `403` — Not the file uploader
- `404` — File not found

---

## Inbox Settings — Attributes

Custom attribute definitions for 4 entity groups. Pre-seeded defaults are created on first access per group.

**Groups:** `CONTACT`, `CONVERSATION`, `GROUP` (team inbox group chats), `TEAM`

**Data types:** `DATE`, `DATETIME`, `NUMBER`, `SINGLE_BUTTON`, `TEXT`, `SINGLE_SELECT`, `MULTI_SELECT`

### GET `/attributes?group=CONTACT`

List all attribute definitions for a group. Seeds default attributes if the group has none.

**Response**

```json
[
  {
    "id": 1,
    "group": "CONTACT",
    "key": "first_name",
    "displayName": "First Name",
    "dataType": "TEXT",
    "isDefault": true,
    "options": null,
    "isRequired": false,
    "position": 0
  }
]
```

---

### POST `/attributes`

Create a custom attribute.

**Request body**

```json
{
  "group": "CONTACT",
  "key": "customer_tier",
  "displayName": "Customer Tier",
  "dataType": "SINGLE_SELECT",
  "options": [
    { "value": "bronze", "label": "Bronze" },
    { "value": "gold", "label": "Gold" }
  ],
  "isRequired": false
}
```

**Errors**

- `409` — Attribute with this key already exists in the group

---

### PUT `/attributes/:id`

Update a custom attribute definition.

**Request body** (all fields optional)

```json
{
  "displayName": "Tier",
  "options": [...],
  "isRequired": true,
  "position": 2
}
```

---

### DELETE `/attributes/:id`

Delete a custom attribute. Default attributes (`isDefault: true`) cannot be deleted.

**Response**

```json
{ "message": "Attribute deleted" }
```

**Errors**

- `400` — Default attributes cannot be deleted

---

## Automations

> These endpoints are existing — listed here for frontend reference.

### GET `/automations`

List all automations for the current user.

### POST `/automations`

Create a new automation.

### GET `/automations/:id`

Get a single automation.

### PATCH `/automations/:id`

Update an automation.

### DELETE `/automations/:id`

Delete an automation.

### GET `/automations/templates`

List available automation templates (pre-built starting configurations).

---

## Setup

> These endpoints are existing — listed here for frontend reference.

### PATCH `/auth/onboarding/step`

Advance the user's onboarding step.

**Request body**

```json
{ "step": 3 }
```

### PATCH `/auth/onboarding/method`

Set the user's preferred contact method during onboarding.

---

## CRM — Campaign Lists

> These endpoints are existing — listed here for frontend reference.

### GET `/campaign-lists`

List all campaign lists. Each includes `configuredInAutomations` (which automations use the list as their contact pool).

### POST `/campaign-lists`

Create a new list.

**Request body**

```json
{ "name": "Q1 Leads", "description": "Website leads from Q1 2026" }
```

### GET `/campaign-lists/:id`

Get a single list.

### PATCH `/campaign-lists/:id`

Update list name or description.

### DELETE `/campaign-lists/:id`

Delete a list. Returns `400` if any active automation is using it.

### GET `/campaign-lists/:id/members`

List all contacts enrolled in the list with their source (`AUTOMATION` | `MANUAL` | `IMPORT`).

### POST `/campaign-lists/:id/members`

Manually add a contact to a list. Creates the contact if they don't exist yet.

**Request body**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+447911123456",
  "whatsappId": "+447911123456"
}
```

### DELETE `/campaign-lists/:id/members/:leadId`

Remove a contact from a list (does not delete the contact).

---

## CRM — Contacts

Contacts in this system are `LeadCapture` records. They exist independently of campaign lists but are enrolled into one or more lists.

### GET `/contacts?search=jane&page=1&limit=20`

List all contacts for the current user. Optional `search` filters by name or email.

**Response**

```json
{
  "contacts": [
    {
      "id": 101,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+447911123456",
      "source": "manual",
      "whatsappId": "+447911123456",
      "facebookMessengerId": null,
      "linkedInId": null,
      "telegramId": null,
      "notes": null,
      "tags": [1, 3],
      "createdAt": "2026-03-06T10:00:00.000Z",
      "listMemberships": [
        {
          "listId": 5,
          "listName": "Q1 Leads",
          "source": "MANUAL",
          "enrolledAt": "2026-03-06T10:00:00.000Z"
        }
      ]
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

---

### POST `/contacts`

Create a new contact and optionally enroll in campaign lists.

**Request body**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+447911123456",
  "whatsappId": "+447911123456",
  "tagIds": [1, 3],
  "campaignListIds": [5]
}
```

**Errors**

- `409` — Email already exists in this account

---

### GET `/contacts/:id`

Get a single contact with full profile and list memberships.

---

### PATCH `/contacts/:id`

Update contact fields. Send only the fields to change.

**Request body** (all optional)

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+447911000000",
  "notes": "VIP client — handle personally",
  "tagIds": [1, 2, 5]
}
```

---

### DELETE `/contacts/:id`

Delete a contact and remove from all campaign lists.

**Response**

```json
{ "message": "Contact deleted" }
```

**Errors**

- `404` — Contact not found

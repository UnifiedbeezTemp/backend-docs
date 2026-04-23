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

### GET `/beehive/go-live/summary`

Returns counts of existing Beehive-mode data per category. Call this before showing the go-live confirmation screen so the user can see what they have and choose what to keep.

**Response**

```json
{
  "brandKit": { "exists": true },
  "automations": { "count": 3 },
  "campaignLists": { "count": 2, "contactCount": 150 },
  "templates": { "count": 8 }
}
```

**Errors**

- `400` — Account is already live

---

### POST `/beehive/go-live`

Transitions the account from Beehive → Live mode. Sends a confirmation email. The `isBeehive` field in the auth user object will flip to `false`.

Each `transfer*` flag controls whether the corresponding staged data is **kept** (`true`, default) or **permanently deleted** (`false`) as part of the transition. Omitting the body or a flag defaults to `true` (keep everything), preserving backwards compatibility.

**Request body** (all fields optional, default `true`)

```json
{
  "transferBrandKit": true,
  "transferAutomations": true,
  "transferCampaignLists": true,
  "transferTemplates": true
}
```

| Field                   | Default | Effect when `false`                                        |
| ----------------------- | ------- | ---------------------------------------------------------- |
| `transferBrandKit`      | `true`  | Deletes the Brand Kit record                               |
| `transferAutomations`   | `true`  | Deletes all Automations                                    |
| `transferCampaignLists` | `true`  | Deletes all Campaign Lists (cascades members) and Contacts |
| `transferTemplates`     | `true`  | Deletes all Message Templates                              |

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

# Brand Kit API

Brand Kit stores the visual identity for a user's organization: logo, colors, typography, and social links.

- Scope: one brand kit per authenticated user
- Data sources:
  - manual updates via `PUT /brand-kit` and `POST /brand-kit/upload-logo`
  - auto-detection via `GET /brand-kit/detect?websiteUrl=...` (SSE)
- Detection persistence rule: detected fields are overwritten with fresh values on each successful detect run
- Logo preservation rule: if detection returns no `companyLogoUrl` and the user already has a stored logo, the existing logo is kept

## Authentication

All endpoints require an authenticated user (JWT/session auth in the backend guard layer).

## Endpoints

### `GET /brand-kit`

Returns the current brand kit for the authenticated user.

- Response: brand kit object or `null` (if no row exists yet)

Example response:

```json
{
  "id": 1,
  "userId": 42,
  "websiteUrl": "https://acme.com",
  "companyLogoUrl": "https://cdn.unifiedbeez.com/brand-kits/logos/42/logo.png",
  "detectedFaviconUrl": "https://acme.com/favicon.ico",
  "fontColors": {
    "headingColor": "#111111",
    "bodyColor": "#333333",
    "linkColor": "#0066cc",
    "mutedColor": "#888888"
  },
  "typographyScale": {
    "h1": "48px",
    "h2": "36px",
    "h3": "24px",
    "body": "16px"
  },
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
  "linkedin": "https://linkedin.com/company/acme",
  "createdAt": "2026-03-06T10:00:00.000Z",
  "updatedAt": "2026-03-06T10:00:00.000Z"
}
```

---

### `PUT /brand-kit`

Creates or updates (upsert) the authenticated user's brand kit.

- Request body: all fields optional
- Partial update semantics: omitted fields are left unchanged
- Response: full updated brand kit object

Request body example:

```json
{
  "websiteUrl": "https://acme.com",
  "detectedFaviconUrl": "https://acme.com/favicon.ico",
  "fontColors": {
    "headingColor": "#111111",
    "bodyColor": "#333333",
    "linkColor": "#0066cc",
    "mutedColor": "#888888"
  },
  "typographyScale": {
    "h1": "48px",
    "h2": "36px",
    "h3": "24px",
    "body": "16px"
  },
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

---

### `POST /brand-kit/upload-logo`

Uploads a company logo using `multipart/form-data`.

- Form field name: `file`
- Behavior:
  - uploads file to S3
  - updates `companyLogoUrl`
  - if an old logo exists, attempts to delete the old S3 object

Response:

```json
{ "logoUrl": "https://cdn.unifiedbeez.com/brand-kits/logos/42/1234567890-logo.png" }
```

---

### `DELETE /brand-kit/logo`

Removes the uploaded logo.

- Deletes file in S3 (best-effort)
- Sets `companyLogoUrl` to `null` in DB
- If no logo exists, returns `404 Not Found`

Response:

```json
{ "message": "Logo removed" }
```

---

### `GET /brand-kit/detect?websiteUrl=...` (SSE)

Auto-detects brand identity from a website URL and streams SSE events.

Query parameters:

| Parameter | Required | Description |
| --- | --- | --- |
| `websiteUrl` | Yes | Website to analyze, e.g. `https://acme.com` |

## Detection pipeline (current)

Detection runs in one orchestration that combines:

1. quick HTML pass (Axios + Cheerio)
2. rendered DOM/CSS pass (Playwright)
3. optional Gemini vision analysis (if `GEMINI_API_KEY` is configured)

Additional details:

- Same-origin stylesheets are fetched for deeper CSS color extraction
- Playwright computed styles are used for:
  - primary/accent/background/button colors
  - `headerFontStyle` / `bodyFontStyle`
  - `headerFontWeight` / `bodyFontWeight`
  - `fontColors` (`headingColor`, `bodyColor`, `linkColor`, `mutedColor`)
  - `typographyScale` (`h1`, `h2`, `h3`, `body`)
- AI screenshot analysis can further refine color and `fontColors`
- Screenshot count used for AI can be controlled by `BRANDKIT_AI_MAX_SCREENSHOTS`

## SSE events

The endpoint emits:

- `partial` when `advancedSearchTriggered` is `true`
- `complete` as the final event

`complete` closes the stream.

> Note: with the current implementation, advanced search is expected on successful runs, so clients should handle both `partial` and `complete`.

## Event payload fields

Each SSE `data` payload contains:

| Field | Type | Description |
| --- | --- | --- |
| `companyLogoUrl` | `string \| null` | Detected logo URL |
| `detectedFaviconUrl` | `string \| null` | Favicon URL |
| `detectedPrimaryColor` | `string \| null` | Primary color |
| `detectedAccentColor` | `string \| null` | Accent/secondary color |
| `detectedBackgroundColor` | `string \| null` | Background color |
| `detectedButtonColor` | `string \| null` | Button/CTA color |
| `fontColors` | `object` | `{ headingColor, bodyColor, linkColor, mutedColor }` |
| `typographyScale` | `object` | `{ h1, h2, h3, body }` |
| `headerFontStyle` | `string \| null` | Heading font family |
| `headerFontWeight` | `string \| null` | Heading font weight |
| `bodyFontStyle` | `string \| null` | Body font family |
| `bodyFontWeight` | `string \| null` | Body font weight |
| `instagram` | `string \| null` | Instagram URL |
| `twitter` | `string \| null` | Twitter/X URL |
| `facebook` | `string \| null` | Facebook URL |
| `linkedin` | `string \| null` | LinkedIn URL |
| `youtube` | `string \| null` | YouTube URL |
| `accuracyScore` | `number` | Confidence score `0..100` |
| `advancedSearchTriggered` | `boolean` | Whether advanced flow was triggered |

All fields may be `null` when unavailable.

## Persistence behavior

On successful detection, the backend upserts the user's brand kit and writes:

- `websiteUrl`
- detected logo/colors/fonts/social fields
- `detectedFaviconUrl`
- `fontColors`
- `typographyScale`

Overwrite behavior:

- detection values are refreshed on each call
- existing `companyLogoUrl` is preserved only when detection returns no logo

## Frontend usage example (SSE)

```ts
const source = new EventSource(
  `/api/v1/brand-kit/detect?websiteUrl=${encodeURIComponent("https://acme.com")}`
);

source.addEventListener("partial", (e) => {
  const data = JSON.parse((e as MessageEvent).data);
  console.log("Partial detection:", data.accuracyScore);
});

source.addEventListener("complete", (e) => {
  const data = JSON.parse((e as MessageEvent).data);
  console.log("Detection complete:", data.accuracyScore);
  source.close();
});
```

## Notes and limitations

- Bot/WAF protected websites can block extraction
- Only same-origin CSS files are fetched during stylesheet enrichment
- Font names reflect CSS/computed values and may differ from brand-marketing names

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

**Data types:** `DATE`, `DATETIME`, `NUMBER`, `TEXT`, `SINGLE_SELECT`, `MULTI_SELECT`

> `options` (array of `{ value, label }`) is **required** when `dataType` is `SINGLE_SELECT` or `MULTI_SELECT`, and must contain at least one entry.

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

- `400` — `options` missing or empty for `SINGLE_SELECT` / `MULTI_SELECT`
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

---

## Threads

Threads allow focused discussion on a specific message (Slack-style). Replies live only in the thread panel — they are **not** shown in the main conversation timeline. The root message in the timeline shows a `threadSummary` badge with reply count and last active time.

> Thread replies are scoped to the same conversation but excluded from `GET /messages?conversationId=...` results via an automatic `threadId: null` filter.

---

### POST `/messages/:messageId/thread`

Start a thread from a message. Thread heading is auto-generated from the first 60 chars of the root message content.

**Response**

```json
{
  "id": "9007199254740994",
  "conversationId": "9007199254740993",
  "rootMessageId": "9007199254740990",
  "heading": "Let's discuss the design proposal",
  "messageCount": 0,
  "lastMessageAt": null,
  "createdAt": "2026-03-09T11:00:00.000Z",
  "updatedAt": "2026-03-09T11:00:00.000Z"
}
```

**Errors**

- `404` — Message not found
- `409` — Thread already exists for this message

---

### GET `/messages/:messageId/thread`

Get the thread started from a specific message (includes first page of replies).

**Errors**

- `404` — No thread started from this message

---

### GET `/threads/:threadId?page=1&limit=20`

Get a thread with paginated replies (oldest first).

**Response**

```json
{
  "id": "9007199254740994",
  "heading": "Design proposal discussion",
  "messageCount": 3,
  "lastMessageAt": "2026-03-09T11:30:00.000Z",
  "rootMessage": {
    "id": "9007199254740990",
    "content": "Let's discuss the design proposal",
    "senderName": "Alice Johnson",
    "direction": "OUTBOUND",
    "createdAt": "2026-03-09T10:00:00.000Z"
  },
  "messages": [
    /* thread replies */
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

---

### POST `/threads/:threadId/messages`

Post a reply to a thread.

**Request body**

```json
{ "content": "I think we should go with option B", "type": "TEXT" }
```

**Realtime:** Emits `thread:reply` to the conversation room:

```json
{
  "threadId": "9007199254740994",
  "rootMessageId": "9007199254740990",
  "messageCount": 4,
  "lastMessageAt": "2026-03-09T11:35:00.000Z",
  "message": {
    /* the new reply message */
  }
}
```

---

### PUT `/threads/:threadId`

Update the thread heading.

**Request body**

```json
{ "heading": "Design proposal discussion" }
```

---

### GET `/conversations/:conversationId/threads`

List all threads in a conversation, ordered by most recently active.

**Response**

```json
[
  {
    "id": "9007199254740994",
    "rootMessageId": "9007199254740990",
    "heading": "Design proposal discussion",
    "messageCount": 3,
    "lastMessageAt": "2026-03-09T11:30:00.000Z"
  }
]
```

---

### `threadSummary` on Main Timeline Messages

Every message returned by `GET /messages?conversationId=...` includes a `threadSummary` field:

```json
{
  "id": "9007199254740990",
  "content": "Let's discuss the design proposal",
  "threadSummary": {
    "threadId": "9007199254740994",
    "heading": "Design proposal discussion",
    "messageCount": 3,
    "lastMessageAt": "2026-03-09T11:30:00.000Z"
  }
}
```

Messages without a thread have `"threadSummary": null`.

---

## CRM — Merge Fields

Merge fields are personalization variables (e.g. `%EMAIL ADDRESS%`) inserted into email/message templates. They are organized into four fixed groups. Each group is seeded with defaults on first access; users can also create custom fields.

**Groups:** `AUDIENCE`, `MESSAGE`, `SOCIAL`, `PROFILE`

**Field types:** `TEXT`, `LINK`, `DATE`

---

### GET `/merge-fields?group=AUDIENCE`

List all merge fields for a group. Automatically seeds defaults the first time a group is accessed.

**Response**

```json
[
  {
    "id": 1,
    "userId": 42,
    "group": "AUDIENCE",
    "fieldName": "Email Address",
    "type": "TEXT",
    "autoFillTag": "%EMAIL ADDRESS%",
    "isDefault": true,
    "position": 0,
    "createdAt": "2026-03-10T09:00:00.000Z",
    "updatedAt": "2026-03-10T09:00:00.000Z"
  }
]
```

**Default fields per group:**

| Group    | Field Name                   | Type |
| -------- | ---------------------------- | ---- |
| AUDIENCE | Email Address                | TEXT |
| AUDIENCE | Full Name                    | TEXT |
| AUDIENCE | First Name                   | TEXT |
| AUDIENCE | Last Name                    | TEXT |
| AUDIENCE | Phone Number                 | TEXT |
| AUDIENCE | GEO - Country                | TEXT |
| AUDIENCE | GEO - Region                 | TEXT |
| AUDIENCE | GEO - City                   | TEXT |
| AUDIENCE | GEO - Area Code              | TEXT |
| AUDIENCE | Date Subscribed              | DATE |
| AUDIENCE | Time Subscribed              | TEXT |
| AUDIENCE | Contact's IP Address         | TEXT |
| AUDIENCE | Subscription List            | TEXT |
| AUDIENCE | Subscriber ID                | TEXT |
| AUDIENCE | Position/Role                | TEXT |
| AUDIENCE | Contact's Preferred Language | TEXT |
| MESSAGE  | Opt Out Link                 | LINK |
| MESSAGE  | Full Sender Info             | TEXT |
| MESSAGE  | Sender Details               | TEXT |
| MESSAGE  | Compliance Reminder          | TEXT |
| MESSAGE  | Web View                     | LINK |
| MESSAGE  | Web View (No Social Links)   | LINK |
| MESSAGE  | Manage Subscription Link     | LINK |
| MESSAGE  | Share Email Link             | LINK |
| MESSAGE  | Unsubscribe From All         | LINK |
| MESSAGE  | Current Date                 | DATE |
| SOCIAL   | Social Sharing Links         | LINK |
| SOCIAL   | Facebook Like Button         | LINK |
| SOCIAL   | Facebook Share Button        | LINK |
| SOCIAL   | Facebook Share URL           | LINK |
| SOCIAL   | Twitter/X Share Icon         | LINK |
| SOCIAL   | Twitter/X Share Link         | LINK |
| SOCIAL   | LinkedIn Share Icon          | LINK |
| SOCIAL   | LinkedIn Share Link          | LINK |
| SOCIAL   | Share On Reddit Icon         | LINK |
| SOCIAL   | Reddit Share URL             | LINK |
| SOCIAL   | Digg Share URL               | LINK |
| SOCIAL   | Digg Share Icon              | LINK |
| SOCIAL   | Delicious Share Icon         | LINK |
| SOCIAL   | Delicious Share Link         | LINK |
| SOCIAL   | StumbleUpon Share Icon       | LINK |
| PROFILE  | Profile: Name                | TEXT |
| PROFILE  | Profile: First Name          | TEXT |
| PROFILE  | Profile: Last Name           | TEXT |
| PROFILE  | Profile: Full Name           | TEXT |
| PROFILE  | Profile: Email               | TEXT |
| PROFILE  | Profile: URL                 | LINK |
| PROFILE  | Profile: Created Date        | DATE |
| PROFILE  | Profile: Last Updated Date   | DATE |
| PROFILE  | Profile: Address             | TEXT |
| PROFILE  | Profile: City                | TEXT |
| PROFILE  | Profile: State/Province      | TEXT |
| PROFILE  | Profile: Postal Code         | TEXT |
| PROFILE  | Profile: Country             | TEXT |
| PROFILE  | Profile: Phone Number        | TEXT |
| PROFILE  | Profile: Description         | TEXT |
| PROFILE  | Profile: Number of Employees | TEXT |
| PROFILE  | Profile: Annual Revenue      | TEXT |
| PROFILE  | Profile: Industry/Vertical   | TEXT |

---

### POST `/merge-fields`

Create a custom merge field. The `autoFillTag` is auto-generated server-side from the field name (e.g. `"Customer Tier"` → `%CUSTOMER TIER%`).

**Request body**

```json
{
  "group": "AUDIENCE",
  "fieldName": "Customer Tier",
  "type": "TEXT"
}
```

**Response** — the created merge field object including the generated `autoFillTag`.

**Errors**

- `409` — a field with the same auto-fill tag already exists in this group

---

### DELETE `/merge-fields/:id`

Delete a custom merge field.

**Errors**

- `400` — cannot delete default merge fields
- `404` — field not found

---

## Settings

The Settings page is split into six tabs. All endpoints require `Authorization: Bearer <session_token>`.

---

### Profile Tab

#### Personal Details

**GET `/auth/profile`**
Returns the current user's full profile (name, email, phone, business details, plan, etc.).

---

**PATCH `/auth/profile`**
Update personal details.

```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+447911123456"
}
```

All fields optional. Returns the updated `UserDto`.

---

**POST `/auth/profile/photo`**
Upload a profile picture. Multipart form-data with a single `file` field.

```json
{ "photoUrl": "https://cdn.example.com/photos/abc.jpg" }
```

---

**DELETE `/auth/profile/photo`**
Remove the profile photo.

---

#### Business Details

**PATCH `/auth/setup/profile`**
Update business information. Multipart form-data.

| Field                  | Type     | Description                   |
| ---------------------- | -------- | ----------------------------- |
| `firstName`            | string   |                               |
| `lastName`             | string   |                               |
| `phone`                | string   |                               |
| `businessName`         | string   |                               |
| `industry`             | enum     | See `GET /auth/industries`    |
| `businessObjectiveIds` | number[] | JSON array or comma-separated |
| `businessGoalIds`      | number[] | JSON array or comma-separated |
| `businessOverview`     | string   | Max 2000 chars                |
| `websites`             | string[] | Array of URLs                 |
| `businessLogo`         | file     | Image upload                  |
| `businessFiles`        | file[]   | Up to 10 files                |

---

**GET `/auth/industries`**
Returns all industry options: `[{ "value": "ECOMMERCE_RETAIL", "label": "Ecommerce & Retail" }, ...]`

**GET `/auth/business-objectives`**
Returns available business objectives.

**GET `/auth/business-goals`**
Returns available business goals.

**DELETE `/auth/business-files/:fileId`**
Delete an uploaded business file.

---

#### Knowledge Files & Websites

Managed under the AI assistant's knowledge base. Pass the relevant `aiId`:

- `GET /ai/:aiId/knowledge/files` — list knowledge files
- `POST /ai/:aiId/knowledge/files` — upload files (multipart)
- `DELETE /ai/:aiId/knowledge/files/:fileId` — delete a file
- `POST /ai/:aiId/knowledge/websites` — add a website source `{ "url": "https://..." }`
- `DELETE /ai/:aiId/knowledge/websites/:websiteId` — remove a website

#### AI Assistants

- `GET /ai` — list all AI assistants
- `POST /ai` — create an AI assistant
- `PATCH /ai/:id` — update an AI assistant
- `DELETE /ai/:id` — delete an AI assistant

---

### Preferences Tab

**GET `/auth/preferences`**
Returns current preferences. Defaults returned if not yet set.

```json
{
  "theme": "auto",
  "language": "en",
  "autoSave": true
}
```

---

**PATCH `/auth/preferences`**
Update any subset of preferences.

```json
{
  "theme": "dark",
  "language": "fr",
  "autoSave": false
}
```

| Field      | Type    | Values                        |
| ---------- | ------- | ----------------------------- |
| `theme`    | string  | `"light"`, `"dark"`, `"auto"` |
| `language` | string  | e.g. `"en"`, `"fr"`           |
| `autoSave` | boolean |                               |

---

### Notifications Tab

**GET `/auth/notifications/preferences`**
Returns all notification toggles. Defaults returned if not yet configured.

```json
{
  "emails": true,
  "pushNotifications": true,
  "marketingEmails": false,
  "securityAlerts": true,
  "phoneNotifications": false
}
```

---

**PATCH `/auth/notifications/preferences`**
Toggle any notification type. All fields optional (boolean).

```json
{
  "marketingEmails": true,
  "phoneNotifications": true
}
```

---

### Security Tab

#### Password

**PATCH `/auth/change-password`**

```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!",
  "confirmPassword": "NewPass456!"
}
```

Invalidates **all** active sessions on success. User must log in again.

---

#### Two-Factor Authentication

**POST `/auth/2fa/setup`**
Generates a TOTP QR code and backup codes. Returns:

```json
{
  "qrCode": "data:image/png;base64,...",
  "secret": "BASE32SECRET",
  "backupCodes": ["abc123", "def456", "..."]
}
```

**POST `/auth/2fa/verify-setup`**
Confirm TOTP and enable 2FA.

```json
{ "token": "123456", "backupCodes": ["abc123", "..."] }
```

**GET `/auth/2fa/status`**
Returns current 2FA state: `{ "enabled": true, "method": "totp" }`.

**POST `/auth/2fa/disable`**
Disable 2FA (requires password confirmation).

```json
{ "password": "CurrentPass123!" }
```

**POST `/auth/2fa/regenerate-backup`**
Generate a new set of backup recovery codes. Returns `{ "backupCodes": [...] }`.

---

#### Active Sessions

**GET `/auth/sessions`**
List all active sessions for the current user.

```json
[
  {
    "id": "cuid_abc123",
    "deviceName": "Chrome on macOS",
    "deviceType": "desktop",
    "ipAddress": "203.0.113.5",
    "location": "London, UK",
    "loginMethod": "password",
    "lastActiveAt": "2026-03-09T10:00:00.000Z",
    "createdAt": "2026-03-01T08:00:00.000Z"
  }
]
```

---

**DELETE `/auth/sessions/:sessionId`**
Revoke a specific session (log out that device).

```json
{ "message": "Session revoked" }
```

---

### Channels Tab

**GET `/channels/available/all`**
Returns all channels with access metadata — shows which are available on the current plan and which are blocked and why.

**GET `/channels/selected`**
Returns channels the user has connected.

> For connecting, configuring, and disconnecting individual channels, refer to the **Channel Integration** documentation.

---

### Team Tab

> Invite and role-management endpoints require `OWNER` or `ADMIN` role.

**GET `/team/members`**
List all team members with their roles, activity status, and last login.

**GET `/team/invitations`**
List pending (unexpired) invitations. _(OWNER/ADMIN only)_

**POST `/team/assign-role`**
Assign or change a team member's role. _(OWNER/ADMIN only)_

```json
{ "userId": 42, "roleId": 3 }
```

**DELETE `/team/members/:id`**
Deactivate and remove a team member. _(OWNER/ADMIN only)_

---

### Plans & Billing Tab

The Plans & Billing settings page is divided into four tabs.

---

#### Tab 1 — Your Plan

Displays the user's active subscription plan and available addons. Uses existing plan and addon endpoints:

- **GET `/plan`** — active plan details, features, limits
- **GET `/plan/addons`** — available addons for purchase
- **GET `/plan/addon-per-plan`** — addons available per plan tier
- **POST `/plan/addons/purchase`** — purchase an addon
- **POST `/plan/upgrade`** — upgrade/downgrade subscription

See the **Plans** and **Addons** sections in this document for full details.

---

#### Tab 2 — Your Invoice

Fetches invoice history directly from Stripe. No DB model; Stripe is the source of truth.

**GET `/payment/invoices`**

Returns all invoices for the authenticated user.

```json
{
  "stats": {
    "total": 12,
    "nextInvoice": {
      "date": "2026-04-01T00:00:00.000Z",
      "estimatedAmount": 2900,
      "currency": "gbp"
    }
  },
  "invoices": [
    {
      "id": "in_abc123",
      "number": "INV-0012",
      "description": "Monthly subscription — March 2026",
      "date": "2026-03-01T00:00:00.000Z",
      "amount": 2900,
      "currency": "gbp",
      "status": "paid",
      "hostedInvoiceUrl": "https://invoice.stripe.com/...",
      "invoicePdf": "https://pay.stripe.com/invoice/..."
    }
  ]
}
```

- `stats.nextInvoice` is `null` if the user has no active subscription.
- `amount` is in the smallest currency unit (pence for GBP).
- `status` values: `draft`, `open`, `paid`, `uncollectible`, `void`.

---

#### Tab 3 — Budget

Monthly budget configuration with computed spending stats and per-pack allocations.

**GET `/budget`**

Returns the full budget dashboard for the current calendar month.

```json
{
  "config": {
    "monthlyLimit": 5000,
    "allocations": {
      "contactPack": 1000,
      "emailPack": 1500,
      "aiComputePack": 2000,
      "twilioPack": 500
    }
  },
  "stats": {
    "budgetedAmount": 5000,
    "totalSpent": 2200,
    "percentageUsed": 44.0,
    "amountRemaining": 2800,
    "savedThisMonth": 800,
    "percentageRemaining": 56.0,
    "avgSpendingOverall": 220,
    "avgSpendingPerWeek": 1540,
    "avgSpendingPerDay": 220,
    "projectedEndOfMonth": 6820,
    "daysRemaining": 21,
    "daysElapsed": 10,
    "daysInMonth": 31
  },
  "budgetBreakdown": {
    "contactPack": {
      "allocated": 1000,
      "spent": 500,
      "unitsAcquired": 5000,
      "unitsUsed": 3200,
      "unitLabel": "contacts",
      "percentageOfAllocationUsed": 50.0,
      "pricePerUnit": 0.1
    },
    "emailPack": {
      "allocated": 1500,
      "spent": 1000,
      "unitsAcquired": 10000,
      "unitsUsed": 7500,
      "unitLabel": "emails",
      "percentageOfAllocationUsed": 66.67,
      "pricePerUnit": 0.1
    },
    "aiComputePack": {
      "allocated": 2000,
      "spent": 700,
      "unitsAcquired": 100000,
      "unitsUsed": 65000,
      "unitLabel": "tokens",
      "percentageOfAllocationUsed": 35.0,
      "pricePerUnit": 0.007
    },
    "twilioPack": {
      "allocated": 500,
      "spent": 0,
      "unitsAcquired": 1000,
      "unitsUsed": 0,
      "unitLabel": "messages",
      "percentageOfAllocationUsed": 0,
      "pricePerUnit": 0
    },
    "addons": { "allocated": null, "spent": 0 }
  }
}
```

- All monetary values are in **cents** (e.g. `5000` = £50.00).
- `totalSpent` = sum of `ContactPack`, `EmailPack`, `TokenComputePack`, and `UserAddon` purchases in the current calendar month.
- `savedThisMonth` = `allocatedTotal - totalSpent` (floored at 0).
- `unitsAcquired` = units from pack purchases this month; `unitsUsed` = from current billing cycle usage tables.
- `pricePerUnit` = `spent / unitsAcquired` (4 decimal places; 0 if no units acquired).
- `percentageOfAllocationUsed` = `spent / allocated × 100` (0 if no allocation set).
- If `autoAdjustEnabled` and spending ≥ 90%, `monthlyLimit` is automatically incremented by 2000 (£20) and the updated value is returned.
- `addons.allocated` is always `null`.

**PATCH `/budget`**

Set the monthly budget limit.

```json
{ "monthlyLimit": 5000 }
```

**PATCH `/budget/allocations`**

Set per-pack budget allocations (all fields optional; existing allocations are merged).

```json
{
  "contactPack": 1000,
  "emailPack": 1500,
  "aiComputePack": 2000,
  "twilioPack": 500
}
```

**GET `/budget/transactions?months=3`**

Returns pack purchase history (manual + auto top-up) sorted newest first. `months` = lookback period (1–12, default 3).

```json
{
  "transactions": [
    {
      "id": 7,
      "type": "email_pack",
      "label": "Email Pack",
      "quantity": 10000,
      "unit": "emails",
      "priceEur": 1000,
      "isAutoTopUp": true,
      "purchasedAt": "2026-03-05T08:23:00.000Z"
    },
    {
      "id": 3,
      "type": "contact_pack",
      "label": "Contact Pack",
      "quantity": 5000,
      "unit": "contacts",
      "priceEur": 1000,
      "isAutoTopUp": false,
      "purchasedAt": "2026-03-01T12:00:00.000Z"
    }
  ]
}
```

`type` values: `contact_pack`, `email_pack`, `ai_compute_pack`, `twilio_pack`.

**GET `/budget/settings`**

Returns budget alert and auto-adjust toggle state.

```json
{ "alertEnabled": false, "autoAdjustEnabled": false }
```

**PATCH `/budget/settings`**

Toggle budget alert and/or auto-adjust (all fields optional).

```json
{ "alertEnabled": true, "autoAdjustEnabled": false }
```

- **`alertEnabled`**: sends a budget alert email when monthly spending reaches 80% of `monthlyLimit`; debounced to once per calendar month.
- **`autoAdjustEnabled`**: silently increases `monthlyLimit` by £20 (2000 cents) when spending reaches 90%; triggers on `GET /budget`.

---

#### Tab 4 — Auto Top-Up

Auto top-up automatically purchases additional capacity when a usage limit is reached. Each pack type has an independent toggle.

| Pack             | Endpoint                           | Trigger                                   |
| ---------------- | ---------------------------------- | ----------------------------------------- |
| Email packs      | `POST /usage/emails/auto-topup`    | When monthly email sends are exhausted    |
| AI compute packs | `POST /usage/ai-tokens/auto-topup` | When token quota is exhausted             |
| Contact packs    | `POST /usage/contacts/auto-topup`  | When contact limit is exceeded            |
| Twilio SMS packs | `POST /usage/twilio/auto-topup`    | When purchased SMS messages are exhausted |

**Request body (all four endpoints):**

```json
{ "enabled": true }
```

**Response:**

```json
{ "success": true, "message": "Auto top-up enabled" }
```

**Auto top-up behaviour:**

- **Email packs**: purchases the smallest pack needed to cover the shortage (10k emails / £10 minimum).
- **AI compute packs**: purchases the configured pack for the assistant.
- **Contact packs**: purchases 5,000 contacts (£10) when the hard limit is exceeded.
- **Twilio SMS packs**: adds 1,000 messages to the current billing cycle when exhausted.

The `autoTopUpEnabled` flag is included in the stats response for each pack:

- `GET /usage/emails` → `autoTopUpEnabled`
- `GET /usage/twilio` → `autoTopUpEnabled`
- `GET /usage/contacts` → (returned as part of contact limits; toggle via endpoint above)

---

#### Tab 5 — Credits

Credits are unit-based prepaid balances that cover usage overflows (AI tokens, email, SMS, automation runs) once plan allowances and add-ons are exhausted. All endpoints require `Authorization: Bearer <session_token>`.

> If a user has never interacted with credits before, the wallet is created automatically on first access — no prior setup required.

---

**GET `/credits`**

Returns wallet stats for the current user.

```json
{
  "balance": 3400,
  "totalPurchased": 5000,
  "creditsUsed": 1600,
  "percentageUsed": 32
}
```

- `balance` — credits currently remaining in the wallet.
- `totalPurchased` — lifetime credits ever purchased.
- `creditsUsed` — `totalPurchased - balance`.
- `percentageUsed` — `0–100`, floored.

---

**GET `/credits/packages`**

Returns the list of available credit packages for the buy modal, ordered by price.

```json
[
  { "id": 1, "name": "Starter Pack", "credits": 500, "priceGbp": 500 },
  { "id": 2, "name": "Basic Pack", "credits": 1000, "priceGbp": 900 },
  { "id": 3, "name": "Growth Pack", "credits": 2500, "priceGbp": 2000 },
  { "id": 4, "name": "Pro Pack", "credits": 5000, "priceGbp": 3500 },
  { "id": 5, "name": "Business Pack", "credits": 10000, "priceGbp": 6000 },
  { "id": 6, "name": "Enterprise Pack", "credits": 25000, "priceGbp": 12500 }
]
```

- `priceGbp` is in **pence** (e.g. `500` = £5.00).
- Only packages where `isActive = true` are returned.

---

**POST `/credits/purchase`**

Purchases a credit package using the user's stored Stripe payment method.

**Request body**

```json
{ "packageId": 3 }
```

**Response**

```json
{
  "success": true,
  "creditsAdded": 2500,
  "newBalance": 5900,
  "transactionId": 42,
  "package": {
    "id": 3,
    "name": "Growth Pack",
    "credits": 2500,
    "priceGbp": 2000
  }
}
```

**Errors**

- `400` — No payment method on file, payment failed, or package not active.
- `404` — Package not found.

> The charge is a one-time Stripe PaymentIntent against the customer's default payment method. Credits are only added to the wallet after a `succeeded` status is confirmed — the wallet is never credited on a failed or pending payment.

---

**GET `/credits/chart/monthly?months=6`**

Returns credit deductions grouped by calendar month.

| Query param | Default | Max  |
| ----------- | ------- | ---- |
| `months`    | `6`     | `12` |

**Response**

```json
{
  "data": [
    { "month": "2025-10", "creditsUsed": 0 },
    { "month": "2025-11", "creditsUsed": 120 },
    { "month": "2025-12", "creditsUsed": 340 },
    { "month": "2026-01", "creditsUsed": 200 },
    { "month": "2026-02", "creditsUsed": 510 },
    { "month": "2026-03", "creditsUsed": 430 }
  ]
}
```

- All months in the range are returned, including zero-usage months.
- `month` format: `YYYY-MM`.

---

**GET `/credits/chart/daily?days=30`**

Returns credit deductions grouped by day.

| Query param | Default | Max  |
| ----------- | ------- | ---- |
| `days`      | `30`    | `90` |

**Response**

```json
{
  "data": [
    { "date": "2026-03-01", "creditsUsed": 0 },
    { "date": "2026-03-02", "creditsUsed": 45 },
    { "date": "2026-03-03", "creditsUsed": 12 },
    "..."
  ]
}
```

- All days in the range are returned, including zero-usage days.
- `date` format: `YYYY-MM-DD`.

---

**GET `/credits/breakdown`**

Returns all-time credit consumption grouped by the service type that consumed it.

```json
{
  "breakdown": [
    { "usageType": "AI_TOKEN_OVERAGE", "credits": 1200 },
    { "usageType": "EMAIL_OVERAGE", "credits": 300 },
    { "usageType": "SMS_OVERAGE", "credits": 100 }
  ]
}
```

`usageType` values: `AI_TOKEN_OVERAGE`, `EMAIL_OVERAGE`, `SMS_OVERAGE`, `AUTOMATION_OVERAGE`, `MANUAL_ADJUSTMENT`.

> `breakdown` is empty `[]` if no deductions have occurred yet.

---

**GET `/credits/transactions?page=1&limit=20`**

Paginated ledger of all credit transactions, newest first.

```json
{
  "transactions": [
    {
      "id": 42,
      "type": "PURCHASE",
      "amount": 2500,
      "balanceAfter": 5900,
      "usageType": null,
      "description": "Purchased Growth Pack: +2500 credits",
      "stripePaymentIntentId": "pi_abc123",
      "createdAt": "2026-03-11T12:00:00.000Z",
      "package": {
        "id": 3,
        "name": "Growth Pack",
        "credits": 2500,
        "priceGbp": 2000
      }
    },
    {
      "id": 41,
      "type": "DEDUCTION",
      "amount": -45,
      "balanceAfter": 3400,
      "usageType": "AI_TOKEN_OVERAGE",
      "description": null,
      "stripePaymentIntentId": null,
      "createdAt": "2026-03-10T09:15:00.000Z",
      "package": null
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

- `type` values: `PURCHASE`, `DEDUCTION`, `REFUND`, `ADJUSTMENT`.
- `amount` is positive for credits added, negative for credits removed.
- `package` is only populated for `PURCHASE` transactions.
- `usageType` is only populated for `DEDUCTION` transactions.
- `limit` max is `100`.

---

**GET `/credits/transactions/:id/receipt`**

Returns the official Stripe hosted receipt URL for a credit purchase transaction. Ideal for a "Download Receipt" button after a successful purchase or in a billing history view.

**Response:**

```json
{
  "receiptUrl": "https://pay.stripe.com/receipts/payment/..."
}
```

- Returns `404 Not Found` if the transaction does not exist or has no associated Stripe record.
- Returns `400 Bad Request` if the transaction is not a `PURCHASE` (e.g., trying to get a receipt for a deduction).

---

**Automatic Credit Deduction (Overage Enforcement)**

Credits are silently deducted by the backend whenever a user exceeds their plan + add-on limits and auto top-up is disabled. No extra API call is required by the frontend — the deduction happens inside the existing enforcement methods (`canUseTokens`, `canSendEmail`, `canSendSMS`).

**3-Layer Enforcement Flow**

```
Usage request (AI token / email / SMS)
    │
    ├── Within plan + add-on limit?  ──► Allow (no credits involved)
    │
    ├── autoTopUpEnabled = true?  ──► Purchase add-on pack ──► Allow
    │
    ├── Credits available?  ──► Deduct credits ──► Top up limit ──► Allow
    │
    └── No credits  ──►  400 with reason message
```

**Credit pricing rates**

| Service          | Rate                               |
| ---------------- | ---------------------------------- |
| AI token overage | 1 credit per 10,000 overage tokens |
| Email overage    | 1 credit per 100 overage emails    |
| SMS overage      | 1 credit per message               |

**AI tokens in detail:**
When `tokensConsumed + estimatedTokens > baseTokens + purchasedTokens` and auto top-up is off, the backend calculates `creditsNeeded = ceil(overage / 10,000)`, deducts that many credits, and adds the equivalent tokens to `purchasedTokens`. The original `consumeTokens` call then proceeds normally.

**Email in detail:**
When `emailsSent >= baseLimit + purchasedLimit` and auto top-up is off, 1 credit is deducted and 100 emails are added to `purchasedLimit`. This means a single credit deduction covers the next 100 overage sends.

**SMS in detail:**
When `messagesUsed >= purchasedMessages` and auto top-up is off, 1 credit is deducted and 1 message is added to `purchasedMessages` for each individual SMS.

**What the UI sees when credits are deducted:**
The API calls that trigger enforcement (`POST /messages`, AI inference endpoints, etc.) return normally — the deduction is transparent. The credits balance visible on `GET /credits` will decrease, and the transaction will appear in `GET /credits/transactions` with:

```json
{
  "type": "DEDUCTION",
  "usageType": "AI_TOKEN_OVERAGE", // or EMAIL_OVERAGE, SMS_OVERAGE
  "amount": -3, // negative = credits removed
  "balanceAfter": 997
}
```

**What the UI sees when credits run out:**
The upstream endpoint (e.g. `POST /conversations`) returns a `400 Bad Request` with a reason describing the limit and suggesting remedies:

```json
{
  "statusCode": 400,
  "message": "Token limit exceeded. Current: 250000, Limit: 250000. Purchase credits or compute packs, or enable auto top-up."
}
```

The Credits tab can use this to prompt the user to top up their wallet.

---

## Settings — Plans & Billing — Usage Tab

All endpoints require `Authorization: Bearer <session_token>`. All usage stats are scoped to the authenticated user (or organisation owner for seat/member counts).

---

#### Individual Service Stats

**GET `/usage/emails`**

Returns email usage for the current billing cycle.

```json
{
  "sent": 1240,
  "baseLimit": 5000,
  "purchasedLimit": 2000,
  "totalLimit": 7000,
  "remaining": 5760,
  "percentageUsed": 18,
  "avgPerDay": 113,
  "estimatedDaysLeft": 51,
  "autoTopUpEnabled": false,
  "warningEmailSent": false,
  "billingCycleStart": "2026-03-01T00:00:00.000Z",
  "billingCycleEnd": "2026-03-31T23:59:59.000Z",
  "nearLimit": false
}
```

- `avgPerDay` — rolling average emails/day since cycle start.
- `estimatedDaysLeft` — days until limit exhausted at current rate. `null` if no usage yet.

---

**GET `/usage/ai-tokens`**

Returns token usage across all AI assistants for the current user.

```json
[
  {
    "assistantId": 1,
    "assistantName": "Support Bot",
    "stats": {
      "consumed": 45000,
      "inputTokens": 20000,
      "outputTokens": 25000,
      "baseTokens": 250000,
      "purchasedTokens": 0,
      "totalLimit": 250000,
      "remaining": 205000,
      "percentageUsed": 18,
      "avgPerDay": 4090,
      "estimatedDaysLeft": 50,
      "autoTopUpEnabled": false,
      "billingCycleStart": "2026-03-01T00:00:00.000Z",
      "billingCycleEnd": "2026-03-31T23:59:59.000Z",
      "nearLimit": false
    }
  }
]
```

**GET `/usage/ai-tokens/:assistantId`** — same shape for a single assistant.

---

**GET `/usage/twilio`**

Returns Twilio SMS usage for the current billing cycle.

```json
{
  "used": 210,
  "purchased": 500,
  "remaining": 290,
  "percentageUsed": 42,
  "avgPerDay": 19,
  "estimatedDaysLeft": 15,
  "canSendSMS": true,
  "autoTopUpEnabled": false,
  "billingCycleStart": "2026-03-01T00:00:00.000Z",
  "billingCycleEnd": "2026-03-31T23:59:59.000Z"
}
```

---

**GET `/usage/contacts`**

Returns CRM contact usage. Contacts do **not** reset monthly — `estimatedDaysToLimit` is how long until the contact limit is reached at the current growth rate.

```json
{
  "current": 1420,
  "baseLimit": 5000,
  "purchasedLimit": 0,
  "totalLimit": 5000,
  "bufferLimit": 5250,
  "remaining": 3580,
  "percentageUsed": 28,
  "avgPerDay": 8,
  "estimatedDaysToLimit": 447,
  "inBuffer": false,
  "nearLimit": false,
  "canImport": true
}
```

- `bufferLimit` — 5% over `totalLimit`, importing is allowed up to this point.
- `estimatedDaysToLimit` — `null` if contact count is not growing.

---

**GET `/usage/seats`**

Returns team seat stats using active organisation members as the source of truth.

```json
{
  "used": 4,
  "basePlanSeats": 5,
  "extraSeats": 0,
  "bulkSeats": 0,
  "totalSeats": 5,
  "remaining": 1,
  "percentageUsed": 80,
  "unlimited": false,
  "canAddMembers": true
}
```

- `used` = active invited members + owner (1).
- `unlimited: true` = ORGANISATION plan with no `maxSeats` set (no percentage/remaining).
- `bulkSeats` is only populated for ORGANISATION plan users.

---

#### Aggregated Endpoints

**GET `/usage/overview`**

Returns all service stats in a single call (email, AI tokens, SMS, contacts, seats).

```json
{
  "contacts": { ... },
  "emails": { ... },
  "aiTokens": [ ... ],
  "sms": { ... },
  "seats": { ... }
}
```

---

**GET `/usage/summary`**

Returns the on-track verdict, month progress, and per-service status flags. Designed for the Usage tab summary card.

```json
{
  "billingCycleEnd": "2026-03-31T23:59:59.000Z",
  "daysRemainingInCycle": 20,
  "monthProgressPercent": 35,
  "services": {
    "email": {
      "percentageUsed": 18,
      "avgPerDay": 113,
      "estimatedDaysLeft": 51,
      "status": "ok"
    },
    "aiTokens": {
      "percentageUsed": 18,
      "avgPerDay": 4090,
      "estimatedDaysLeft": 50,
      "status": "ok",
      "assistants": [
        {
          "assistantId": 1,
          "assistantName": "Support Bot",
          "percentageUsed": 18,
          "estimatedDaysLeft": 50,
          "status": "ok"
        }
      ]
    },
    "sms": {
      "percentageUsed": 42,
      "avgPerDay": 19,
      "estimatedDaysLeft": 15,
      "status": "warning"
    },
    "contacts": {
      "percentageUsed": 28,
      "avgPerDay": 8,
      "estimatedDaysToLimit": 447,
      "status": "ok"
    },
    "seats": {
      "percentageUsed": 80,
      "unlimited": false,
      "status": "warning"
    }
  },
  "onTrack": false,
  "summaryMessage": "⚠️ Your SMS and team seat usage are trending high — you may exceed your limits before the month ends."
}
```

**Status thresholds:**

| Status     | Monthly-reset services       | Capacity services (contacts, seats) |
| ---------- | ---------------------------- | ----------------------------------- |
| `ok`       | usage% < monthProgress% + 10 | usage% < 75                         |
| `warning`  | usage% ≥ monthProgress% + 10 | usage% ≥ 75                         |
| `critical` | usage% ≥ 90 (any)            | usage% ≥ 90                         |

- `monthProgressPercent` — percentage of the billing month that has elapsed (e.g. day 11 of 31 = 35%).
- `onTrack: true` — all services are `ok`.
- `summaryMessage` — ready-to-display string for the UI.

---

#### Full Usage Report (Modal)

**GET `/usage/report`**

Returns the full breakdown powering the "View Full Usage Report" modal.

```json
{
  "reportGeneratedAt": "2026-03-11T23:00:00.000Z",
  "billingCycleStart": "2026-03-01T00:00:00.000Z",
  "billingCycleEnd": "2026-03-31T23:59:59.000Z",
  "daysRemaining": 20,

  "messaging": {
    "sms": {
      "used": 210,
      "total": 500,
      "percentageUsed": 42,
      "avgPerDay": 19,
      "estimatedDaysLeft": 15,
      "activeNumbers": 2,
      "voiceNumberLimit": 5
    }
  },

  "email": {
    "monthlySends": {
      "used": 1240,
      "total": 7000,
      "percentageUsed": 18,
      "avgPerDay": 113
    },
    "projectedEndOfMonth": 3500,
    "remainingSends": 5760
  },

  "crm": {
    "contacts": {
      "used": 1420,
      "total": 5000,
      "percentageUsed": 28,
      "avgGrowthPerDay": 8,
      "gainedThisMonth": 88,
      "projectedAtCurrentGrowth": 1580,
      "estimatedDaysToLimit": 447
    }
  },

  "team": {
    "seats": {
      "used": 4,
      "total": 5,
      "percentageUsed": 80,
      "unlimited": false
    },
    "aiAssistants": {
      "used": 2,
      "total": 5,
      "percentageUsed": 40,
      "remainingSlots": 3,
      "unlimited": false
    }
  },

  "insights": {
    "messaging": "You're using 42% of your SMS limit. At current rate, consider buying more messages in 15 days.",
    "email": "Projected to use 3,500 emails by end of month. You're well within limits.",
    "crm": "Contacts growing at +8/day. Consider upgrading in 447 days.",
    "team": "You have 3 available AI assistant slots. Consider adding more assistants to automate workflows."
  }
}
```

- `projectedEndOfMonth` = `used + (avgPerDay × daysRemaining)`.
- `gainedThisMonth` = contacts created since the 1st of the current calendar month.
- `insights` strings are pre-built on the backend — display them directly in the UI.
- Insights prefixed with `⚠️` indicate a service at risk of exceeding its limit.

---

**GET `/usage/report/pdf`**

Streams a PDF version of the usage report.

- **Response**: `Content-Type: application/pdf`
- **Content-Disposition**: `attachment; filename="usage-report-YYYY-MM-DD.pdf"`

The PDF contains the same four sections (Messaging, Email, CRM, Team) plus the Insights & Recommendations section, formatted as an A4 document. Values at risk (≥ 80% usage or projecting over limit) are highlighted in red.

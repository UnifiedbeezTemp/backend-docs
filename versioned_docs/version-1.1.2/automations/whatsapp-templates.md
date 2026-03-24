---
sidebar_position: 5
---

# WhatsApp Templates — Frontend Integration Guide

Covers all `/whatsapp/templates` endpoints: creating templates, fetching them with their full response structure, sending template messages, checking service windows, and sending interactive messages.

---

## Authentication

All endpoints require a valid session / JWT.

```
Authorization: Bearer <token>
```

---

## Create a WhatsApp message template

```
POST /whatsapp/templates
```

Registers a new WhatsApp message template with Meta. Templates must be approved before they can be sent.

**Request body**

```json
{
  "channelId": 3,
  "name": "order_confirmation",
  "category": "UTILITY",
  "language": "en_US",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Order Confirmed!"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}}, your order #{{2}} has been confirmed and will arrive by {{3}}.",
      "example": {
        "body_text": [["Jane", "ORD-1234", "March 10"]]
      }
    },
    {
      "type": "FOOTER",
      "text": "Thank you for shopping with us."
    }
  ],
  "messageSendTtlSeconds": 86400
}
```

| Field                   | Type   | Required | Notes                                               |
| ----------------------- | ------ | -------- | --------------------------------------------------- |
| `channelId`             | number | **yes**  | Your connected WhatsApp channel ID                  |
| `name`                  | string | **yes**  | Template name — lowercase, underscores only         |
| `category`              | string | **yes**  | `"AUTHENTICATION"` \| `"MARKETING"` \| `"UTILITY"`  |
| `language`              | string | **yes**  | BCP-47 language tag, e.g. `"en_US"`, `"es"`, `"fr"` |
| `components`            | array  | **yes**  | Template components (HEADER, BODY, FOOTER, BUTTONS) |
| `messageSendTtlSeconds` | number | no       | Auth template TTL in seconds (default: 600)         |

**Component types:**

| `type`    | `format` options                     | Notes                                                       |
| --------- | ------------------------------------ | ----------------------------------------------------------- |
| `HEADER`  | `TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT` | Optional                                                    |
| `BODY`    | —                                    | Required. Use `{{1}}`, `{{2}}` for variables                |
| `FOOTER`  | —                                    | Optional                                                    |
| `BUTTONS` | —                                    | Optional. See interactive endpoint for buttons at send time |

**Response `201`**

```json
{
  "id": "template_meta_id_123",
  "status": "PENDING",
  "category": "UTILITY"
}
```

---

## Get WhatsApp templates

```
GET /whatsapp/templates?channelId=3
GET /whatsapp/templates?channelId=3&status=APPROVED
```

| Query param | Type   | Required | Notes                                                             |
| ----------- | ------ | -------- | ----------------------------------------------------------------- |
| `channelId` | number | **yes**  | Connected WhatsApp channel ID                                     |
| `status`    | string | no       | Filter: `"APPROVED"` \| `"PENDING"` \| `"REJECTED"` \| `"PAUSED"` |

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
          "text": "Order Confirmed!"
        },
        {
          "type": "BODY",
          "text": "Hi {{1}}, your order #{{2}} has been confirmed and will arrive by {{3}}.",
          "example": {
            "body_text": [["Jane", "ORD-1234", "March 10"]]
          }
        },
        {
          "type": "FOOTER",
          "text": "Thank you for shopping with us."
        }
      ],
      "createdAt": "2026-03-01T12:00:00.000Z",
      "updatedAt": "2026-03-01T14:00:00.000Z"
    },
    {
      "id": "template_meta_id_456",
      "name": "win_back_offer",
      "status": "APPROVED",
      "category": "MARKETING",
      "language": "en_US",
      "components": [
        {
          "type": "HEADER",
          "format": "IMAGE",
          "example": { "header_handle": ["https://example.com/image.jpg"] }
        },
        {
          "type": "BODY",
          "text": "We miss you, {{1}}! Here's 20% off your next order. Use code: {{2}}",
          "example": {
            "body_text": [["Jane", "WINBACK20"]]
          }
        }
      ],
      "createdAt": "2026-02-15T09:00:00.000Z",
      "updatedAt": "2026-02-15T09:00:00.000Z"
    }
  ]
}
```

**Template status values:**

| Status     | Meaning                                          |
| ---------- | ------------------------------------------------ |
| `APPROVED` | Ready to send                                    |
| `PENDING`  | Awaiting Meta review                             |
| `REJECTED` | Meta rejected the template — revise and resubmit |
| `PAUSED`   | Temporarily paused by Meta due to low quality    |
| `DISABLED` | Permanently disabled                             |

---

## Send a template message

```
POST /whatsapp/templates/send
```

Sends an approved template to a recipient. Use this when the 24-hour service window is closed (only templates can be sent outside the window).

**Request body**

```json
{
  "channelId": 3,
  "recipientId": "+15551234567",
  "templateName": "order_confirmation",
  "languageCode": "en_US",
  "parameters": [
    { "type": "text", "text": "Jane" },
    { "type": "text", "text": "ORD-1234" },
    { "type": "text", "text": "March 10" }
  ]
}
```

| Field          | Type   | Required | Notes                                                   |
| -------------- | ------ | -------- | ------------------------------------------------------- |
| `channelId`    | number | **yes**  | Connected WhatsApp channel ID                           |
| `recipientId`  | string | **yes**  | Recipient's WhatsApp phone number (E.164 format)        |
| `templateName` | string | **yes**  | Must match an `APPROVED` template name                  |
| `languageCode` | string | no       | Defaults to `"en_US"`                                   |
| `parameters`   | array  | no       | Variable substitutions in order (`{{1}}`, `{{2}}`, ...) |

**Response `200`**

```json
{
  "messageId": "wamid.HBgLMTU1NTEyMzQ1Njc...",
  "status": "sent",
  "timestamp": "2026-03-01T15:30:00.000Z"
}
```

---

## Check service window status

```
GET /whatsapp/templates/service-window/:channelId/:participantId
```

A WhatsApp **service window** is the 24-hour window after a contact messages you, during which you can send any message (not just templates). Use this to decide whether to send a template or a regular message.

| Param           | Type   | Notes                           |
| --------------- | ------ | ------------------------------- |
| `channelId`     | number | Connected WhatsApp channel ID   |
| `participantId` | string | Contact's WhatsApp phone number |

**Response `200`**

```json
{
  "isOpen": true,
  "opensAt": null,
  "expiresAt": "2026-03-02T10:15:00.000Z",
  "canSendRegularMessages": true,
  "canSendTemplateMessages": true
}
```

When the window is closed:

```json
{
  "isOpen": false,
  "opensAt": null,
  "expiresAt": null,
  "canSendRegularMessages": false,
  "canSendTemplateMessages": true
}
```

| Field                     | Type           | Notes                                                     |
| ------------------------- | -------------- | --------------------------------------------------------- |
| `isOpen`                  | boolean        | `true` = within 24-hour window, can send regular messages |
| `opensAt`                 | string \| null | When the window will open (future)                        |
| `expiresAt`               | string \| null | When the current window expires                           |
| `canSendRegularMessages`  | boolean        | Same as `isOpen`                                          |
| `canSendTemplateMessages` | boolean        | Always `true` — templates can always be sent              |

**UI guidance:** Show a "Send Template" button when `isOpen = false`. When `isOpen = true`, both regular messages and templates are available.

---

## Send an interactive message

```
POST /whatsapp/templates/interactive
```

Sends a message with clickable buttons or a list picker. Only available within the 24-hour service window.

**Button message:**

```json
{
  "channelId": 3,
  "recipientId": "+15551234567",
  "type": "button",
  "header": "Your appointment",
  "body": "Would you like to confirm your appointment for tomorrow at 10am?",
  "footer": "Tap a button to respond",
  "buttons": [
    { "id": "confirm", "title": "Yes, confirm" },
    { "id": "reschedule", "title": "Reschedule" },
    { "id": "cancel", "title": "Cancel" }
  ]
}
```

**List message:**

```json
{
  "channelId": 3,
  "recipientId": "+15551234567",
  "type": "list",
  "header": "Choose a plan",
  "body": "Select the plan that works best for your business.",
  "footer": "Plans renew monthly",
  "listItems": [
    {
      "id": "starter",
      "title": "Starter",
      "description": "$29/mo — up to 500 contacts"
    },
    {
      "id": "growth",
      "title": "Growth",
      "description": "$79/mo — up to 2,000 contacts"
    },
    {
      "id": "business",
      "title": "Business",
      "description": "$199/mo — unlimited contacts"
    }
  ]
}
```

| Field         | Type   | Required             | Notes                  |
| ------------- | ------ | -------------------- | ---------------------- |
| `channelId`   | number | **yes**              |                        |
| `recipientId` | string | **yes**              | E.164 phone number     |
| `type`        | string | **yes**              | `"button"` \| `"list"` |
| `header`      | string | no                   | Short header text      |
| `body`        | string | **yes**              | Main message text      |
| `footer`      | string | no                   | Small footer text      |
| `buttons`     | array  | for `type: "button"` | Max 3 buttons          |
| `listItems`   | array  | for `type: "list"`   | Max 10 items           |

**Response `200`**

```json
{
  "messageId": "wamid.HBgLMTU1NTEyMzQ1...",
  "status": "sent"
}
```

---

## Mark a message as read

```
POST /whatsapp/templates/mark-read
```

Sends a read receipt to the contact, showing the blue double-tick in their WhatsApp.

**Request body**

```json
{
  "channelId": 3,
  "messageId": "wamid.HBgLMTU1NTEyMzQ1Njc..."
}
```

**Response `200`**

```json
{ "success": true }
```

---

## Error Responses

| Status | Scenario                                                       |
| ------ | -------------------------------------------------------------- |
| `400`  | Missing required fields or invalid channel                     |
| `401`  | Not authenticated                                              |
| `403`  | Channel does not belong to this user                           |
| `404`  | Channel not found                                              |
| `422`  | Template not approved / window closed for non-template message |

# FAQ Management — Frontend Integration Guide

Covers all `/faq` endpoints: listing categories, creating and updating FAQs with multiple answer source types, searching with AI, and fetching leads triggered by FAQ interactions.

---

## Authentication

All endpoints require a valid session / JWT.

```
Authorization: Bearer <token>
```

---

## Get FAQ categories

```
GET /faq/categories
```

Returns the available FAQ category types for grouping FAQs.

**Response `200`**

```json
[
  { "value": "GENERAL", "label": "General" },
  { "value": "PRODUCT", "label": "Product" },
  { "value": "SUPPORT", "label": "Support" },
  { "value": "BILLING", "label": "Billing" },
  { "value": "ONBOARDING", "label": "Onboarding" }
]
```

> The exact category values are defined by the `FaqCategoryType` enum — use this endpoint to stay in sync rather than hard-coding them.

---

## List FAQs

```
GET /faq
GET /faq?category=SUPPORT
```

| Query param | Type   | Required | Notes                                                                             |
| ----------- | ------ | -------- | --------------------------------------------------------------------------------- |
| `category`  | string | no       | Filter by `FaqCategoryType` value. Returns `400` if an invalid value is supplied. |

Each FAQ in the response includes `isConfigured: boolean` — `true` when at least one answer source exists. Only configured FAQs are eligible to be used by the AI. Use this flag to surface draft FAQs in the UI.

**Response `200`**

```json
[
  {
    "id": 10,
    "question": "How do I reset my password?",
    "categoryType": "SUPPORT",
    "answerSources": [
      {
        "id": 1,
        "type": "TEXT",
        "content": "Go to the login page and click 'Forgot password'. You will receive a reset link by email within 5 minutes.",
        "websiteUrl": null,
        "fileId": null
      }
    ],
    "notificationConfig": {
      "isEnabled": true,
      "channels": ["email"],
      "immediately": true,
      "customDelay": null,
      "timeOfDay": null,
      "teamMemberEmails": ["support@example.com"]
    },
    "isConfigured": true,
    "triggerCount": 14,
    "createdAt": "2026-02-01T10:00:00.000Z",
    "updatedAt": "2026-02-10T08:30:00.000Z"
  },
  {
    "id": 11,
    "question": "What payment methods do you accept?",
    "categoryType": "BILLING",
    "answerSources": [
      {
        "id": 2,
        "type": "TEXT",
        "content": "We accept Visa, Mastercard, PayPal, and bank transfers.",
        "websiteUrl": null,
        "fileId": null
      },
      {
        "id": 3,
        "type": "WEBSITE",
        "content": null,
        "websiteUrl": "https://example.com/pricing#payment",
        "fileId": null
      }
    ],
    "notificationConfig": null,
    "isConfigured": true,
    "triggerCount": 7,
    "createdAt": "2026-02-05T11:00:00.000Z",
    "updatedAt": "2026-02-05T11:00:00.000Z"
  },
  {
    "id": 13,
    "question": "How do I upgrade my plan?",
    "categoryType": "BILLING",
    "answerSources": [],
    "notificationConfig": null,
    "isConfigured": false,
    "triggerCount": 0,
    "createdAt": "2026-03-18T09:00:00.000Z",
    "updatedAt": "2026-03-18T09:00:00.000Z"
  }
]
```

---

## Create a FAQ

```
POST /faq
```

Only `question` and `categoryType` are required. `answerSources` and `notificationConfig` can be added later via `PUT /faq/:faqId`.

> A FAQ without answer sources will **not** be used by the AI until sources are added. See `isConfigured` in the list response.

**Minimal request body (draft)**

```json
{
  "categoryType": "SUPPORT",
  "question": "How do I cancel my subscription?"
}
```

**Full request body**

```json
{
  "categoryType": "SUPPORT",
  "question": "How do I cancel my subscription?",
  "answerSources": [
    {
      "type": "TEXT",
      "content": "You can cancel your subscription at any time from the Billing page under Settings. Cancellation takes effect at the end of your current billing period."
    }
  ],
  "notificationConfig": {
    "isEnabled": true,
    "channels": ["email", "whatsapp"],
    "immediately": true,
    "customDelay": null,
    "timeOfDay": null,
    "teamMemberEmails": ["billing@example.com"]
  }
}
```

### Answer source types

Each FAQ can have one or more answer sources. The AI uses all sources to compose an accurate answer.

| `type`    | Required fields | When to use                                            |
| --------- | --------------- | ------------------------------------------------------ |
| `TEXT`    | `content`       | Paste the answer text directly                         |
| `WEBSITE` | `websiteUrl`    | Point to a webpage — AI crawls and indexes the content |
| `FILE`    | `fileId`        | Reference an uploaded file (PDF, DOCX, etc.)           |

**TEXT source:**

```json
{
  "type": "TEXT",
  "content": "Cancellation takes effect at end of the billing period."
}
```

**WEBSITE source:**

```json
{
  "type": "WEBSITE",
  "websiteUrl": "https://example.com/help/cancellation"
}
```

**FILE source:**

```json
{
  "type": "FILE",
  "fileId": 42
}
```

### Notification config

When a FAQ is triggered by a contact, you can notify team members automatically.

| Field              | Type           | Notes                                     |
| ------------------ | -------------- | ----------------------------------------- |
| `isEnabled`        | boolean        | Enable/disable notifications              |
| `channels`         | string[]       | `"email"` \| `"whatsapp"` \| `"sms"`      |
| `immediately`      | boolean        | Fire immediately when triggered           |
| `customDelay`      | number \| null | Minutes to wait (if `immediately: false`) |
| `timeOfDay`        | string \| null | HH:MM time constraint (e.g. `"09:00"`)    |
| `teamMemberEmails` | string[]       | Who to notify                             |

**Response `201`**

```json
{
  "id": 12,
  "question": "How do I cancel my subscription?",
  "categoryType": "SUPPORT",
  "answerSources": [
    {
      "id": 4,
      "type": "TEXT",
      "content": "You can cancel your subscription at any time from the Billing page under Settings. Cancellation takes effect at the end of your current billing period.",
      "websiteUrl": null,
      "fileId": null
    }
  ],
  "notificationConfig": {
    "isEnabled": true,
    "channels": ["email", "whatsapp"],
    "immediately": true,
    "customDelay": null,
    "timeOfDay": null,
    "teamMemberEmails": ["billing@example.com"]
  },
  "isConfigured": true,
  "triggerCount": 0,
  "createdAt": "2026-03-01T12:00:00.000Z",
  "updatedAt": "2026-03-01T12:00:00.000Z"
}
```

---

## Update a FAQ

```
PUT /faq/:faqId
```

Partial update — only include fields you want to change. Same shape as the create body. Use this to complete a draft FAQ by adding answer sources for the first time — this is also when the AI embedding is created.

**Example: complete a draft FAQ by adding answer sources**

```json
{
  "answerSources": [
    {
      "type": "TEXT",
      "content": "You can cancel from the Billing page under Settings."
    }
  ]
}
```

**Example: add a website source to an existing FAQ**

```json
{
  "answerSources": [
    {
      "type": "TEXT",
      "content": "Existing text answer."
    },
    {
      "type": "WEBSITE",
      "websiteUrl": "https://example.com/help/cancellation"
    }
  ]
}
```

**Response `200`** — the updated FAQ object (same shape as create response).

---

## Delete a FAQ

```
DELETE /faq/:faqId
```

**Response `200`**

```json
{ "message": "FAQ deleted successfully" }
```

---

## Search FAQs (AI-powered)

```
POST /faq/search
```

Uses vector similarity search to find the most relevant FAQ answer for a natural-language query. Optionally fires notification rules and logs the customer interaction.

**Request body**

```json
{
  "query": "Can I get a refund if I'm not happy?",
  "triggerNotifications": true,
  "customerIdentifier": "jane@example.com"
}
```

| Field                  | Type    | Required | Notes                                                  |
| ---------------------- | ------- | -------- | ------------------------------------------------------ |
| `query`                | string  | **yes**  | Natural language question from the contact             |
| `triggerNotifications` | boolean | no       | Default `false`. Set `true` when called from live chat |
| `customerIdentifier`   | string  | no       | Email, phone, or platform ID — used to log the lead    |

**Response `200`**

```json
{
  "results": [
    {
      "faqId": 12,
      "question": "How do I cancel my subscription?",
      "answer": "You can cancel your subscription at any time from the Billing page under Settings. Cancellation takes effect at the end of your current billing period.",
      "score": 0.94,
      "categoryType": "SUPPORT"
    },
    {
      "faqId": 11,
      "question": "What payment methods do you accept?",
      "answer": "We accept Visa, Mastercard, PayPal, and bank transfers.",
      "score": 0.71,
      "categoryType": "BILLING"
    }
  ],
  "topAnswer": "You can cancel your subscription at any time from the Billing page under Settings. Cancellation takes effect at the end of your current billing period.",
  "notificationsTriggered": true
}
```

| Field                    | Notes                                                  |
| ------------------------ | ------------------------------------------------------ |
| `results`                | Ranked list of matching FAQs (highest score first)     |
| `results[].score`        | Similarity score 0–1 (1 = exact match)                 |
| `topAnswer`              | The answer text from the highest-scoring result        |
| `notificationsTriggered` | Whether notifications were fired (based on FAQ config) |

---

## Get FAQ leads

```
GET /faq/:faqId/leads
```

Returns all contacts who triggered a specific FAQ question.

**Response `200`**

```json
[
  {
    "id": 7,
    "triggeredAt": "2026-03-01T14:00:00.000Z",
    "customerIdentifier": "jane@example.com",
    "query": "Can I get a refund?",
    "customer": {
      "id": 101,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+15551234567"
    }
  }
]
```

---

## Utility endpoints (Admin)

### Cleanup orphaned FAQ vectors

```
POST /faq/cleanup-vectors
```

Removes FAQ documents from the vector store that no longer exist in the database. Run after bulk-deleting FAQs.

**Response `200`**

```json
{
  "removed": 3,
  "message": "Orphaned vectors cleaned up successfully"
}
```

### Clear all FAQ leads

```
DELETE /faq/leads/clear
```

Removes all FAQ trigger groups and associated lead captures for the current user.

**Response `200`**

```json
{ "message": "All FAQ leads cleared successfully" }
```

---

## Error Responses

| Status | Scenario                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------ |
| `400`  | Missing `question` or `categoryType` on create                                                   |
| `400`  | Invalid answer source type, or `content`/`websiteUrl`/`fileId` missing for the given source type |
| `400`  | Invalid `category` query param                                                                   |
| `401`  | Not authenticated                                                                                |
| `404`  | FAQ not found or belongs to another user                                                         |

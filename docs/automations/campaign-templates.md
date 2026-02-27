---
sidebar_position: 2
---

# Automation Categories — Frontend Integration Guide

> **Architecture note:** The campaign template layer has been removed. The 4 automation categories are now fixed system definitions — not user-created objects. The frontend GETs the static category definitions and POSTs directly to create an automation. Steps are auto-populated by the backend.

---

## Overview

| Category                | Enum value               | `key` slug                  | Pre-populated steps |
| ----------------------- | ------------------------ | --------------------------- | ------------------- |
| Sales & Lead Generation | `SALES_LEAD_GENERATION`  | `sales-and-lead-generation` | 10                  |
| Support Escalation      | `SUPPORT_ESCALATION`     | `support-escalation`        | 4                   |
| Retention & Nurture     | `RETENTION_NURTURE`      | `retention-nurture`         | 3                   |
| Reengagement Campaigns  | `REENGAGEMENT_CAMPAIGNS` | `reengagement-campaigns`    | 0 — blank slate     |

---

## Authentication

All endpoints require a valid session cookie / JWT bearer token.

```
Authorization: Bearer <token>
```

---

## Get Category Definitions

```
GET /automations/categories
```

Returns the 4 static category definitions with their predefined step shapes. No DB query — always the same response.

**Response `200`**

```json
[
  {
    "category": "SALES_LEAD_GENERATION",
    "key": "sales-and-lead-generation",
    "label": "Sales & Lead Generation",
    "steps": [
      {
        "stepIndex": 0,
        "type": "auto",
        "stepKey": "slg-webchat-install",
        "label": "Add BeeBot to Your Website",
        "required": true,
        "locked": true,
        "isDefault": true,
        "completionStatus": "pending",
        "config": {}
      },
      { "stepIndex": 1, "type": "auto", "stepKey": "slg-consent-flow", "label": "Smart Consent Flow", ... },
      ...
    ]
  },
  {
    "category": "SUPPORT_ESCALATION",
    "key": "support-escalation",
    "label": "Support Escalation",
    "steps": [
      { "stepIndex": 0, "type": "auto", "stepKey": "se-select-channels",   "label": "Select Connected Channels", ... },
      { "stepIndex": 1, "type": "auto", "stepKey": "se-select-faqs",      "label": "Select FAQ Category", ... },
      { "stepIndex": 2, "type": "auto", "stepKey": "se-faq-config",       "label": "FAQ Configuration", ... },
      { "stepIndex": 3, "type": "auto", "stepKey": "se-campaign-preview", "label": "Campaign Preview", ... }
    ]
  },
  {
    "category": "RETENTION_NURTURE",
    "key": "retention-nurture",
    "label": "Retention & Nurture",
    "steps": [
      { "stepIndex": 0, "type": "auto", "stepKey": "rn-create-campaign",  "label": "Create Campaign", ... },
      { "stepIndex": 1, "type": "auto", "stepKey": "rn-campaign-config",  "label": "Campaign Configuration", ... },
      { "stepIndex": 2, "type": "auto", "stepKey": "rn-outreach-email",   "label": "Build Your Outreach Email", ... }
    ]
  },
  {
    "category": "REENGAGEMENT_CAMPAIGNS",
    "key": "reengagement-campaigns",
    "label": "Reengagement Campaigns",
    "steps": []
  }
]
```

Each step shape:

| Field              | Type        | Notes                                |
| ------------------ | ----------- | ------------------------------------ |
| `stepIndex`        | number      | 0-based position                     |
| `type`             | `"auto"`    | All predefined steps have this type  |
| `stepKey`          | string      | Routing key for the UI config drawer |
| `label`            | string      | Human-readable name                  |
| `required`         | true        | Cannot be removed                    |
| `locked`           | true        | Position is fixed                    |
| `isDefault`        | true        | System-generated                     |
| `completionStatus` | `"pending"` | Initially empty                      |
| `config`           | `{}`        | Starts empty, filled by user         |

---

## Create an Automation

```
POST /automations
```

**Minimum body** (only `name` + `automationCategory` required):

```json
{
  "name": "My SLG Setup",
  "automationCategory": "SALES_LEAD_GENERATION"
}
```

The backend auto-creates all predefined steps for the category with `isTemplatePrefilled: true` and `config: {}`.

**Full body** (all optional fields):

```json
{
  "name": "My SLG Setup",
  "automationCategory": "SALES_LEAD_GENERATION",
  "description": "Optional",
  "startType": "TRIGGER_BASED",
  "sourceFilterEnabled": false,
  "allowedSources": [],
  "inactivityFilterEnabled": false,
  "inactivityThreshold": null,
  "inactivityUnit": null,
  "tagFilterEnabled": false,
  "allowedTagIds": [],
  "statusFilterEnabled": false,
  "allowedStatuses": [],
  "triggers": [],
  "steps": []
}
```

| Field                | Required | Notes                                                                                  |
| -------------------- | -------- | -------------------------------------------------------------------------------------- |
| `name`               | **yes**  |                                                                                        |
| `automationCategory` | **yes**  | One of the 4 enum values                                                               |
| `description`        | no       |                                                                                        |
| `startType`          | no       | `"TRIGGER_BASED"` (default) or `"ACTION_BASED"`                                        |
| `triggers`           | no       | Max 1. Can be added later via `PUT /automations/:id`                                   |
| `steps`              | no       | Extra steps appended after predefined ones (for SLG/SE/RN); all steps for REENGAGEMENT |

**Response `201`** — raw automation record. Fetch `GET /automations/:id` for the full `{ logic, layout }` response.

---

## Configure Predefined Steps

Each predefined step's config is initially empty. Use the unified step config endpoint:

```
PATCH /automations/:id/steps/:stepId
```

**Request body**

```json
{
  "config": {
    "websiteUrl": "https://example.com",
    "installVerified": false
  }
}
```

The `stepId` is the DB ID of the step (returned in `GET /automations/:id` → `logic.steps[n].id`, but as a string — parse to int).

**Response `200`** — the updated `AutomationStep` record.

---

## Step-by-Step Config Reference

### SALES_LEAD_GENERATION (10 steps)

| stepIndex | stepKey                 | Human name                    |
| --------- | ----------------------- | ----------------------------- |
| 0         | `slg-webchat-install`   | Add BeeBot to Your Website    |
| 1         | `slg-consent-flow`      | Smart Consent Flow            |
| 2         | `slg-select-channels`   | Select Connected Channels     |
| 3         | `slg-form-integration`  | Integrate Your Form           |
| 4         | `slg-sender-email`      | Configure Sender Email        |
| 5         | `slg-campaign-list`     | Create Campaign List          |
| 6         | `slg-beebot-handler`    | Select BeeBot Handler         |
| 7         | `slg-crm-tags`          | CRM Tags / Keywords           |
| 8         | `slg-tag-notifications` | CRM Tag Notification Settings |
| 9         | `slg-outreach-email`    | Build Your Outreach Email     |

---

#### Step 0 — `slg-webchat-install`

Install BeeBot widget on the user's website.

```json
{
  "websiteUrl": "https://example.com",
  "installVerified": false,
  "scriptUrl": "https://cdn.unifiedbeez.com/widget/abc123.js"
}
```

| Field             | Type    | Required to be "configured" | Notes                                               |
| ----------------- | ------- | --------------------------- | --------------------------------------------------- |
| `websiteUrl`      | string  | **yes**                     | URL of the target website                           |
| `installVerified` | boolean | no                          | Set to `true` after verification succeeds           |
| `scriptUrl`       | string  | no                          | Generated by backend after `websiteUrl` is provided |

**Related webchat endpoints:**

- `POST /webchat/:webchatConfigId/install-script` — generate embed script
- `POST /webchat/:webchatConfigId/verify` — verify installation
- `POST /webchat/:webchatConfigId/send-instructions` — email install instructions

---

#### Step 1 — `slg-consent-flow`

Configure how users give marketing consent.

```json
{
  "method": "popup",
  "popupConfigId": 7,
  "scriptUrl": "https://cdn.unifiedbeez.com/consent/popup.js"
}
```

| Field           | Type   | Required to be "configured" | Values                                 |
| --------------- | ------ | --------------------------- | -------------------------------------- |
| `method`        | string | **yes**                     | `"popup"` \| `"banner"` \| `"in_chat"` |
| `popupConfigId` | number | no                          | ID of a saved popup config             |
| `scriptUrl`     | string | no                          | Generated embed script                 |

---

#### Step 2 — `slg-select-channels`

Which connected channels should receive leads.

```json
{
  "channelAccounts": [
    {
      "connectedChannelId": 3,
      "accountType": "WHATSAPP",
      "accountId": "15551234567"
    }
  ]
}
```

| Field             | Type          | Required to be "configured" |
| ----------------- | ------------- | --------------------------- |
| `channelAccounts` | array (min 1) | **yes**                     |

---

#### Step 3 — `slg-form-integration` _(stub)_

Embed an external form.

```json
{
  "embedUrl": "https://forms.example.com/lead",
  "webhookUrl": "https://api.example.com/webhook/form"
}
```

| Field        | Type   | Required to be "configured" |
| ------------ | ------ | --------------------------- |
| `embedUrl`   | string | **yes**                     |
| `webhookUrl` | string | no                          |

---

#### Step 4 — `slg-sender-email`

Which email configuration to use for outbound messages.

```json
{
  "emailConfigId": 5
}
```

| Field           | Type   | Required to be "configured" |
| --------------- | ------ | --------------------------- |
| `emailConfigId` | number | **yes**                     |

---

#### Step 5 — `slg-campaign-list`

Select or create a campaign list for lead segmentation.

```json
{
  "listIds": [1, 2]
}
```

| Field     | Type             | Required to be "configured" |
| --------- | ---------------- | --------------------------- |
| `listIds` | number[] (min 1) | **yes**                     |

See [Campaign List Management](#campaign-list-management) below.

---

#### Step 6 — `slg-beebot-handler`

Which AI assistant handles incoming leads.

```json
{
  "aiAssistantId": 9
}
```

| Field           | Type   | Required to be "configured" |
| --------------- | ------ | --------------------------- |
| `aiAssistantId` | number | **yes**                     |

---

#### Step 7 — `slg-crm-tags`

Tags/keywords to apply to captured leads.

```json
{
  "tagIds": [3, 7],
  "customTags": ["vip", "webinar-attendee"]
}
```

| Field        | Type     | Required to be "configured" |
| ------------ | -------- | --------------------------- |
| `tagIds`     | number[] | **yes** (min 1)             |
| `customTags` | string[] | no                          |

---

#### Step 8 — `slg-tag-notifications`

Who gets notified and how when a tag is applied.

```json
{
  "notifications": [
    {
      "tagId": 3,
      "channels": ["email", "whatsapp"],
      "immediately": true,
      "customDelay": null,
      "timeOfDay": null,
      "teamMemberIds": [1, 4]
    }
  ]
}
```

| Field           | Type          | Required to be "configured" |
| --------------- | ------------- | --------------------------- |
| `notifications` | array (min 1) | **yes**                     |

Each notification object:

| Field           | Type           | Notes                                   |
| --------------- | -------------- | --------------------------------------- |
| `tagId`         | number         | Tag this notification applies to        |
| `channels`      | string[]       | `"email"` \| `"whatsapp"` \| `"sms"`    |
| `immediately`   | boolean        | Fire immediately when tag is applied    |
| `customDelay`   | number \| null | Minutes to delay (if not `immediately`) |
| `timeOfDay`     | string \| null | HH:MM time constraint                   |
| `teamMemberIds` | number[]       | Which team members to notify            |

---

#### Step 9 — `slg-outreach-email`

Which email template to send for outreach.

```json
{
  "emailTemplateId": 14
}
```

| Field             | Type   | Required to be "configured" |
| ----------------- | ------ | --------------------------- |
| `emailTemplateId` | number | **yes**                     |

---

### SUPPORT_ESCALATION (4 steps)

| stepIndex | stepKey               | Human name                |
| --------- | --------------------- | ------------------------- |
| 0         | `se-select-channels`  | Select Connected Channels |
| 1         | `se-select-faqs`      | Select FAQ Category       |
| 2         | `se-faq-config`       | FAQ Configuration         |
| 3         | `se-campaign-preview` | Campaign Preview          |

#### Step 0 — `se-select-channels`

Same config shape as [`slg-select-channels`](#step-2--slg-select-channels).

#### Step 1 — `se-select-faqs`

Which FAQs to include. Fetch the user's FAQs from `GET /faq` and pass their IDs here.

```json
{
  "faqIds": [10, 11, 12],
  "categoryIds": [2]
}
```

| Field         | Type     | Required to be "configured" |
| ------------- | -------- | --------------------------- |
| `faqIds`      | number[] | **yes** (min 1)             |
| `categoryIds` | number[] | no                          |

#### Step 2 — `se-faq-config`

Screen-navigation step — no backend payload. Mark as done once the user has completed the FAQ configuration screen.

```json
{ "completed": true }
```

| Field       | Type    | Required to be "configured" |
| ----------- | ------- | --------------------------- |
| `completed` | boolean | **yes**                     |

#### Step 3 — `se-campaign-preview`

Screen-navigation step — no backend payload. Mark as done once the user has reviewed the campaign preview screen.

```json
{ "completed": true }
```

| Field       | Type    | Required to be "configured" |
| ----------- | ------- | --------------------------- |
| `completed` | boolean | **yes**                     |

---

### RETENTION_NURTURE (3 steps)

| stepIndex | stepKey              | Human name                |
| --------- | -------------------- | ------------------------- |
| 0         | `rn-create-campaign` | Create Campaign           |
| 1         | `rn-campaign-config` | Campaign Configuration    |
| 2         | `rn-outreach-email`  | Build Your Outreach Email |

#### Step 0 — `rn-create-campaign`

```json
{
  "tagIds": [5, 6],
  "faqIds": [20],
  "campaignName": "Retention Q2"
}
```

| Field          | Type     | Required to be "configured" |
| -------------- | -------- | --------------------------- |
| `tagIds`       | number[] | **yes** (min 1)             |
| `faqIds`       | number[] | no                          |
| `campaignName` | string   | no                          |

#### Step 1 — `rn-campaign-config`

```json
{
  "isActive": true,
  "leadSourceChannelId": 3,
  "status": "warm"
}
```

| Field                 | Type    | Required to be "configured" | Values                                           |
| --------------------- | ------- | --------------------------- | ------------------------------------------------ |
| `leadSourceChannelId` | number  | **yes**                     | ID of a `ConnectedChannel`                       |
| `isActive`            | boolean | no                          | Defaults to `true`                               |
| `status`              | string  | no                          | `"cold"` \| `"warm"` \| `"hot"` \| `"qualified"` |

#### Step 2 — `rn-outreach-email`

Same config shape as [`slg-outreach-email`](#step-9--slg-outreach-email).

---

### REENGAGEMENT_CAMPAIGNS (0 predefined steps)

Blank slate — no predefined steps. Add steps freely via `POST /automations/:id/steps`.

---

## Campaign List Management

Campaign lists are segmentation lists. When an SLG automation fires, any lead that triggers it is automatically enrolled in every campaign list configured in that automation's Campaign List step.

### Create a campaign list

```
POST /campaign-lists
```

```json
{
  "name": "Q1 Leads",
  "description": "All leads captured in Q1",
  "listUrl": "https://example.com/lists/q1"
}
```

| Field         | Type   | Required | Notes                |
| ------------- | ------ | -------- | -------------------- |
| `name`        | string | **yes**  |                      |
| `description` | string | no       |                      |
| `listUrl`     | string | no       | Validated URL format |

### List campaign lists

```
GET /campaign-lists
```

Each list in the response includes a `configuredInAutomations` array — the automations that reference this list in their Campaign List step. This is read-only and derived at query time.

```json
[
  {
    "id": 1,
    "name": "Q1 Leads",
    "description": "All leads captured in Q1",
    "listUrl": "https://example.com/lists/q1",
    "configuredInAutomations": [{ "id": 45, "name": "Main SLG Flow" }],
    "createdAt": "2026-02-27T00:00:00.000Z",
    "updatedAt": "2026-02-27T00:00:00.000Z"
  }
]
```

### Get campaign list members

```
GET /campaign-lists/:id/members
```

Returns all leads enrolled in the list, ordered by most recently enrolled first.

```json
[
  {
    "id": 7,
    "enrolledAt": "2026-02-27T10:00:00.000Z",
    "source": "automation",
    "lead": {
      "id": 101,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "source": "form",
      "createdAt": "2026-02-20T08:00:00.000Z"
    }
  }
]
```

### Update / Delete

```
PATCH /campaign-lists/:id
DELETE /campaign-lists/:id
```

---

## Full Frontend Flow

```
1. GET /automations/categories
       │  ← display 4 category cards with their predefined steps
       ▼
2. User picks a category, enters a name

3. POST /automations { name, automationCategory }
       │  ← backend creates automation + N predefined steps
       ▼
4. GET /automations/:id
       │  ← all steps have completionStatus: "pending", config: {}
       ▼
5. User opens each step's config drawer

6. PATCH /automations/:id/steps/:stepId { config: { ... } }
       │  ← repeat for each step
       ▼
7. All steps completionStatus: "configured"
       │
       ▼
8. PATCH /automations/:id/status { status: "ACTIVE" }
```

---

## Webchat Install Flow (SLG Step 0)

### Generate install script

```
POST /webchat/:webchatConfigId/install-script
```

```json
{ "websiteUrl": "https://example.com" }
```

**Response**

```json
{
  "scriptUrl": "https://cdn.unifiedbeez.com/widget/abc123.js",
  "embedCode": "<script src=\"https://cdn.unifiedbeez.com/widget/abc123.js\"></script>"
}
```

After success, update the step config: `PATCH /automations/:id/steps/:stepId { config: { scriptUrl: "..." } }`.

### Verify installation

```
POST /webchat/:webchatConfigId/verify
```

**Response**

```json
{
  "verified": true,
  "message": "BeeBot script detected on https://example.com"
}
```

On success: `PATCH /automations/:id/steps/:stepId { config: { installVerified: true } }`.

### Send install instructions by email

```
POST /webchat/:webchatConfigId/send-instructions
```

```json
{ "recipientEmail": "dev@example.com" }
```

---

## Error Responses

| Status | Scenario                                                |
| ------ | ------------------------------------------------------- |
| `400`  | Missing `name` or `automationCategory`                  |
| `404`  | Automation or step not found or belongs to another user |

---

## TypeScript Reference

```typescript
type AutomationTemplateCategory =
  | "SALES_LEAD_GENERATION"
  | "SUPPORT_ESCALATION"
  | "RETENTION_NURTURE"
  | "REENGAGEMENT_CAMPAIGNS";

interface CategoryDefinition {
  category: AutomationTemplateCategory;
  key: string; // kebab-case slug
  label: string;
  steps: CategoryStepDefinition[];
}

interface CategoryStepDefinition {
  stepIndex: number;
  type: "auto";
  stepKey: string;
  label: string;
  required: true;
  locked: true;
  isDefault: true;
  completionStatus: "pending";
  config: Record<string, never>; // always empty in category definition
}

interface CampaignListResponse {
  id: number;
  name: string;
  description?: string;
  listUrl?: string;
  configuredInAutomations: { id: number; name: string }[];
  createdAt: string;
  updatedAt: string;
}
```

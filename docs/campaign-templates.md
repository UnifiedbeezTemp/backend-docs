# Campaign Templates — Frontend Integration Guide

Campaign templates are reusable configuration blueprints for automation workflows. A user configures a template step-by-step, then uses it to spawn one or more automations pre-populated with those steps.

---

## Overview

| Category | Enum Value | API slug | Pre-populated steps |
|---|---|---|---|
| Sales & Lead Generation | `SALES_LEAD_GENERATION` | `sales-and-lead-generation` | 11 |
| Support Escalation | `SUPPORT_ESCALATION` | `support-escalation` | 2 |
| Retention & Nurture | `RETENTION_NURTURE` | `retention-nurture` | 3 |
| Reengagement Campaigns | `REENGAGEMENT_CAMPAIGNS` | `reengagement-campaigns` | 0 — **no template layer** |

> **Reengagement automations are created directly** (not from a template). Use `POST /campaign-templates/reengagement/automation`.

---

## Authentication

All endpoints require a valid session cookie / JWT bearer token.

```
Authorization: Bearer <token>
```

---

## Template CRUD

### Create a template

```
POST /campaign-templates
```

**Request body**

```json
{
  "name": "Q1 Lead Gen Campaign",
  "description": "Optional description",
  "category": "SALES_LEAD_GENERATION"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `description` | string | no | |
| `category` | `AutomationTemplateCategory` | yes | One of the four enum values |

**Response `201`**

```json
{
  "id": 12,
  "name": "Q1 Lead Gen Campaign",
  "description": "Optional description",
  "category": "SALES_LEAD_GENERATION",
  "isActive": true,
  "stepConfigs": [
    { "id": 101, "stepIndex": 0, "stepType": "SLG_WEBCHAT_INSTALL", "config": {}, "createdAt": "...", "updatedAt": "..." },
    { "id": 102, "stepIndex": 1, "stepType": "SLG_CONSENT_FLOW",    "config": {}, "createdAt": "...", "updatedAt": "..." },
    ...
  ],
  "createdAt": "2026-02-25T10:00:00.000Z",
  "updatedAt": "2026-02-25T10:00:00.000Z"
}
```

Upon creation, all steps for the chosen category are automatically created with **empty `config: {}`**. The user must fill each step using the update-step endpoint.

---

### List templates

```
GET /campaign-templates
GET /campaign-templates?category=SALES_LEAD_GENERATION
```

| Query param | Type | Required | Notes |
|---|---|---|---|
| `category` | `AutomationTemplateCategory` | no | Filter by category |

**Response `200`** — array of `CampaignTemplateResponseDto` (same shape as create response, always includes `stepConfigs`).

---

### Get a single template

```
GET /campaign-templates/:id
```

Returns the full template with all step configs ordered by `stepIndex` ascending.

---

### Update template metadata

```
PATCH /campaign-templates/:id
```

**Request body** (all fields optional)

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "isActive": false
}
```

Returns the updated template with step configs.

---

### Delete a template

```
DELETE /campaign-templates/:id
```

**Returns `400`** if any automations were created from this template. Delete or unlink those automations first.

```json
{ "message": "Campaign template deleted successfully" }
```

---

## Step Configuration

Each template has `N` pre-populated steps. Steps are identified by their **0-based `stepIndex`**. Step configs are automatically created (empty) when the template is created; use the update endpoint to fill them.

### Get all step configs

```
GET /campaign-templates/:id/steps
```

Returns array of `StepConfigResponseDto` ordered by `stepIndex`.

### Update a single step config

```
PATCH /campaign-templates/:id/steps/:stepIndex
```

**Request body**

```json
{
  "stepType": "SLG_WEBCHAT_INSTALL",
  "config": {
    "websiteUrl": "https://example.com",
    "installVerified": true
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `stepType` | `TemplateStepType` | yes | Must match the expected type for this index |
| `config` | `Record<string, any>` | no | Step-specific payload (see per-step specs below) |

**Response `200`** — `StepConfigResponseDto`

```json
{
  "id": 101,
  "stepIndex": 0,
  "stepType": "SLG_WEBCHAT_INSTALL",
  "config": {
    "websiteUrl": "https://example.com",
    "installVerified": true
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## Creating an Automation from a Template

```
POST /campaign-templates/:id/automation
```

**Request body**

```json
{
  "name": "My SLG Automation",
  "description": "Optional"
}
```

This creates a new `Automation` record with:
- `templateCategory` set to the template's category
- `campaignTemplateId` linking back to the template
- One `AutomationStep` per step config, with `isTemplatePrefilled: true`
- Steps are locked in order — their position within the pre-filled block cannot change
- Additional steps can be appended after the pre-filled ones

**Response `201`** — the new automation object (raw Prisma shape, not the `{ logic, layout }` contract). Use `GET /automations/:id` to get the full response transformer output.

```json
{
  "id": 45,
  "name": "My SLG Automation",
  "templateCategory": "SALES_LEAD_GENERATION",
  "campaignTemplateId": 12,
  "status": "DRAFT",
  "steps": [
    { "id": 200, "stepOrder": 0, "stepType": "SLG_WEBCHAT_INSTALL", "name": "Add BeeBot to Your Website", "isTemplatePrefilled": true, ... },
    { "id": 201, "stepOrder": 1, "stepType": "SLG_CONSENT_FLOW",    "name": "Smart Consent Flow",         "isTemplatePrefilled": true, ... },
    ...
  ]
}
```

---

## Creating a Reengagement Automation

Reengagement has no template layer. Create a blank automation directly:

```
POST /campaign-templates/reengagement/automation
```

**Request body**

```json
{
  "name": "Win-back Campaign",
  "description": "Optional"
}
```

**Response** — automation with `templateCategory: "REENGAGEMENT_CAMPAIGNS"` and 0 steps.

---

## Step-by-Step Config Reference

### SALES_LEAD_GENERATION (11 steps)

| stepIndex | stepType | Human name |
|---|---|---|
| 0 | `SLG_WEBCHAT_INSTALL` | Add BeeBot to Your Website |
| 1 | `SLG_CONSENT_FLOW` | Smart Consent Flow |
| 2 | `SLG_SELECT_CHANNELS` | Select Connected Channels |
| 3 | `SLG_SELECT_FAQS` | Select FAQ Category |
| 4 | `SLG_FORM_INTEGRATION` | Integrate Your Form |
| 5 | `SLG_SENDER_EMAIL` | Configure Sender Email |
| 6 | `SLG_CAMPAIGN_LIST` | Create Campaign List |
| 7 | `SLG_BEEBOT_HANDLER` | Select BeeBot Handler |
| 8 | `SLG_CRM_TAGS` | CRM Tags / Keywords |
| 9 | `SLG_TAG_NOTIFICATIONS` | CRM Tag Notification Settings |
| 10 | `SLG_OUTREACH_EMAIL` | Build Your Outreach Email |

---

#### Step 0 — `SLG_WEBCHAT_INSTALL`

Install BeeBot widget on the user's website.

```json
{
  "websiteUrl": "https://example.com",
  "installVerified": false,
  "scriptUrl": "https://cdn.unifiedbeez.com/widget/abc123.js"
}
```

| Field | Type | Required to be "configured" | Notes |
|---|---|---|---|
| `websiteUrl` | string | **yes** | URL of the target website |
| `installVerified` | boolean | no | Set to `true` after verification succeeds |
| `scriptUrl` | string | no | Generated by the backend after `websiteUrl` is provided |

**Related endpoints (webchat module):**

- `POST /webchat/:webchatConfigId/install-script` — generate embed script for a URL
- `POST /webchat/:webchatConfigId/verify` — verify installation
- `POST /webchat/:webchatConfigId/send-instructions` — email install instructions

---

#### Step 1 — `SLG_CONSENT_FLOW`

Configure how users give marketing consent.

```json
{
  "method": "popup",
  "popupConfigId": 7,
  "scriptUrl": "https://cdn.unifiedbeez.com/consent/popup.js"
}
```

| Field | Type | Required to be "configured" | Values |
|---|---|---|---|
| `method` | string | **yes** | `"popup"` \| `"banner"` \| `"in_chat"` |
| `popupConfigId` | number | no | ID of a saved popup config |
| `scriptUrl` | string | no | Generated embed script |

---

#### Step 2 — `SLG_SELECT_CHANNELS`

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

| Field | Type | Required to be "configured" |
|---|---|---|
| `channelAccounts` | array (min 1) | **yes** |

Each item:

| Field | Type | Notes |
|---|---|---|
| `connectedChannelId` | number | ID from `ConnectedChannel` |
| `accountType` | string | Channel type identifier |
| `accountId` | string | Account identifier within that channel |

---

#### Step 3 — `SLG_SELECT_FAQS`

Which FAQ categories are associated with this campaign.

```json
{
  "faqIds": [10, 11, 12],
  "categoryIds": [2]
}
```

| Field | Type | Required to be "configured" |
|---|---|---|
| `faqIds` | number[] | **yes** (min 1) |
| `categoryIds` | number[] | no |

---

#### Step 4 — `SLG_FORM_INTEGRATION` *(stub)*

Embed an external form.

```json
{
  "embedUrl": "https://forms.example.com/lead",
  "webhookUrl": "https://api.example.com/webhook/form"
}
```

| Field | Type | Required to be "configured" |
|---|---|---|
| `embedUrl` | string | **yes** |
| `webhookUrl` | string | no |

> This step is a stub — full implementation is pending.

---

#### Step 5 — `SLG_SENDER_EMAIL`

Which email configuration to use for outbound messages.

```json
{
  "emailConfigId": 5
}
```

| Field | Type | Required to be "configured" |
|---|---|---|
| `emailConfigId` | number | **yes** |

---

#### Step 6 — `SLG_CAMPAIGN_LIST`

Select or create a campaign list for lead segmentation.

```json
{
  "listIds": [1, 2]
}
```

| Field | Type | Required to be "configured" |
|---|---|---|
| `listIds` | number[] (min 1) | **yes** |

See [Campaign List Management](#campaign-list-management) below for how to create/manage lists.

---

#### Step 7 — `SLG_BEEBOT_HANDLER`

Which AI assistant handles incoming leads.

```json
{
  "aiAssistantId": 9
}
```

| Field | Type | Required to be "configured" |
|---|---|---|
| `aiAssistantId` | number | **yes** |

---

#### Step 8 — `SLG_CRM_TAGS`

Tags/keywords to apply to captured leads.

```json
{
  "tagIds": [3, 7],
  "customTags": ["vip", "webinar-attendee"]
}
```

| Field | Type | Required to be "configured" |
|---|---|---|
| `tagIds` | number[] | **yes** (min 1) |
| `customTags` | string[] | no |

---

#### Step 9 — `SLG_TAG_NOTIFICATIONS`

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

| Field | Type | Required to be "configured" |
|---|---|---|
| `notifications` | array (min 1) | **yes** |

Each notification object:

| Field | Type | Notes |
|---|---|---|
| `tagId` | number | Tag this notification applies to |
| `channels` | string[] | `"email"` \| `"whatsapp"` \| `"sms"` \| `"push"` *(push = TODO)* |
| `immediately` | boolean | Fire immediately when tag is applied |
| `customDelay` | number \| null | Minutes to delay (if not `immediately`) |
| `timeOfDay` | string \| null | HH:MM time constraint |
| `teamMemberIds` | number[] | Which team members to notify |

---

#### Step 10 — `SLG_OUTREACH_EMAIL`

Which email template to send for outreach.

```json
{
  "emailTemplateId": 14
}
```

| Field | Type | Required to be "configured" |
|---|---|---|
| `emailTemplateId` | number | **yes** |

---

### SUPPORT_ESCALATION (2 steps)

| stepIndex | stepType | Human name |
|---|---|---|
| 0 | `SE_SELECT_CHANNELS` | Select Connected Channels |
| 1 | `SE_SELECT_FAQS` | Select FAQ Category |

#### Step 0 — `SE_SELECT_CHANNELS`

Same config shape as [`SLG_SELECT_CHANNELS`](#step-2--slg_select_channels).

#### Step 1 — `SE_SELECT_FAQS`

Same config shape as [`SLG_SELECT_FAQS`](#step-3--slg_select_faqs).

---

### RETENTION_NURTURE (3 steps)

| stepIndex | stepType | Human name |
|---|---|---|
| 0 | `RN_CREATE_CAMPAIGN` | Create Campaign |
| 1 | `RN_CAMPAIGN_CONFIG` | Campaign Configuration |
| 2 | `RN_OUTREACH_EMAIL` | Build Your Outreach Email |

#### Step 0 — `RN_CREATE_CAMPAIGN`

Define the campaign's associated tags and FAQs.

```json
{
  "tagIds": [5, 6],
  "faqIds": [20],
  "campaignName": "Retention Q2"
}
```

| Field | Type | Required to be "configured" |
|---|---|---|
| `tagIds` | number[] | **yes** (min 1) |
| `faqIds` | number[] | no |
| `campaignName` | string | no |

---

#### Step 1 — `RN_CAMPAIGN_CONFIG`

Configure the campaign's source channel and lead status filter.

```json
{
  "isActive": true,
  "leadSourceChannelId": 3,
  "status": "warm"
}
```

| Field | Type | Required to be "configured" | Values |
|---|---|---|---|
| `leadSourceChannelId` | number | **yes** | ID of a `ConnectedChannel` |
| `isActive` | boolean | no | Defaults to `true` |
| `status` | string | no | `"cold"` \| `"warm"` \| `"hot"` \| `"qualified"` |

---

#### Step 2 — `RN_OUTREACH_EMAIL`

Same config shape as [`SLG_OUTREACH_EMAIL`](#step-10--slg_outreach_email).

---

## Campaign List Management

Campaign lists are simple segmentation lists that can be linked to either a template or an automation.

### Create a campaign list

```
POST /campaign-lists
```

```json
{
  "name": "Q1 Leads",
  "description": "All leads captured in Q1",
  "listUrl": "https://example.com/lists/q1",
  "marketingChannelId": 2,
  "campaignTemplateId": 12
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | **yes** | |
| `description` | string | no | |
| `listUrl` | string | no | External list URL |
| `marketingChannelId` | number | no | Connected channel used for this list |
| `campaignTemplateId` | number | no | Link to a template |
| `automationId` | number | no | Link to an automation (mutually exclusive with templateId at the logical level) |

**Response `201`**

```json
{
  "id": 8,
  "name": "Q1 Leads",
  "description": "All leads captured in Q1",
  "listUrl": "https://example.com/lists/q1",
  "marketingChannelId": 2,
  "campaignTemplateId": 12,
  "automationId": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### List campaign lists

```
GET /campaign-lists
GET /campaign-lists?campaignTemplateId=12
GET /campaign-lists?automationId=45
```

### Update a campaign list

```
PATCH /campaign-lists/:id
```

Body follows the same shape as create (all fields optional).

### Delete a campaign list

```
DELETE /campaign-lists/:id
```

---

## Webchat Install Flow (SLG Step 0)

These endpoints assist with configuring step 0 (`SLG_WEBCHAT_INSTALL`).

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

### Verify installation

```
POST /webchat/:webchatConfigId/verify
```

No body required.

**Response**

```json
{
  "verified": true,
  "message": "BeeBot script detected on https://example.com"
}
```

On success, update the template step config `installVerified: true`.

### Send install instructions by email

```
POST /webchat/:webchatConfigId/send-instructions
```

```json
{ "recipientEmail": "dev@example.com" }
```

**Response**

```json
{ "message": "Install instructions sent to dev@example.com" }
```

---

## Template Lifecycle

```
Create template (empty config)
       │
       ▼
Configure each step (PATCH /steps/:stepIndex)
       │
       ▼
Create automation from template (POST /:id/automation)
       │
       ▼
Automation is DRAFT with isTemplatePrefilled steps
       │
       ├── User can edit each step's config within the automation
       ├── User cannot insert steps between pre-filled steps
       └── User can append new steps after all pre-filled steps
```

---

## Error Responses

| Status | Scenario |
|---|---|
| `400` | Missing required field / template has automations (on delete) |
| `404` | Template not found or belongs to another user |

---

## TypeScript Reference

```typescript
// Category enum
type AutomationTemplateCategory =
  | "SALES_LEAD_GENERATION"
  | "SUPPORT_ESCALATION"
  | "RETENTION_NURTURE"
  | "REENGAGEMENT_CAMPAIGNS";

// Template step type enum
type TemplateStepType =
  | "SLG_WEBCHAT_INSTALL"
  | "SLG_CONSENT_FLOW"
  | "SLG_SELECT_CHANNELS"
  | "SLG_SELECT_FAQS"
  | "SLG_FORM_INTEGRATION"
  | "SLG_SENDER_EMAIL"
  | "SLG_CAMPAIGN_LIST"
  | "SLG_BEEBOT_HANDLER"
  | "SLG_CRM_TAGS"
  | "SLG_TAG_NOTIFICATIONS"
  | "SLG_OUTREACH_EMAIL"
  | "SE_SELECT_CHANNELS"
  | "SE_SELECT_FAQS"
  | "RN_CREATE_CAMPAIGN"
  | "RN_CAMPAIGN_CONFIG"
  | "RN_OUTREACH_EMAIL";

interface StepConfigResponse {
  id: number;
  stepIndex: number;           // 0-based position
  stepType: TemplateStepType;
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface CampaignTemplateResponse {
  id: number;
  name: string;
  description?: string;
  category: AutomationTemplateCategory;
  isActive: boolean;
  stepConfigs?: StepConfigResponse[];
  createdAt: string;
  updatedAt: string;
}

interface CampaignListResponse {
  id: number;
  name: string;
  description?: string;
  listUrl?: string;
  marketingChannelId?: number;
  campaignTemplateId?: number;
  automationId?: number;
  createdAt: string;
  updatedAt: string;
}
```

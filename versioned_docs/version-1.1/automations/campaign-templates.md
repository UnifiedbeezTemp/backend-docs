# Automation Categories — Frontend Integration Guide

> **Architecture note:** The campaign template layer has been removed. The 4 automation categories are now fixed system definitions — not user-created objects. The frontend GETs the static category definitions and POSTs directly to create an automation. Steps are auto-populated by the backend.

---

## Overview

| Category                | Enum value               | `key` slug                  | Pre-populated steps                                                               |
| ----------------------- | ------------------------ | --------------------------- | --------------------------------------------------------------------------------- |
| Sales & Lead Generation | `SALES_LEAD_GENERATION`  | `sales-and-lead-generation` | 10                                                                                |
| Support Escalation      | `SUPPORT_ESCALATION`     | `support-escalation`        | 4                                                                                 |
| Retention & Nurture     | `RETENTION_NURTURE`      | `retention-nurture`         | 3                                                                                 |
| Reengagement Campaigns  | `REENGAGEMENT_CAMPAIGNS` | `reengagement-campaigns`    | 0 — steps come from template blueprint via `POST /automation-templates/:id/apply` |

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
  "steps": []
}
```

| Field                | Required | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`               | **yes**  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `automationCategory` | **yes**  | One of the 4 enum values                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `description`        | no       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `campaignListId`     | no       | For `REENGAGEMENT_CAMPAIGNS` only — scopes the trigger to contacts on this list                                                                                                                                                                                                                                                                                                                                                                                        |
| `startType`          | no       | `"TRIGGER_BASED"` (default) or `"ACTION_BASED"`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `triggers`           | no       | Legacy — max 1. Prefer using steps with `triggerType` instead.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `steps`              | no       | Unified steps array. Accepts both the canonical request shape (`clientId`, `stepOrder`, `stepType`, `name`) and the response shape from GET (round-trip: `id`, `order`, `stepKey`, `label`, `config`, etc.). Steps with `triggerType` (or `type: "trigger"`) are extracted as triggers. Regular steps are appended after predefined ones (SLG/SE/RN) or used directly (REENGAGEMENT). See [automations.md](automations.md#create-automation) for full alias reference. |

**Response `201`** — full automation object, same shape as `GET /automations/:id`. No follow-up fetch needed.

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

### REENGAGEMENT_CAMPAIGNS (template-provided steps)

No system-predefined steps. Instead, use `POST /automation-templates/:id/apply` to create an automation pre-populated with a template's steps and trigger. All steps created this way are fully editable — nothing is locked or required.

Alternatively, create a blank automation via `POST /automations` and add steps freely via `POST /automations/:id/steps`.

See [Automation Templates](#automation-templates-reengagement--campaigns) below for the full apply flow.

---

## Automation Templates (Reengagement & Campaigns)

> **Concept:** Automation templates are actual automation blueprints available exclusively for the `REENGAGEMENT_CAMPAIGNS` category. Each template ships with pre-configured triggers and a full step DAG (WAIT, SEND_MESSAGE, SMART_RULE, TAG_ACTION, etc.). When a user picks a template, a single API call creates a new `REENGAGEMENT_CAMPAIGNS` automation with all steps and triggers already in place — fully editable, nothing locked.

### How templates differ from the other 3 categories

|                        | SLG / SE / RN               | REENGAGEMENT_CAMPAIGNS templates               |
| ---------------------- | --------------------------- | ---------------------------------------------- |
| Steps predefined?      | Yes — fixed wizard steps    | Yes — but copied from template, fully editable |
| Steps locked/required? | Yes                         | No — can be deleted, reordered, or replaced    |
| Step creation          | Auto on `POST /automations` | On `POST /automation-templates/:id/apply`      |
| Triggers predefined?   | No                          | Yes — pre-configured, editable afterward       |

---

### List templates

```
GET /automation-templates?category=REENGAGEMENT_CAMPAIGNS
```

No authentication required for listing.

**Response `200`**

```json
[
  {
    "id": 1,
    "heading": "Win-back Inactive Contacts",
    "text": "Re-engage contacts who have gone quiet. Sends a personalized email after a period of inactivity, then follows up via WhatsApp if there is no response.",
    "iconUrl": null,
    "category": "REENGAGEMENT_CAMPAIGNS",
    "isActive": true,
    "defaultTriggers": [
      {
        "triggerType": "ACTIVITY_THRESHOLD",
        "name": "Contact inactive for 30 days",
        "conditions": [
          { "conditionOrder": 0, "operator": "GREATER_THAN", "value": "30" }
        ]
      }
    ],
    "defaultSteps": [
      { "stepIndex": 0, "stepType": "WAIT", "name": "Initial delay", "waitConfig": { "waitDays": 7 }, "nextStepIndex": 1 },
      { "stepIndex": 1, "stepType": "SEND_MESSAGE", "name": "Re-engagement email", "messageConfig": { "messageType": "MARKETING_EMAIL", "customMessage": "Hi {customer.name}, we miss you!" }, "nextStepIndex": 2 },
      { "stepIndex": 2, "stepType": "SMART_RULE", "name": "Did they open the email?", "nextStepIndex": null, "trueNextStepIndex": 3, "falseNextStepIndex": 4 },
      { "stepIndex": 3, "stepType": "TAG_ACTION", "name": "Mark as re-engaged", "config": { "action": "ADD", "tagName": "re-engaged" }, "nextStepIndex": null },
      { "stepIndex": 4, "stepType": "SEND_MESSAGE", "name": "WhatsApp follow-up", "messageConfig": { "messageType": "WHATSAPP", "customMessage": "Hey {customer.name}, we'd love to have you back!" }, "nextStepIndex": null }
    ],
    "createdAt": "2026-03-01T00:00:00.000Z",
    "updatedAt": "2026-03-01T00:00:00.000Z"
  },
  {
    "id": 2,
    "heading": "Post-Purchase Upsell",
    "text": "Strike while the iron is hot. Reach out a few days after purchase with a relevant upsell offer.",
    "iconUrl": null,
    "category": "REENGAGEMENT_CAMPAIGNS",
    "isActive": true,
    "defaultTriggers": [ ... ],
    "defaultSteps": [ ... ],
    "createdAt": "2026-03-01T00:00:00.000Z",
    "updatedAt": "2026-03-01T00:00:00.000Z"
  },
  {
    "id": 3,
    "heading": "Re-subscription Campaign",
    "text": "Win back unsubscribed contacts with a targeted re-engagement sequence.",
    "iconUrl": null,
    "category": "REENGAGEMENT_CAMPAIGNS",
    "isActive": true,
    "defaultTriggers": [ ... ],
    "defaultSteps": [ ... ],
    "createdAt": "2026-03-01T00:00:00.000Z",
    "updatedAt": "2026-03-01T00:00:00.000Z"
  }
]
```

**Response fields:**

| Field             | Type           | Notes                                                                        |
| ----------------- | -------------- | ---------------------------------------------------------------------------- |
| `id`              | number         | Template DB ID                                                               |
| `heading`         | string         | Short title shown as the card heading                                        |
| `text`            | string         | Longer description explaining the template's purpose                         |
| `iconUrl`         | string \| null | Signed URL (2-hour TTL) for the template icon                                |
| `category`        | string         | Always `"REENGAGEMENT_CAMPAIGNS"`                                            |
| `isActive`        | boolean        | Only `true` records are returned in listing                                  |
| `defaultTriggers` | array \| null  | Trigger blueprints — see [Trigger blueprint shape](#trigger-blueprint-shape) |
| `defaultSteps`    | array \| null  | Step blueprints — see [Step blueprint shape](#step-blueprint-shape)          |
| `createdAt`       | string         | ISO 8601                                                                     |
| `updatedAt`       | string         | ISO 8601                                                                     |

---

### Trigger blueprint shape

Each item in `defaultTriggers`:

```json
{
  "triggerType": "ACTIVITY_THRESHOLD",
  "name": "Contact inactive for 30 days",
  "conditions": [
    { "conditionOrder": 0, "operator": "GREATER_THAN", "value": "30" }
  ]
}
```

| Field         | Type   | Notes                                                                            |
| ------------- | ------ | -------------------------------------------------------------------------------- |
| `triggerType` | string | One of the `AutomationTriggerType` enum values (see `GET /automations/metadata`) |
| `name`        | string | Human-readable label                                                             |
| `conditions`  | array  | `conditionOrder`, `operator` (`ConditionOperator`), `value`                      |

---

### Step blueprint shape

Each item in `defaultSteps`:

```json
{
  "stepIndex": 0,
  "stepType": "WAIT",
  "name": "Initial delay",
  "waitConfig": { "waitDays": 7 },
  "nextStepIndex": 1
}
```

Steps reference each other by `stepIndex` (not DB id). When the template is applied, indices are resolved to real DB IDs.

| Field                | Type           | Notes                                                                           |
| -------------------- | -------------- | ------------------------------------------------------------------------------- |
| `stepIndex`          | number         | 0-based position in the blueprint                                               |
| `stepType`           | string         | `WAIT`, `SEND_MESSAGE`, `SMART_RULE`, `TAG_ACTION`, `AUTOMATION_LIST`, etc.     |
| `name`               | string         | Human-readable step name                                                        |
| `nextStepIndex`      | number \| null | Index of the next step (linear flow)                                            |
| `trueNextStepIndex`  | number \| null | `SMART_RULE` only — branch taken when condition is true                         |
| `falseNextStepIndex` | number \| null | `SMART_RULE` only — branch taken when condition is false                        |
| `waitConfig`         | object \| null | `{ waitDays: number }` for WAIT steps                                           |
| `messageConfig`      | object \| null | See [Send-Message step config](automations.md#send-message-step) for full shape |
| `smartRuleConfig`    | object \| null | `{ name, conditions: [...] }` for SMART_RULE steps                              |
| `config`             | object \| null | Generic JSON config for other step types (e.g., TAG_ACTION)                     |

---

### Apply a template — create automation from blueprint

```
POST /automation-templates/:id/apply
```

Requires authentication.

Creates a new `REENGAGEMENT_CAMPAIGNS` automation with all steps and triggers pre-populated from the template. All created steps are fully editable — `isDefault: false`, `locked: false`, `required: false`.

**Request body:**

```json
{
  "name": "My Win-back Campaign",
  "description": "Re-engage contacts inactive for 30+ days",
  "campaignListId": 5
}
```

| Field            | Type   | Required | Notes                                                                                                                     |
| ---------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `name`           | string | **yes**  | Name of the new automation. Trimmed — whitespace-only is rejected.                                                        |
| `description`    | string | no       | Optional description                                                                                                      |
| `campaignListId` | number | no       | ID of the Campaign List that scopes this automation's contact pool. The trigger will only fire for contacts on this list. |

**Response `201`** — full automation object (same `{ logic, layout }` shape as `GET /automations/:id`). The trigger is included both in `logic.trigger` (backward-compat) and as the first entry in `logic.steps` with `type: "trigger"`. See the [Automations response contract](automations.md#response-contract-logic-layout) for the full TypeScript interface.

---

### Get single template

```
GET /automation-templates/:id
```

Returns the same shape as a single item in the list above (including `defaultTriggers` and `defaultSteps`).

---

### Seed default templates (Admin)

Call once to populate the 3 default reengagement templates. Safe to call repeatedly — idempotent.

```
POST /automation-templates/seed-reengagement-defaults
```

Requires authentication.

**Response `201`**

```json
{
  "message": "Reengagement templates seeded successfully",
  "count": 3,
  "templates": [ ... ]
}
```

Or if already seeded:

```json
{
  "message": "Reengagement templates already seeded",
  "count": 3
}
```

---

### Create / update templates (Admin)

```
POST /automation-templates
PATCH /automation-templates/:id
```

Use these to add custom template blueprints or update existing ones. Both require authentication.

**Request body for `POST`:**

```json
{
  "heading": "Custom Template Name",
  "text": "Description of what this automation does and who it is for.",
  "category": "REENGAGEMENT_CAMPAIGNS",
  "iconUrl": "https://cdn.example.com/icon.svg",
  "defaultTriggers": [
    {
      "triggerType": "MAKES_PURCHASE",
      "name": "Contact makes a purchase",
      "conditions": []
    }
  ],
  "defaultSteps": [
    {
      "stepIndex": 0,
      "stepType": "WAIT",
      "name": "Wait 3 days",
      "waitConfig": { "waitDays": 3 },
      "nextStepIndex": 1
    },
    {
      "stepIndex": 1,
      "stepType": "SEND_MESSAGE",
      "name": "Upsell email",
      "messageConfig": {
        "messageType": "MARKETING_EMAIL",
        "customMessage": "Hi {customer.name}, check out our latest offers!"
      },
      "nextStepIndex": null
    }
  ]
}
```

Upload an icon as a file:

```
POST /automation-templates/:id/icon   (multipart/form-data, field: icon)
```

---

### Frontend flow — template selection

```
1. GET /automation-templates?category=REENGAGEMENT_CAMPAIGNS
       │  ← display template cards (heading, text, icon) to user
       ▼
2. User picks a template

3. POST /automation-templates/:id/apply  { name: "My Campaign" }
       │  ← backend creates automation + all steps + trigger in one call
       ▼
4. GET /automations/:id (optional — response from step 3 is the same shape)
       │  ← user can review/edit steps
       ▼
5. User edits steps as desired via:
   POST   /automations/:id/steps           (add new step)
   PATCH  /automations/:id/steps/:stepId   (edit existing step)
   DELETE /automations/:id/steps/:stepId   (remove step)
       ▼
6. PATCH /automations/:id/status { status: "ACTIVE" }
```

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

Returns all leads enrolled in the list, ordered by most recently enrolled first. Each member includes a `leadSource` field indicating how they were enrolled.

| `leadSource` | Meaning                                                   |
| ------------ | --------------------------------------------------------- |
| `AUTOMATION` | Enrolled automatically when captured by an SLG automation |
| `MANUAL`     | Added directly by the user via the contact creation form  |
| `IMPORT`     | Added via bulk upload _(future)_                          |

```json
[
  {
    "id": 7,
    "enrolledAt": "2026-02-27T10:00:00.000Z",
    "source": "automation",
    "leadSource": "AUTOMATION",
    "lead": {
      "id": 101,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "whatsappId": null,
      "facebookMessengerId": null,
      "linkedInId": null,
      "telegramId": null,
      "source": "form",
      "createdAt": "2026-02-20T08:00:00.000Z"
    }
  }
]
```

### Manually add a contact to a list

```
POST /campaign-lists/:id/members
```

Creates a new contact (if one with this email doesn't already exist) and enrolls them in the list with `leadSource: MANUAL`.

**Request body:**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+447911123456",
  "whatsappId": "+447911123456",
  "facebookMessengerId": "1234567890",
  "linkedInId": "jane-doe-1a2b3c",
  "telegramId": "@janedoe",
  "tagIds": [3, 7],
  "notes": "High-value lapsed customer from 2024"
}
```

| Field                 | Required | Notes                                                                                             |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `firstName`           | **yes**  |                                                                                                   |
| `email`               | **yes**  | If a contact with this email already exists in the account, they are enrolled without re-creation |
| `lastName`            | no       |                                                                                                   |
| `phone`               | no       | Include country code                                                                              |
| `whatsappId`          | no       | Used for WhatsApp outreach steps                                                                  |
| `facebookMessengerId` | no       | Used for Messenger outreach steps                                                                 |
| `linkedInId`          | no       | Used for LinkedIn outreach steps                                                                  |
| `telegramId`          | no       | Used for Telegram outreach steps                                                                  |
| `tagIds`              | no       | Array of tag IDs to apply                                                                         |
| `notes`               | no       | Free-text notes                                                                                   |

**Response `201`** — the created `CampaignListMember` record including the `lead` object.

### Remove a contact from a list

```
DELETE /campaign-lists/:id/members/:leadId
```

Removes the contact from the list only — the contact profile itself is not deleted.

**Response `200`:**

```json
{ "message": "Contact removed from list" }
```

### Update / Delete

```
PATCH /campaign-lists/:id
DELETE /campaign-lists/:id
```

> **Note:** A list cannot be deleted while any automation is actively using it as its contact pool. The `DELETE` endpoint will return a `400 Bad Request` naming the automations that must be updated or deactivated first.

---

## Contacts

### Create a contact (standalone)

```
POST /contacts
```

Creates a new contact and optionally enrolls them in one or more Campaign Lists at the same time. This is the bidirectional path — the contact form in the app that includes a list selector.

Returns `409 Conflict` if a contact with the same email already exists in this account.

**Request body:**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "+447911123456",
  "whatsappId": "+447911123456",
  "facebookMessengerId": "1234567890",
  "linkedInId": "jane-doe-1a2b3c",
  "telegramId": "@janedoe",
  "tagIds": [3, 7],
  "notes": "High-value lapsed customer from 2024",
  "campaignListIds": [1, 4]
}
```

| Field                 | Required | Notes                                                                                                                                |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `firstName`           | **yes**  |                                                                                                                                      |
| `email`               | **yes**  | Must be unique within the account — returns 409 if already exists                                                                    |
| `lastName`            | no       |                                                                                                                                      |
| `phone`               | no       | Include country code                                                                                                                 |
| `whatsappId`          | no       | Used for WhatsApp outreach steps                                                                                                     |
| `facebookMessengerId` | no       | Used for Messenger outreach steps                                                                                                    |
| `linkedInId`          | no       | Used for LinkedIn outreach steps                                                                                                     |
| `telegramId`          | no       | Used for Telegram outreach steps                                                                                                     |
| `tagIds`              | no       | Array of tag IDs to apply                                                                                                            |
| `notes`               | no       | Free-text notes                                                                                                                      |
| `campaignListIds`     | no       | Array of Campaign List IDs to enroll the contact in. All IDs must belong to the authenticated user — returns 404 if any are invalid. |

**Response `201`:**

```json
{
  "id": 42,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+447911123456",
  "source": "manual",
  "whatsappId": "+447911123456",
  "facebookMessengerId": "1234567890",
  "linkedInId": "jane-doe-1a2b3c",
  "telegramId": "@janedoe",
  "createdAt": "2026-03-06T10:00:00.000Z",
  "enrolledInLists": [1, 4]
}
```

`enrolledInLists` is the array of Campaign List IDs the contact was successfully enrolled in. Empty array if `campaignListIds` was not provided.

---

## Full Frontend Flow

```
1. GET /automations/categories
       │  ← display 4 category cards with their predefined steps
       ▼
2. User picks a category, enters a name

3. POST /automations { name, automationCategory }
       │  ← response is the full automation with logic.steps already populated
       │    (no follow-up GET needed)
       ▼
4. User opens each step's config drawer

5. PATCH /automations/:id/steps/:stepId { config: { ... } }
       │  ← repeat for each step
       ▼
6. All steps completionStatus: "configured"
       │
       ▼
7. PATCH /automations/:id/status { status: "ACTIVE" }
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

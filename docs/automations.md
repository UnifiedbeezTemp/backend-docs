# Automations — Frontend Integration Guide

This document covers the full automation API: the `{ logic, layout }` response contract, all endpoints, step types, config shapes, status lifecycle, and execution routing.

---

## Response Contract: `{ logic, layout }`

Every `GET /automations` and `GET /automations/:id` response uses this shape:

```typescript
interface AutomationResponse {
  id: number;
  name: string;
  description: string | null;
  category: CategorySlug | null; // kebab-case string, see Category Slugs
  status: AutomationStatus; // "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED"
  logicVersion: string; // e.g. "1.0.0"
  logic: {
    version: string;
    trigger: TriggerNode | null;
    steps: LogicStep[];
  };
  layout: CanvasLayout | null; // opaque JSON, stored as-is
  _count?: { executions: number };
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### `TriggerNode`

```typescript
interface TriggerNode {
  id: string; // stringified trigger DB id
  type: AutomationTriggerType; // backend enum
  stepKey: "trigger";
  label: string;
  conditions: TriggerCondition[];
}
```

### `LogicStep`

```typescript
interface LogicStep {
  id: string; // stringified step DB id
  type: "action" | "condition" | "auto"; // semantic role — see Step Type Roles
  stepKey: string; // kebab-case routing key (see Step Key Reference)
  label: string; // human-readable name
  order: number; // stepOrder from DB (0-based for predefined steps)
  config: Record<string, any>; // flattened step config (see per-step shapes)
  nextStepIds: string[]; // computed for linear categories; explicit for REENGAGEMENT
  completionStatus: "pending" | "configured"; // "error" is client-side only
  isDefault: boolean; // true = auto-created by backend (predefined step)
  locked: boolean; // true = step order is fixed (same as isDefault)
  required: boolean; // true = step cannot be removed (same as isDefault)
}
```

### `CanvasLayout`

An opaque JSON blob owned by the frontend. The backend stores and returns it without modification.

```typescript
interface CanvasLayout {
  viewport?: { x: number; y: number; zoom: number };
  nodes?: Record<string, { x: number; y: number }>;
  groups?: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >;
  links?: Record<string, { style?: Record<string, any> }>;
  [key: string]: any;
}
```

---

## Step Type Roles

The `type` field classifies each step's semantic role:

| `type`        | Applies to                                                               |
| ------------- | ------------------------------------------------------------------------ |
| `"action"`    | `SEND_MESSAGE`, `WAIT`, `AUTOMATION_LIST`, `TAG_ACTION`, `STATUS_CHANGE` |
| `"condition"` | `SMART_RULE`, `TRIGGER_CONDITION`                                        |
| `"auto"`      | All predefined template steps: `SLG_*`, `SE_*`, `RN_*`                   |

---

## Automation Status Lifecycle

```
DRAFT ──activate──► ACTIVE ──pause──► PAUSED
  ▲                    │                 │
  │                    └──archive──►  ARCHIVED
  │                                     │
  └─────────────── (unarchive) ─────────┘
```

| Status     | Meaning                                 | Executions triggered? |
| ---------- | --------------------------------------- | --------------------- |
| `DRAFT`    | Being configured, not yet live          | No                    |
| `ACTIVE`   | Live — triggers fire and executions run | Yes                   |
| `PAUSED`   | Temporarily suspended                   | No                    |
| `ARCHIVED` | Retired — no longer runs                | No                    |

Change status via `PATCH /automations/:id/status`.

---

## Category Slugs

The `category` field in responses uses kebab-case strings:

| DB enum                  | Response value                |
| ------------------------ | ----------------------------- |
| `SALES_LEAD_GENERATION`  | `"sales-and-lead-generation"` |
| `SUPPORT_ESCALATION`     | `"support-escalation"`        |
| `RETENTION_NURTURE`      | `"retention-nurture"`         |
| `REENGAGEMENT_CAMPAIGNS` | `"reengagement-campaigns"`    |
| _(none set)_             | `null`                        |

---

## Step Key Reference

Use `stepKey` to route to the correct configuration drawer or component in the UI.

### Core step types (`type: "action"` or `type: "condition"`)

| `stepKey`           | DB enum             | `type`      | Purpose                           |
| ------------------- | ------------------- | ----------- | --------------------------------- |
| `send-message`      | `SEND_MESSAGE`      | `action`    | Send email / WhatsApp / SMS       |
| `wait`              | `WAIT`              | `action`    | Delay execution                   |
| `automation-list`   | `AUTOMATION_LIST`   | `action`    | Add/remove/move contact in a list |
| `tag-action`        | `TAG_ACTION`        | `action`    | Apply or remove a tag             |
| `status-change`     | `STATUS_CHANGE`     | `action`    | Update lead status                |
| `smart-rule`        | `SMART_RULE`        | `condition` | Conditional branch                |
| `trigger-condition` | `TRIGGER_CONDITION` | `condition` | Inline trigger check              |

### Sales & Lead Generation predefined steps (`type: "auto"`)

| `stepKey`               | DB enum                 | Human name                    |
| ----------------------- | ----------------------- | ----------------------------- |
| `slg-webchat-install`   | `SLG_WEBCHAT_INSTALL`   | Add BeeBot to Your Website    |
| `slg-consent-flow`      | `SLG_CONSENT_FLOW`      | Smart Consent Flow            |
| `slg-select-channels`   | `SLG_SELECT_CHANNELS`   | Select Connected Channels     |
| `slg-select-faqs`       | `SLG_SELECT_FAQS`       | Select FAQ Category           |
| `slg-form-integration`  | `SLG_FORM_INTEGRATION`  | Integrate Your Form           |
| `slg-sender-email`      | `SLG_SENDER_EMAIL`      | Configure Sender Email        |
| `slg-campaign-list`     | `SLG_CAMPAIGN_LIST`     | Create Campaign List          |
| `slg-beebot-handler`    | `SLG_BEEBOT_HANDLER`    | Select BeeBot Handler         |
| `slg-crm-tags`          | `SLG_CRM_TAGS`          | CRM Tags / Keywords           |
| `slg-tag-notifications` | `SLG_TAG_NOTIFICATIONS` | CRM Tag Notification Settings |
| `slg-outreach-email`    | `SLG_OUTREACH_EMAIL`    | Build Your Outreach Email     |

### Support Escalation predefined steps (`type: "auto"`)

| `stepKey`            | DB enum              | Human name                |
| -------------------- | -------------------- | ------------------------- |
| `se-select-channels` | `SE_SELECT_CHANNELS` | Select Connected Channels |
| `se-select-faqs`     | `SE_SELECT_FAQS`     | Select FAQ Category       |

### Retention & Nurture predefined steps (`type: "auto"`)

| `stepKey`            | DB enum              | Human name                |
| -------------------- | -------------------- | ------------------------- |
| `rn-create-campaign` | `RN_CREATE_CAMPAIGN` | Create Campaign           |
| `rn-campaign-config` | `RN_CAMPAIGN_CONFIG` | Campaign Configuration    |
| `rn-outreach-email`  | `RN_OUTREACH_EMAIL`  | Build Your Outreach Email |

---

## `completionStatus` Rules

The backend computes `completionStatus` per step based on whether the required config key(s) are populated.

| `stepKey`               | Required key(s)                        | Logic            |
| ----------------------- | -------------------------------------- | ---------------- |
| `send-message`          | `messageType`                          | Non-empty        |
| `wait`                  | `waitMinutes`, `waitHours`, `waitDays` | **Any one** > 0  |
| `smart-rule`            | `conditions`                           | Non-empty array  |
| `automation-list`       | `action`                               | Non-empty        |
| `trigger-condition`     | `conditions`                           | Non-empty array  |
| `slg-webchat-install`   | `websiteUrl`                           | Non-empty string |
| `slg-consent-flow`      | `method`                               | Non-empty string |
| `slg-select-channels`   | `channelAccounts`                      | Non-empty array  |
| `slg-select-faqs`       | `faqIds`                               | Non-empty array  |
| `slg-form-integration`  | `embedUrl`                             | Non-empty string |
| `slg-sender-email`      | `emailConfigId`                        | Non-null         |
| `slg-campaign-list`     | `listIds`                              | Non-empty array  |
| `slg-beebot-handler`    | `aiAssistantId`                        | Non-null         |
| `slg-crm-tags`          | `tagIds`                               | Non-empty array  |
| `slg-tag-notifications` | `notifications`                        | Non-empty array  |
| `slg-outreach-email`    | `emailTemplateId`                      | Non-null         |
| `se-select-channels`    | `channelAccounts`                      | Non-empty array  |
| `se-select-faqs`        | `faqIds`                               | Non-empty array  |
| `rn-create-campaign`    | `tagIds`                               | Non-empty array  |
| `rn-campaign-config`    | `leadSourceChannelId`                  | Non-null         |
| `rn-outreach-email`     | `emailTemplateId`                      | Non-null         |

> `"error"` is a **client-side only** state — the backend never returns it.

A step with no matching entry defaults to `"configured"`.

---

## `nextStepIds` Routing

### Linear categories (SLG, SE, RN, and standard automations)

`nextStepIds` is **computed at response time** from step order:

```
step[order=0] → nextStepIds: ["<step[order=1].id>"]
step[order=1] → nextStepIds: ["<step[order=2].id>"]
step[order=N] → nextStepIds: []   // last step
```

### Reengagement Campaigns (`REENGAGEMENT_CAMPAIGNS`)

`nextStepIds` comes from the **explicitly stored `nextStepId`** on each `AutomationStep`. Smart Rule steps also carry `trueNextStepId` / `falseNextStepId` in their `config`.

---

## Step `config` Shapes

### `send-message`

```json
{
  "messageType": "MARKETING_EMAIL",
  "emailTemplateId": 14,
  "customMessage": null,
  "sendingTime": "09:00"
}
```

| Field             | Type           | `messageType` values                           |
| ----------------- | -------------- | ---------------------------------------------- |
| `messageType`     | string         | `"MARKETING_EMAIL"` \| `"WHATSAPP"` \| `"SMS"` |
| `emailTemplateId` | number \| null | Used when `messageType = "MARKETING_EMAIL"`    |
| `customMessage`   | string \| null | Used for WhatsApp / SMS                        |
| `sendingTime`     | string \| null | HH:MM preferred send time                      |

---

### `wait`

```json
{
  "waitMinutes": null,
  "waitHours": null,
  "waitDays": 3,
  "waitUntilTime": null,
  "waitUntilDay": null
}
```

Only one of `waitMinutes`, `waitHours`, `waitDays` needs to be set.

---

### `smart-rule`

```json
{
  "name": "VIP Check",
  "conditions": [
    {
      "conditionOrder": 0,
      "logicOperator": "AND",
      "conditionType": "field",
      "fieldName": "leadStatus",
      "operator": "EQUALS",
      "value": "qualified"
    }
  ],
  "trueNextStepId": null,
  "falseNextStepId": null
}
```

`trueNextStepId` / `falseNextStepId` are only relevant for `REENGAGEMENT_CAMPAIGNS` automations.

---

### `automation-list`

```json
{
  "action": "ADD_TO_CAMPAIGN",
  "sourceCampaignId": null,
  "sourceTagGroupId": null,
  "sourceFaqGroupId": null,
  "destinationCampaignId": 7,
  "destinationTagGroupId": null,
  "destinationFaqGroupId": null
}
```

**Action values:** `ADD_TO_CAMPAIGN`, `REMOVE_FROM_CAMPAIGN`, `COPY_TO_CAMPAIGN`, `MOVE_BETWEEN_TAG_GROUPS`, `MOVE_BETWEEN_FAQ_GROUPS`

---

### `trigger-condition`

```json
{
  "name": "New subscriber check",
  "conditions": [
    {
      "conditionOrder": 0,
      "logicOperator": null,
      "triggerType": "CONTACT_SUBSCRIBED",
      "fieldName": null,
      "operator": null,
      "value": null
    }
  ]
}
```

---

### Predefined step configs (`type: "auto"`)

Predefined steps (`isDefault: true`) store their config in the `AutomationStep.config` JSON column. The config starts empty (`{}`) and is filled via `PATCH /automations/:id/steps/:stepId`.

Refer to the [Automation Categories guide](./campaign-templates.md) for the full per-step config shape reference.

---

## Trigger Types

| Value                  | Meaning                         |
| ---------------------- | ------------------------------- |
| `CONTACT_SUBSCRIBED`   | Contact joins a campaign        |
| `CONTACT_UNSUBSCRIBED` | Contact leaves a campaign       |
| `TAG_APPLIED`          | A tag is applied to a contact   |
| `TAG_REMOVED`          | A tag is removed from a contact |
| `INACTIVITY`           | Contact inactive for N days     |
| `FORM_SUBMITTED`       | Form submission received        |
| `CHAT_INITIATED`       | Chat started                    |
| `FAQ_TRIGGERED`        | FAQ trigger fired               |
| `MANUAL`               | Manually triggered              |

---

## API Reference

### Authentication

All endpoints require a valid session / JWT.

```
Authorization: Bearer <token>
```

---

### Get category definitions

```
GET /automations/categories
```

Static response — no DB query. Returns 4 category objects, each with their predefined step shapes.

**Response `200`** — see [Automation Categories guide](./campaign-templates.md).

---

### Create automation

```
POST /automations
```

**Minimum body:**

```json
{
  "name": "My SLG Setup",
  "automationCategory": "SALES_LEAD_GENERATION"
}
```

**Full body (all optional fields):**

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
  "triggers": [
    {
      "triggerType": "INACTIVITY",
      "name": "30-day inactive",
      "conditions": [
        {
          "conditionOrder": 0,
          "logicOperator": null,
          "operator": "GREATER_THAN",
          "value": "30"
        }
      ]
    }
  ],
  "steps": []
}
```

**Constraints:**

- `name` and `automationCategory` are required.
- `triggers` is optional — max 1 if provided.
- `steps` is optional — these are appended after the auto-created predefined steps.
- For `SALES_LEAD_GENERATION`, `SUPPORT_ESCALATION`, `RETENTION_NURTURE`: backend auto-creates predefined steps with `isTemplatePrefilled: true`.
- For `REENGAGEMENT_CAMPAIGNS`: blank slate — add steps manually afterward.

**Response `201`** — raw automation record. Fetch `GET /automations/:id` for the full `{ logic, layout }` output.

---

### List automations

```
GET /automations
GET /automations?category=SALES_LEAD_GENERATION
```

| Query param | Type                         | Required | Notes              |
| ----------- | ---------------------------- | -------- | ------------------ |
| `category`  | `AutomationTemplateCategory` | no       | Filter by category |

**Response `200`** — array of `AutomationResponse` (full `{ logic, layout }` contract for each).

---

### Get single automation

```
GET /automations/:id
```

**Response `200`** — single `AutomationResponse`.

**Example response for an SLG automation:**

```json
{
  "id": 45,
  "name": "My SLG Setup",
  "description": null,
  "category": "sales-and-lead-generation",
  "status": "DRAFT",
  "logicVersion": "1.0.0",
  "logic": {
    "version": "1.0.0",
    "trigger": null,
    "steps": [
      {
        "id": "200",
        "type": "auto",
        "stepKey": "slg-webchat-install",
        "label": "Add BeeBot to Your Website",
        "order": 0,
        "config": {},
        "nextStepIds": ["201"],
        "completionStatus": "pending",
        "isDefault": true,
        "locked": true,
        "required": true
      },
      {
        "id": "201",
        "type": "auto",
        "stepKey": "slg-consent-flow",
        "label": "Smart Consent Flow",
        "order": 1,
        "config": {},
        "nextStepIds": ["202"],
        "completionStatus": "pending",
        "isDefault": true,
        "locked": true,
        "required": true
      }
    ]
  },
  "layout": null,
  "_count": { "executions": 0 },
  "createdAt": "2026-02-26T10:00:00.000Z",
  "updatedAt": "2026-02-26T10:00:00.000Z"
}
```

---

### Update step configuration

```
PATCH /automations/:id/steps/:stepId
```

Unified endpoint for configuring any step:

- **Predefined steps** (`type: "auto"`, `SLG_*` / `SE_*` / `RN_*`): writes to the `AutomationStep.config` JSON column.
- **Standard steps** (`SEND_MESSAGE`, `WAIT`, etc.): writes to the relevant polymorphic config model.

**Request body**

```json
{
  "config": {
    "websiteUrl": "https://example.com",
    "installVerified": false
  }
}
```

Note: the `stepId` in the URL is the integer DB ID — parse `LogicStep.id` (which is a string) to int.

**Response `200`** — the updated step record.

---

### Update automation

```
PUT /automations/:id
```

Partial update of automation metadata, triggers, and steps. When `triggers` or `steps` are provided, existing records are **deleted and recreated**.

---

### Delete automation

```
DELETE /automations/:id
```

**Response `200`**

```json
{ "message": "Automation deleted successfully" }
```

---

### Update status

```
PATCH /automations/:id/status
```

```json
{ "status": "ACTIVE" }
```

**Response `200`**

```json
{
  "id": 45,
  "status": "ACTIVE",
  "updatedAt": "2026-02-26T12:00:00.000Z"
}
```

---

### Save canvas layout

```
PATCH /automations/:id/layout
```

Call this **debounced** (e.g. 1 second after last drag). The backend stores the JSON opaquely.

```json
{
  "layout": {
    "viewport": { "x": -120, "y": -80, "zoom": 0.85 },
    "nodes": {
      "200": { "x": 400, "y": 100 },
      "201": { "x": 400, "y": 250 }
    }
  }
}
```

---

### Add a step

```
POST /automations/:id/steps
```

Add a non-predefined step. Step order must not conflict with existing steps.

```json
{
  "stepOrder": 12,
  "stepType": "SEND_MESSAGE",
  "name": "Follow-up Email",
  "messageConfig": {
    "messageType": "MARKETING_EMAIL",
    "emailTemplateId": 8
  }
}
```

---

### Update a step (full replace)

```
PUT /automations/:id/steps/:stepId
```

Replaces the step's metadata and config. Same body shape as add-step.

---

### Delete a step

```
DELETE /automations/:id/steps/:stepId
```

---

### Reorder a step

```
PATCH /automations/:id/steps/:stepId/reorder
```

```json
{ "newStepOrder": 3 }
```

---

### Execution endpoints

```
GET  /automations/:id/executions?page=1&limit=20
POST /automations/:id/test   { "customerId": 123 }
```

---

## Execution Routing

### Linear automations (SLG, SE, RN, non-template)

Execution advances `stepOrder N` → `stepOrder N+1` sequentially. `SMART_RULE` steps still evaluate but do not branch (true/false paths are ignored).

### Reengagement automations

Steps carry explicit `nextStepId` edges. The engine follows:

- `currentStep.nextStepId` → next step (or stops if null)
- For `SMART_RULE` steps: follows `trueNextStepId` or `falseNextStepId` from `SmartRuleStepConfig`

---

## Predefined (isDefault) Steps

When an automation is created under SLG, SE, or RN, the backend auto-creates predefined steps with `isTemplatePrefilled: true`. In the response this maps to:

```json
{
  "isDefault": true,
  "locked": true,
  "required": true
}
```

**UI implications:**

- Position cannot be changed
- Cannot be deleted
- `config` can be edited via `PATCH /automations/:id/steps/:stepId`
- Additional steps can be appended after all predefined steps

---

## Filter Options (Automation-level)

| Field                     | Type     | Description                                                     |
| ------------------------- | -------- | --------------------------------------------------------------- |
| `sourceFilterEnabled`     | boolean  | Restrict to specific lead sources                               |
| `allowedSources`          | string[] | Allowed source identifiers                                      |
| `inactivityFilterEnabled` | boolean  | Only run for contacts inactive for N units                      |
| `inactivityThreshold`     | number   | Threshold value                                                 |
| `inactivityUnit`          | string   | `"MINUTES"` \| `"HOURS"` \| `"DAYS"` \| `"WEEKS"` \| `"MONTHS"` |
| `tagFilterEnabled`        | boolean  | Restrict to contacts with specific tags                         |
| `allowedTagIds`           | number[] | Allowed tag IDs                                                 |
| `statusFilterEnabled`     | boolean  | Restrict to contacts with specific statuses                     |
| `allowedStatuses`         | string[] | Allowed `CustomerStatusType` values                             |

---

## Error Responses

| Status | Scenario                                                                           |
| ------ | ---------------------------------------------------------------------------------- |
| `400`  | Missing `name` or `automationCategory` / more than 1 trigger / invalid step config |
| `404`  | Automation or step not found or belongs to another user                            |

---

## TypeScript Reference

```typescript
type AutomationStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

type AutomationTemplateCategory =
  | "SALES_LEAD_GENERATION"
  | "SUPPORT_ESCALATION"
  | "RETENTION_NURTURE"
  | "REENGAGEMENT_CAMPAIGNS";

type CategorySlug =
  | "sales-and-lead-generation"
  | "support-escalation"
  | "retention-nurture"
  | "reengagement-campaigns";

type StepTypeRole = "action" | "condition" | "auto";
type CompletionStatus = "pending" | "configured"; // "error" is client-side only

interface TriggerNode {
  id: string;
  type: string; // AutomationTriggerType enum value
  stepKey: "trigger";
  label: string;
  conditions: TriggerCondition[];
}

interface LogicStep {
  id: string; // stringified DB id — parse to int for PATCH endpoint
  type: StepTypeRole;
  stepKey: string;
  label: string;
  order: number;
  config: Record<string, any>;
  nextStepIds: string[];
  completionStatus: CompletionStatus;
  isDefault: boolean;
  locked: boolean;
  required: boolean;
}

interface AutomationResponse {
  id: number;
  name: string;
  description: string | null;
  category: CategorySlug | null;
  status: AutomationStatus;
  logicVersion: string;
  logic: {
    version: string;
    trigger: TriggerNode | null;
    steps: LogicStep[];
  };
  layout: Record<string, any> | null;
  _count?: { executions: number };
  createdAt: string;
  updatedAt: string;
}
```

---

## Quick-start Examples

### Create and configure an SLG automation

```typescript
// 1. Get category definitions (optional — for displaying step list in UI)
const categories = await fetch("/automations/categories").then((r) => r.json());
const slg = categories.find((c) => c.category === "SALES_LEAD_GENERATION");

// 2. Create automation (backend auto-populates 11 predefined steps)
const { id } = await fetch("/automations", {
  method: "POST",
  body: JSON.stringify({
    name: "My SLG Setup",
    automationCategory: "SALES_LEAD_GENERATION",
  }),
}).then((r) => r.json());

// 3. Get automation with predefined steps
const automation = await fetch(`/automations/${id}`).then((r) => r.json());
// automation.logic.steps → 11 steps, all type: "auto", completionStatus: "pending"

// 4. Configure step 0 (webchat install)
const stepId = parseInt(automation.logic.steps[0].id);
await fetch(`/automations/${id}/steps/${stepId}`, {
  method: "PATCH",
  body: JSON.stringify({
    config: { websiteUrl: "https://example.com", installVerified: false },
  }),
});

// 5. Activate when all steps configured
await fetch(`/automations/${id}/status`, {
  method: "PATCH",
  body: JSON.stringify({ status: "ACTIVE" }),
});
```

### Create a blank Reengagement automation

```typescript
const { id } = await fetch("/automations", {
  method: "POST",
  body: JSON.stringify({
    name: "Win-back Campaign",
    automationCategory: "REENGAGEMENT_CAMPAIGNS",
  }),
}).then((r) => r.json());
// automation has 0 steps — add freely via POST /automations/:id/steps
```

### Saving canvas layout (debounced)

```typescript
let saveTimer: ReturnType<typeof setTimeout>;

function onCanvasDrag(automationId: number, layout: CanvasLayout) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(`/automations/${automationId}/layout`, {
      method: "PATCH",
      body: JSON.stringify({ layout }),
    });
  }, 1000);
}
```

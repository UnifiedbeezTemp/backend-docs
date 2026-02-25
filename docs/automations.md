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
  category: CategorySlug | null;     // kebab-case string, see Category Slugs
  status: AutomationStatus;          // "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED"
  logicVersion: string;              // e.g. "1.0.0"
  logic: {
    version: string;
    trigger: TriggerNode | null;
    steps: LogicStep[];
  };
  layout: CanvasLayout | null;       // opaque JSON, stored as-is
  _count?: { executions: number };
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
}
```

### `TriggerNode`

```typescript
interface TriggerNode {
  id: string;                        // stringified trigger DB id
  type: AutomationTriggerType;       // backend enum
  stepKey: "trigger";
  label: string;
  conditions: TriggerCondition[];
}
```

### `LogicStep`

```typescript
interface LogicStep {
  id: string;                        // stringified step DB id
  type: AutomationStepType;          // backend enum, ALL_CAPS
  stepKey: string;                   // kebab-case routing key (see Step Key Reference)
  label: string;                     // human-readable name
  order: number;                     // stepOrder from DB (0-based for template steps)
  config: Record<string, any>;       // flattened step config (see per-step shapes)
  nextStepIds: string[];             // computed for linear automations; explicit for REENGAGEMENT
  completionStatus: "pending" | "configured";
  isDefault: boolean;                // true = step was pre-filled from a template
  locked: boolean;                   // true = step order is locked (same as isDefault)
  required: boolean;                 // true = step cannot be removed (same as isDefault)
}
```

### `CanvasLayout`

An opaque JSON blob owned by the frontend. The backend stores and returns it without modification.

```typescript
interface CanvasLayout {
  viewport?: { x: number; y: number; zoom: number };
  nodes?: Record<string, { x: number; y: number }>;
  groups?: Record<string, { x: number; y: number; width: number; height: number }>;
  links?: Record<string, { style?: Record<string, any> }>;
  [key: string]: any;   // any additional canvas metadata
}
```

---

## Automation Status Lifecycle

```
DRAFT ──activate──► ACTIVE ──pause──► PAUSED
  ▲                    │                 │
  │                    └──archive──►  ARCHIVED
  │                                     │
  └─────────────── (unarchive) ─────────┘
```

| Status | Meaning | Executions triggered? |
|---|---|---|
| `DRAFT` | Being configured, not yet live | No |
| `ACTIVE` | Live — triggers fire and executions run | Yes |
| `PAUSED` | Temporarily suspended | No |
| `ARCHIVED` | Retired — no longer runs | No |

Change status via `PATCH /automations/:id/status`.

---

## Category Slugs

The `category` field in responses uses kebab-case strings:

| DB enum | Response value |
|---|---|
| `SALES_LEAD_GENERATION` | `"sales-and-lead-generation"` |
| `SUPPORT_ESCALATION` | `"support-escalation"` |
| `RETENTION_NURTURE` | `"retention-nurture"` |
| `REENGAGEMENT_CAMPAIGNS` | `"reengagement-campaigns"` |
| *(none set)* | `null` |

---

## Step Key Reference

Use `stepKey` to route to the correct configuration drawer or component in the UI.

### Core step types (any category)

| `type` (DB enum) | `stepKey` | Purpose |
|---|---|---|
| `SEND_MESSAGE` | `send-message` | Send email / WhatsApp / SMS |
| `WAIT` | `wait` | Delay execution |
| `SMART_RULE` | `smart-rule` | Conditional branch |
| `AUTOMATION_LIST` | `automation-list` | Add/remove/move contact in a list |
| `TRIGGER_CONDITION` | `trigger-condition` | Inline trigger check |
| `TAG_ACTION` | `tag-action` | Apply or remove a tag |
| `STATUS_CHANGE` | `status-change` | Update lead status |

### Sales & Lead Generation template steps

| `type` | `stepKey` | Human name |
|---|---|---|
| `SLG_WEBCHAT_INSTALL` | `slg-webchat-install` | Add BeeBot to Your Website |
| `SLG_CONSENT_FLOW` | `slg-consent-flow` | Smart Consent Flow |
| `SLG_SELECT_CHANNELS` | `slg-select-channels` | Select Connected Channels |
| `SLG_SELECT_FAQS` | `slg-select-faqs` | Select FAQ Category |
| `SLG_FORM_INTEGRATION` | `slg-form-integration` | Integrate Your Form |
| `SLG_SENDER_EMAIL` | `slg-sender-email` | Configure Sender Email |
| `SLG_CAMPAIGN_LIST` | `slg-campaign-list` | Create Campaign List |
| `SLG_BEEBOT_HANDLER` | `slg-beebot-handler` | Select BeeBot Handler |
| `SLG_CRM_TAGS` | `slg-crm-tags` | CRM Tags / Keywords |
| `SLG_TAG_NOTIFICATIONS` | `slg-tag-notifications` | CRM Tag Notification Settings |
| `SLG_OUTREACH_EMAIL` | `slg-outreach-email` | Build Your Outreach Email |

### Support Escalation template steps

| `type` | `stepKey` | Human name |
|---|---|---|
| `SE_SELECT_CHANNELS` | `se-select-channels` | Select Connected Channels |
| `SE_SELECT_FAQS` | `se-select-faqs` | Select FAQ Category |

### Retention & Nurture template steps

| `type` | `stepKey` | Human name |
|---|---|---|
| `RN_CREATE_CAMPAIGN` | `rn-create-campaign` | Create Campaign |
| `RN_CAMPAIGN_CONFIG` | `rn-campaign-config` | Campaign Configuration |
| `RN_OUTREACH_EMAIL` | `rn-outreach-email` | Build Your Outreach Email |

---

## `completionStatus` Rules

The backend computes `completionStatus` per step based on whether the required config key(s) are populated.

| `stepKey` | Required key(s) | Logic |
|---|---|---|
| `send-message` | `messageType` | Any one non-empty |
| `wait` | `waitMinutes`, `waitHours`, `waitDays` | **Any one** > 0 |
| `smart-rule` | `conditions` | Non-empty array |
| `automation-list` | `action` | Non-empty |
| `trigger-condition` | `conditions` | Non-empty array |
| `slg-webchat-install` | `websiteUrl` | Non-empty string |
| `slg-consent-flow` | `method` | Non-empty string |
| `slg-select-channels` | `channelAccounts` | Non-empty array |
| `slg-select-faqs` | `faqIds` | Non-empty array |
| `slg-form-integration` | `embedUrl` | Non-empty string |
| `slg-sender-email` | `emailConfigId` | Non-null |
| `slg-campaign-list` | `listIds` | Non-empty array |
| `slg-beebot-handler` | `aiAssistantId` | Non-null |
| `slg-crm-tags` | `tagIds` | Non-empty array |
| `slg-tag-notifications` | `notifications` | Non-empty array |
| `slg-outreach-email` | `emailTemplateId` | Non-null |
| `se-select-channels` | `channelAccounts` | Non-empty array |
| `se-select-faqs` | `faqIds` | Non-empty array |
| `rn-create-campaign` | `tagIds` | Non-empty array |
| `rn-campaign-config` | `leadSourceChannelId` | Non-null |
| `rn-outreach-email` | `emailTemplateId` | Non-null |

A step with **no matching entry** in the table defaults to `"configured"`.

---

## `nextStepIds` Routing

### Linear categories (SLG, SE, RN, and non-template automations)

`nextStepIds` is **computed at response time** from step order. Each step points to the immediately following step:

```
step[order=0] → nextStepIds: ["<step[order=1].id>"]
step[order=1] → nextStepIds: ["<step[order=2].id>"]
step[order=N] → nextStepIds: []   // last step
```

### Reengagement Campaigns (`REENGAGEMENT_CAMPAIGNS`)

`nextStepIds` comes from the **explicitly stored `nextStepId`** on each `AutomationStep`. Steps that haven't been linked yet have `nextStepIds: []`.

Smart Rule steps in reengagement automations also carry `trueNextStepId` and `falseNextStepId` inside their `config`:

```json
{
  "stepKey": "smart-rule",
  "config": {
    "name": "Check lead status",
    "conditions": [...],
    "trueNextStepId": 203,
    "falseNextStepId": 205
  }
}
```

---

## Step `config` Shapes

These are the exact objects returned in `LogicStep.config` after the backend flattens the polymorphic step config models.

### `send-message`

```json
{
  "messageType": "MARKETING_EMAIL",
  "emailTemplateId": 14,
  "customMessage": null,
  "sendingTime": "09:00"
}
```

| Field | Type | `messageType` values |
|---|---|---|
| `messageType` | string | `"MARKETING_EMAIL"` \| `"WHATSAPP"` \| `"SMS"` |
| `emailTemplateId` | number \| null | Used when `messageType = "MARKETING_EMAIL"` |
| `customMessage` | string \| null | Used for WhatsApp / SMS |
| `sendingTime` | string \| null | HH:MM preferred send time |

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

Only one of `waitMinutes`, `waitHours`, `waitDays` needs to be set. `waitUntilTime` (HH:MM) and `waitUntilDay` (day-of-week string) are optional scheduling constraints.

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

`trueNextStepId` and `falseNextStepId` are only relevant (and non-null) for `REENGAGEMENT_CAMPAIGNS` automations.

**Condition operators** (ConditionOperator enum):
`EQUALS`, `NOT_EQUALS`, `CONTAINS`, `NOT_CONTAINS`, `GREATER_THAN`, `LESS_THAN`, `IS_EMPTY`, `IS_NOT_EMPTY`

**Condition types:**
- `"trigger"` — references an `AutomationTriggerType`
- `"campaign"` — references a campaign via `targetCampaignId`
- `"field"` — references a lead field via `fieldName`

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

**Action values** (`AutomationListAction` enum):

| Value | Description |
|---|---|
| `ADD_TO_CAMPAIGN` | Add contact to a campaign |
| `REMOVE_FROM_CAMPAIGN` | Remove contact from a campaign |
| `COPY_TO_CAMPAIGN` | Copy contact to another campaign |
| `MOVE_BETWEEN_TAG_GROUPS` | Move between tag groups |
| `MOVE_BETWEEN_FAQ_GROUPS` | Move between FAQ groups |

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

### Template step configs (SLG / SE / RN)

Template steps (`isDefault: true`) have their configuration stored in the parent `CampaignTemplateStepConfig.config` JSON. Because these steps are created from templates rather than through the standard step config models, their `config` field may be an empty object `{}` until the user edits the step within the automation.

Refer to the [Campaign Templates guide](./campaign-templates.md) for the full per-step config shape reference.

---

## Trigger Types

The `trigger.type` field uses the `AutomationTriggerType` enum:

| Value | Meaning |
|---|---|
| `CONTACT_SUBSCRIBED` | Contact joins a campaign |
| `CONTACT_UNSUBSCRIBED` | Contact leaves a campaign |
| `TAG_APPLIED` | A tag is applied to a contact |
| `TAG_REMOVED` | A tag is removed from a contact |
| `INACTIVITY` | Contact inactive for N days |
| `FORM_SUBMITTED` | Form submission received |
| `CHAT_INITIATED` | Chat started |
| `FAQ_TRIGGERED` | FAQ trigger fired |
| `MANUAL` | Manually triggered |

---

## API Reference

### Authentication

All endpoints require a valid session / JWT.

```
Authorization: Bearer <token>
```

---

### Create automation

```
POST /automations
```

Creates an automation from scratch (not from a template). For template-based automations see [Campaign Templates guide](./campaign-templates.md).

**Request body**

```json
{
  "name": "Re-engage cold leads",
  "description": "Optional",
  "startType": "TRIGGER_BASED",
  "campaignId": 5,
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
          "fieldName": null,
          "operator": "GREATER_THAN",
          "value": "30"
        }
      ]
    }
  ],
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "SEND_MESSAGE",
      "name": "Win-back Email",
      "messageConfig": {
        "messageType": "MARKETING_EMAIL",
        "emailTemplateId": 7,
        "sendingTime": "10:00"
      }
    },
    {
      "stepOrder": 2,
      "stepType": "WAIT",
      "name": "Wait 3 days",
      "waitConfig": {
        "waitDays": 3
      }
    },
    {
      "stepOrder": 3,
      "stepType": "SMART_RULE",
      "name": "Check engagement",
      "smartRuleConfig": {
        "name": "Opened email?",
        "conditions": [
          {
            "conditionOrder": 0,
            "conditionType": "field",
            "fieldName": "emailOpened",
            "operator": "EQUALS",
            "value": "true"
          }
        ]
      }
    }
  ]
}
```

**Constraints**:
- `triggers` must contain **exactly 1** trigger (more = 400).
- At least 1 step required.
- `campaignId` is optional — omit for template-based automations.

**Response `201`** — raw automation record (not the logic/layout shape). Fetch `GET /automations/:id` to get the full transformer output.

---

### List automations

```
GET /automations
GET /automations?campaignId=5
```

**Response `200`** — array of `AutomationResponse` objects (full `{ logic, layout }` contract for each).

```json
[
  {
    "id": 45,
    "name": "Win-back Campaign",
    "description": null,
    "category": "reengagement-campaigns",
    "status": "DRAFT",
    "logicVersion": "1.0.0",
    "logic": {
      "version": "1.0.0",
      "trigger": {
        "id": "22",
        "type": "INACTIVITY",
        "stepKey": "trigger",
        "label": "30-day inactive",
        "conditions": [...]
      },
      "steps": [
        {
          "id": "200",
          "type": "SEND_MESSAGE",
          "stepKey": "send-message",
          "label": "Win-back Email",
          "order": 1,
          "config": { "messageType": "MARKETING_EMAIL", "emailTemplateId": 7, ... },
          "nextStepIds": ["201"],
          "completionStatus": "configured",
          "isDefault": false,
          "locked": false,
          "required": false
        }
      ]
    },
    "layout": null,
    "_count": { "executions": 0 },
    "createdAt": "2026-02-25T10:00:00.000Z",
    "updatedAt": "2026-02-25T10:00:00.000Z"
  }
]
```

---

### Get single automation

```
GET /automations/:id
```

**Response `200`** — single `AutomationResponse` (same shape as one item in the list).

---

### Update automation

```
PUT /automations/:id
```

Replaces the automation's configuration. Accepts the same body as `POST /automations` (all fields partial). When `triggers` or `steps` are included, the existing records are **deleted and recreated**.

**Response `200`** — raw updated automation record.

---

### Delete automation

```
DELETE /automations/:id
```

Deletes the automation and stops all executions.

**Response `200`**

```json
{ "message": "Automation deleted successfully" }
```

---

### Update status

```
PATCH /automations/:id/status
```

**Request body**

```json
{ "status": "ACTIVE" }
```

| Value | Effect |
|---|---|
| `"DRAFT"` | Moves back to draft |
| `"ACTIVE"` | Goes live — triggers will fire |
| `"PAUSED"` | Suspends without losing config |
| `"ARCHIVED"` | Permanently retired |

**Response `200`**

```json
{
  "id": 45,
  "status": "ACTIVE",
  "updatedAt": "2026-02-25T12:00:00.000Z"
}
```

---

### Save canvas layout

```
PATCH /automations/:id/layout
```

Persists visual canvas data. Call this **debounced** (e.g. 1 second after last user drag) to avoid excessive writes. The backend stores the JSON opaquely and returns it unchanged in all subsequent `GET` responses.

**Request body**

```json
{
  "layout": {
    "viewport": { "x": -120, "y": -80, "zoom": 0.85 },
    "nodes": {
      "200": { "x": 400, "y": 100 },
      "201": { "x": 400, "y": 250 }
    },
    "groups": {},
    "links": {}
  }
}
```

**Response `200`**

```json
{
  "id": 45,
  "layout": { ... },
  "updatedAt": "2026-02-25T12:05:00.000Z"
}
```

---

### Add a step

```
POST /automations/:id/steps
```

**Request body** — same `CreateStepDto` shape used in the automation create payload, but for a single step:

```json
{
  "stepOrder": 4,
  "stepType": "SEND_MESSAGE",
  "name": "Follow-up Email",
  "messageConfig": {
    "messageType": "MARKETING_EMAIL",
    "emailTemplateId": 8
  }
}
```

> **Note:** Steps with `isTemplatePrefilled: true` cannot be inserted between other pre-filled steps. Appending after all pre-filled steps is always allowed.

---

### Update a step

```
PUT /automations/:id/steps/:stepId
```

Replaces the step's config. Same body shape as add-step.

---

### Delete a step

```
DELETE /automations/:id/steps/:stepId
```

---

### Execution endpoints

#### List executions for an automation

```
GET /automations/:id/executions?page=1&limit=20
```

#### Get execution details

```
GET /automations/:id/executions/:executionId
```

#### Trigger manual execution

```
POST /automations/:id/execute
```

```json
{ "contactId": 123 }
```

---

## Execution Routing

### Linear automations (SLG, SE, RN, non-template)

The execution engine advances from `stepOrder N` → `stepOrder N+1` sequentially. All `SMART_RULE` steps evaluate their conditions but the result does not branch — execution always continues to the next step in order.

### Reengagement automations

Steps carry explicit `nextStepId` edges. The engine follows:
- `currentStep.nextStepId` → next step (or stops if null)
- For `SMART_RULE` steps: evaluates conditions → follows `trueNextStepId` or `falseNextStepId` from `SmartRuleStepConfig`

To configure branching in a reengagement automation:
1. Create step A and step B
2. Set `step_A.nextStepId = step_B.id` (via `PUT /automations/:id/steps/:stepId`)
3. For Smart Rule branching, include `trueNextStepId` and `falseNextStepId` in the smart rule config

---

## Template-Prefilled Steps

When an automation is created from a campaign template, its steps carry `isTemplatePrefilled: true`. In the response contract this maps to:

```json
{
  "isDefault": true,
  "locked": true,
  "required": true
}
```

**UI implications:**
- The step's position in the pre-filled block cannot be changed by the user
- The step cannot be deleted
- The step's `config` can still be edited (updating the step config within the automation does not affect the source template)
- Additional steps can be appended after all pre-filled steps

---

## Filter Options (Automation-level)

These fields are set on the `Automation` record and control which contacts enter the automation:

| Field | Type | Description |
|---|---|---|
| `sourceFilterEnabled` | boolean | Restrict to specific lead sources |
| `allowedSources` | string[] | Allowed source identifiers |
| `inactivityFilterEnabled` | boolean | Only run for contacts inactive for N units |
| `inactivityThreshold` | number | Threshold value |
| `inactivityUnit` | `InactivityUnit` | `"MINUTES"` \| `"HOURS"` \| `"DAYS"` \| `"WEEKS"` \| `"MONTHS"` |
| `tagFilterEnabled` | boolean | Restrict to contacts with specific tags |
| `allowedTagIds` | number[] | Allowed tag IDs |
| `statusFilterEnabled` | boolean | Restrict to contacts with specific statuses |
| `allowedStatuses` | string[] | Allowed `CustomerStatusType` values |

---

## Common Response Shapes

### `TriggerCondition`

```typescript
interface TriggerCondition {
  id: number;
  conditionOrder: number;
  logicOperator: "AND" | "OR" | null;
  fieldName: string | null;
  operator: ConditionOperator;
  value: string | null;
  targetCampaignId: number | null;
  targetTagGroupId: number | null;
  targetFaqGroupId: number | null;
  // Resolved names (if available)
  targetCampaign?: { name: string } | null;
  targetTagGroup?: { id: number; tagId: number } | null;
  targetFaqGroup?: { id: number; questionId: number } | null;
}
```

---

## Error Responses

| Status | Scenario |
|---|---|
| `400` | Missing required field, invalid step config, or more than 1 trigger provided |
| `404` | Automation not found or belongs to another user |
| `400` | Attempting to insert step between pre-filled steps (when applicable) |

---

## TypeScript Reference

```typescript
type AutomationStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

type CategorySlug =
  | "sales-and-lead-generation"
  | "support-escalation"
  | "retention-nurture"
  | "reengagement-campaigns";

type CompletionStatus = "pending" | "configured";

interface TriggerNode {
  id: string;
  type: string;            // AutomationTriggerType enum value
  stepKey: "trigger";
  label: string;
  conditions: TriggerCondition[];
}

interface LogicStep {
  id: string;
  type: string;            // AutomationStepType enum value
  stepKey: string;         // kebab-case routing key
  label: string;
  order: number;
  config: Record<string, any>;
  nextStepIds: string[];
  completionStatus: CompletionStatus;
  isDefault: boolean;
  locked: boolean;
  required: boolean;
}

interface AutomationLogic {
  version: string;
  trigger: TriggerNode | null;
  steps: LogicStep[];
}

interface AutomationResponse {
  id: number;
  name: string;
  description: string | null;
  category: CategorySlug | null;
  status: AutomationStatus;
  logicVersion: string;
  logic: AutomationLogic;
  layout: Record<string, any> | null;
  _count?: { executions: number };
  createdAt: string;
  updatedAt: string;
}
```

---

## Quick-start Examples

### Creating and activating a simple email automation

```typescript
// 1. Create
const automation = await fetch('/automations', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Welcome Email',
    startType: 'TRIGGER_BASED',
    triggers: [{
      triggerType: 'CONTACT_SUBSCRIBED',
      name: 'On subscribe',
      conditions: []
    }],
    steps: [{
      stepOrder: 1,
      stepType: 'SEND_MESSAGE',
      name: 'Welcome Email',
      messageConfig: {
        messageType: 'MARKETING_EMAIL',
        emailTemplateId: 3
      }
    }]
  })
});

// 2. Activate
await fetch(`/automations/${automation.id}/status`, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'ACTIVE' })
});
```

### Creating a template-based automation

```typescript
// 1. Create SLG template
const template = await fetch('/campaign-templates', {
  method: 'POST',
  body: JSON.stringify({ name: 'My SLG', category: 'SALES_LEAD_GENERATION' })
});

// 2. Configure step 0 (webchat install)
await fetch(`/campaign-templates/${template.id}/steps/0`, {
  method: 'PATCH',
  body: JSON.stringify({
    stepType: 'SLG_WEBCHAT_INSTALL',
    config: { websiteUrl: 'https://example.com', installVerified: false }
  })
});

// 3. Spawn automation
const automation = await fetch(`/campaign-templates/${template.id}/automation`, {
  method: 'POST',
  body: JSON.stringify({ name: 'My SLG Automation' })
});

// 4. Fetch with { logic, layout } contract
const full = await fetch(`/automations/${automation.id}`);
```

### Saving canvas layout (debounced)

```typescript
let saveTimer: ReturnType<typeof setTimeout>;

function onCanvasDrag(automationId: number, layout: CanvasLayout) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(`/automations/${automationId}/layout`, {
      method: 'PATCH',
      body: JSON.stringify({ layout })
    });
  }, 1000);
}
```

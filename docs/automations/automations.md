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
  campaignListId: number | null; // RC automations only — the Campaign List that scopes this automation's contact pool
  status: AutomationStatus; // "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED"
  logicVersion: string; // e.g. "1.0.0"
  logic: {
    version: string;
    trigger: TriggerNode | null;
    steps: LogicStep[];
  };
  layout: AutomationLayout | null;
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

### `AutomationLayout`

The layout captures visual concerns only — viewport position and group customisation. Nodes and edges are **not** stored; the frontend derives them from `logic.steps`.

```typescript
interface LayoutGroup {
  id: string;
  label?: string;
  bgColor?: string;
  position?: { x: number; y: number };
}

interface AutomationLayout {
  viewport: { x: number; y: number; zoom: number };
  groups: LayoutGroup[];
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
| `slg-form-integration`  | `SLG_FORM_INTEGRATION`  | Integrate Your Form           |
| `slg-sender-email`      | `SLG_SENDER_EMAIL`      | Configure Sender Email        |
| `slg-campaign-list`     | `SLG_CAMPAIGN_LIST`     | Create Campaign List          |
| `slg-beebot-handler`    | `SLG_BEEBOT_HANDLER`    | Select BeeBot Handler         |
| `slg-crm-tags`          | `SLG_CRM_TAGS`          | CRM Tags / Keywords           |
| `slg-tag-notifications` | `SLG_TAG_NOTIFICATIONS` | CRM Tag Notification Settings |
| `slg-outreach-email`    | `SLG_OUTREACH_EMAIL`    | Build Your Outreach Email     |

### Support Escalation predefined steps (`type: "auto"`)

| `stepKey`             | DB enum               | Human name                |
| --------------------- | --------------------- | ------------------------- |
| `se-select-channels`  | `SE_SELECT_CHANNELS`  | Select Connected Channels |
| `se-select-faqs`      | `SE_SELECT_FAQS`      | Select FAQ Category       |
| `se-faq-config`       | `SE_FAQ_CONFIG`       | FAQ Configuration         |
| `se-campaign-preview` | `SE_CAMPAIGN_PREVIEW` | Campaign Preview          |

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
| `slg-form-integration`  | `embedUrl`                             | Non-empty string |
| `slg-sender-email`      | `emailConfigId`                        | Non-null         |
| `slg-campaign-list`     | `listIds`                              | Non-empty array  |
| `slg-beebot-handler`    | `aiAssistantId`                        | Non-null         |
| `slg-crm-tags`          | `tagIds`                               | Non-empty array  |
| `slg-tag-notifications` | `notifications`                        | Non-empty array  |
| `slg-outreach-email`    | `emailTemplateId`                      | Non-null         |
| `se-select-channels`    | `channelAccounts`                      | Non-empty array  |
| `se-select-faqs`        | `faqIds`                               | Non-empty array  |
| `se-faq-config`         | `completed`                            | `true`           |
| `se-campaign-preview`   | `completed`                            | `true`           |
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

The send-message step supports three channels. Set `messageType` to select the channel — the remaining fields differ per channel.

| Field               | Type           | Required               | Notes                                                                                                                                    |
| ------------------- | -------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `messageType`       | string         | **yes**                | `"MARKETING_EMAIL"` \| `"WHATSAPP"` \| `"SMS"`                                                                                           |
| `emailTemplateId`   | number \| null | for `MARKETING_EMAIL`  | ID of a saved email template                                                                                                             |
| `customMessage`     | string \| null | for `WHATSAPP` / `SMS` | Plain text or template variables                                                                                                         |
| `sendingTime`       | string \| null | no                     | HH:MM preferred send time (e.g. `"09:00"`)                                                                                               |
| `emailConfigId`     | number \| null | no                     | **Step-level override**: use this specific email config. Takes priority over the automation-level `emailConfigId`.                       |
| `whatsappAccountId` | number \| null | no                     | **Step-level override**: use this specific WhatsApp account. Takes priority over the automation-level `outreachChannelId`.               |
| `smsAccountId`      | number \| null | no                     | **Step-level override**: use this specific SMS account / purchased number. Takes priority over the automation-level `outreachChannelId`. |

#### Account resolution priority

| Channel  | Priority order                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Email    | Step `emailConfigId` → Automation `emailConfigId` → Global "automations" account                         |
| WhatsApp | Step `whatsappAccountId` (direct) → Automation `outreachChannelId` (channel filter) → Any active account |
| SMS      | Step `smsAccountId` (direct) → Automation `outreachChannelId` (channel filter) → Any active account      |

#### Channel: MARKETING_EMAIL

Use `emailTemplateId` to send a pre-built template, or `customMessage` to send ad-hoc HTML/text. Optionally pin a specific email config at the step level with `emailConfigId`.

```json
{
  "messageType": "MARKETING_EMAIL",
  "emailTemplateId": 14,
  "customMessage": null,
  "sendingTime": "09:00",
  "emailConfigId": 7
}
```

#### Channel: WHATSAPP

Set `customMessage` to the message body. The backend resolves the active WhatsApp account for the user (or the specific one set via `whatsappAccountId`). `sendingTime` is respected if set.

```json
{
  "messageType": "WHATSAPP",
  "emailTemplateId": null,
  "customMessage": "Hi {customer.name}, we miss you! Check out what's new: {business.name}",
  "sendingTime": null,
  "whatsappAccountId": 3
}
```

#### Channel: SMS

Same as WhatsApp — `customMessage` is the message body. The recipient's phone number is resolved from their contact record. Optionally pin the specific SMS account (purchased number) with `smsAccountId`.

```json
{
  "messageType": "SMS",
  "emailTemplateId": null,
  "customMessage": "Hey {customer.name}, here's an exclusive offer just for you.",
  "sendingTime": "10:00",
  "smsAccountId": 5
}
```

#### Variable Interpolation

All three channels support the following variables in `customMessage`:

| Variable            | Resolves to                              |
| ------------------- | ---------------------------------------- |
| `{customer.name}`   | Contact's full name                      |
| `{customer.email}`  | Contact's email address                  |
| `{customer.phone}`  | Contact's phone number                   |
| `{customer.source}` | Lead source (e.g. `"form"`, `"webchat"`) |
| `{business.name}`   | Your business name                       |

Unknown variables are left as-is in the sent message.

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
      "groupId": "group-a",
      "conditionType": "field",
      "fieldName": "country",
      "operator": "EQUALS",
      "value": "US"
    },
    {
      "conditionOrder": 1,
      "logicOperator": "AND",
      "groupId": "group-a",
      "conditionType": "field",
      "fieldName": "createdAt",
      "operator": "IS_AFTER",
      "value": "RELATIVE:-30d"
    },
    {
      "conditionOrder": 2,
      "logicOperator": "OR",
      "groupId": "group-b",
      "conditionType": "campaign_list",
      "targetCampaignListId": 5,
      "operator": null,
      "value": "SUBSCRIBED"
    }
  ],
  "trueNextStepId": null,
  "falseNextStepId": null
}
```

**`conditionType` values:**

| `conditionType`   | What it checks                                                                    |
| ----------------- | --------------------------------------------------------------------------------- |
| `"field"`         | A contact field (use `fieldName` + `operator` + `value`)                          |
| `"campaign"`      | Campaign membership (use `targetLeadGenerationCampaignId`)                        |
| `"campaign_list"` | List membership status (use `targetCampaignListId` + `value` for status)          |
| `"trigger"`       | The trigger type that started this execution (use `triggerType`)                  |
| `"activity"`      | Past contact activity — e.g. has opened email (use `triggerType` as activity key) |

**`value` for `campaign_list` conditions:**

| `value`              | Meaning                          |
| -------------------- | -------------------------------- |
| `"SUBSCRIBED"`       | Currently subscribed (default)   |
| `"UNSUBSCRIBED"`     | Unsubscribed                     |
| `"UNCONFIRMED"`      | Double-opt-in pending            |
| `"BOUNCED_HARD"`     | Hard bounced                     |
| `"NEVER_SUBSCRIBED"` | Never been on this list          |
| `"EVER_ADDED"`       | Has ever been added (any status) |

**Relative date values:** `value` supports `"RELATIVE:<sign><amount><unit>"` where unit is `d` (days), `w` (weeks), `m` (months), `y` (years). Example: `"RELATIVE:-7d"` means "7 days ago".

**Condition grouping:** Conditions with the same `groupId` are AND-ed together; different groups are OR-ed. If no `groupId` is set, the legacy `logicOperator` boundary heuristic applies.

`trueNextStepId` / `falseNextStepId` are only relevant for `REENGAGEMENT_CAMPAIGNS` automations.

---

### `automation-list`

```json
{
  "action": "ADD_TO_CAMPAIGN",
  "sourceCampaignId": null,
  "sourceTagGroupId": null,
  "sourceFaqGroupId": null,
  "destinationCampaignId": null,
  "destinationTagGroupId": null,
  "destinationFaqGroupId": null,
  "sourceCampaignListId": null,
  "destinationCampaignListId": 5
}
```

**Action values:** `ADD_TO_CAMPAIGN`, `REMOVE_FROM_CAMPAIGN`, `COPY_TO_CAMPAIGN`, `MOVE_BETWEEN_TAG_GROUPS`, `MOVE_BETWEEN_FAQ_GROUPS`

For `REENGAGEMENT_CAMPAIGNS` automations, use `sourceCampaignListId` / `destinationCampaignListId` (user-created Campaign Lists). The legacy `sourceCampaignId` / `destinationCampaignId` fields remain for backward compatibility with older automations.

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

Use `GET /automations/metadata` to get the full list with labels and groups. The table below is a reference — always prefer the live endpoint for building UI.

| Group               | Value                     | Meaning                               |
| ------------------- | ------------------------- | ------------------------------------- |
| Email Interactions  | `OPENS_EMAIL`             | Contact opens an email                |
| Email Interactions  | `READS_EMAIL`             | Contact reads an email (tracked read) |
| Email Interactions  | `CLICKS_LINK_IN_EMAIL`    | Contact clicks a link in an email     |
| Email Interactions  | `REPLIES_EMAIL`           | Contact replies to an email           |
| Email Interactions  | `FORWARDS_EMAIL`          | Contact forwards an email             |
| Email Interactions  | `SHARES_EMAIL`            | Contact shares an email               |
| Subscription / List | `SUBSCRIBES_TO_LIST`      | Contact joins a campaign list         |
| Subscription / List | `UNSUBSCRIBES_FROM_LIST`  | Contact leaves a campaign list        |
| Web & Form          | `WEBPAGE_VISITED`         | Contact visits a tracked webpage      |
| Web & Form          | `SUBMITS_FORM`            | Contact submits a form                |
| Web & Form          | `FILE_DOWNLOADED`         | Contact downloads a file              |
| Web & Form          | `DISMISSES_SITE_MESSAGE`  | Contact dismisses a site message      |
| Customer Data       | `TAG_ADDED`               | A tag is added to a contact           |
| Customer Data       | `TAG_REMOVED`             | A tag is removed from a contact       |
| Customer Data       | `CONTACT_FIELD_CHANGES`   | A contact field value changes         |
| Customer Data       | `CONTACT_JUMPED_TO`       | Contact is moved to a specific stage  |
| Customer Data       | `STATUS_CHANGED`          | Contact status changes                |
| Deals & Pipeline    | `DEAL_FIELD_CHANGES`      | A deal field changes                  |
| Deals & Pipeline    | `ACCOUNT_FIELD_CHANGES`   | An account field changes              |
| Deals & Pipeline    | `ENTERS_PIPELINE`         | Contact enters a pipeline             |
| Deals & Pipeline    | `DEAL_STAGE_OCCURS`       | Deal reaches a stage                  |
| Deals & Pipeline    | `DEAL_STATUS_CHANGES`     | Deal status changes                   |
| Deals & Pipeline    | `DEAL_VALUE_CHANGES`      | Deal value changes                    |
| Deals & Pipeline    | `DEAL_OWNER_CHANGES`      | Deal owner changes                    |
| Deals & Pipeline    | `SENTIMENT_CHANGES`       | AI-detected sentiment changes         |
| Commerce            | `CONVERSION_OCCURS`       | A conversion event fires              |
| Commerce            | `MAKES_PURCHASE`          | Contact makes a purchase              |
| System              | `EVENT_RECORDED`          | A custom event is recorded            |
| System              | `RSS_BASED`               | RSS feed update                       |
| System              | `WHATSAPP_FLOW_COMPLETED` | WhatsApp flow completed               |
| System              | `TASK_COMPLETED`          | A task is completed                   |
| System              | `FAQ_TRIGGERED`           | An FAQ is triggered by a contact      |
| System              | `SMART_RULE_MET`          | A smart rule condition is met         |
| Time & Activity     | `TIME_BASED`              | Scheduled / time-based trigger        |
| Time & Activity     | `ACTIVITY_THRESHOLD`      | Contact activity crosses a threshold  |

---

## API Reference

### Authentication

All endpoints require a valid session / JWT.

```
Authorization: Bearer <token>
```

---

### Get automation builder metadata

```
GET /automations/metadata
```

Returns all available **triggers**, **action steps**, **condition steps**, **condition operators**, and **logic options** as structured lists. No DB query — always the same static response. Use this to populate dropdowns and palettes in the automation builder so the frontend never has to hard-code these values.

**Response `200`**

```json
{
  "triggers": [
    {
      "value": "OPENS_EMAIL",
      "label": "Opens Email",
      "group": "Email Interactions"
    },
    {
      "value": "READS_EMAIL",
      "label": "Reads Email",
      "group": "Email Interactions"
    },
    {
      "value": "CLICKS_LINK_IN_EMAIL",
      "label": "Clicks Link In Email",
      "group": "Email Interactions"
    },
    {
      "value": "REPLIES_EMAIL",
      "label": "Replies Email",
      "group": "Email Interactions"
    },
    {
      "value": "FORWARDS_EMAIL",
      "label": "Forwards Email",
      "group": "Email Interactions"
    },
    {
      "value": "SHARES_EMAIL",
      "label": "Shares Email",
      "group": "Email Interactions"
    },
    {
      "value": "SUBSCRIBES_TO_LIST",
      "label": "Subscribes To List",
      "group": "Subscription / List"
    },
    {
      "value": "UNSUBSCRIBES_FROM_LIST",
      "label": "Unsubscribes From List",
      "group": "Subscription / List"
    },
    {
      "value": "WEBPAGE_VISITED",
      "label": "Webpage Visited",
      "group": "Web & Form"
    },
    { "value": "SUBMITS_FORM", "label": "Submits Form", "group": "Web & Form" },
    {
      "value": "FILE_DOWNLOADED",
      "label": "File Downloaded",
      "group": "Web & Form"
    },
    {
      "value": "DISMISSES_SITE_MESSAGE",
      "label": "Dismisses Site Message",
      "group": "Web & Form"
    },
    { "value": "TAG_ADDED", "label": "Tag Added", "group": "Customer Data" },
    {
      "value": "TAG_REMOVED",
      "label": "Tag Removed",
      "group": "Customer Data"
    },
    {
      "value": "CONTACT_FIELD_CHANGES",
      "label": "Contact Field Changes",
      "group": "Customer Data"
    },
    {
      "value": "CONTACT_JUMPED_TO",
      "label": "Contact Jumped To",
      "group": "Customer Data"
    },
    {
      "value": "STATUS_CHANGED",
      "label": "Status Changed",
      "group": "Customer Data"
    },
    {
      "value": "DEAL_FIELD_CHANGES",
      "label": "Deal Field Changes",
      "group": "Deals & Pipeline"
    },
    {
      "value": "ACCOUNT_FIELD_CHANGES",
      "label": "Account Field Changes",
      "group": "Deals & Pipeline"
    },
    {
      "value": "ENTERS_PIPELINE",
      "label": "Enters Pipeline",
      "group": "Deals & Pipeline"
    },
    {
      "value": "DEAL_STAGE_OCCURS",
      "label": "Deal Stage Occurs",
      "group": "Deals & Pipeline"
    },
    {
      "value": "DEAL_STATUS_CHANGES",
      "label": "Deal Status Changes",
      "group": "Deals & Pipeline"
    },
    {
      "value": "DEAL_VALUE_CHANGES",
      "label": "Deal Value Changes",
      "group": "Deals & Pipeline"
    },
    {
      "value": "DEAL_OWNER_CHANGES",
      "label": "Deal Owner Changes",
      "group": "Deals & Pipeline"
    },
    {
      "value": "SENTIMENT_CHANGES",
      "label": "Sentiment Changes",
      "group": "Deals & Pipeline"
    },
    {
      "value": "CONVERSION_OCCURS",
      "label": "Conversion Occurs",
      "group": "Commerce"
    },
    {
      "value": "MAKES_PURCHASE",
      "label": "Makes Purchase",
      "group": "Commerce"
    },
    { "value": "EVENT_RECORDED", "label": "Event Recorded", "group": "System" },
    { "value": "RSS_BASED", "label": "Rss Based", "group": "System" },
    {
      "value": "WHATSAPP_FLOW_COMPLETED",
      "label": "Whatsapp Flow Completed",
      "group": "System"
    },
    { "value": "TASK_COMPLETED", "label": "Task Completed", "group": "System" },
    { "value": "FAQ_TRIGGERED", "label": "Faq Triggered", "group": "System" },
    { "value": "SMART_RULE_MET", "label": "Smart Rule Met", "group": "System" },
    {
      "value": "TIME_BASED",
      "label": "Time Based",
      "group": "Time & Activity"
    },
    {
      "value": "ACTIVITY_THRESHOLD",
      "label": "Activity Threshold",
      "group": "Time & Activity"
    }
  ],
  "actions": [
    {
      "value": "SEND_MESSAGE",
      "stepKey": "send-message",
      "label": "Send Message",
      "type": "action"
    },
    { "value": "WAIT", "stepKey": "wait", "label": "Wait", "type": "action" },
    {
      "value": "AUTOMATION_LIST",
      "stepKey": "automation-list",
      "label": "Automation List",
      "type": "action"
    },
    {
      "value": "TAG_ACTION",
      "stepKey": "tag-action",
      "label": "Tag Action",
      "type": "action"
    },
    {
      "value": "STATUS_CHANGE",
      "stepKey": "status-change",
      "label": "Status Change",
      "type": "action"
    }
  ],
  "conditions": [
    {
      "value": "SMART_RULE",
      "stepKey": "smart-rule",
      "label": "Smart Rule",
      "type": "condition"
    },
    {
      "value": "TRIGGER_CONDITION",
      "stepKey": "trigger-condition",
      "label": "Trigger Condition",
      "type": "condition"
    }
  ],
  "conditionOperators": [
    { "value": "EQUALS", "label": "Equals" },
    { "value": "NOT_EQUALS", "label": "Not Equals" },
    { "value": "CONTAINS", "label": "Contains" },
    { "value": "NOT_CONTAINS", "label": "Not Contains" },
    { "value": "STARTS_WITH", "label": "Starts With" },
    { "value": "DOES_NOT_START_WITH", "label": "Does Not Start With" },
    { "value": "ENDS_WITH", "label": "Ends With" },
    { "value": "GREATER_THAN", "label": "Greater Than" },
    { "value": "GREATER_THAN_OR_EQUAL", "label": "Greater Than Or Equal" },
    { "value": "LESS_THAN", "label": "Less Than" },
    { "value": "LESS_THAN_OR_EQUAL", "label": "Less Than Or Equal" },
    { "value": "IS_EMPTY", "label": "Is Empty" },
    { "value": "IS_NOT_EMPTY", "label": "Is Not Empty" },
    { "value": "IS_TRUE", "label": "Is True" },
    { "value": "IS_FALSE", "label": "Is False" },
    { "value": "IS_AFTER", "label": "Is After" },
    { "value": "IS_BEFORE", "label": "Is Before" },
    { "value": "IS_ON_OR_AFTER", "label": "Is On Or After" },
    { "value": "IS_ON_OR_BEFORE", "label": "Is On Or Before" },
    { "value": "BETWEEN", "label": "Between" },
    { "value": "IS_ONE_OF", "label": "Is One Of" },
    { "value": "IS_NOT_ONE_OF", "label": "Is Not One Of" }
  ],
  "conditionLogic": [
    { "value": "AND", "label": "All conditions must match (AND)" },
    { "value": "OR", "label": "Any condition must match (OR)" }
  ]
}
```

**Trigger groups** — use the `group` field to render triggers in categorized sections in the UI.

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
  "campaignListId": null,
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
      "triggerType": "ACTIVITY_THRESHOLD",
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

- `name` and `automationCategory` are required. `name` is trimmed — a whitespace-only string is rejected.
- `automationCategory` must be a valid `AutomationTemplateCategory` enum value.
- `campaignListId` is optional — for `REENGAGEMENT_CAMPAIGNS` only; scopes the `ACTIVITY_THRESHOLD` trigger to contacts on that list.
- `triggers` is optional — max 1 if provided.
- `steps` is optional — these are appended after the auto-created predefined steps.
- For `SALES_LEAD_GENERATION`, `SUPPORT_ESCALATION`, `RETENTION_NURTURE`: backend auto-creates predefined steps with `isTemplatePrefilled: true`.
- For `REENGAGEMENT_CAMPAIGNS`: blank slate — use `POST /automation-templates/:id/apply` (recommended) or add steps manually afterward.

**Response `201`** — full automation object, same shape as `GET /automations/:id`. No follow-up fetch needed.

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

Partial update of automation metadata, triggers, and steps. All fields are optional — only the fields you supply are changed. When `triggers` or `steps` are provided, the existing records are **deleted and recreated** in full.

**Request body** (all fields optional)

```json
{
  "name": "Updated Name",
  "description": "Optional",
  "campaignListId": 5,
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
      "triggerType": "ACTIVITY_THRESHOLD",
      "name": "30-day inactive",
      "conditions": [
        {
          "conditionOrder": 0,
          "logicOperator": null,
          "groupId": null,
          "operator": "GREATER_THAN",
          "value": "30",
          "fieldName": null,
          "targetCampaignListId": null,
          "targetLeadGenerationCampaignId": null,
          "targetTagGroupId": null,
          "targetFaqGroupId": null
        }
      ]
    }
  ],
  "steps": []
}
```

**Condition fields** in `triggers[].conditions[]`:

| Field                            | Type                        | Notes                                                                          |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| `conditionOrder`                 | integer                     | 0-based ordering                                                               |
| `logicOperator`                  | `"AND"` \| `"OR"` \| null   | Legacy per-condition logic                                                     |
| `groupId`                        | string \| null              | Conditions sharing a `groupId` are AND-ed together; different groups are OR-ed |
| `fieldName`                      | string \| null              | Contact field path for `field` conditions                                      |
| `operator`                       | `ConditionOperator` \| null | See operator values below                                                      |
| `value`                          | string \| null              | Comparison value; use `"RELATIVE:-7d"` for relative date expressions           |
| `targetCampaignListId`           | integer \| null             | Target campaign list for list-membership conditions                            |
| `targetLeadGenerationCampaignId` | integer \| null             | Target lead generation campaign for campaign conditions                        |
| `targetTagGroupId`               | integer \| null             | Target tag group                                                               |
| `targetFaqGroupId`               | integer \| null             | Target FAQ group                                                               |

**Response `200`** — full automation object, same shape as `GET /automations/:id`. No follow-up fetch needed.

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

Call this **debounced** (e.g. 1 second after last drag). Send `viewport` and `groups` directly — do not wrap in a `layout` key. Nodes and edges are not stored here; they are derived from `logic.steps` on the frontend.

```json
{
  "viewport": { "x": -120, "y": -80, "zoom": 0.85 },
  "groups": [
    {
      "id": "group-1",
      "label": "Lead Capture",
      "bgColor": "#f0f4ff",
      "position": { "x": 100, "y": 80 }
    }
  ]
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

| Status | Scenario                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Missing required field / empty or whitespace-only `name` / invalid enum value / negative or zero integer / more than 1 trigger / missing body on any endpoint that requires one |
| `404`  | Automation or step not found or belongs to another user                                                                                                                         |

---

## TypeScript Reference

```typescript
interface LayoutGroup {
  id: string;
  label?: string;
  bgColor?: string;
  position?: { x: number; y: number };
}

interface AutomationLayout {
  viewport: { x: number; y: number; zoom: number };
  groups: LayoutGroup[];
}

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
  id: string; // stringified DB — parse to int for PATCH endpoint
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
  campaignListId: number | null; // RC automations only
  status: AutomationStatus;
  logicVersion: string;
  logic: {
    version: string;
    trigger: TriggerNode | null;
    steps: LogicStep[];
  };
  layout: AutomationLayout | null;
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

// 2. Create automation — response already includes full { logic, layout } shape
const automation = await fetch("/automations", {
  method: "POST",
  body: JSON.stringify({
    name: "My SLG Setup",
    automationCategory: "SALES_LEAD_GENERATION",
  }),
}).then((r) => r.json());
// automation.logic.steps → 10 steps, all type: "auto", completionStatus: "pending"

const { id } = automation;

// 3. Configure step 0 (webchat install)
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

### Create a Reengagement automation from a template

```typescript
// 1. Fetch available templates for the RC category
const templates = await fetch(
  "/automation-templates?category=REENGAGEMENT_CAMPAIGNS"
).then((r) => r.json());

// 2. Apply a template (creates automation + pre-fills steps + trigger)
//    Pass campaignListId to scope the trigger to contacts on that list
const automation = await fetch(
  `/automation-templates/${templates[0].id}/apply`,
  {
    method: "POST",
    body: JSON.stringify({
      name: "Win-back Campaign",
      description: "Re-engage contacts inactive for 30+ days",
      campaignListId: 5, // only contacts on list #5 will be evaluated
    }),
  }
).then((r) => r.json());
// automation.campaignListId === 5
// automation.logic.steps → pre-filled from template, fully editable
```

### Saving canvas layout (debounced)

```typescript
let saveTimer: ReturnType<typeof setTimeout>;

function onCanvasDrag(automationId: number, layout: AutomationLayout) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(`/automations/${automationId}/layout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout), // send viewport + groups directly, no wrapper key
    });
  }, 1000);
}
```

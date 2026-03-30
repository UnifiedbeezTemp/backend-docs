# Account Configuration API — Frontend Integration Guide

This document covers the full account configuration API: endpoints, request/response shapes, status lifecycle, edge cases, and error handling.

---

## Base URL

All endpoints are prefixed with `/api/v1`.

---

## Authentication

All endpoints require a valid session. Requests without a session return `401 Unauthorized`.

---

## Account Types

The following channel types are AI-configurable and appear in the accounts list:

| `accountType` | Description                                      |
| ------------- | ------------------------------------------------ |
| `"whatsapp"`  | WhatsApp Business account                        |
| `"messenger"` | Facebook Messenger page                          |
| `"instagram"` | Instagram DM page                                |
| `"email"`     | Connected email account (Gmail, Outlook, custom) |
| `"sms"`       | SMS / purchased phone number                     |
| `"telegram"`  | Telegram account                                 |

> `calendar`, `calendly`, `stripe`, `shopify`, `zoom`, and `paypal` are connected channels in the system but are not AI-configurable and will not appear in any of these endpoints.

---

## `configStatus` Values

Each account's configuration has a computed status:

| Value               | Meaning                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `"NOT_STARTED"`     | No configuration record exists for this account                                                                  |
| `"IN_PROGRESS"`     | Configuration exists but `aiAssistantId` has not been set                                                        |
| `"CONFIGURED"`      | `aiAssistantId` is set — account is fully configured                                                             |
| `"NEEDS_ATTENTION"` | Account connection is broken (`DISCONNECTED`, `ERROR`, or `REAUTH_REQUIRED`) — takes priority over config status |

`isConfigured = (configStatus === "CONFIGURED")`

---

## Account `status` Values

| Value               | Meaning                                     |
| ------------------- | ------------------------------------------- |
| `"CONNECTED"`       | Account is active and verified              |
| `"REAUTH_REQUIRED"` | Token/session expired — user must reconnect |
| `"ERROR"`           | Verification failed                         |
| `"DISCONNECTED"`    | Account has been deactivated                |

---

## Endpoints

---

### 1. List all connected accounts

```
GET /api/v1/channel-accounts
```

Returns all AI-configurable accounts with a config summary per account. Use this to render the account selection screen with "configured" badges.

**Query parameters**

| Param         | Type   | Default | Description                            |
| ------------- | ------ | ------- | -------------------------------------- |
| `accountType` | string | —       | Filter to one type (e.g. `"whatsapp"`) |
| `status`      | string | —       | Filter by account status               |
| `page`        | number | `1`     | Page number                            |
| `limit`       | number | `20`    | Max `100`                              |

**Response `200`**

```json
{
  "accounts": [
    {
      "accountId": 12,
      "accountType": "whatsapp",
      "channelKey": "whatsapp",
      "iconKey": "whatsapp",
      "displayName": "WhatsApp – Sales Line",
      "secondaryText": "+234 ••• 1234",
      "status": "CONNECTED",
      "config": {
        "configurationId": 9001,
        "configStatus": "IN_PROGRESS",
        "isConfigured": false,
        "aiAssistantId": null,
        "updatedAt": "2026-03-26T10:10:10.000Z"
      }
    },
    {
      "accountId": 7,
      "accountType": "email",
      "channelKey": "email",
      "iconKey": "email",
      "displayName": "support@acme.com",
      "secondaryText": "s••••@acme.com",
      "status": "CONNECTED",
      "config": null
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Edge cases**

- `config: null` means no configuration has been saved for this account yet. Treat it the same as `configStatus: "NOT_STARTED"`.
- `iconKey` and `channelKey` are always equal to `accountType` — use either for icon rendering.
- `secondaryText` is already masked server-side. Do not re-mask it.

---

### 2. Get account configuration

```
GET /api/v1/channel-accounts/:accountType/:accountId/configuration
```

Returns the full AI configuration for one account.

**URL parameters**

| Param         | Type    | Description                                 |
| ------------- | ------- | ------------------------------------------- |
| `accountType` | string  | One of the valid account types listed above |
| `accountId`   | integer | The account's numeric ID                    |

**Response `200` — configuration exists**

```json
{
  "configurationId": 9001,
  "accountId": 12,
  "accountType": "whatsapp",
  "configStatus": "IN_PROGRESS",
  "isConfigured": false,
  "aiAssistantId": null,
  "escalation": {
    "enabled": false,
    "unansweredMessagesThreshold": 5,
    "timeAmount": 30,
    "timeUnit": "MINUTES",
    "keywords": [],
    "contacts": [],
    "escalateToAllMembers": false
  },
  "followUp": {
    "enabled": false,
    "delayAmount": 24,
    "delayUnit": "HOURS",
    "contentType": "SUPPORT"
  },
  "aiBehavior": {
    "replyDelayAmount": 10,
    "replyDelayUnit": "MINUTES",
    "openingHour": 9,
    "closingHour": 17,
    "timezone": "UTC",
    "workingDays": []
  },
  "access": {
    "teamAccess": [
      {
        "teamMemberId": 3,
        "fullName": "Ada Obi",
        "email": "ada@acme.com",
        "canView": true,
        "canModify": false,
        "grantedAt": "2026-03-01T09:00:00.000Z"
      }
    ]
  },
  "updatedAt": "2026-03-26T10:10:10.000Z",
  "createdAt": "2026-03-20T08:00:00.000Z"
}
```

**Response `200` — no configuration exists**

```json
null
```

The status code is always `200`. When `null` is returned, show an empty/default form in the drawer. The first `PATCH` call will create the record.

**Errors**

| Status | Reason                                                |
| ------ | ----------------------------------------------------- |
| `400`  | Invalid `accountType` (not one of the allowed values) |
| `401`  | Not authenticated                                     |
| `404`  | Account not found or belongs to another user          |

---

### 3. Create or update account configuration

```
PATCH /api/v1/channel-accounts/:accountType/:accountId/configuration
```

Partial update. All fields are optional — only the fields you include are written. If no configuration exists yet, it is created on this call.

**URL parameters** — same as GET above.

**Request body** — all fields optional

```json
{
  "aiAssistantId": 77,
  "escalation": {
    "enabled": true,
    "unansweredMessagesThreshold": 3,
    "timeAmount": 15,
    "timeUnit": "MINUTES",
    "keywords": ["refund", "cancel", "chargeback"],
    "contacts": [{ "email": "manager@acme.com", "fullName": "Jane Manager" }],
    "escalateToAllMembers": false
  },
  "followUp": {
    "enabled": true,
    "delayAmount": 24,
    "delayUnit": "HOURS",
    "contentType": "SALES"
  },
  "aiBehavior": {
    "replyDelayAmount": 5,
    "replyDelayUnit": "MINUTES",
    "openingHour": 9,
    "closingHour": 17,
    "timezone": "Africa/Lagos",
    "workingDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
  },
  "access": {
    "teamAccess": [{ "teamMemberId": 3, "canView": true, "canModify": true }]
  }
}
```

**Field reference**

| Field                                    | Type     | Constraint    | Notes                                       |
| ---------------------------------------- | -------- | ------------- | ------------------------------------------- |
| `aiAssistantId`                          | integer  | `≥ 1`         | Must be an assistant belonging to the user  |
| `escalation.unansweredMessagesThreshold` | integer  | `≥ 1`         |                                             |
| `escalation.timeAmount`                  | integer  | `≥ 1`         |                                             |
| `escalation.timeUnit`                    | string   | enum          | `SECONDS` \| `MINUTES` \| `HOURS` \| `DAYS` |
| `escalation.keywords`                    | string[] | —             | Full replace when included                  |
| `escalation.contacts[].email`            | string   | valid email   | Required per contact                        |
| `escalation.contacts[].fullName`         | string   | optional      |                                             |
| `followUp.delayAmount`                   | integer  | `≥ 1`         |                                             |
| `followUp.delayUnit`                     | string   | enum          | `MINUTES` \| `HOURS` \| `DAYS`              |
| `followUp.contentType`                   | string   | enum          | See follow-up content types catalog         |
| `aiBehavior.replyDelayAmount`            | integer  | `≥ 0`         |                                             |
| `aiBehavior.replyDelayUnit`              | string   | enum          | `SECONDS` \| `MINUTES` \| `HOURS`           |
| `aiBehavior.openingHour`                 | integer  | `0–23`        |                                             |
| `aiBehavior.closingHour`                 | integer  | `0–23`        |                                             |
| `aiBehavior.timezone`                    | string   | IANA timezone | Validated against the timezones catalog     |
| `aiBehavior.workingDays`                 | string[] | enum each     | `MONDAY` \| `TUESDAY` \| ... \| `SUNDAY`    |
| `access.teamAccess[].teamMemberId`       | integer  | `≥ 1`         | Must be a team member belonging to the user |
| `access.teamAccess[].canView`            | boolean  | optional      | Defaults to `true`                          |
| `access.teamAccess[].canModify`          | boolean  | optional      | Defaults to `false`                         |

**`access.teamAccess` is a full replace.** Whatever array you send becomes the new state. To clear all access, send `"teamAccess": []`. To leave access unchanged, omit the `access` key entirely.

The same full-replace rule applies to `escalation.keywords` and `escalation.contacts` — if you include the key, the entire list is replaced.

**Response `200`** — same shape as `GET .../configuration` (never null after a PATCH).

**Errors**

| Status | Reason                                                      |
| ------ | ----------------------------------------------------------- |
| `400`  | Validation failure — see error message for details          |
| `400`  | `aiAssistantId` is `0` or negative                          |
| `400`  | Invalid enum value (e.g. `timeUnit: "DECADES"`)             |
| `400`  | `openingHour` or `closingHour` outside `0–23`               |
| `400`  | `teamMemberId` is `0` or negative                           |
| `400`  | `aiAssistantId` does not belong to the user                 |
| `400`  | One or more `teamMemberId` values do not belong to the user |
| `400`  | `timezone` is not in the allowed list                       |
| `400`  | Creating a new config without providing `aiAssistantId`     |
| `401`  | Not authenticated                                           |
| `404`  | Account not found or belongs to another user                |

> **Creating vs updating:** If no config exists and you call `PATCH`, a new record is created. In this case `aiAssistantId` is **required** — the backend cannot create a config without it. For subsequent updates `aiAssistantId` can be omitted.

---

### 4. Bulk apply configuration

```
POST /api/v1/channel-accounts/configuration/bulk
```

Applies the same configuration fields to multiple accounts at once. Only the fields included in `config` are written — existing values for omitted fields are preserved on each account.

**Request body**

```json
{
  "accounts": [
    { "accountType": "whatsapp", "accountId": 12 },
    { "accountType": "sms", "accountId": 7 }
  ],
  "config": {
    "aiBehavior": {
      "timezone": "Africa/Lagos",
      "workingDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    }
  }
}
```

**Response `200`**

```json
{
  "results": [
    { "accountType": "whatsapp", "accountId": 12, "success": true },
    { "accountType": "sms", "accountId": 7, "success": true }
  ]
}
```

If an individual account fails (e.g. not found), the result for that account has `"success": false` with an `"error"` field — other accounts are still processed.

```json
{
  "results": [
    { "accountType": "whatsapp", "accountId": 12, "success": true },
    {
      "accountType": "sms",
      "accountId": 999,
      "success": false,
      "error": "Account not found"
    }
  ]
}
```

**Errors**

| Status | Reason                               |
| ------ | ------------------------------------ |
| `400`  | `accounts` array is missing or empty |
| `400`  | Invalid `accountType` in any entry   |
| `401`  | Not authenticated                    |

---

### 5. Get allowed timezones

```
GET /api/v1/configuration/options/timezones
```

Returns the list of supported IANA timezones. The `timezone` field in `PATCH` is validated against this list. Cache this response — it is static.

**Response `200`**

```json
{
  "timezones": [
    { "value": "UTC", "label": "UTC" },
    { "value": "Africa/Lagos", "label": "Africa/Lagos (WAT, UTC+1)" },
    { "value": "America/New_York", "label": "America/New York (ET, UTC-5)" }
  ],
  "defaultTimezone": "UTC"
}
```

Store `value`, display `label`.

---

### 6. Get follow-up content types

```
GET /api/v1/configuration/options/follow-up-content-types
```

Returns all valid values for `followUp.contentType`. Cache this response — it is static.

**Response `200`**

```json
{
  "contentTypes": [
    { "code": "SALES", "label": "Sales Follow-up" },
    { "code": "SUPPORT", "label": "Customer Support" },
    { "code": "BOOKING_REMINDER", "label": "Booking Reminder" },
    { "code": "COLD_LEAD_NUDGE", "label": "Cold Lead Nudge" },
    { "code": "ABANDONED_CART", "label": "Abandoned Cart" },
    { "code": "ONBOARDING_SETUP_HELP", "label": "Onboarding Help" },
    { "code": "CUSTOM", "label": "Custom" }
  ]
}
```

Store `code` in state, display `label` in the UI.

---

### 7. Get escalation keyword suggestions

```
GET /api/v1/configuration/options/escalation-keywords
GET /api/v1/configuration/options/escalation-keywords?industryType=retail
```

Returns suggested keywords for pre-filling the escalation keywords input. These are hints only — the user can add or remove any keyword regardless of this list.

**Query parameters**

| Param          | Type   | Description                                                                                   |
| -------------- | ------ | --------------------------------------------------------------------------------------------- |
| `industryType` | string | Optional. Must be one of the values below. Falls back to defaults if omitted or unrecognised. |

**Supported `industryType` values**

| Value                 | Industry             |
| --------------------- | -------------------- |
| `ECOMMERCE_RETAIL`    | E-commerce & Retail  |
| `REAL_ESTATE`         | Real Estate          |
| `HEALTHCARE_CLINICS`  | Healthcare & Clinics |
| `EDUCATION`           | Education            |
| `FINANCE_ACCOUNTING`  | Finance & Accounting |
| `LEGAL`               | Legal Services       |
| `EVENTS_BOOKINGS`     | Events & Bookings    |
| `HOSPITALITY`         | Hospitality          |
| `BEAUTY_WELLNESS`     | Beauty & Wellness    |
| `TECH_SUPPORT_SAAS`   | Tech Support & SaaS  |
| `AUTOMOTIVE`          | Automotive           |
| `PROPERTY_MANAGEMENT` | Property Management  |

**Response `200`**

```json
{
  "industryType": "ECOMMERCE_RETAIL",
  "keywords": [
    "refund",
    "return",
    "exchange",
    "not delivered",
    "payment failed",
    "cancel order",
    "wrong item",
    "tracking"
  ]
}
```

---

## Error Response Shape

All errors use this shape:

```json
{
  "statusCode": 400,
  "message": "Human-readable description or array of validation errors",
  "error": "Bad Request"
}
```

Validation errors return an array in `message`:

```json
{
  "statusCode": 400,
  "message": [
    "aiAssistantId must not be less than 1",
    "aiBehavior.timezone must be a string"
  ],
  "error": "Bad Request"
}
```

---

## Edge Cases

### Opening a config drawer for the first time

`GET .../configuration` returns `null` (with `200`) when no config exists. Render an empty/default form. Do not show an error.

The first `PATCH` creates the record — `aiAssistantId` is required at this point. Ensure the user selects an AI assistant before saving for the first time.

### Updating only one section

You do not need to send the full config on every save. Send only the section being updated:

```json
{ "aiBehavior": { "timezone": "Africa/Lagos" } }
```

All other fields remain unchanged.

### Clearing a list field

To remove all escalation keywords: include `"keywords": []` in the request. Omitting the key entirely leaves the existing keywords unchanged.

```json
{ "escalation": { "keywords": [] } }
```

### Removing all team access

```json
{ "access": { "teamAccess": [] } }
```

### `NEEDS_ATTENTION` accounts

Accounts with `configStatus: "NEEDS_ATTENTION"` have a broken connection — the AI configuration cannot be edited until the connection is restored. The backend still returns the configuration data, but you should show a "reconnect" prompt instead of the config form.

### Bulk apply partial failure

A bulk request processes every account independently. A failure on one account does not abort the others. Always check each entry in `results` for `success: false` and surface errors to the user.

---

## TypeScript Reference

```typescript
type AccountType =
  | "whatsapp"
  | "messenger"
  | "instagram"
  | "email"
  | "sms"
  | "telegram";

type AccountStatus = "CONNECTED" | "REAUTH_REQUIRED" | "ERROR" | "DISCONNECTED";

type ConfigStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "CONFIGURED"
  | "NEEDS_ATTENTION";

type EscalationTimeUnit = "SECONDS" | "MINUTES" | "HOURS" | "DAYS";
type FollowUpDelayUnit = "MINUTES" | "HOURS" | "DAYS";
type FollowUpContentType =
  | "SALES"
  | "SUPPORT"
  | "BOOKING_REMINDER"
  | "COLD_LEAD_NUDGE"
  | "ABANDONED_CART"
  | "ONBOARDING_SETUP_HELP"
  | "CUSTOM";
type ReplyDelayUnit = "SECONDS" | "MINUTES" | "HOURS";
type WorkingDay =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

interface AccountListItem {
  accountId: number;
  accountType: AccountType;
  channelKey: AccountType;
  iconKey: AccountType;
  displayName: string;
  secondaryText: string;
  status: AccountStatus;
  config: AccountConfigSummary | null;
}

interface AccountConfigSummary {
  configurationId: number;
  configStatus: ConfigStatus;
  isConfigured: boolean;
  aiAssistantId: number | null;
  updatedAt: string;
}

interface AccountConfigDetail {
  configurationId: number;
  accountId: number;
  accountType: AccountType;
  configStatus: ConfigStatus;
  isConfigured: boolean;
  aiAssistantId: number | null;
  escalation: {
    enabled: boolean;
    unansweredMessagesThreshold: number;
    timeAmount: number;
    timeUnit: EscalationTimeUnit;
    keywords: string[];
    contacts: { email: string; fullName: string | null }[];
    escalateToAllMembers: boolean;
  };
  followUp: {
    enabled: boolean;
    delayAmount: number;
    delayUnit: FollowUpDelayUnit;
    contentType: FollowUpContentType;
  };
  aiBehavior: {
    replyDelayAmount: number;
    replyDelayUnit: ReplyDelayUnit;
    openingHour: number;
    closingHour: number;
    timezone: string;
    workingDays: WorkingDay[];
  };
  access: {
    teamAccess: {
      teamMemberId: number;
      fullName: string | null;
      email: string | null;
      canView: boolean;
      canModify: boolean;
      grantedAt: string;
    }[];
  };
  updatedAt: string;
  createdAt: string;
}

interface AccountListResponse {
  accounts: AccountListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface BulkResult {
  results: {
    accountType: string;
    accountId: number;
    success: boolean;
    error?: string;
  }[];
}
```

---

## Quick-start Example

```typescript
// 1. Fetch option catalogs on app load (cache these)
const [timezones, contentTypes] = await Promise.all([
  fetch("/api/v1/configuration/options/timezones").then((r) => r.json()),
  fetch("/api/v1/configuration/options/follow-up-content-types").then((r) =>
    r.json()
  ),
]);

// 2. Load accounts list
const { accounts } = await fetch("/api/v1/channel-accounts").then((r) =>
  r.json()
);

// 3. User selects an account — open config drawer
const config = await fetch(
  `/api/v1/channel-accounts/${account.accountType}/${account.accountId}/configuration`
).then((r) => r.json());
// config may be null — render default form if so

// 4. User saves — PATCH with only the changed section
await fetch(
  `/api/v1/channel-accounts/${account.accountType}/${account.accountId}/configuration`,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aiAssistantId: selectedAssistantId,
      aiBehavior: {
        timezone: selectedTimezone,
        workingDays: selectedDays,
        openingHour: 9,
        closingHour: 17,
      },
    }),
  }
).then((r) => r.json());

// 5. Bulk apply timezone to all accounts
await fetch("/api/v1/channel-accounts/configuration/bulk", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    accounts: accounts.map((a) => ({
      accountType: a.accountType,
      accountId: a.accountId,
    })),
    config: { aiBehavior: { timezone: "Africa/Lagos" } },
  }),
}).then((r) => r.json());
```

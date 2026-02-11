---
sidebar_position: 2
---

# Channel AI Recommendations API Documentation

## Overview

Get and apply AI configuration recommendations based on user's industry and plan. Recommendations are screen-specific and apply immediately when toggled.

---

## Endpoints

### 1. Get Recommendations

Fetch recommended settings for a specific configuration screen.

```
GET /channels/:channelId/ai-config/:aiId/recommendations
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| channelId | number | Channel ID |
| aiId | number | AI Assistant ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| timezone | string | Yes | User's timezone (e.g., "America/New_York") |
| category | string | No | Screen category: `main-config`, `escalation-rules`, `follow-up-triggers`, `ai-behaviour-settings` |
| accountId | number | No | Account ID (for channel accounts) |
| accountType | string | No | Account type: `whatsapp`, `facebook`, `email`, `sms`, `calendar` |
| webchatId | number | No | Webchat ID (for webchat) |

**Response by Category:**

**`main-config`** (Screen 1):

```json
{
  "escalationEnabled": true,
  "followUpEnabled": true,
  "replyDelayAmount": 5,
  "replyDelayUnit": "SECONDS",
  "teamAccess": [
    {
      "teamMemberId": 1,
      "email": "member@example.com",
      "fullName": "John Doe",
      "canView": true,
      "canModify": true
    }
  ]
}
```

**`escalation-rules`** (Screen 2):

```json
{
  "unansweredMessagesThreshold": 3,
  "escalationKeywords": ["urgent", "emergency", "help"],
  "escalationTimeAmount": 15,
  "escalationTimeUnit": "MINUTES",
  "escalationContacts": [
    {
      "email": "support@example.com",
      "fullName": "Support Team"
    }
  ],
  "escalateToAllMembers": false
}
```

**`follow-up-triggers`** (Screen 3):

```json
{
  "followUpEnabled": true,
  "followUpDelayAmount": 24,
  "followUpDelayUnit": "HOURS",
  "followUpContentType": "SUPPORT"
}
```

**`ai-behaviour-settings`** (Screen 4):

```json
{
  "replyDelayAmount": 5,
  "replyDelayUnit": "SECONDS",
  "workingDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  "timezone": "America/New_York",
  "openingHour": 9,
  "closingHour": 17
}
```

**Examples:**

```javascript
// Screen 1 - Main Config
GET /channels/1/ai-config/2/recommendations?timezone=America/New_York&category=main-config

// Screen 2 - Escalation Rules for WhatsApp account
GET /channels/1/ai-config/2/recommendations?timezone=Europe/London&category=escalation-rules&accountId=5&accountType=whatsapp

// Screen 3 - Follow-up Triggers
GET /channels/1/ai-config/2/recommendations?timezone=Asia/Tokyo&category=follow-up-triggers

// Screen 4 - AI Behaviour Settings
GET /channels/1/ai-config/2/recommendations?timezone=America/Los_Angeles&category=ai-behaviour-settings
```

---

### 2. Apply Recommendations

Apply recommended settings for a specific screen. Called when user toggles "Use Recommended Settings".

```
PATCH /channels/:channelId/ai-config/:aiId/apply-recommendations
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| channelId | number | Channel ID |
| aiId | number | AI Assistant ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| accountId | number | No | Account ID (for channel accounts) |
| accountType | string | No | Account type: `whatsapp`, `facebook`, `email`, `sms`, `calendar` |
| webchatId | number | No | Webchat ID (for webchat) |

**Request Body:**

```json
{
  "timezone": "America/New_York",
  "category": "main-config"
}
```

| Field    | Type   | Required | Options                                                                          |
| -------- | ------ | -------- | -------------------------------------------------------------------------------- |
| timezone | string | Yes      | IANA timezone (e.g., "America/New_York")                                         |
| category | string | Yes      | `main-config`, `escalation-rules`, `follow-up-triggers`, `ai-behaviour-settings` |

**Response:**

```json
{
  "message": "Recommendations for main-config applied successfully",
  "config": {
    "id": 123,
    "escalationEnabled": true,
    "followUpEnabled": true,
    "isRecommendation": true,
    "fieldSources": {
      "escalationEnabled": "RECOMMENDED",
      "followUpEnabled": "RECOMMENDED"
    },
    "recommendationAppliedAt": "2025-01-15T10:30:00.000Z",
    "recommendationVersion": "1.0"
  }
}
```

**Examples:**

```javascript
// Apply Screen 1 recommendations
PATCH /channels/1/ai-config/2/apply-recommendations
Body: {
  "timezone": "America/New_York",
  "category": "main-config"
}

// Apply Screen 2 recommendations for WhatsApp
PATCH /channels/1/ai-config/2/apply-recommendations?accountId=5&accountType=whatsapp
Body: {
  "timezone": "Europe/London",
  "category": "escalation-rules"
}
```

---

## Integration Flow

### 1. Screen Load

When user navigates to a configuration screen:

```javascript
// Get user's timezone
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Fetch recommendations for current screen
const response = await fetch(
  `/channels/${channelId}/ai-config/${aiId}/recommendations?timezone=${timezone}&category=${category}`
);
const recommendations = await response.json();

// Populate form fields with recommendations
```

### 2. Toggle "Use Recommended Settings"

When user toggles the switch ON:

```javascript
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

await fetch(`/channels/${channelId}/ai-config/${aiId}/apply-recommendations`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    timezone,
    category: "main-config", // or current screen category
  }),
});

// Settings applied immediately - refresh form or navigate to next screen
```

### 3. Manual Edit Detection

When user manually changes any field after applying recommendations:

```javascript
// The backend automatically tracks this
// fieldSources will update from "RECOMMENDED" to "CUSTOM" for edited fields
// Audit logs are created automatically
```

---

## Screen Categories

| Category                | Screen   | Fields Applied                                                                                                                      |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `main-config`           | Screen 1 | escalationEnabled, followUpEnabled, replyDelayAmount, replyDelayUnit, teamAccess                                                    |
| `escalation-rules`      | Screen 2 | unansweredMessagesThreshold, escalationKeywords, escalationTimeAmount, escalationTimeUnit, escalationContacts, escalateToAllMembers |
| `follow-up-triggers`    | Screen 3 | followUpEnabled, followUpDelayAmount, followUpDelayUnit, followUpContentType                                                        |
| `ai-behaviour-settings` | Screen 4 | replyDelayAmount, replyDelayUnit, workingDays, timezone, openingHour, closingHour                                                   |

---

## Error Responses

```json
{
  "statusCode": 400,
  "message": "timezone is required"
}
```

```json
{
  "statusCode": 400,
  "message": "Invalid category. Must be one of: main-config, escalation-rules, follow-up-triggers, ai-behaviour-settings"
}
```

```json
{
  "statusCode": 404,
  "message": "Channel not found"
}
```

---

## Notes

- Timezone must be detected from browser: `Intl.DateTimeFormat().resolvedOptions().timeZone`
- For React Native: Use `expo-localization` or `react-native-localize`
- Recommendations vary by user's industry and plan tier
- Each screen applies only its own fields
- Field tracking is automatic - no additional calls needed
- Audit logs are created for both bulk application and individual edits

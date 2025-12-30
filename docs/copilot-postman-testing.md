---
sidebar_position: 12
---

# Copilot Business Identity Step Testing Guide

## Prerequisites

- Base URL: `{your-api-url}`
- Auth token from login
- User ID from session

## Test Flow Structure

### 1. Start Conversation

```http
POST /copilot/start
Authorization: Bearer {token}
```

**Expected Response:**

- Current substep: `planConfirmation`
- Bot message with plan summary component
- 2 options: Proceed or Change plan

---

### 2. Plan Confirmation - Proceed Path

**2a. Confirm Plan (Yes)**

```http
POST /copilot/message
Content-Type: application/json

{
  "inputType": "selection",
  "content": "Yes, Proceed with my current plan",
  "metadata": {
    "selectedOption": true
  }
}
```

**Expected Response:**

- Current substep: `businessIndustry`
- Industry selection grid (11 options + "not listed")

---

### 3. Plan Change Path (Alternative)

**3a. Request Plan Change**

```http
POST /copilot/message

{
  "inputType": "selection",
  "content": "No, Change plan",
  "metadata": {
    "selectedOption": false
  }
}
```

**Expected Response:**

- Current substep: `changePlan`
- Plans preview component

**3b. Execute Plan Change**

```http
POST /copilot/change-plan

{
  "newPlan": "BUSINESS"
}
```

**Expected Response:**

- Returns to appropriate substep with updated plan context

---

### 4. Business Industry Selection

**4a. Select Listed Industry**

```http
POST /copilot/message

{
  "inputType": "selection",
  "content": "E-commerce / Retail",
  "metadata": {
    "selectedOption": "ECOMMERCE_RETAIL"
  }
}
```

**Expected Response:**

- Current substep: `businessName`
- Prompt for business name input

**4b. Select "Not Listed"**

```http
POST /copilot/message

{
  "inputType": "selection",
  "content": "Category not listed here",
  "metadata": {
    "selectedOption": "none"
  }
}
```

**Expected Response:**

- Current substep: `categoryNotListed`
- Text input prompt

---

### 5. Category Not Listed Flow

**5a. Enter Custom Industry**

```http
POST /copilot/message

{
  "inputType": "text",
  "content": "Pet grooming services",
  "metadata": {
    "formField": "industry"
  }
}
```

**Expected Response:**

- AI suggests industry category
- Advances to `businessName`

---

### 6. Business Name Entry

**6a. Enter Business Name**

```http
POST /copilot/message

{
  "inputType": "text",
  "content": "Pawfect Grooming",
  "metadata": {
    "formField": "businessName"
  }
}
```

**Expected Response:**

- Current substep: `selectBusinessNameMatch`
- List of matching businesses + "not listed" option

---

### 7. Business Match Selection

**7a. Select Matched Business**

```http
POST /copilot/message

{
  "inputType": "selection",
  "content": "Private Dog Grooming in Bellevue — Serving Seattle Area | Pawfect Grooming",
  "metadata": {
    "selectedOption": {
      "name": "Private Dog Grooming in Bellevue — Serving Seattle Area | Pawfect Grooming",
      "website": "https://pawfectgrooming.org/",
      "phone": "(425) 502-5135",
      "logo_url": "https://pawfectgrooming.org/images/pawfect.png",
      "source": "google_search",
      "confidence": 0.8
    }
  }
}
```

**Expected Response:**

- Current substep: `confirmBusinessData`
- Business details + AI-generated goals
- Section complete flag: `true`

**Continue to next step (team member)**

```json
{
  "inputType": "selection",
  "content": "Continue",
  "metadata": {
    "selectedOption": "continue"
  }
}
```

**7b. Select "Not Listed"**

```http
POST /copilot/message

{
  "inputType": "selection",
  "content": "My business isn't listed",
  "metadata": {
    "selectedOption": ""
  }
}
```

**Expected Response:**

- Current substep: `businessNotListed`
- Logo upload component

---

### 8. Business Not Listed - Logo Upload

**8a. Upload Logo** (Custom handling required)

```http
POST /copilot/message

{
  "inputType": "custom",
  "content": "logo_uploaded",
  "metadata": {
    "logoUrl": "s3://bucket/user-123/logo.png"
  }
}
```

**Expected Response:**

- Section complete
- Advances to next section: `teamMembers`

---

## Edit Flow Tests

### 9. Edit Business Industry

**9a. Request Edit**

```http
POST /copilot/edit/businessIndustry

{
  "newValue": "HEALTHCARE_CLINICS"
}
```

**Expected Response:**

- Updated `collected_data.industry`
- If dependent steps exist, returns first affected step
- Otherwise, returns current position

---

### 10. Skip Flow Tests

**10a. Skip Business Industry**

```http
POST /copilot/skip

{
  "substepId": "businessIndustry"
}
```

**Expected Response:**

- Substep marked as skipped
- System event recorded
- Advances to next available substep

---

## State Management Tests

### 11. Get Current State

```http
GET /copilot/state
```

**Expected Response:**

```json
{
  "conversationId": 123,
  "currentSection": "businessIdentity",
  "currentSubstep": "planConfirmation",
  "sessionState": {
    "current_section": "businessIdentity",
    "current_substep": "planConfirmation",
    "completed_substeps": [],
    "completed_sections": [],
    "skipped_substeps": [],
    "collected_data": {},
    "edit_history": []
  },
  "recentMessages": [...],
  "currentSubstepDetails": {...}
}
```

---

### 12. Restart Conversation

```http
POST /copilot/restart
```

**Expected Response:**

- New conversation created
- Previous marked inactive
- Returns to `planConfirmation`

---

## Validation Tests

### 13. Invalid Input Handling

**13a. Wrong Input Type**

```http
POST /copilot/message

{
  "inputType": "text",
  "content": "some text",
  "metadata": {}
}
```

On a choice substep - should return error

**13b. Missing Required Selection**

```http
POST /copilot/message

{
  "inputType": "selection",
  "content": "",
  "metadata": {}
}
```

**Expected Response:** 400 error - "Selection required"

---

## Test Execution Order

1. Start → Plan Confirmation → Yes → Industry → Name → Match → Confirm ✅
2. Start → Plan Change → Select New Plan → Industry → ... ✅
3. Start → Industry → Not Listed → Custom → Name → ... ✅
4. Mid-flow: Edit Industry → Verify state update ✅
5. Mid-flow: Skip substep → Verify skip logic ✅
6. Restart conversation → Verify reset ✅

Each path should validate:

- Correct substep transitions
- Proper data persistence in `collected_data`
- Message history recording
- UI directive components
- Error handling

# Team Members Section - Postman Test Flow

## Prerequisites

Complete `businessIdentity` section and be at `teamSize` substep.

---

## Test 1: Team Size Selection - "Just Me"

**POST** `/api/v1/copilot/message`

```json
{
  "inputType": "selection",
  "content": "Just Me",
  "metadata": {
    "selectedOption": "1"
  }
}
```

**Expected:** Advance to `inviteTeamLater` substep

---

## Test 2: Team Size Selection - "2-5"

**POST** `/api/v1/copilot/message`

```json
{
  "inputType": "selection",
  "content": "2-5",
  "metadata": {
    "selectedOption": "2-5"
  }
}
```

**Expected:** Advance to `inviteTeam` substep

---

## Test 3: Invite Team - "Invite Now" (Exit Option)

At `inviteTeam` substep:

```json
{
  "inputType": "selection",
  "content": "Invite Now",
  "metadata": {
    "selectedOption": "inviteNow"
  }
}
```

**Expected:** Handle `isExitOption: true` - should trigger special flow or stay on current substep

---

## Test 4: Invite Team - "Invite Later"

At `inviteTeam` substep:

```json
{
  "inputType": "selection",
  "content": "Invite Later",
  "metadata": {
    "selectedOption": "inviteLater"
  }
}
```

**Expected:** Advance to `inviteTeamLater` (end of section)

---

## Test 5: Complete Section from inviteTeamLater

At `inviteTeamLater` (has `isEndOfStep: true`):

```json
{
  "inputType": "selection",
  "content": "Continue",
  "metadata": {
    "selectedOption": "continue"
  }
}
```

**Expected:**

- Mark `teamMembers` section complete
- Advance to `channels` section with entry substep

---

## Test 6: Plan Validation - Exceeds Limit

Restart and select team size exceeding plan limit:

```json
{
  "inputType": "selection",
  "content": "21 or more",
  "metadata": {
    "selectedOption": "21"
  }
}
```

**Expected:**

- `showPlanUpgrade: true` in `uiDirectives`
- `suggestedPlan` returned
- Stay on `teamSize` substep

---

## Verification Checklist

After each test, call **GET** `/api/v1/copilot/state` and verify:

- `completed_substeps` includes previous substeps
- `current_substep` matches expected
- `current_section` is `"teamMembers"` (or `"channels"` if section complete)
- `collected_data.team_size` stored correctly
- `botMessage` properly interpolated
- `completed_sections` includes `"teamMembers"` after final step

# Testing Channels → AI Assistant Flow

## Prerequisites

- Active user session with valid JWT token
- User has selected a plan during onboarding
- User has completed businessIdentity section

## Step 1: Start/Resume Conversation

**GET** `/copilot/state`

Headers:

```
Authorization: Bearer {your_jwt_token}
```

**Expected Response:**

```json
{
  "currentSection": "channels",
  "currentSubstep": "channels",
  "sessionState": {
    "collected_data": {
      "industry": "ECOMMERCE_RETAIL",
      "selected_plan": "BUSINESS"
    }
  }
}
```

## Step 2: Select Channels

**POST** `/copilot/message`

Body:

```json
{
  "content": "WhatsApp Business, Email, SMS",
  "inputType": "choice",
  "metadata": {
    "substepId": "channels",
    "selectedOptions": ["whatsapp", "gmail", "twilio_sms"]
  }
}
```

**Expected Response:**

```json
{
  "currentSubstep": {
    "id": "confirmChannelsConfiguration",
    "botMessage": "Great! I've noted these channels: WhatsApp Business, Gmail, Twilio SMS..."
  },
  "lastUserMessage": {
    "content": "WhatsApp Business, Gmail, Twilio SMS"
  }
}
```

## Step 3: Choose Settings Strategy

**POST** `/copilot/message`

Body (for recommended):

```json
{
  "content": "Use recommended settings",
  "inputType": "choice",
  "metadata": {
    "substepId": "confirmChannelsConfiguration",
    "selectedOption": true
  }
}
```

Or (for manual):

```json
{
  "content": "Configure now",
  "inputType": "choice",
  "metadata": {
    "substepId": "confirmChannelsConfiguration",
    "selectedOption": false
  }
}
```

**Expected Response:**

```json
{
  "currentSubstep": {
    "id": "noReplyConfiguration",
    "parentStepId": "fallbackLogic"
  },
  "sectionComplete": true
}
```

## Step 4: Select Fallback Behavior

**POST** `/copilot/message`

Body:

```json
{
  "content": "Escalate to someone else",
  "inputType": "choice",
  "metadata": {
    "substepId": "noReplyConfiguration",
    "selectedOption": "escalate"
  }
}
```

**Expected Response:**

```json
{
  "currentSubstep": {
    "id": "confirmNoReplyConfiguration",
    "botMessage": "Okay, I'll escalate if no one replies."
  }
}
```

## Step 5: Confirm Fallback Config

**POST** `/copilot/message`

Body:

```json
{
  "content": "Continue to next step",
  "inputType": "choice",
  "metadata": {
    "substepId": "confirmNoReplyConfiguration",
    "selectedOption": true
  }
}
```

**Expected Response:**

```json
{
  "currentSubstep": {
    "id": "aiAssistantsForChannels",
    "parentStepId": "aiAssistant"
  },
  "sectionComplete": true
}
```

## Step 6: Choose Assistant Strategy

**POST** `/copilot/message`

Body (for multiple):

```json
{
  "content": "Multiple Assistants by Channel",
  "inputType": "choice",
  "metadata": {
    "substepId": "aiAssistantsForChannels",
    "selectedOption": "multiple"
  }
}
```

**Expected Response:**

```json
{
  "currentSubstep": {
    "id": "beezaroAssistants",
    "botMessage": "...we have selected 3 Beezaro assistants..."
  }
}
```

## Step 7: Confirm Assistant Creation

**POST** `/copilot/message`

Body:

```json
{
  "content": "Confirm",
  "inputType": "button",
  "metadata": {
    "substepId": "beezaroAssistants"
  }
}
```

**Expected Response:**

```json
{
  "currentSubstep": {
    "id": "addAutomations",
    "parentStepId": "automation"
  },
  "sectionComplete": true
}
```

## Verification Queries

**Check created assistants:**

```sql
SELECT * FROM ai_assistants WHERE user_id = {userId};
```

**Check channel configs:**

```sql
SELECT cac.*, cc.channel_name, aa.name as assistant_name
FROM channel_ai_configs cac
JOIN connected_channels cc ON cc.id = cac.connected_channel_id
JOIN ai_assistants aa ON aa.id = cac.ai_assistant_id
WHERE cc.user_id = {userId};
```

**Check recommendations applied:**

```sql
SELECT * FROM escalation_keywords WHERE channel_ai_config_id IN (
  SELECT id FROM channel_ai_configs WHERE is_recommendation = true
);
```

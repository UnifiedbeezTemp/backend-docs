# Updated Copilot Testing Guide

## Prerequisites

- Base URL: `{your-api-url}`
- Auth token from login
- User ID from session

---

## Business Identity Section

### 1. Start Conversation

```http
POST /copilot/start
Authorization: Bearer {token}
```

**Expected:** `planConfirmation` substep with 2 options

---

### 2. Plan Confirmation

**Proceed with current plan:**

```json
{
  "inputType": "selection",
  "content": "Yes, Proceed with my current plan",
  "metadata": {
    "substepId": "planConfirmation",
    "selectedOption": true
  }
}
```

**Change plan:**

```json
{
  "inputType": "selection",
  "content": "No, Change plan",
  "metadata": {
    "substepId": "planConfirmation",
    "selectedOption": false
  }
}
```

---

### 3. Business Industry

**Select listed industry:**

```json
{
  "inputType": "selection",
  "content": "E-commerce / Retail",
  "metadata": {
    "substepId": "businessIndustry",
    "selectedOption": "ECOMMERCE_RETAIL"
  }
}
```

**Select "Not Listed":**

```json
{
  "inputType": "selection",
  "content": "Category not listed here",
  "metadata": {
    "substepId": "businessIndustry",
    "selectedOption": "none"
  }
}
```

---

### 4. Category Not Listed

```json
{
  "inputType": "text",
  "content": "Pet grooming services",
  "metadata": {
    "substepId": "categoryNotListed"
  }
}
```

---

### 5. Business Name

```json
{
  "inputType": "text",
  "content": "Pawfect Grooming",
  "metadata": {
    "substepId": "businessName"
  }
}
```

---

### 6. Business Match Selection

**Select matched business:**

```json
{
  "inputType": "selection",
  "content": "Pawfect Grooming - Seattle",
  "metadata": {
    "substepId": "selectBusinessNameMatch",
    "selectedOption": {
      "name": "Pawfect Grooming",
      "website": "https://pawfectgrooming.org/",
      "phone": "(425) 502-5135",
      "logo_url": "https://pawfectgrooming.org/images/pawfect.png"
    }
  }
}
```

**Business not listed:**

```json
{
  "inputType": "selection",
  "content": "My business isn't listed",
  "metadata": {
    "substepId": "selectBusinessNameMatch",
    "selectedOption": ""
  }
}
```

---

### 7. Confirm Business Data

```json
{
  "inputType": "selection",
  "content": "Confirm",
  "metadata": {
    "substepId": "confirmBusinessData",
    "selectedOption": "confirm"
  }
}
```

---

## Team Members Section

### 8. Team Size

**Just me:**

```json
{
  "inputType": "selection",
  "content": "Just Me",
  "metadata": {
    "substepId": "teamSize",
    "selectedOption": "1"
  }
}
```

**2-5 members:**

```json
{
  "inputType": "selection",
  "content": "2-5",
  "metadata": {
    "substepId": "teamSize",
    "selectedOption": "2-5"
  }
}
```

**21+ (triggers upgrade):**

```json
{
  "inputType": "selection",
  "content": "21 or more",
  "metadata": {
    "substepId": "teamSize",
    "selectedOption": "21"
  }
}
```

---

### 9. Invite Team

**Invite later:**

```json
{
  "inputType": "selection",
  "content": "Invite Later",
  "metadata": {
    "substepId": "inviteTeam",
    "selectedOption": "inviteLater"
  }
}
```

---

## Channels Section

### 10. Select Channels

```json
{
  "inputType": "selection",
  "content": "WhatsApp, Gmail, Webchat",
  "metadata": {
    "substepId": "channels",
    "selectedOptions": ["whatsapp", "gmail", "webchat"]
  }
}
```

---

### 11. Confirm Channel Configuration

**Use recommended:**

```json
{
  "inputType": "selection",
  "content": "Use recommended settings",
  "metadata": {
    "substepId": "confirmChannelsConfiguration",
    "selectedOption": true
  }
}
```

**Configure now:**

```json
{
  "inputType": "selection",
  "content": "Configure now",
  "metadata": {
    "substepId": "confirmChannelsConfiguration",
    "selectedOption": false
  }
}
```

---

## Fallback Logic Section

### 12. No Reply Configuration

```json
{
  "inputType": "selection",
  "content": "Escalate to someone else",
  "metadata": {
    "substepId": "noReplyConfiguration",
    "selectedOption": "escalate"
  }
}
```

---

### 13. Confirm No Reply

```json
{
  "inputType": "selection",
  "content": "Continue",
  "metadata": {
    "substepId": "confirmNoReplyConfiguration",
    "selectedOption": true
  }
}
```

---

## AI Assistant Section

### 14. Assistant Strategy

**Multiple assistants:**

```json
{
  "inputType": "selection",
  "content": "Multiple Assistants by Channel",
  "metadata": {
    "substepId": "aiAssistantsForChannels",
    "selectedOption": "multiple"
  }
}
```

**Single assistant:**

```json
{
  "inputType": "selection",
  "content": "Single Assistant",
  "metadata": {
    "substepId": "aiAssistantsForChannels",
    "selectedOption": "single"
  }
}
```

---

### 15. Confirm Assistants

```json
{
  "inputType": "selection",
  "content": "Confirm",
  "metadata": {
    "substepId": "beezaroAssistants",
    "selectedOption": "confirm"
  }
}
```

---

## Automation Section

### 16. Add Automations

**With sub-selections:**

```json
{
  "inputType": "selection",
  "content": "Yes, add automation",
  "metadata": {
    "substepId": "addAutomations",
    "selectedOption": true,
    "subSelectValues": [
      "Tag new leads",
      "Auto-respond after hours",
      "Follow-up after 24h"
    ]
  }
}
```

**Skip automations:**

```json
{
  "inputType": "selection",
  "content": "No, skip",
  "metadata": {
    "substepId": "addAutomations",
    "selectedOption": false
  }
}
```

---

### 17. Confirm Automations

```json
{
  "inputType": "selection",
  "content": "Confirm and continue",
  "metadata": {
    "substepId": "confirmAIAutomations",
    "selectedOption": true
  }
}
```

---

## Edit Flow

### 18. Edit Industry

```http
POST /copilot/edit

{
  "substepId": "businessIndustry",
  "newValue": "HEALTHCARE_CLINICS"
}
```

---

## Validation Test Cases

### ❌ Missing substepId (should fail)

```json
{
  "inputType": "text",
  "content": "Pawfect Grooming",
  "metadata": {
    "formField": "businessName"
  }
}
```

**Expected:** 400 - "substepId required in metadata"

---

### ❌ Wrong substepId (should fail)

```json
{
  "inputType": "selection",
  "content": "E-commerce",
  "metadata": {
    "substepId": "wrongStep",
    "selectedOption": "ECOMMERCE"
  }
}
```

**Expected:** 400 - "Invalid substep context"

---

### ❌ Invalid option (should fail)

```json
{
  "inputType": "selection",
  "content": "Invalid",
  "metadata": {
    "substepId": "businessIndustry",
    "selectedOption": "INVALID_INDUSTRY"
  }
}
```

**Expected:** 400 - "Invalid option"

---

### ❌ Missing sub-selections (should fail)

```json
{
  "inputType": "selection",
  "content": "Yes",
  "metadata": {
    "substepId": "addAutomations",
    "selectedOption": true
  }
}
```

**Expected:** 400 - "Please select at least one automation type"

---

### ❌ Empty text input (should fail)

```json
{
  "inputType": "text",
  "content": "   ",
  "metadata": {
    "substepId": "businessName"
  }
}
```

**Expected:** 400 - "Input cannot be empty"

---

### ❌ Exceeds channel limits (should fail)

```json
{
  "inputType": "selection",
  "content": "Multiple WhatsApp",
  "metadata": {
    "substepId": "channels",
    "selectedOptions": ["whatsapp", "whatsapp_business", "whatsapp_api"]
  }
}
```

**Expected:** 400 - Plan limit exceeded

---

## State Management

### Get Current State

```http
GET /copilot/state
```

### Restart Conversation

```http
POST /copilot/restart
```

---

## Notes

- All selection/choice inputs require `substepId` in metadata
- Text inputs require `substepId` but NOT `formField`
- Sub-selections require `subSelectValues` array
- Multiple selections use `selectedOptions`, single uses `selectedOption`

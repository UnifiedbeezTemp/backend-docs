---
sidebar_position: 10
---

# Copilot Onboarding - Frontend Integration Guide

## Base URL

```
/copilot
```

## Authentication

All endpoints require JWT authentication via `SessionAuthGuard`.

---

## API Endpoints

### 1. Start Conversation

**POST** `/copilot/start`

**Description:** Initialize new copilot onboarding session

**Response:**

```typescript
{
  botMessage: string;
  currentSubstep: {
    id: string;
    name: string;
    type: 'choice' | 'input' | 'custom' | 'button';
    botMessage: string; // Interpolated text only
    options?: Array<{
      label: string;
      value: any;
      type: 'radio' | 'select' | 'button';
      emoji?: string;
      nextSubstepId?: string;
      isCustom?: boolean;
    }>;
    canEdit?: boolean;
    canSkip?: boolean;
    formField?: string;
    optionsMobileType?: string;
  };
  uiDirectives?: {
    components?: Array<{ name: string; metadata?: any }>;
    showAttachment?: boolean;
    [key: string]: any;
  };
  lastUserMessage?: {
    messageType: string;
    content: string;
    metadata: any;
    createdAt: string;
  };
}
```

**Example:**

```typescript
const response = await fetch("/copilot/start", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
```

---

### 2. Send Message

**POST** `/copilot/message`

**Description:** Send user response (selection, text input, file upload)

**Request Body:**

```typescript
{
  content: string;                    // User's selection/input value
  inputType?: 'text' | 'choice' | 'file';
  metadata?: {
    selectedOption?: any;
    formField?: string;
    [key: string]: any;
  };
}
```

**Response:** Same as `/start` response

**Examples:**

**Choice (Button/Option Selection):**

```typescript
await fetch("/copilot/message", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    content: "HEALTHCARE_CLINICS",
    inputType: "choice",
    metadata: {
      selectedOption: "HEALTHCARE_CLINICS",
      formField: "industry",
    },
  }),
});
```

**Text Input:**

```typescript
await fetch("/copilot/message", {
  method: "POST",
  body: JSON.stringify({
    content: "Dental Care Plus",
    inputType: "text",
    metadata: { formField: "businessName" },
  }),
});
```

**General Chat (No formField):**

```typescript
// User types: "I run a dental clinic"
await fetch("/copilot/message", {
  method: "POST",
  body: JSON.stringify({
    content: "I run a dental clinic",
    inputType: "text",
    // No formField = triggers AI intent recognition
  }),
});
```

---

### 3. Edit Previous Step

**POST** `/copilot/edit/:substepId`

**Description:** Go back and change a previous answer

**Request Body:**

```typescript
{
  substepId: string; // Also in URL param
  newValue: any;
}
```

**Response:**

```typescript
{
  botMessage: string;
  currentSubstep: object;
  uiDirectives?: {
    requiresReconfiguration?: string[];  // Affected substep IDs
  };
}
```

**Example:**

```typescript
// User wants to change team size
await fetch("/copilot/edit/teamSize", {
  method: "POST",
  body: JSON.stringify({
    substepId: "teamSize",
    newValue: "6-20",
  }),
});
```

---

### 4. Skip Substep

**POST** `/copilot/skip`

**Description:** Skip current substep (if allowed)

**Request Body:**

```typescript
{
  substepId: string;
}
```

**Response:** Same as `/message` response

---

### 5. Get Current State

**GET** `/copilot/state`

**Description:** Retrieve current conversation state and progress

**Response:**

```typescript
{
  conversationId: number;
  currentSection: string;
  currentSubstep: string;
  sessionState: {
    current_section: string;
    current_substep: string;
    last_interaction: string;
    collected_data: {
      confirmed_plan?: boolean;
      selected_plan?: 'INDIVIDUAL' | 'BUSINESS' | 'PREMIUM' | 'ORGANISATION';
      industry?: string;
      business_name?: string;
      selected_business?: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
        website?: string;
        logo_url?: string;
      };
      team_size?: string;
      team_members?: Array<{ email: string; name?: string; role?: string }>;
      selected_channels?: string[];
      no_reply_action?: 'wait' | 'escalate' | 'followUp';
      ai_setup_type?: 'single' | 'multiple';
      selected_automations?: string[];
    };
    completed_sections: string[];
    completed_substeps: string[];
    skipped_substeps: string[];
    edit_history: Array<{
      section: string;
      substep: string;
      field: string;
      old_value: any;
      new_value: any;
      timestamp: string;
      affected_substeps?: string[];
    }>;
  };
  isActive: boolean;
  isCompleted: boolean;
  recentMessages: Array<{
    messageType: 'USER_INPUT' | 'USER_SELECTION' | 'USER_EDIT' | 'AI_RESPONSE' | 'SECTION_COMPLETE' | 'SYSTEM';
    content: string;
    metadata: {
      section: string;
      substep: string;
      action: string;
      formField?: string;
      selectedValue?: any;
      substepConfig?: {
        id: string;
        type: 'choice' | 'input' | 'custom' | 'button';
        canEdit: boolean;
        canSkip?: boolean;
        formField?: string;
        botMessage: string;
        options?: Array<{
          label: string;
          value: any;
          type: 'radio' | 'select' | 'button';
          emoji?: string;
          nextSubstepId?: string;
          isCustom?: boolean;
        }>;
      };
    };
    createdAt: string;
  }>;
}
```

---

### 6. Restart Conversation

**POST** `/copilot/restart`

**Description:** Mark current conversation inactive and start fresh

**Response:** Same as `/start` response

---

### 7. Change Plan

**POST** `/copilot/change-plan`

**Description:** Switch user's plan mid-onboarding

**Request Body:**

```typescript
{
  newPlan: "INDIVIDUAL" | "BUSINESS" | "PREMIUM" | "ORGANISATION";
}
```

**Response:**

```typescript
{
  botMessage: string;
  currentSubstep: object;
  uiDirectives?: {
    requiresReconfiguration?: string[];
  };
}
```

**Example:**

```typescript
// User clicks "Change plan" button
await fetch("/copilot/change-plan", {
  method: "POST",
  body: JSON.stringify({
    newPlan: "BUSINESS",
  }),
});
```

---

### 8. AI Assist (Optional)

**POST** `/copilot/ai-assist`

**Description:** Direct access to Python Lambda AI services

**Request Body:**

```typescript
{
  action: 'suggest_industry' | 'generate_goals_objectives' | 'parse_intent';
  user_input: string;
  context?: any;
}
```

---

## Frontend Flow

### Initial Load

```typescript
// 1. Start conversation
const { botMessage, currentSubstep } = await POST("/copilot/start");

// 2. Display bot message
displayMessage(botMessage);

// 3. Render UI based on substep type
if (currentSubstep.type === "choice") {
  renderOptions(currentSubstep.options);
} else if (currentSubstep.type === "input") {
  renderTextInput();
} else if (currentSubstep.type === "custom") {
  renderCustomComponent(currentSubstep.attachment.name);
}
```

### User Responds

```typescript
// User selects option or enters text
const response = await POST("/copilot/message", {
  content: userSelection,
  inputType: "selection",
  metadata: {
    selectedOption: userSelection,
    formField: currentSubstep.formField,
  },
});

// Update UI
displayMessage(response.botMessage);
renderSubstep(response.currentSubstep);
```

### Handle Special Cases

**Plan Upgrade Prompt:**

```typescript
if (response.uiDirectives?.showPlanUpgrade) {
  showModal({
    message: response.botMessage,
    suggestedPlan: response.uiDirectives.suggestedPlan,
    onUpgrade: () =>
      POST("/copilot/change-plan", {
        newPlan: response.uiDirectives.suggestedPlan,
      }),
  });
}
```

**Reconfiguration Required:**

```typescript
if (response.uiDirectives?.requiresReconfiguration) {
  const affectedSteps = response.uiDirectives.requiresReconfiguration;
  showNotification(`Changes affect: ${affectedSteps.join(", ")}`);
  // Backend automatically redirects to first affected step
}
```

**Section Complete:**

```typescript
if (response.sectionComplete) {
  showSectionCompleteAnimation();
  updateProgressBar(sessionState.completed_sections.length / 6);
}
```

**Conversation Complete:**

```typescript
if (response.conversationComplete) {
  redirectTo("/dashboard");
}
```

---

## UI Directives Reference

| Directive                 | Type     | When Used                                  |
| ------------------------- | -------- | ------------------------------------------ |
| `components`              | array    | Components to render alongside bot message |
| `showPlanUpgrade`         | boolean  | User selection exceeds current plan        |
| `suggestedPlan`           | PlanType | Which plan to upgrade to                   |
| `highlightOption`         | string   | Auto-suggest from AI parsing               |
| `requiresReconfiguration` | string[] | Edit triggered reconfiguration             |

---

## Bot Message & Components

Bot messages support text + component rendering:

```typescript
{
  "botMessage": "Hi Joshua, I'm Beezaro\n\nPlease confirm your plan",
  "uiDirectives": {
    "components": [
      { "name": "planSummary", "metadata": {} }
    ]
  }
}

// Render
<BotMessage>{response.botMessage}</BotMessage>
{response.uiDirectives?.components?.map(comp =>
  <Component name={comp.name} {...comp.metadata} />
)}
```

**Available components:** `planSummary`, `plansPreview`, `businessLogo`, `logoUpload`, `AssistantCard`

---

## Last User Message

Responses include the user's message:

```typescript
{
  "lastUserMessage": {
    "messageType": "USER_SELECTION",
    "content": "HEALTHCARE_CLINICS",
    "metadata": { ... },
    "createdAt": "2025-12-22T12:00:00.000Z"
  }
}

// Use for immediate UI update
appendMessage(response.lastUserMessage);
appendMessage({ type: 'bot', content: response.botMessage });
```

---

## Special Substeps Handling

### planConfirmation

Render plan summary component:

```typescript
if (response.uiDirectives?.components?.some((c) => c.name === "planSummary")) {
  renderPlanSummary(userData.plan);
}
```

### changePlan

Render plans preview:

```typescript
if (response.uiDirectives?.components?.some((c) => c.name === "plansPreview")) {
  const plans = await fetchPlans();
  renderPlansGrid(plans);
}
```

### categoryNotListed

Text input triggers AI suggestion:

```typescript
// User types business description
const response = await POST("/copilot/message", {
  content: "I run a dental clinic",
  inputType: "text",
});

// Backend returns suggested industry with highlight
if (response.uiDirectives?.highlightOption) {
  highlightIndustryChip(response.uiDirectives.highlightOption);
}
```

### businessName

After input, searches for matches:

```typescript
const response = await POST("/copilot/message", {
  content: "Dental Care Plus",
  metadata: { formField: "businessName" },
});

// Backend automatically searches and moves to selectBusinessNameMatch
// Next substep shows business options
```

### selectBusinessNameMatch

Shows scraped business data:

```typescript
currentSubstep.options.forEach((business) => {
  renderBusinessCard({
    name: business.label,
    details: business.value, // Contains address, phone, email, website, logo
  });
});
```

### confirmBusinessData

Shows business data preview:

```typescript
if (currentSubstep.attachment?.name === "businessDataPreview") {
  renderBusinessPreview(sessionState.collected_data.selected_business);
}
```

### businessNotListed

Render logo upload component. Upload directly to backend endpoint:

```typescript
if (response.uiDirectives?.components?.some((c) => c.name === "logoUpload")) {
  renderFileUploader({
    accept: "image/png,image/jpeg,image/jpg,image/webp",
    maxSize: 5 * 1024 * 1024, // 5MB
    onUpload: async (file) => {
      const formData = new FormData();
      formData.append("logo", file);
      formData.append("substepId", "businessNotListed");

      const response = await POST("/copilot/upload-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Response advances to next section automatically
      updateUI(response);
    },
  });
}
```

**Validation:**

- Allowed types: PNG, JPG, JPEG, WebP
- Max size: 5MB
- Completes `businessNotListed` substep and advances to next section

### beezaroAssistants

Render AI assistant cards:

```typescript
const assistantComponents = response.uiDirectives?.components?.filter(
  (c) => c.name === "AssistantCard"
);

assistantComponents?.forEach((comp) => {
  renderAssistantCard({
    name: comp.metadata.name,
    tags: comp.metadata.tags,
    id: comp.metadata.id,
  });
});
```

---

## Bot Message Structure

Bot messages now use an array format supporting both text and components:

```json
{
  "botMessage": "Hi Joshua, I'm Beezaro\n\nPlease confirm that you selected the BUSINESS plan",
  "currentSubstep": {
    "botMessage": "Hi Joshua, I'm Beezaro\n\nPlease confirm that you selected the BUSINESS plan"
    // ... other fields
  },
  "uiDirectives": {
    "components": [
      {
        "name": "planSummary",
        "metadata": {}
      }
    ]
  }
}
```

**Backend processing:**

- Extracts text messages from array
- Interpolates variables like `{firstName}`, `{selectedPlan}`
- Returns plain text in `botMessage`
- Returns components separately in `uiDirectives.components`

**Frontend rendering:**

```typescript
// Display bot text
<BotMessage>{response.botMessage}</BotMessage>;

// Render components
{
  response.uiDirectives?.components?.map((comp) => {
    switch (comp.name) {
      case "planSummary":
        return <PlanSummaryCard {...comp.metadata} />;
      case "businessLogo":
        return <BusinessLogoPreview {...comp.metadata} />;
      case "AssistantCard":
        return <AssistantCard {...comp.metadata} />;
      // ... other components
    }
  });
}
```

**Available components:**

- `planSummary` - Display user's plan details
- `plansPreview` - Show all available plans for selection
- `businessLogo` - Preview selected business logo
- `logoUpload` - File upload for business logo
- `AssistantCard` - AI assistant configuration card

---

## Last User Message

Each message in `recentMessages` contains full substep configuration to enable accurate UI reconstruction:

```typescript
{
  "messageType": "USER_SELECTION",
  "content": "HEALTHCARE_CLINICS",
  "metadata": {
    "section": "businessIdentity",
    "substep": "businessIndustry",
    "action": "select",
    "formField": "industry",
    "selectedValue": "HEALTHCARE_CLINICS",
    "substepConfig": {
      "id": "businessIndustry",
      "type": "choice",
      "canEdit": true,
      "canSkip": true,
      "formField": "industry",
      "botMessage": "Next, which industry does your business belong to?",
      "options": [
        {
          "emoji": "🛍️",
          "label": "E-commerce / Retail",
          "value": "ECOMMERCE_RETAIL",
          "type": "radio",
          "nextSubstepId": "businessName"
        },
        {
          "emoji": "🏥",
          "label": "Healthcare / Clinics",
          "value": "HEALTHCARE_CLINICS",
          "type": "radio",
          "nextSubstepId": "businessName"
        }
        // ... more options
      ]
    }
  },
  "createdAt": "2025-12-22T12:00:00.000Z"
}
```

**Why substepConfig is included:**

Backend is the single source of truth. Frontend doesn't need to maintain or parse `copilotSteps.json` - all UI rendering data comes from API responses.

**Rendering past messages:**

```typescript
// Render user's past selection with context
const message = recentMessages[0];
const { substepConfig, selectedValue } = message.metadata;

// Show what options were available
const selectedOption = substepConfig.options.find(
  (opt) => opt.value === selectedValue
);

return (
  <MessageBubble>
    <BotMessage>{substepConfig.botMessage}</BotMessage>
    <OptionsGrid>
      {substepConfig.options.map((option) => (
        <Option
          key={option.value}
          selected={option.value === selectedValue}
          disabled={!substepConfig.canEdit}
        >
          {option.emoji} {option.label}
        </Option>
      ))}
    </OptionsGrid>
    <UserResponse>{selectedOption.label}</UserResponse>
  </MessageBubble>
);
```

**Edit functionality:**

```typescript
// Check if message can be edited
if (message.metadata.substepConfig?.canEdit) {
  showEditButton(() => {
    // Call /copilot/edit/:substepId with new value
    editSubstep(message.metadata.substep, newValue);
  });
}
```

---

## Progress Tracking

```typescript
// Get state to show progress
const state = await GET("/copilot/state");

const progress = {
  currentSection: state.currentSection,
  completedSections: state.sessionState.completed_sections,
  totalSections: 6,
  percentage: (state.sessionState.completed_sections.length / 6) * 100,
};

renderProgressBar(progress);
```

---

## Error Handling

```typescript
try {
  const response = await POST("/copilot/message", data);
} catch (error) {
  if (error.status === 404) {
    // No active conversation
    redirectTo("/copilot/start");
  } else if (error.status === 400) {
    // Invalid input
    showError(error.message);
  } else {
    // Server error
    showError("Something went wrong. Please try again.");
  }
}
```

---

## State Persistence

Backend handles all state persistence. Frontend can refresh/navigate away safely:

```typescript
// On page load
const state = await GET("/copilot/state");

if (state.isCompleted) {
  redirectTo("/dashboard");
} else if (state.isActive) {
  // Resume from current position
  displaySubstep(state.currentSubstep);
} else {
  // No conversation - start new
  redirectTo("/copilot/start");
}
```

---

## TypeScript Types

```typescript
type PlanType = "INDIVIDUAL" | "BUSINESS" | "PREMIUM" | "ORGANISATION";

type SubstepType = "choice" | "input" | "custom" | "button";

type InputType = "text" | "choice" | "file";

interface SubstepOption {
  label: string;
  value: any;
  type: "radio" | "select" | "button";
  emoji?: string;
  nextSubstepId?: string;
  isCustom?: boolean;
  recommended?: boolean;
  hasSubselect?: boolean;
  options?: SubstepOption[];
}

interface Substep {
  id: string;
  name: string;
  type: SubstepType;
  botMessage: string;
  options?: SubstepOption[];
  attachment?: {
    name: string;
    data: any;
  };
  canEdit?: boolean;
  canSkip?: boolean;
  formField?: string;
  isEndOfStep?: boolean;
}

interface SendMessagePayload {
  content: string;
  inputType?: InputType;
  metadata?: {
    selectedOption?: any;
    formField?: string;
  };
}

interface CopilotResponse {
  botMessage: string;
  currentSubstep: Substep;
  nextSubstepId?: string;
  uiDirectives?: {
    components?: Array<{ name: string; metadata?: any }>;
    showPlanUpgrade?: boolean;
    suggestedPlan?: PlanType;
    highlightOption?: string;
    requiresReconfiguration?: string[];
    assistantSuggestions?: {
      tone: string;
      style: string;
      personality: string;
    };
    possibleQuery?: string;
  };
  lastUserMessage?: {
    messageType: string;
    content: string;
    metadata: any;
    createdAt: string;
  };
  sectionComplete?: boolean;
  conversationComplete?: boolean;
}
```

---

## Testing Checklist

- [ ] Start conversation displays first substep
- [ ] Button selections advance flow
- [ ] Text inputs work correctly
- [ ] General chat triggers AI parsing
- [ ] Plan upgrade modal appears when needed
- [ ] Edit redirects to previous step
- [ ] Skip hides dependent substeps
- [ ] Section completion shows animation
- [ ] Progress bar updates correctly
- [ ] State persists across refreshes
- [ ] Restart clears and begins fresh
- [ ] Completion redirects to dashboard
- [ ] Error states handled gracefully

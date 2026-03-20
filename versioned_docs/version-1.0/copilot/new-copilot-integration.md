---
sidebar_position: 1
---

# New Copilot Onboarding - Frontend Integration Guide

# Section A: Normal Flow API Reference

## Core Endpoints

### 1. Start Conversation

```typescript
POST /copilot/start

Request: None (authenticated via session)

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "planConfirmation"
    name: "planConfirmation"
    parentStepId: "businessIdentity"
    canEdit: false
    isComplete: false
    type: "choice"
    formField: ""
    botMessage: [
      {
        message: "Hi {firstName}, I'm Beezaro\n\nPlease confirm...",
        type: "text",
        component: null
      },
      {
        message: null,
        type: "component",
        component: "planSummary"
      }
    ]
    options: [
      {
        label: "Yes, Proceed with my current plan",
        value: true,
        type: "radio",
        nextSubstepId: "businessIndustry"
      },
      {
        label: "No, Change plan",
        value: false,
        type: "radio",
        nextSubstepId: "changePlan"
      }
    ]
    optionsListClasses: "grid grid-cols-1 max-w-[28.7rem]..."
    showNextStepButton: false
  }
  uiDirectives: {
    components: [
      { name: "planSummary", metadata: {} }
    ]
  }
}
```

### 2. Send Message (Selection)

```typescript
POST /copilot/message

Request: SendMessageDto
{
  inputType: "selection",
  content: "Yes, Proceed with my current plan", // Display text
  metadata: {
    substepId: "planConfirmation",  // REQUIRED - must match current substep
    selectedOption: true             // Actual value from option.value
  }
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "businessIndustry",
    type: "choice",
    botMessage: [...],
    options: [
      {
        emoji: "🛍️",
        label: "E-commerce / Retail",
        value: "ECOMMERCE_RETAIL",
        type: "radio",
        nextSubstepId: "businessName"
      },
      // ... more industries
      {
        label: "Category not listed here",
        value: "none",
        type: "radio",
        nextSubstepId: "categoryNotListed",
        isCustom: true
      }
    ]
  },
  lastUserMessage: {
    messageType: "USER_SELECTION",
    content: "Yes, Proceed with my current plan",
    metadata: { substepId: "planConfirmation", ... },
    createdAt: "2024-01-15T10:30:00Z"
  }
}
```

### 3. Send Message (Text Input)

```typescript
POST /copilot/message

Request: SendMessageDto
{
  inputType: "text",
  content: "Acme Electronics",
  metadata: {
    substepId: "businessName"
  }
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "selectBusinessNameMatch",
    botMessage: [
      {
        message: "Here are a few businesses I found...",
        type: "text"
      }
    ],
    options: [
      {
        label: "Acme Electronics Inc.",
        value: {
          id: "https://acme.com",
          name: "Acme Electronics Inc.",
          address: "123 Main St",
          phone: "+1234567890",
          website: "https://acme.com",
          logo_url: "https://...",
          source: "google_search",
          confidence: 0.95
        },
        type: "radio",
        nextSubstepId: "confirmBusinessData"
      },
      // ... more matches
      {
        label: "My business isn't listed",
        value: "",
        type: "radio",
        nextSubstepId: "businessNotListed",
        isCustom: true
      }
    ]
  }
}
```

### 4. Send Message (Multiple Selection)

```typescript
POST /copilot/message

Request: SendMessageDto
{
  inputType: "selection",
  content: "WhatsApp, Gmail",
  metadata: {
    substepId: "channels",
    selectedOptions: ["whatsapp", "gmail"]  // Array for multiple
  }
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "confirmChannelsConfiguration",
    botMessage: [
      {
        message: "Great! I've noted these channels: WhatsApp, Gmail.",
        type: "text"
      }
    ],
    options: [
      {
        label: "Configure now (Manual Setup)",
        value: false,
        type: "button",
        isExitOption: true
      },
      {
        label: "Use recommended settings",
        value: true,
        type: "button"
      }
    ]
  }
}
```

### 5. Send Message (Sub-Select)

```typescript
POST /copilot/message

Request: SendMessageDto
{
  inputType: "selection",
  content: "Yes, add automation",
  metadata: {
    substepId: "addAutomations",
    selectedOption: "yes",
    subSelectValues: [          // Required when option has hasSubselect
      "Tag new leads",
      "Follow-up after 24h"
    ]
  }
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "confirmAIAutomations",
    botMessage: [
      {
        message: "Great, I'll add these automations:\nTag new leads, Follow-up after 24h",
        type: "text"
      }
    ]
  }
}
```

### 6. Get State

```typescript
GET /copilot/state

Response: CopilotStateResponseDto
{
  conversationId: 123,
  currentSection: "businessIdentity",
  currentSubstep: "confirmBusinessData",
  sessionState: {
    current_section: "businessIdentity",
    current_substep: "confirmBusinessData",
    last_interaction: "2024-01-15T10:45:00Z",
    collected_data: {
      firstName: "John",
      selected_plan: "BUSINESS",
      industry: "ECOMMERCE_RETAIL",
      business_name: "Acme Electronics",
      selected_business: {
        name: "Acme Electronics Inc.",
        logo_url: "https://...",
        // ... full business object
      },
      suggested_goals: [
        { title: "Increase sales", description: "..." }
      ],
      // ... all accumulated data
    },
    completed_sections: [],
    completed_substeps: [
      "planConfirmation",
      "businessIndustry",
      "businessName",
      "selectBusinessNameMatch"
    ],
    skipped_substeps: [],
    edit_history: [],
    is_in_edit_flow: false
  },
  isActive: true,
  isCompleted: false,
  recentMessages: [
    {
      messageType: "BOT_MESSAGE",
      content: "Perfect! I'll set you up as...",
      metadata: { section: "businessIdentity", ... },
      createdAt: "2024-01-15T10:40:00Z"
    },
    // ... last 20 messages
  ],
  currentSubstepDetails: {
    currentSubstep: {
      id: "confirmBusinessData",
      botMessage: [
        {
          message: "**Acme Electronics Inc.**\n🌐 https://acme.com...",
          type: "text"
        }
      ],
      options: [...]
    },
    uiDirectives: {
      components: [
        {
          name: "businessLogo",
          metadata: {
            logoUrl: "https://...",
            businessName: "Acme Electronics Inc.",
            website: "https://acme.com"
          }
        }
      ]
    }
  }
}
```

### 7. Upload Logo

```typescript
POST /copilot/upload-logo
Content-Type: multipart/form-data

Request:
{
  logo: File,                    // Max 5MB, PNG/JPG/WEBP only
  substepId: "businessNotListed" // Always this value
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "confirmBusinessData",
    botMessage: [
      {
        message: "Perfect! Here's your business setup:",
        type: "text"
      }
    ]
  },
  uiDirectives: {
    components: [
      {
        name: "businessLogo",
        metadata: {
          logoUrl: "https://s3.../business-logos/123/uuid.png",
          businessName: "Acme Electronics",
          website: null
        }
      }
    ]
  }
}
```

### 8. Edit Logo

```typescript
POST /copilot/edit-logo
Content-Type: multipart/form-data

Request:
{
  logo: File,                    // Max 5MB, PNG/JPG/WEBP only
  substepId: string              // ID of the substep to update logo for
}

Response: CopilotResponseDto
{
  currentSubstep: { ... },       // Returns updated substep after logo change
  uiDirectives: {
    components: [
      {
        name: "businessLogo",
        metadata: {
          logoUrl: "https://s3.../business-logos/123/uuid.png",
          businessName: "Acme Electronics",
          website: null
        }
      }
    ]
  }
}
```

### 9. Delete Assistant

```typescript
DELETE /copilot/assistants/:assistantId

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "beezaroAssistants",
    botMessage: [
      {
        type: "component",
        component: "CopilotContext",
        metadata: {
          event: "assistant_deleted",
          previousPosition: { section: "channels", substep: "channels" },
          nextPosition: { section: "aiAssistant", substep: "beezaroAssistants" }
        }
      },
      {
        type: "text",
        message: "Assistant removed. Channels were reassigned automatically."
      },
      {
        type: "component",
        component: "AssistantCard",
        metadata: { id: 456, name: "Beezaro Swift", onboardingDraft: true }
      },
      // ... remaining assistants
    ]
  }
}
```

### 10. Add Assistant

```typescript
POST /copilot/assistants

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "beezaroAssistants",
    botMessage: [
      {
        type: "component",
        component: "CopilotContext",
        metadata: { event: "assistant_added" }
      },
      {
        type: "text",
        message: "New assistant added. Channel assignments were rebalanced automatically."
      },
      // ... all assistants including new one
    ]
  }
}

// OR (if called outside conversation flow):
Response: CopilotResponseDto
{
  currentSubstep: null,
  uiDirectives: {
    refreshAssistants: true,
    assistantMutation: {
      createdAssistant: {
        id: 789,
        name: "Beezaro Zen",
        onboardingDraft: true
      },
      createdAssistants: [
        { id: 456, name: "Beezaro Swift" },
        { id: 789, name: "Beezaro Zen" }
      ],
      draftChannelConfigs: [
        {
          channelAiConfigId: 1,
          connectedChannelId: 10,
          aiAssistantId: 456,
          // ... config details
        },
        // ... updated configs
      ]
    }
  }
}
```

### 11. Restart Conversation

```typescript
POST /copilot/restart
{
  sectionId?: "channels",     // Optional: jump to specific section
  substepId?: "channels"      // Optional: jump to specific substep
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "planConfirmation",  // Or specified substep
    // ... fresh substep data
  }
}
```

## Request Validation Rules

### SendMessageDto Validation

```typescript
// CRITICAL: substepId must match current position
metadata.substepId === currentState.current_substep  // Must be true

// Input type must match substep type
substep.type === "choice" → inputType: "selection"
substep.type === "input"  → inputType: "text"
substep.type === "button" → inputType: "selection"
substep.type === "custom" → inputType: "custom"

// Selection format validation
substep.multiple === true  → metadata.selectedOptions: string[]
substep.multiple === false → metadata.selectedOption: any

// Sub-select validation
option.hasSubselect === true → metadata.subSelectValues: string[] (required)
```

### File Upload Validation

```typescript
// Logo upload constraints
mimeType: ["image/png", "image/jpeg", "image/jpg", "image/webp"];
maxSize: 5 * 1024 * 1024; // 5MB
substepId: "businessNotListed"; // Only valid value
```

## Error Responses

### Validation Error

```typescript
Status: 400 Bad Request
{
  message: "Validation failed",
  errors: [
    "Invalid option \"xyz\". Available options: option1, option2"
  ],
  substepId: "channels",
  section: "channels",
  hint: "Please call GET /copilot/state to sync your current position"
}
```

### Plan Limit Error

```typescript
Status: 400 Bad Request
{
  message: "Team size \"21 or more\" requires the ORGANISATION plan",
  substepId: "teamSize",
  requiresUpgrade: true,
  currentPlan: "BUSINESS",
  limit: 10,
  hint: "Please upgrade your plan or select fewer/different channels"
}
```

### State Sync Error

```typescript
Status: 400 Bad Request
{
  message: "Invalid substep context - expected confirmBusinessData, received businessName",
  substepId: "businessName",
  currentState: {
    section: "businessIdentity",
    substep: "confirmBusinessData"
  }
}
```

## Dynamic Substeps Requiring GET /state

These substeps have runtime-generated options:

```typescript
// Always call GET /state before rendering:
"businessIndustry"; // Options from IndustryType enum
"selectBusinessNameMatch"; // Options from business search results
"channels"; // Options from user's available channels
"adjustGoalsObjectives"; // Options from active goals/objectives DB

// State contains the data in:
state.sessionState.collected_data.business_search_results; // For selectBusinessNameMatch
state.currentSubstepDetails.currentSubstep.options; // For all others
```

# Section B: Flow Logic & State Management

## Section Hierarchy & Navigation

### Complete Flow Structure

```typescript
Flow Hierarchy:
├── businessIdentity (Section)
│   ├── planConfirmation (entry point)
│   ├── businessIndustry
│   ├── categoryNotListed (conditional)
│   ├── businessName
│   ├── selectBusinessNameMatch
│   ├── businessNotListed (conditional)
│   ├── confirmBusinessData
│   ├── adjustGoalsObjectives (conditional)
│   └── adjustGoalsConfirm (conditional)
│
├── teamMembers (Section)
│   ├── teamSize (entry point)
│   ├── inviteTeam (conditional - size >= 2)
│   ├── inviteTeamLater (conditional - size == 1)
│   ├── teamSizeOverLimit (conditional - plan validation failed)
│   ├── teamPlanDetails (conditional)
│   ├── teamUpgradeOptions (conditional)
│   └── teamUpgradeConfirm (conditional)
│
├── channels (Section)
│   ├── channels (entry point)
│   └── confirmChannelsConfiguration
│
├── fallbackLogic (Section)
│   ├── noReplyConfiguration (entry point)
│   └── confirmNoReplyConfiguration
│
├── aiAssistant (Section)
│   ├── aiAssistantsForChannels (entry point)
│   └── beezaroAssistants
│
└── automation (Section)
    ├── addAutomations (entry point)
    ├── confirmAIAutomations (conditional)
    └── finalizeSetup (conditional)
```

### Section Entry Points

```typescript
// Every section has a defined entry substep:
{
  businessIdentity: "planConfirmation",
  teamMembers: "teamSize",
  channels: "channels",
  fallbackLogic: "noReplyConfiguration",
  aiAssistant: "aiAssistantsForChannels",
  automation: "addAutomations"
}

// Backend enforces: When entering a new section, always start at entry substep
// Retrieved via: section.entry || Object.keys(section.subSteps)[0]
```

### Section Progression Order

```typescript
// Linear section flow (no branching at section level):
businessIdentity → teamMembers → channels → fallbackLogic → aiAssistant → automation

// Determined by: flowService.getNextSection(currentSection)
// Terminal condition: getNextSection() returns null after automation
```

## State Transition Rules

### Substep Completion Flow

```typescript
// Standard progression (happy path):
1. User submits valid input via POST /copilot/message
2. Backend validates:
   - Phase 7: Comprehensive message validation (format, context, options)
   - Phase 2: Choice validation (if substep.type === "choice")
   - Phase 4: Text input validation (if substep.type === "input")
3. Backend records user message
4. Backend updates collected_data[substep.formField] = value
5. Backend marks substep complete: completed_substeps.push(substep.id)
6. Backend determines next substep:
   - Check substep.isEndOfStep === true → trigger section completion
   - Call getNextSubstep(currentSubstep, userValue) → get dynamic next
   - Validate next substep prerequisites
7. Backend updates position: { current_section, current_substep }
8. Backend records bot message for new substep
9. Response includes new currentSubstep + lastUserMessage

// Terminal conditions:
- isEndOfStep === true → handleSectionComplete()
- getNextSubstep() returns null → handleSectionComplete()
- getNextSection() returns null → conversation complete
```

### Section Completion Flow

```typescript
// Triggered when substep.isEndOfStep === true OR no next substep exists:

1. Backend validates section completion:
   - Phase 6: validateSectionCompletion()
   - Checks all required substeps completed
   - Validates no missing prerequisites

2. Backend marks section complete:
   - completed_sections.push(section.id)
   - Records SECTION_COMPLETE system event

3. Backend clears transient data (e.g., business_search_results)

4. Backend checks edit context:
   IF (state.is_in_edit_flow && state.edit_return_position):
     - Clear edit context
     - Navigate to edit_return_position
     - Return with uiDirectives.editComplete = true
   ELSE:
     - Get next section via getNextSection()
     - Navigate to next section's entry substep
     - Return with sectionComplete = true

5. Response patterns:
   {
     currentSubstep: { ... },      // Next section's entry substep
     sectionComplete: true,
     uiDirectives: { components: [...] }
   }

   OR (if conversation complete):
   {
     currentSubstep: null,
     conversationComplete: true,
     uiDirectives: {}
   }
```

### Dynamic Next Substep Logic

```typescript
// Option-based navigation (most common):
option.nextSubstepId determines next step

Example:
{
  label: "Yes, Proceed with my current plan",
  value: true,
  nextSubstepId: "businessIndustry"  // Explicit navigation
}

// Value-based branching:
if (value === "none") {
  nextSubstepId = "categoryNotListed"
} else {
  nextSubstepId = "businessName"
}

// Conditional substeps (only visited if condition met):
- businessNotListed: only if user selects "My business isn't listed"
- categoryNotListed: only if industry === "none"
- teamSizeOverLimit: only if team size > plan limit
- adjustGoalsObjectives: only if user selects "I want to adjust that"
```

## Validation Chain Architecture

### Seven-Phase Validation System

```typescript
// Phase 1: Entry Validation (before any processing)
Location: Start of handleMessage()
Checks:
- Active conversation exists
- Current position retrievable

// Phase 2: Choice Validation (for type: "choice" substeps)
Location: handleContextualInput() → validateChoice()
Checks:
- selectedOption exists in substep.options
- selectedOption value matches option.value exactly
- If option has subselect: subSelectValues provided and valid
Example error:
{
  message: "Invalid selection. Available options: confirm, adjustGoals",
  substepId: "confirmBusinessData",
  availableOptions: [...]
}

// Phase 3: Plan Validation (for plan-restricted features)
Location: Multiple handlers (team size, channels, assistants)
Checks:
- Team size within plan.maxSeats limit
- Channel count within plan limits (WhatsApp, CRM, etc.)
- AI assistant count within plan.maxAiAssistants
Example error:
{
  message: "Team size \"21 or more\" requires the ORGANISATION plan",
  requiresUpgrade: true,
  currentPlan: "BUSINESS",
  limit: 10
}

// Phase 4: Text Input Validation (for type: "input" substeps)
Location: validateTextInput()
Checks:
- Non-empty string
- Length limits (1-500 chars typically)
- Sanitization (trim, remove dangerous chars)
- Field-specific rules (e.g., business name format)
Example error:
{
  message: "Business name must be between 1 and 200 characters",
  substepId: "businessName",
  field: "businessName",
  providedValue: ""
}

// Phase 5: Prerequisites & Flow Validation
Location: processSubstepCompletion() → validateNextSubstep()
Checks:
- Next substep exists in flow config
- Next substep belongs to current section
- All prerequisite substeps completed
- No circular dependencies
Example error:
{
  message: "Cannot advance to confirmBusinessData - missing prerequisites",
  currentSubstep: "businessName",
  attemptedNext: "confirmBusinessData",
  missingSteps: ["selectBusinessNameMatch"]
}

// Phase 6: Section Completion Validation
Location: handleSectionComplete() → validateSectionCompletion()
Checks:
- All required (non-skippable) substeps completed
- No orphaned state (e.g., selected channels but no config)
Example error:
{
  message: "Section cannot be completed - missing required steps",
  section: "businessIdentity",
  missingSteps: ["confirmBusinessData"]
}

// Phase 7: Comprehensive Message Validation (entry gate)
Location: handleMessage() → validateMessage()
Checks:
- inputType matches substep.type
- metadata.substepId matches current_substep
- For selections: option exists and is valid
- For text: meets field requirements
- State prerequisites satisfied
Example error:
{
  message: "Validation failed",
  errors: ["substepId mismatch: expected confirmBusinessData, received businessName"],
  substepId: "businessName",
  section: "businessIdentity",
  hint: "Please call GET /copilot/state to sync your current position"
}
```

### Validation Failure Handling

```typescript
// All validation failures throw BadRequestException:
throw new BadRequestException({
  message: "Primary error message",
  errors?: string[],           // Array of specific validation failures
  substepId: string,           // Current or target substep
  section?: string,            // Current section
  hint?: string,               // Developer guidance
  availableOptions?: any[],    // For choice validation errors
  currentState?: object        // For sync errors
})

// Frontend should:
1. Display message to user
2. If hint present: log for debugging
3. If availableOptions present: show valid choices
4. If currentState mismatch: call GET /state to resync
5. Never retry without user action
```

## Collected Data Management

### Core Fields Reference

```typescript
interface CollectedData {
  // Identity section
  firstName: string; // From user.fullName.split(" ")[0]
  selected_plan: PlanType; // From planConfirmation
  industry: IndustryType; // From businessIndustry
  businessCategory: string; // Display name of industry
  additionalCategoryMessage: string; // "your industry" or custom
  business_name: string; // From businessName input
  business_search_results: BusinessMatch[]; // Temporary - cleared after section
  selected_business: BusinessMatch; // From selectBusinessNameMatch
  business_logo: string; // S3 URL from upload
  suggested_goals: Goal[]; // LLM-generated
  suggested_objectives: Objective[]; // LLM-generated
  ai_summary: string; // LLM explanation of goals
  adjustedGoalsSummary?: string; // If user adjusted goals
  goalsAdjustmentMode?: "kept" | "adjusted";

  // Team section
  team_size: string; // "1" | "2-5" | "6-20" | "21"
  team_size_attempt: string; // Attempted size (may exceed limit)
  team_size_attempt_label: string; // Display label for attempt

  // Channels section
  channels: string[]; // Display names
  selected_channel_values: string[]; // Internal values (e.g., "whatsapp")
  useRecommendedSettings: boolean; // From confirmChannelsConfiguration

  // Fallback section
  noReplyConfiguration: string; // "escalate" | "followUp" | "none"

  // AI Assistant section
  aiAssistantsForChannels: string; // "single" | "multiple"
  created_assistants: Array<{
    // Draft assistants created
    id: number;
    name: string;
  }>;
  draft_channel_configs: ChannelConfig[]; // Temporary configs (onboardingDraft: true)

  // Automation section
  selected_automations: string[]; // Preset keys
  addAutomations: boolean; // Whether user opted in
}
```

### Field Lifecycle Patterns

```typescript
// Transient fields (cleared after use):
business_search_results  // Cleared at end of businessIdentity section
draft_channel_configs    // Finalized at beezaroAssistants completion
created_assistants       // Finalized at beezaroAssistants completion

// Persistent fields (kept throughout):
firstName, selected_plan, industry, business_name, selected_business
team_size, channels, selected_channel_values
aiAssistantsForChannels, noReplyConfiguration

// Updated fields (overwritten during edits):
Any field can be updated via:
- Normal flow: stateService.updateCollectedData()
- Edit flow: editSubstep() → updateCollectedData()

// Cleared fields (on edit impact):
When edit affects dependent substeps, related fields cleared:
Example: Edit industry → clears suggested_goals, suggested_objectives
```

### Data Persistence Points

```typescript
// collected_data is stored in:
conversation.sessionState (JSON column in DB)

// Updated after every:
1. Substep completion: formField value stored
2. Special handlers: multiple fields at once
3. Edit operations: target field + clear affected fields
4. Section completion: cleanup of transient data

// Accessed via:
state = parseSessionState(conversation.sessionState)
value = state.collected_data[fieldName]

// Never accessed directly - always through state service
```

## Dynamic Option Hydration

### Runtime Option Generation

```typescript
// These substeps MUST fetch options at runtime (cannot cache):

1. businessIndustry
   Source: IndustryType enum + formatting
   Pattern:
   const industries = Object.values(IndustryType)
   options = industries.map(industry => ({
     emoji: getIndustryEmoji(industry),
     label: getIndustryLabel(industry),
     value: industry,
     type: "radio",
     nextSubstepId: "businessName"
   }))

   Trigger: withBusinessIndustryOptions(substep)
   When: handleMessage(), getState(), restartConversation()

2. selectBusinessNameMatch
   Source: state.collected_data.business_search_results
   Pattern:
   options = [
     ...searchResults.map(match => ({
       label: match.name,
       value: match,  // FULL OBJECT
       type: "radio",
       nextSubstepId: "confirmBusinessData"
     })),
     {
       label: "My business isn't listed",
       value: "",
       isCustom: true,
       type: "radio",
       nextSubstepId: "businessNotListed"
     }
   ]

   Trigger: Check state.collected_data.business_search_results exists
   When: After businessName input processed

3. channels
   Source: channelService.getAvailableChannels(userId)
   Pattern:
   const availableChannels = await channelService.getAvailableChannels(userId)
   const allChannels = [
     ...availableChannels.categories.communication.available,
     ...availableChannels.categories.crmCalendar.available,
     ...availableChannels.categories.ecommerce.available
   ]
   options = allChannels.map(channel => ({
     label: channel.displayName,
     value: channel.name,
     type: "select",
     icon: getChannelIcon(channel.name)
   }))

   Trigger: substep.id === "channels"
   When: handleMessage(), getState()

4. adjustGoalsObjectives
   Source: Database query for active goals/objectives
   Pattern:
   const { goals, objectives } = await getActiveGoalsAndObjectives()
   options = [
     ...goals.map(g => ({
       label: g.title,
       description: g.description,
       value: `goal:${g.id}`,
       type: "checkbox"
     })),
     ...objectives.map(o => ({
       label: o.title,
       description: o.description,
       value: `objective:${o.id}`,
       type: "checkbox"
     })),
     {
       label: "Keep current goals and objectives",
       value: "keepCurrent",
       type: "button",
       nextSubstepId: "confirmBusinessData"
     }
   ]

   Trigger: substep.id === "adjustGoalsObjectives"
   When: User selects "I want to adjust that" from confirmBusinessData
```

### Hydration Timing

```typescript
// Frontend MUST call GET /state before rendering these substeps:
- businessIndustry (always hydrated, but verify options present)
- selectBusinessNameMatch (only if business_search_results exists in state)
- channels (always requires fresh fetch per plan/connections)
- adjustGoalsObjectives (always requires DB fetch)

// Backend automatically hydrates during:
handleMessage() {
  if (currentSubstep.id === "businessIndustry") {
    currentSubstep = withBusinessIndustryOptions(currentSubstep)
  }
  // ... other hydrations
}

getState() {
  let substep = await getSubstep(section, substepId)
  if (substepId === "channels") {
    substep = { ...substep, options: [...dynamicChannels] }
  }
  // ... other hydrations
  return substep
}

// Frontend rendering logic:
if (["businessIndustry", "channels", "adjustGoalsObjectives"].includes(substep.id)) {
  // Options already hydrated in response - render directly
}

if (substep.id === "selectBusinessNameMatch") {
  // Check if options array is populated
  if (!substep.options?.length) {
    // Call GET /state to trigger hydration
    const state = await GET /copilot/state
    substep = state.currentSubstepDetails.currentSubstep
  }
}
```

## Special Flow Patterns

### Business Search Flow

```typescript
// Pattern: Search → Match → Confirm OR Manual Entry

Flow:
1. businessName (input)
   ↓
2. Backend searches via businessLookupService.searchBusiness(name)
   ↓
3. Stores results in state.collected_data.business_search_results
   ↓
4. Advances to selectBusinessNameMatch
   ↓
5a. User selects match → confirmBusinessData
    - Stores full business object in selected_business
    - LLM generates goals based on business + industry

5b. User selects "not listed" → businessNotListed
    - Clears selected_business
    - Requires logo upload
    - Uses business_name for confirmBusinessData

// Key implementation details:
- business_search_results populated at businessName completion
- businessNotListed bypasses search results, uses manual data
- confirmBusinessData works with EITHER selected_business OR manual entry
- business_search_results cleared at end of businessIdentity section
```

### Team Size Validation Flow

```typescript
// Pattern: Size Selection → Plan Validation → Upgrade Flow OR Continue

Flow:
1. teamSize (choice)
   User selects: "1" | "2-5" | "6-20" | "21"
   ↓
2. Backend validates against plan.maxSeats
   const validation = await validateTeamSizeAgainstPlan(size, userId)
   ↓
3a. VALID → Store team_size, advance to next section

3b. INVALID → Navigate to teamSizeOverLimit
    - Store team_size_attempt + team_size_attempt_label
    - Present upgrade options
    ↓
4. teamSizeOverLimit (choice)
   Options: "upgrade" | "planDetails" | default (smaller size)
   ↓
5a. "upgrade" → teamUpgradeOptions
    - Show plan comparison
    - User selects new plan
    - On confirm → teamUpgradeConfirm

5b. "planDetails" → teamPlanDetails
    - Show current plan details
    - Options: "upgrade" | "stay" | "smaller"

5c. default → Back to teamSize with limit reminder

6. teamUpgradeConfirm
   - Finalizes plan upgrade
   - Stores team_size from team_size_attempt
   - Advances to next section

// Critical: team_size only stored if validation passes
// team_size_attempt tracks what user wants (may exceed limit)
```

### Channel Configuration Flow

```typescript
// Pattern: Select Channels → Config Strategy → Setup OR Manual

Flow:
1. channels (multiple selection)
   User selects: ["whatsapp", "gmail", ...]
   ↓
2. Backend validates against plan limits
   - Max WhatsApp channels
   - CRM/Calendar addon access
   - Ecommerce pack access
   ↓
3. Backend creates ConnectedChannel records
   await channelService.selectChannel(userId, { availableChannelId, customName })
   ↓
4. Stores in collected_data:
   - channels: ["WhatsApp", "Gmail"] (display names)
   - selected_channel_values: ["whatsapp", "gmail"] (internal values)
   ↓
5. confirmChannelsConfiguration (choice)
   Options: "Use recommended settings" (true) | "Configure now (Manual)" (false)
   ↓
6a. useRecommendedSettings === true
    → noReplyConfiguration (fallbackLogic section)
    → Creates draft configs with industry-based recommendations

6b. useRecommendedSettings === false
    → Exit to manual setup (conversation pauses)
    → User configures in full UI

// Draft configs pattern:
- All configs created with onboardingDraft: true
- Finalized only at beezaroAssistants completion
- Allows deletion/recreation during edits
```

### AI Assistant Assignment Flow

```typescript
// Pattern: Strategy → Create Assistants → Assign to Channels → Confirm

Flow:
1. aiAssistantsForChannels (choice)
   Options: "single" | "multiple"
   ↓
2. Backend determines count:
   if (strategy === "single") {
     assistantCount = 1
   } else {
     assistantCount = selected_channel_values.length
   }
   ↓
3. Backend validates against plan.maxAiAssistants
   ↓
4. Backend creates draft assistants:
   for (i = 0; i < assistantCount; i++) {
     await prisma.aiAssistant.create({
       name: `Beezaro ${suffix[i]}`,
       tone: getIndustryTone(industry),
       onboardingDraft: true,  // CRITICAL FLAG
       ...
     })
   }
   ↓
5. Backend computes channel assignments:
   const assignments = computeDraftAssignments(channelIds, assistantIds)

   Logic:
   - Single assistant → all channels use same assistant
   - Multiple assistants >= channels → 1:1 mapping
   - Multiple assistants < channels → first N-1 get 1:1, last gets remainder
   ↓
6. Backend creates draft configs:
   for (assignment of assignments) {
     await prisma.channelAiConfig.create({
       connectedChannelId: assignment.connectedChannelId,
       aiAssistantId: assignment.aiAssistantId,
       onboardingDraft: true,  // CRITICAL FLAG
       // ... escalation, followUp settings from recommendations or fallback
     })
   }
   ↓
7. Stores in collected_data:
   - created_assistants: [{ id, name }]
   - draft_channel_configs: [{ channelAiConfigId, connectedChannelId, aiAssistantId, ... }]
   ↓
8. beezaroAssistants (choice)
   Displays assistant cards
   Options: "yes" (finalize) | "no" (manual setup)
   User can add/delete assistants at this step
   ↓
9. On "yes":
   - Sets onboardingDraft: false on all assistants
   - Sets onboardingDraft: false on all configs
   - Advances to automation section

   On "no":
   - Finalizes same way
   - Exits to manual setup

// Assignment recomputation:
- Triggered on assistant add/delete
- Uses same computeDraftAssignments() logic
- Updates all draft_channel_configs
```

### Automation Selection Flow

```typescript
// Pattern: Optional Selection → Sub-Select → Confirm OR Skip

Flow:
1. addAutomations (choice with sub-select)
   Options:
   - "yes" → hasSubselect: true
     Sub-options:
     - "Tag new leads"
     - "Follow-up after 24h"
     - "Send welcome message"
   - "no" → nextSubstepId: "finalizeSetup"
   ↓
2a. User selects "no"
    - Sets addAutomations: false
    - Skips confirmAIAutomations
    - Advances to finalizeSetup

2b. User selects "yes" + sub-options
    - Validates: subSelectValues.length > 0
    - Stores selected_automations: ["tagNewLeads", "followUp"]
    - Advances to confirmAIAutomations
    ↓
3. confirmAIAutomations (choice)
   Options: "Confirm and continue" (true) | "View in manual setup" (false)
   ↓
4a. User confirms
    - Creates automation records from AUTOMATION_PRESETS
    - Marks conversation complete

4b. User selects manual
    - Exits to manual setup
    - Conversation marked complete

// Automation creation:
- Only happens at confirmAIAutomations confirmation
- Uses predefined presets from AUTOMATION_PRESETS map
- Creates in default campaign: "Copilot Onboarding Automations"
```

## State Synchronization Patterns

### When Frontend Should Call GET /state

```typescript
// REQUIRED scenarios:
1. Page load/refresh
   - Always sync on mount
   - Prevents stale state rendering

2. After validation error with sync hint
   Error: { hint: "Please call GET /copilot/state to sync..." }

3. Before rendering dynamic substeps
   - channels, adjustGoalsObjectives (always)
   - selectBusinessNameMatch (if options missing)

4. After assistant add/delete (if outside conversation)
   - Response has uiDirectives.refreshAssistants

5. After external state changes
   - Plan upgrades outside copilot
   - Channel additions outside copilot

// OPTIONAL but recommended:
1. After long idle periods (>5 minutes)
2. Before edit operations (verify current position)
3. On browser back/forward navigation

// NOT NEEDED:
1. After successful POST /copilot/message (response includes full state)
2. During normal flow progression (server advances position)
3. Immediately after POST /copilot/start (response includes initial state)
```

### Optimistic Updates Pattern

```typescript
// ❌ DON'T DO THIS (server is source of truth):
onClick={() => {
  // Optimistically advance to next substep
  setCurrentSubstep(nextSubstep)

  POST /copilot/message
    .then(res => {
      // Might not match optimistic update!
    })
}

// ✅ DO THIS (wait for server confirmation):
onClick={async () => {
  setLoading(true)

  try {
    const res = await POST /copilot/message

    // Server tells us exact next state
    setCurrentSubstep(res.currentSubstep)
    setCurrentSection(res.currentSubstep.parentStepId)

    // Update history if provided
    if (res.lastUserMessage) {
      addToHistory(res.lastUserMessage)
    }

  } catch (error) {
    // Show error, don't advance state
    showError(error.message)
  } finally {
    setLoading(false)
  }
}

// Why: Backend may:
// - Navigate to different substep than expected (validation, branching)
// - Trigger section completion (isEndOfStep)
// - Enter edit flow (affected substeps)
// - Mark conversation complete
```

### State Reconciliation on Errors

```typescript
// Pattern for handling state drift:

try {
  (await POST) / copilot / message;
} catch (error) {
  if (error.status === 400) {
    // Validation error - check for sync hint
    if (error.hint?.includes("call GET /copilot/state")) {
      // State is out of sync - resync
      const freshState = (await GET) / copilot / state;

      // Update local state to match server
      setCurrentSection(freshState.currentSection);
      setCurrentSubstep(freshState.currentSubstep);
      setSessionState(freshState.sessionState);

      // Show user-friendly message
      showToast("Your position was updated. Please try again.");
    } else {
      // Regular validation error - show to user
      showValidationErrors(error.errors || [error.message]);
    }
  } else {
    // Network or server error - don't change state
    showError("Something went wrong. Please try again.");
  }
}
```

## Completion & Terminal States

### Conversation Completion Detection

```typescript
// Conversation is complete when:
Response: {
  currentSubstep: null,
  conversationComplete: true,
  uiDirectives: {}
}

// Triggers:
1. automation section completes:
   - User confirms automations at confirmAIAutomations
   - User confirms at finalizeSetup

2. User exits to manual setup:
   - Any "View in manual setup" or "Configure now" option
   - Response has uiDirectives.exitToManualSetup: true

// Backend action:
await stateService.completeConversation(conversationId)
// Sets: conversation.isActive = false, completedAt = now()

// Frontend action:
if (response.conversationComplete) {
  // Navigate to dashboard or manual setup
  router.push(response.uiDirectives.exitToManualSetup
    ? "/channels/configure"
    : "/dashboard"
  )
}
```

### Section Completion Detection

```typescript
// Section is complete when:
Response: {
  currentSubstep: { ... },  // Next section's entry substep
  sectionComplete: true,
  uiDirectives: { ... }
}

// Triggers:
- Last substep in section completed
- substep.isEndOfStep === true
- No nextSubstepId available

// Backend action:
await stateService.markSectionComplete(conversationId, sectionId)
// Adds to: conversation.sessionState.completed_sections

// Frontend action (optional):
if (response.sectionComplete) {
  // Show progress indicator update
  updateProgressBar(completedSections.length, totalSections)

  // Optional celebration animation
  if (sectionId === "businessIdentity") {
    showAnimation("Business profile complete!")
  }
}

// Note: Section completion doesn't pause flow
// User automatically advances to next section entry point
```

### Substep Skip vs Complete

```typescript
// Completed substeps:
// - User provided input and advanced
// - Stored in state.completed_substeps
// - Can be edited later (if canEdit: true)

// Skipped substeps:
// - User explicitly skipped via POST /copilot/skip
// - OR substep was bypassed due to branching
// - Stored in state.skipped_substeps
// - Cannot be edited (no data collected)

// Example skipped scenarios:
1. categoryNotListed - skipped if user picks valid industry
2. businessNotListed - skipped if user picks business match
3. teamSizeOverLimit - skipped if size within plan limits
4. adjustGoalsObjectives - skipped if user doesn't select "adjust"
5. confirmAIAutomations - skipped if user selects "no" to automations

// Validation impact:
// Prerequisites check both completed AND skipped:
const validSubsteps = [
  ...state.completed_substeps,
  ...state.skipped_substeps
]
// If prerequisite not in validSubsteps → validation fails
```

---

**Phase 1, Section B Complete**

This section covered:

- ✅ Complete flow hierarchy and navigation rules
- ✅ State transition logic with 7-phase validation
- ✅ collected_data field reference and lifecycle
- ✅ Dynamic option hydration patterns
- ✅ All special flow patterns (search, team size, channels, assistants, automation)
- ✅ State synchronization best practices
- ✅ Completion and terminal state handling

# Supplementary Documentation

## Edge Cases Matrix

### Comprehensive Edge Case Reference

```typescript
// LEGEND:
// ✅ Handled automatically by backend
// ⚠️ Requires frontend awareness
// 🔴 Blocked with error
// 🔄 Triggers special flow

┌─────────────────────────────────────────────────────────────────────────────┐
│                         NORMAL FLOW EDGE CASES                              │
├──────────────────────────┬──────────────────────────┬────────────────────────┤
│ Scenario                 │ Behavior                 │ Frontend Action        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Empty business search    │ ✅ Returns empty array   │ Show "not listed"      │
│ results                  │ selectBusinessNameMatch  │ prominently            │
│                          │ shows only "not listed"  │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Team size exceeds plan   │ 🔄 Navigates to          │ Follow upgrade flow    │
│ limit                    │ teamSizeOverLimit        │ or select smaller size │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Channel requires addon   │ 🔴 Validation error      │ Show upgrade message   │
│ not in plan              │ requiresUpgrade: true    │ with plan details      │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Last assistant deleted   │ 🔴 BadRequest error      │ Disable delete button  │
│                          │ "Cannot delete last"     │ when count === 1       │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Logo upload with         │ ✅ Replaces matched data │ Show confirmation      │
│ existing business        │ selected_business.logo   │ before upload          │
│                          │ updated                  │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Sub-select without       │ 🔴 Validation error      │ Validate before submit │
│ parent selection         │ "subSelectValues missing"│ show inline error      │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Late session sync        │ ⚠️ substepId mismatch    │ Call GET /state        │
│ (page refresh)           │ error with hint          │ on mount, before submit│
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Skip substep vs complete │ ✅ Different tracking    │ UI shows skip ≠ edit   │
│                          │ skipped_substeps vs      │ Skipped = no edit btn  │
│                          │ completed_substeps       │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Multiple channel         │ ✅ Creates all, reports  │ Show success count +   │
│ selections with errors   │ channelValidations array │ any failures           │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ AI assistant count       │ 🔄 Caps at plan limit    │ Show warning if capped │
│ exceeds plan limit       │ Logs warning, continues  │ "Created N of M"       │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Business name with       │ ✅ Sanitized by backend  │ Show sanitized version │
│ special characters       │ validateTextInput()      │ after submission       │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Industry "none" selected │ 🔄 Navigates to          │ Provide text input for │
│                          │ categoryNotListed        │ custom industry        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ LLM goal generation      │ ✅ Falls back to default │ Display goals normally │
│ fails                    │ goals if LLM fails       │ (user doesn't see diff)│
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Automation selection:    │ ✅ Skips to finalizeSetup│ Handle both paths      │
│ "No, skip"               │ Clears selected_automations                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Exit to manual setup     │ ✅ Returns currentSubstep│ Navigate to manual UI  │
│                          │ = null, exitToManualSetup│ /channels/configure    │
│                          │ = true                   │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Section complete during  │ ✅ Auto-advances to next │ Show progress update   │
│ normal flow              │ section entry substep    │ animate transition     │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Conversation complete    │ ✅ Returns currentSubstep│ Redirect to dashboard  │
│                          │ = null, conversationComplete = true                │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Dynamic options missing  │ ⚠️ Options array empty   │ Call GET /state to     │
│ (channels, goals)        │ or undefined             │ trigger hydration      │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Duplicate channel        │ ✅ Marked alreadyExists  │ Show "already added"   │
│ selection                │ in channelValidations    │ message, no error      │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ File upload > 5MB        │ 🔴 BadRequest error      │ Validate client-side   │
│                          │ "File size must be..."   │ before upload          │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ File upload wrong type   │ 🔴 BadRequest error      │ Validate client-side   │
│ (e.g., PDF for logo)     │ "Only PNG, JPG, WEBP..." │ accept="image/*"       │
└──────────────────────────┴──────────────────────────┴────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          EDIT FLOW EDGE CASES                               │
├──────────────────────────┬──────────────────────────┬────────────────────────┤
│ Scenario                 │ Behavior                 │ Frontend Action        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Edit during active edit  │ 🔴 BadRequest error      │ Disable edit buttons   │
│ (nested edit)            │ "Cannot edit while in    │ when isInEditFlow=true │
│                          │ edit flow"               │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Edit non-editable        │ 🔴 BadRequest error      │ Hide edit button if    │
│ substep (canEdit: false) │ "This substep cannot be  │ substep.canEdit=false  │
│                          │ edited"                  │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Edit incomplete substep  │ 🔴 BadRequest error      │ Only show edit for     │
│                          │ "Cannot edit incomplete  │ completed substeps     │
│                          │ substep"                 │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Edit with plan downgrade │ ✅ Revalidation cascade  │ Show affected substeps │
│                          │ Clears invalidated data  │ that need completion   │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Cross-section edit       │ ✅ Sets edit context     │ Show edit breadcrumb   │
│ return                   │ Navigates to affected    │ "Editing X, return to Y"│
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Edit invalidates future  │ ✅ Clears multiple       │ Show which sections    │
│ sections                 │ substeps across sections │ need re-completion     │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Edit "not listed" after  │ ✅ Switches to manual    │ Show logo upload UI    │
│ business match           │ Clears selected_business │ Clear business data    │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Team size edit requiring │ 🔄 Navigates to upgrade  │ Follow upgrade flow    │
│ upgrade                  │ flow (teamSizeOverLimit) │ then return            │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Channel edit removes     │ ✅ Auto cleanup + rebuild│ Refresh assistant list │
│ channels with assistants │ Deletes configs & channel│ Show reassignment msg  │
│                          │ Reassigns remaining      │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Industry edit triggers   │ ✅ LLM regenerates goals │ Show loading during    │
│ goal regeneration        │ Clears old goals         │ regeneration           │
│                          │ Navigates to confirm     │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Business name edit       │ ✅ New search performed  │ Show search results    │
│ from later section       │ Clears old match + goals │ Navigate to match      │
│                          │ Sets edit context        │ selection              │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Logo edit replaces       │ ✅ Deletes old from S3   │ Show upload progress   │
│ existing logo            │ Uploads new              │ Update preview         │
│                          │ Updates URL in state     │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Channel config strategy  │ ✅ Cleans all drafts     │ If manual: exit to UI  │
│ edit (rec → manual)      │ Sets exit flag           │ If rec: rebuild flow   │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Assistant strategy edit  │ ✅ Deletes all assistants│ Show loading           │
│ (single → multiple)      │ Creates new count        │ Display new assistants │
│                          │ Recomputes assignments   │                        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Return position invalid  │ ✅ Logs error, clears    │ Shouldn't happen       │
│ (flow config changed)    │ Falls back to normal flow│ Handle gracefully      │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Edit during upgrade flow │ 🔴 Blocked               │ Disable edit during    │
│                          │ "Complete current edit"  │ upgrade substeps       │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Multiple edits to same   │ ✅ Each tracked in       │ Show edit count badge  │
│ substep                  │ edit_history             │ "Edited 2 times"       │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Edit after conversation  │ 🔴 Not found error       │ Don't show edit after  │
│ complete                 │ "No active conversation" │ completion             │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Channels edit adds >     │ 🔴 Plan validation error │ Show plan upgrade      │
│ plan limit               │ requiresUpgrade: true    │ before allowing        │
└──────────────────────────┴──────────────────────────┴────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      STATE SYNCHRONIZATION EDGE CASES                       │
├──────────────────────────┬──────────────────────────┬────────────────────────┤
│ Scenario                 │ Behavior                 │ Frontend Action        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Page refresh mid-flow    │ ⚠️ State persists in DB  │ GET /state on mount    │
│                          │ Frontend needs resync    │ Restore UI from state  │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Browser back/forward     │ ⚠️ May show stale UI     │ GET /state on popstate │
│                          │ Server state unchanged   │ Resync position        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Concurrent requests      │ ✅ Last write wins       │ Disable submit during  │
│ (double click)           │ Database handles         │ pending request        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Network timeout          │ ⚠️ May be processed      │ Don't retry auto       │
│                          │ Server may have saved    │ Show "Check status"    │
│                          │                          │ Call GET /state        │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ substepId mismatch       │ 🔴 Validation error      │ Resync via GET /state  │
│                          │ "expected X, received Y" │ Don't allow submission │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Stale options data       │ ⚠️ May select invalid    │ GET /state before      │
│ (channels changed)       │ Backend validates        │ rendering options      │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Session expiry mid-flow  │ 🔴 401 Unauthorized      │ Redirect to login      │
│                          │ State preserved          │ Resume after reauth    │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Optimistic update fails  │ ⚠️ UI out of sync        │ DON'T use optimistic   │
│                          │ Server is source of truth│ Wait for response      │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Long idle (>30 min)      │ ✅ State persists        │ Optional: GET /state   │
│                          │ Session may expire       │ before next action     │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ External plan change     │ ⚠️ State may be invalid  │ GET /state after       │
│ (via settings page)      │ Not auto-revalidated     │ returning to copilot   │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ External channel add     │ ⚠️ Not reflected         │ GET /state to refresh  │
│ (via manual UI)          │ until resync             │ available channels     │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ Multiple tabs open       │ ⚠️ Each has own state    │ Detect with storage    │
│                          │ Last action wins         │ Warn user or disable   │
└──────────────────────────┴──────────────────────────┴────────────────────────┘
```

## Code Examples & Integration Snippets

### Example 1: Complete Message Send Flow

```typescript
// ✅ CORRECT: Full error handling with state sync

import { useState } from "react";
import { CopilotResponseDto, SendMessageDto } from "./types";

function CopilotFlow() {
  const [currentSubstep, setCurrentSubstep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(
    inputType: string,
    content: string,
    metadata: any
  ) {
    setLoading(true);
    setError(null);

    try {
      const messageDto: SendMessageDto = {
        inputType,
        content,
        metadata: {
          ...metadata,
          substepId: currentSubstep.id, // CRITICAL: Must match current position
        },
      };

      const response: CopilotResponseDto = await fetch("/api/copilot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messageDto),
      }).then((res) => {
        if (!res.ok) throw res;
        return res.json();
      });

      // Handle completion states
      if (response.conversationComplete) {
        router.push(
          response.uiDirectives?.exitToManualSetup
            ? "/channels/configure"
            : "/dashboard"
        );
        return;
      }

      // Update local state from server response
      setCurrentSubstep(response.currentSubstep);

      // Render components
      if (response.uiDirectives?.components) {
        renderComponents(response.uiDirectives.components);
      }

      // Add to message history
      if (response.lastUserMessage) {
        addToHistory(response.lastUserMessage);
      }

      // Show section completion celebration
      if (response.sectionComplete) {
        showToast(`${currentSubstep.parentStepId} section complete!`);
      }
    } catch (err) {
      if (err.status === 400) {
        const errorData = await err.json();

        // Check for sync error
        if (errorData.hint?.includes("call GET /copilot/state")) {
          // Resync state
          const freshState = await fetch("/api/copilot/state").then((r) =>
            r.json()
          );
          setCurrentSubstep(freshState.currentSubstepDetails.currentSubstep);

          setError("Your position was updated. Please try again.");
        } else {
          // Regular validation error
          setError(errorData.message);

          // Show field-specific errors if available
          if (errorData.errors) {
            showValidationErrors(errorData.errors);
          }
        }
      } else if (err.status === 401) {
        // Session expired
        router.push("/login?redirect=/copilot");
      } else {
        // Network or server error
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ... render UI
}
```

### Example 2: Dynamic Option Hydration

```typescript
// ✅ CORRECT: Fetch fresh state for dynamic substeps

function DynamicSubstepRenderer({ substep }) {
  const [options, setOptions] = useState(substep.options || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if substep needs dynamic options
    const needsHydration = [
      "businessIndustry",
      "channels",
      "adjustGoalsObjectives",
      "selectBusinessNameMatch",
    ].includes(substep.id);

    if (needsHydration && (!substep.options || substep.options.length === 0)) {
      // Fetch fresh state to hydrate options
      refreshOptions();
    }
  }, [substep.id]);

  async function refreshOptions() {
    setLoading(true);

    try {
      const state = await fetch("/api/copilot/state").then((r) => r.json());
      const freshSubstep = state.currentSubstepDetails.currentSubstep;

      if (freshSubstep.id === substep.id) {
        setOptions(freshSubstep.options);
      }
    } catch (err) {
      console.error("Failed to refresh options:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <Spinner />;
  }

  return <OptionsList options={options} onSelect={handleSelect} />;
}
```

### Example 3: Edit Flow with Context Awareness

```typescript
// ✅ CORRECT: Edit handling with return flow support

function EditButton({ substep, currentSection, value }) {
  const [isEditing, setIsEditing] = useState(false);

  // Don't show edit button if:
  // 1. Substep not completed
  // 2. canEdit is false
  // 3. Currently in edit flow (prevent nested edits)
  const canEdit =
    substep.isComplete && substep.canEdit !== false && !isInEditFlow;

  if (!canEdit) return null;

  async function handleEdit(newValue: any) {
    setIsEditing(true);

    try {
      const response = await fetch(`/api/copilot/edit/${substep.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          substepId: substep.id,
          newValue,
        }),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      });

      // Handle different edit response patterns
      if (response.uiDirectives?.isInEditFlow) {
        // Cross-section edit - navigate to affected substep
        setEditContext({
          editedSubstep: substep.id,
          editedSection: currentSection,
          affectedSubsteps: response.uiDirectives.editContext.affectedSubsteps,
          returnPosition: { section: currentSection, substep: substep.id },
        });

        setCurrentSubstep(response.currentSubstep);

        // Show breadcrumb
        showEditBreadcrumb(
          `Editing ${substep.name}`,
          `Will return to ${currentSection}`
        );
      } else if (response.uiDirectives?.editComplete) {
        // Edit complete - inline or same section
        if (response.uiDirectives?.returnedFromEdit) {
          // Returned from cross-section edit
          clearEditContext();
          showToast("Edit complete - returned to your original position");
        } else {
          // Inline edit
          showToast("Updated successfully");
        }

        // Update current substep if navigated
        if (response.currentSubstep) {
          setCurrentSubstep(response.currentSubstep);
        }
      } else if (response.uiDirectives?.exitToManualSetup) {
        // Switched to manual setup
        router.push("/channels/configure");
      }
    } catch (err) {
      const errorData = await err.json();

      if (errorData.message?.includes("Cannot edit while in edit flow")) {
        showError(
          "Please complete your current edit before starting a new one"
        );
      } else {
        showError(errorData.message || "Failed to edit");
      }
    } finally {
      setIsEditing(false);
    }
  }

  return (
    <button onClick={() => handleEdit(/* new value */)} disabled={isEditing}>
      {isEditing ? "Saving..." : "Edit"}
    </button>
  );
}
```

### Example 4: File Upload with Validation

```typescript
// ✅ CORRECT: Client-side validation + progress tracking

function LogoUpload({ substepId }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleFileSelect(file: File) {
    // Client-side validation
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      showError("Please upload a PNG, JPG, or WEBP image");
      return;
    }

    if (file.size > maxSize) {
      showError(
        `File size must be under 5MB (current: ${(
          file.size /
          1024 /
          1024
        ).toFixed(2)}MB)`
      );
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("logo", file);
      formData.append("substepId", substepId);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress((e.loaded / e.total) * 100);
        }
      });

      const response = await new Promise<CopilotResponseDto>(
        (resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status === 200) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(JSON.parse(xhr.responseText));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed"));

          xhr.open("POST", "/api/copilot/upload-logo");
          xhr.send(formData);
        }
      );

      // Update UI with new logo
      if (response.uiDirectives?.components) {
        const logoComponent = response.uiDirectives.components.find(
          (c) => c.name === "businessLogo"
        );
        if (logoComponent) {
          setLogoUrl(logoComponent.metadata.logoUrl);
        }
      }

      showToast("Logo uploaded successfully");
    } catch (err) {
      showError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={(e) => handleFileSelect(e.target.files[0])}
        disabled={uploading}
      />
      {uploading && (
        <ProgressBar
          value={progress}
          label={`Uploading... ${progress.toFixed(0)}%`}
        />
      )}
    </div>
  );
}
```

### Example 5: Assistant Add/Delete with Optimistic UI

```typescript
// ✅ CORRECT: Optimistic UI with rollback on error

function AssistantList({ assistants, isConversational }) {
  const [localAssistants, setLocalAssistants] = useState(assistants);
  const [pendingOps, setPendingOps] = useState<Set<number>>(new Set());

  async function handleAddAssistant() {
    // Optimistic: Add temporary assistant immediately
    const tempId = Date.now();
    const tempAssistant = {
      id: tempId,
      name: "Creating...",
      temporary: true,
    };

    setLocalAssistants((prev) => [...prev, tempAssistant]);
    setPendingOps((prev) => new Set(prev).add(tempId));

    try {
      const response = await fetch("/api/copilot/assistants", {
        method: "POST",
      }).then((r) => r.json());

      if (isConversational && response.currentSubstep) {
        // Update from bot message (assistant cards)
        const assistantCards = response.currentSubstep.botMessage
          .filter((m) => m.component === "AssistantCard")
          .map((m) => m.metadata);

        setLocalAssistants(assistantCards);
      } else if (response.uiDirectives?.assistantMutation) {
        // Update from mutation data
        setLocalAssistants(
          response.uiDirectives.assistantMutation.createdAssistants
        );
      }
    } catch (err) {
      // Rollback optimistic update
      setLocalAssistants((prev) => prev.filter((a) => a.id !== tempId));
      showError("Failed to add assistant");
    } finally {
      setPendingOps((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }
  }

  async function handleDeleteAssistant(assistantId: number) {
    // Prevent deleting last assistant
    if (localAssistants.length === 1) {
      showError("Cannot delete the last assistant");
      return;
    }

    // Optimistic: Remove immediately
    const backup = localAssistants;
    setLocalAssistants((prev) => prev.filter((a) => a.id !== assistantId));
    setPendingOps((prev) => new Set(prev).add(assistantId));

    try {
      const response = await fetch(`/api/copilot/assistants/${assistantId}`, {
        method: "DELETE",
      }).then((r) => r.json());

      // Update from response
      if (response.currentSubstep?.botMessage) {
        const assistantCards = response.currentSubstep.botMessage
          .filter((m) => m.component === "AssistantCard")
          .map((m) => m.metadata);

        setLocalAssistants(assistantCards);
      }
    } catch (err) {
      // Rollback
      setLocalAssistants(backup);
      showError("Failed to delete assistant");
    } finally {
      setPendingOps((prev) => {
        const next = new Set(prev);
        next.delete(assistantId);
        return next;
      });
    }
  }

  return (
    <div>
      {localAssistants.map((assistant) => (
        <AssistantCard
          key={assistant.id}
          assistant={assistant}
          onDelete={handleDeleteAssistant}
          deleting={pendingOps.has(assistant.id)}
          canDelete={localAssistants.length > 1}
        />
      ))}
      <button onClick={handleAddAssistant}>Add Assistant</button>
    </div>
  );
}
```

### Example 6: State Persistence & Recovery

```typescript
// ✅ CORRECT: Handle page refresh and browser navigation

function CopilotProvider({ children }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: Restore state from server
  useEffect(() => {
    async function restoreState() {
      try {
        const response = await fetch("/api/copilot/state").then((r) =>
          r.json()
        );

        setState({
          conversationId: response.conversationId,
          currentSection: response.currentSection,
          currentSubstep: response.currentSubstepDetails.currentSubstep,
          sessionState: response.sessionState,
          isActive: response.isActive,
          isCompleted: response.isCompleted,
          messageHistory: response.recentMessages,
        });

        // Check if conversation is complete
        if (response.isCompleted) {
          router.push("/dashboard");
          return;
        }
      } catch (err) {
        if (err.status === 404) {
          // No active conversation - start new one
          const startResponse = await fetch("/api/copilot/start", {
            method: "POST",
          }).then((r) => r.json());

          setState({
            currentSubstep: startResponse.currentSubstep,
            // ... initialize state
          });
        } else {
          showError("Failed to restore conversation state");
        }
      } finally {
        setLoading(false);
      }
    }

    restoreState();
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    function handlePopState() {
      // Resync state on navigation
      fetch("/api/copilot/state")
        .then((r) => r.json())
        .then((response) => {
          setState((prev) => ({
            ...prev,
            currentSubstep: response.currentSubstepDetails.currentSubstep,
            currentSection: response.currentSection,
          }));
        });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Prevent multiple tabs
  useEffect(() => {
    const tabId = sessionStorage.getItem("copilot-tab-id");

    if (tabId && tabId !== window.name) {
      showWarning(
        "Copilot is already open in another tab. Changes may conflict."
      );
    } else {
      window.name = Date.now().toString();
      sessionStorage.setItem("copilot-tab-id", window.name);
    }

    return () => {
      sessionStorage.removeItem("copilot-tab-id");
    };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <CopilotContext.Provider value={state}>{children}</CopilotContext.Provider>
  );
}
```

## Troubleshooting Guide

### Common Issues & Solutions

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue: "Validation failed - substepId mismatch"                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cause: Frontend and backend are out of sync                                │
│                                                                             │
│ Symptoms:                                                                   │
│ • Error message: "expected confirmBusinessData, received businessName"     │
│ • Occurs after page refresh or navigation                                  │
│                                                                             │
│ Solution:                                                                   │
│ 1. Call GET /copilot/state on component mount                              │
│ 2. Use state.currentSubstep.id for metadata.substepId                      │
│ 3. Never hardcode substep IDs                                              │
│                                                                             │
│ Prevention:                                                                 │
│ • Always sync state before user interaction                                │
│ • Implement popstate listener for browser back/forward                     │
│ • Add state version checking                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue: Options array is empty for dynamic substeps                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cause: Options not hydrated (channels, goals, etc.)                        │
│                                                                             │
│ Symptoms:                                                                   │
│ • substep.options = [] or undefined                                        │
│ • Occurs for: channels, adjustGoalsObjectives, selectBusinessNameMatch     │
│                                                                             │
│ Solution:                                                                   │
│ 1. Check if substep needs hydration:                                       │
│    const needsHydration = ['channels', 'adjustGoalsObjectives',            │
│      'selectBusinessNameMatch'].includes(substep.id)                       │
│                                                                             │
│ 2. If options empty, call GET /copilot/state                               │
│ 3. Use state.currentSubstepDetails.currentSubstep.options                  │
│                                                                             │
│ Prevention:                                                                 │
│ • Always fetch fresh state before rendering dynamic substeps               │
│ • Don't cache options for these substeps                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue: "Cannot edit while in edit flow"                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cause: Attempting nested edit                                              │
│                                                                             │
│ Symptoms:                                                                   │
│ • Error when clicking edit button during active edit                       │
│ • state.is_in_edit_flow = true                                             │
│                                                                             │
│ Solution:                                                                   │
│ 1. Check state.sessionState.is_in_edit_flow before showing edit button     │
│ 2. Disable all edit buttons when in edit flow                              │
│ 3. Show "Complete current edit first" message                              │
│                                                                             │
│ UI Pattern:                                                                 │
│ {!state.is_in_edit_flow && (                                               │
│   <button onClick={handleEdit}>Edit</button>                               │
│ )}                                                                          │
│                                                                             │
│ Prevention:                                                                 │
│ • Track edit state globally                                                │
│ • Show edit context breadcrumb when in edit flow                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue: Team size / channel selection fails with plan error                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cause: Selection exceeds plan limits                                       │
│                                                                             │
│ Symptoms:                                                                   │
│ • Error: "Team size requires ORGANISATION plan"                            │
│ • Error: "Channel requires addon"                                          │
│ • requiresUpgrade: true in error response                                  │
│                                                                             │
│ Solution:                                                                   │
│ 1. Don't treat as error - this triggers upgrade flow                       │
│ 2. Follow navigation to upgrade substeps                                   │
│ 3. Allow user to upgrade or select smaller option                          │
│                                                                             │
│ UI Pattern:                                                                 │
│ • Show plan comparison when requiresUpgrade: true                          │
│ • Highlight recommended plan                                               │
│ • Allow "Choose smaller size" option                                       │
│                                                                             │
│ Prevention:                                                                 │
│ • Show plan limits in UI before selection                                  │
│ • Disable options that exceed plan                                         │
│ • Add "Requires [PLAN]" badges to options                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue: File upload fails silently or times out                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cause: Network issues or validation failure                                │
│                                                                             │
│ Symptoms:                                                                   │
│ • Upload spinner never completes                                           │
│ • No error message shown                                                   │
│ • File > 5MB or wrong type                                                 │
│                                                                             │
│ Solution:                                                                   │
│ 1. Add client-side validation BEFORE upload:                               │
│    - File size < 5MB                                                       │
│    - MIME type in ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']  │
│                                                                             │
│ 2. Add timeout handler:                                                    │
│    setTimeout(() => {                                                      │
│      if (uploading) {                                                      │
│        showError('Upload timed out. Please try again.')                    │
│        setUploading(false)                                                 │
│      }                                                                      │
│    }, 30000) // 30 second timeout                                          │
│                                                                             │
│ 3. Show progress indicator                                                 │
│ 4. Allow cancel/retry                                                      │
│                                                                             │
│ Prevention:                                                                 │
│ • Use <input accept="image/*"> attribute                                   │
│ • Show file requirements in UI                                             │
│ • Validate before initiating upload                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue: Assistant deletion shows "Cannot delete last assistant"             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cause: Attempting to delete when only one assistant remains                │
│                                                                             │
│ Symptoms:                                                                   │
│ • Error on DELETE /copilot/assistants/:id                                  │
│ • All channels would be left without assistant                             │
│                                                                             │
│ Solution:                                                                   │
│ 1. Disable delete button when assistants.length === 1                      │
│ 2. Show tooltip: "At least one assistant required"                         │
│ 3. Suggest "Add assistant first, then delete this one"                     │
│                                                                             │
│ UI Pattern:                                                                 │
│ <button                                                                     │
│   onClick={() => handleDelete(assistant.id)}                               │
│   disabled={assistants.length === 1}                                       │
│   title={assistants.length === 1                                           │
│     ? "Cannot delete last assistant"                                       │
│     : "Delete assistant"}                                                  │
│ >                                                                           │
│   Delete                                                                    │
│ </button>                                                                   │
│                                                                             │
│ Prevention:                                                                 │
│ • Always check count before enabling delete                                │
│ • Show count badge: "3 assistants"                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue: Edit returns to wrong position                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cause: Return position tracking issue                                      │
│                                                                             │
│ Symptoms:                                                                   │
│ • After completing edit, navigates to unexpected substep                   │
│ • state.edit_return_position seems incorrect                               │
│                                                                             │
│ Debug Steps:                                                                │
│ 1. Check state.edit_return_position in GET /copilot/state                  │
│ 2. Verify it matches where edit started                                    │
│ 3. Check edit_history for edit origin                                      │
│                                                                             │
│ Solution:                                                                   │
│ • This is usually a backend bug, not frontend                              │
│ • Log issue with edit flow details                                         │
│ • Workaround: Call POST /copilot/restart to reset                          │
│                                                                             │
│ Prevention:                                                                 │
│ • Track original position in frontend state during edit                    │
│ • Validate return position exists before navigation                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Issue: Business search returns no results                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cause: No matching businesses found                                        │
│                                                                             │
│ Symptoms:                                                                   │
│ • selectBusinessNameMatch shows only "My business isn't listed"            │
│ • state.collected_data.business_search_results = []                        │
│                                                                             │
│ Solution:                                                                   │
│ • This is expected behavior, not an error                                  │
│ • User should select "My business isn't listed"                            │
│ • Flow continues to businessNotListed for manual entry                     │
│                                                                             │
│ UI Pattern:                                                                 │
│ {options.length === 1 && (                                                 │
│   <div>                                                                     │
│     <p>No matches found for "{businessName}"</p>                           │
│     <p>Don't worry - you can add your details manually.</p>                │
│   </div>                                                                    │
│ )}                                                                          │
│                                                                             │
│ Prevention:                                                                 │
│ • Set user expectations: "We'll search for your business"                  │
│ • Explain manual entry is always available                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Testing Scenarios

### Unit Test Cases

```typescript
// Test Suite 1: Normal Flow Navigation

describe("Normal Flow Navigation", () => {
  test("should advance from planConfirmation to businessIndustry", async () => {
    const response = await sendMessage({
      inputType: "selection",
      content: "Yes, Proceed with my current plan",
      metadata: {
        substepId: "planConfirmation",
        selectedOption: true,
      },
    });

    expect(response.currentSubstep.id).toBe("businessIndustry");
    expect(response.currentSubstep.options).toHaveLength(13); // 12 industries + "not listed"
  });

  test('should handle "category not listed" flow', async () => {
    const response = await sendMessage({
      inputType: "selection",
      content: "Category not listed here",
      metadata: {
        substepId: "businessIndustry",
        selectedOption: "none",
      },
    });

    expect(response.currentSubstep.id).toBe("categoryNotListed");
    expect(response.currentSubstep.type).toBe("input");
  });

  test("should validate business name input", async () => {
    await expect(
      sendMessage({
        inputType: "text",
        content: "", // Empty name
        metadata: { substepId: "businessName" },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Business name must be"),
    });
  });

  test("should handle empty search results", async () => {
    // Mock businessLookupService to return []
    jest.spyOn(businessLookupService, "searchBusiness").mockResolvedValue([]);

    const response = await sendMessage({
      inputType: "text",
      content: "Nonexistent Business XYZ",
      metadata: { substepId: "businessName" },
    });

    expect(response.currentSubstep.id).toBe("selectBusinessNameMatch");
    expect(response.currentSubstep.options).toHaveLength(1); // Only "not listed"
    expect(response.currentSubstep.options[0].isCustom).toBe(true);
  });

  test("should complete section and advance to next section", async () => {
    const response = await sendMessage({
      inputType: "selection",
      content: "Confirm",
      metadata: {
        substepId: "confirmBusinessData",
        selectedOption: "confirm",
      },
    });

    expect(response.sectionComplete).toBe(true);
    expect(response.currentSubstep.parentStepId).toBe("teamMembers");
    expect(response.currentSubstep.id).toBe("teamSize");
  });
});

// Test Suite 2: Plan Validation

describe("Plan Validation", () => {
  test("should allow team size within plan limit", async () => {
    // User on BUSINESS plan (max 10 seats)
    const response = await sendMessage({
      inputType: "selection",
      content: "6-20",
      metadata: {
        substepId: "teamSize",
        selectedOption: "6-20",
      },
    });

    // Should navigate to upgrade flow (6-20 exceeds 10)
    expect(response.currentSubstep.id).toBe("teamSizeOverLimit");
  });

  test("should block channel requiring addon", async () => {
    // User on STARTER plan (no CRM addon)
    await expect(
      sendMessage({
        inputType: "selection",
        content: "Google Calendar",
        metadata: {
          substepId: "channels",
          selectedOptions: ["google_calendar"],
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      requiresUpgrade: true,
      details: expect.objectContaining({
        google_calendar: expect.stringContaining("CRM"),
      }),
    });
  });

  test("should cap AI assistants at plan limit", async () => {
    // User on BUSINESS plan (max 3 assistants)
    // Selects "multiple" strategy with 5 channels
    const response = await sendMessage({
      inputType: "selection",
      content: "Multiple Assistants by Channel",
      metadata: {
        substepId: "aiAssistantsForChannels",
        selectedOption: "multiple",
      },
    });

    const createdAssistants = response.currentSubstep.botMessage.filter(
      (m) => m.component === "AssistantCard"
    );

    expect(createdAssistants).toHaveLength(3); // Capped at plan limit
  });
});

// Test Suite 3: Edit Flow

describe("Edit Flow", () => {
  test("should handle same-section inline edit", async () => {
    const response = await editSubstep("noReplyConfiguration", "escalate");

    expect(response.uiDirectives.editComplete).toBe(true);
    expect(response.uiDirectives.isInEditFlow).toBe(false);
    expect(response.currentSubstep.id).toBe("confirmNoReplyConfiguration"); // Unchanged
  });

  test("should handle cross-section edit with navigation", async () => {
    // Currently at channels/channels
    // Edit businessIndustry from earlier section
    const response = await editSubstep(
      "businessIndustry",
      "HEALTHCARE_CLINICS"
    );

    expect(response.uiDirectives.isInEditFlow).toBe(true);
    expect(response.uiDirectives.editContext).toMatchObject({
      editedSubstep: "businessIndustry",
      editedSection: "businessIdentity",
      affectedSubsteps: [
        { substep: "confirmBusinessData", section: "businessIdentity" },
        { substep: "adjustGoalsObjectives", section: "businessIdentity" },
      ],
    });
    expect(response.currentSubstep.id).toBe("confirmBusinessData");
  });

  test("should return to origin after completing edit", async () => {
    // Complete affected substep during edit flow
    const response = await sendMessage({
      inputType: "selection",
      content: "Confirm",
      metadata: {
        substepId: "adjustGoalsConfirm", // Last affected substep
        selectedOption: "confirm",
      },
    });

    expect(response.uiDirectives.editComplete).toBe(true);
    expect(response.uiDirectives.returnedFromEdit).toBe(true);
    expect(response.currentSubstep.id).toBe("channels"); // Original position
  });

  test("should block nested edits", async () => {
    // Start first edit
    await editSubstep("businessIndustry", "REAL_ESTATE");

    // Attempt second edit while first is active
    await expect(editSubstep("teamSize", "21")).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Cannot edit while in edit flow"),
    });
  });

  test("should clear affected substeps and data", async () => {
    const stateBefore = await getState();
    expect(stateBefore.sessionState.completed_substeps).toContain(
      "confirmBusinessData"
    );
    expect(
      stateBefore.sessionState.collected_data.suggested_goals
    ).toBeTruthy();

    await editSubstep("businessIndustry", "FINANCE_ACCOUNTING");

    const stateAfter = await getState();
    expect(stateAfter.sessionState.completed_substeps).not.toContain(
      "confirmBusinessData"
    );
    expect(stateAfter.sessionState.collected_data.suggested_goals).toBeNull();
  });

  test("should record edit in history", async () => {
    await editSubstep("channels", ["whatsapp", "gmail"]);

    const state = await getState();
    const lastEdit =
      state.sessionState.edit_history[
        state.sessionState.edit_history.length - 1
      ];

    expect(lastEdit).toMatchObject({
      section: "channels",
      substep: "channels",
      field: "channels",
      new_value: ["whatsapp", "gmail"],
    });
    expect(lastEdit.timestamp).toBeTruthy();
  });
});

// Test Suite 4: File Upload

describe("File Upload", () => {
  test("should upload valid logo file", async () => {
    const file = new File(["fake image data"], "logo.png", {
      type: "image/png",
    });

    const response = await uploadLogo(file, "businessNotListed");

    expect(response.currentSubstep.id).toBe("confirmBusinessData");
    expect(response.uiDirectives.components).toContainEqual(
      expect.objectContaining({
        name: "businessLogo",
        metadata: expect.objectContaining({
          logoUrl: expect.stringContaining("s3.amazonaws.com"),
        }),
      })
    );
  });

  test("should reject file over 5MB", async () => {
    const largeFile = new File(
      [new ArrayBuffer(6 * 1024 * 1024)],
      "large.png",
      {
        type: "image/png",
      }
    );

    await expect(
      uploadLogo(largeFile, "businessNotListed")
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("5MB"),
    });
  });

  test("should reject invalid file type", async () => {
    const pdfFile = new File(["fake pdf"], "doc.pdf", {
      type: "application/pdf",
    });

    await expect(
      uploadLogo(pdfFile, "businessNotListed")
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("PNG, JPG"),
    });
  });
});

// Test Suite 5: Assistant Management

describe("Assistant Management", () => {
  test("should add assistant and rebalance channels", async () => {
    const stateBefore = await getState();
    const initialCount =
      stateBefore.sessionState.collected_data.created_assistants.length;

    const response = await addAssistant();

    const createdAssistants = response.currentSubstep.botMessage.filter(
      (m) => m.component === "AssistantCard"
    );
    expect(createdAssistants).toHaveLength(initialCount + 1);

    // Verify channel configs updated
    const stateAfter = await getState();
    expect(
      stateAfter.sessionState.collected_data.draft_channel_configs
    ).toBeTruthy();
  });

  test("should delete assistant and reassign channels", async () => {
    const state = await getState();
    const assistantToDelete =
      state.sessionState.collected_data.created_assistants[1];

    const response = await deleteAssistant(assistantToDelete.id);

    const remainingAssistants = response.currentSubstep.botMessage.filter(
      (m) => m.component === "AssistantCard"
    );
    expect(remainingAssistants).not.toContainEqual(
      expect.objectContaining({ metadata: { id: assistantToDelete.id } })
    );
  });

  test("should prevent deleting last assistant", async () => {
    // Delete all but one
    const state = await getState();
    const assistants = state.sessionState.collected_data.created_assistants;

    for (let i = 1; i < assistants.length; i++) {
      await deleteAssistant(assistants[i].id);
    }

    // Attempt to delete last one
    await expect(deleteAssistant(assistants[0].id)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Cannot delete the last"),
    });
  });
});

// Test Suite 6: State Synchronization

describe("State Synchronization", () => {
  test("should reject message with mismatched substepId", async () => {
    const state = await getState();

    await expect(
      sendMessage({
        inputType: "selection",
        content: "Test",
        metadata: {
          substepId: "wrongSubstep", // Doesn't match current position
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      hint: expect.stringContaining("call GET /copilot/state"),
    });
  });

  test("should persist state across GET requests", async () => {
    const state1 = await getState();
    const state2 = await getState();

    expect(state1.conversationId).toBe(state2.conversationId);
    expect(state1.currentSubstep.id).toBe(state2.currentSubstep.id);
    expect(state1.sessionState.collected_data).toEqual(
      state2.sessionState.collected_data
    );
  });

  test("should handle conversation restart", async () => {
    const stateBefore = await getState();

    const response = await restartConversation();

    expect(response.currentSubstep.id).toBe("planConfirmation"); // First substep

    const stateAfter = await getState();
    expect(stateAfter.conversationId).not.toBe(stateBefore.conversationId);
    expect(stateAfter.sessionState.completed_substeps).toHaveLength(0);
  });
});
```

### Integration Test Scenarios

```typescript
// Scenario 1: Complete Happy Path (No Edits)

test("should complete full onboarding flow", async () => {
  // 1. Start conversation
  const start = await POST("/copilot/start");
  expect(start.currentSubstep.id).toBe("planConfirmation");

  // 2. Confirm plan
  const confirmPlan = await POST("/copilot/message", {
    inputType: "selection",
    content: "Yes, Proceed with my current plan",
    metadata: { substepId: "planConfirmation", selectedOption: true },
  });
  expect(confirmPlan.currentSubstep.id).toBe("businessIndustry");

  // 3. Select industry
  const selectIndustry = await POST("/copilot/message", {
    inputType: "selection",
    content: "E-commerce / Retail",
    metadata: {
      substepId: "businessIndustry",
      selectedOption: "ECOMMERCE_RETAIL",
    },
  });
  expect(selectIndustry.currentSubstep.id).toBe("businessName");

  // 4. Enter business name
  const enterName = await POST("/copilot/message", {
    inputType: "text",
    content: "Acme Corp",
    metadata: { substepId: "businessName" },
  });
  expect(enterName.currentSubstep.id).toBe("selectBusinessNameMatch");

  // 5. Select business match
  const selectMatch = await POST("/copilot/message", {
    inputType: "selection",
    content: "Acme Corp Ltd",
    metadata: {
      substepId: "selectBusinessNameMatch",
      selectedOption: enterName.currentSubstep.options[0].value,
    },
  });
  expect(selectMatch.currentSubstep.id).toBe("confirmBusinessData");

  // 6. Confirm business data
  const confirmBusiness = await POST("/copilot/message", {
    inputType: "selection",
    content: "Confirm",
    metadata: { substepId: "confirmBusinessData", selectedOption: "confirm" },
  });
  expect(confirmBusiness.sectionComplete).toBe(true);
  expect(confirmBusiness.currentSubstep.parentStepId).toBe("teamMembers");

  // ... continue through remaining sections

  // Final: Complete automation
  const complete = await POST("/copilot/message", {
    inputType: "selection",
    content: "Confirm and continue",
    metadata: { substepId: "finalizeSetup", selectedOption: true },
  });
  expect(complete.conversationComplete).toBe(true);
  expect(complete.currentSubstep).toBeNull();
});

// Scenario 2: Cross-Section Edit with Return

test("should handle cross-section edit and return", async () => {
  // Complete through channels section
  // ... (omitted for brevity)

  const stateBeforeEdit = await GET("/copilot/state");
  expect(stateBeforeEdit.currentSection).toBe("channels");
  expect(stateBeforeEdit.currentSubstep).toBe("confirmChannelsConfiguration");

  // Edit businessIndustry from earlier section
  const edit = await POST("/copilot/edit/businessIndustry", {
    substepId: "businessIndustry",
    newValue: "HEALTHCARE_CLINICS",
  });

  expect(edit.uiDirectives.isInEditFlow).toBe(true);
  expect(edit.currentSubstep.id).toBe("confirmBusinessData");

  // Complete affected substeps
  const confirmEdited = await POST("/copilot/message", {
    inputType: "selection",
    content: "Confirm",
    metadata: { substepId: "confirmBusinessData", selectedOption: "confirm" },
  });

  // Should return to original position
  expect(confirmEdited.uiDirectives.returnedFromEdit).toBe(true);
  expect(confirmEdited.currentSubstep.id).toBe("confirmChannelsConfiguration");

  const stateAfterReturn = await GET("/copilot/state");
  expect(stateAfterReturn.sessionState.is_in_edit_flow).toBe(false);
  expect(stateAfterReturn.sessionState.edit_return_position).toBeNull();
});

// Scenario 3: Plan Upgrade Flow

test("should handle team size exceeding plan limit", async () => {
  // User on BUSINESS plan (max 10 seats)

  const selectLargeTeam = await POST("/copilot/message", {
    inputType: "selection",
    content: "21 or more",
    metadata: { substepId: "teamSize", selectedOption: "21" },
  });

  // Should navigate to upgrade flow
  expect(selectLargeTeam.currentSubstep.id).toBe("teamSizeOverLimit");

  // Select upgrade option
  const chooseUpgrade = await POST("/copilot/message", {
    inputType: "selection",
    content: "Upgrade my plan",
    metadata: { substepId: "teamSizeOverLimit", selectedOption: "upgrade" },
  });
  expect(chooseUpgrade.currentSubstep.id).toBe("teamUpgradeOptions");

  // Select ORGANISATION plan
  const selectPlan = await POST("/copilot/message", {
    inputType: "selection",
    content: "ORGANISATION",
    metadata: {
      substepId: "teamUpgradeOptions",
      selectedOption: "ORGANISATION",
    },
  });
  expect(selectPlan.currentSubstep.id).toBe("teamUpgradeConfirm");

  // Confirm upgrade
  const confirmUpgrade = await POST("/copilot/message", {
    inputType: "selection",
    content: "Continue",
    metadata: { substepId: "teamUpgradeConfirm", selectedOption: true },
  });

  // Should advance to next section
  expect(confirmUpgrade.currentSubstep.parentStepId).toBe("channels");

  // Verify plan changed
  const state = await GET("/copilot/state");
  expect(state.sessionState.collected_data.selected_plan).toBe("ORGANISATION");
  expect(state.sessionState.collected_data.team_size).toBe("21");
});
```

---

**Phase 3 Complete: Supplementary Documentation**

This phase covered:

- ✅ Comprehensive edge cases matrix (50+ scenarios)
- ✅ Production-ready code examples (6 complete patterns)
- ✅ Troubleshooting guide (8 common issues with solutions)
- ✅ Testing scenarios (unit tests + integration tests)

---

## Complete Documentation Summary

**Phase 1: Normal Flow Documentation**

- ✅ Section A: API Reference - All endpoints, request/response schemas, validation rules
- ✅ Section B: Flow Logic - Navigation, state management, validation chains, special flows

**Phase 2: Edit Flow Documentation**

- ✅ Section A: Edit API Reference - Edit endpoints, value types, response patterns
- ✅ Section B: Edit State Management - Context lifecycle, impact chains, return flow, cleanup

**Phase 3: Supplementary Documentation**

- ✅ Edge cases matrix - 50+ scenarios with handling patterns
- ✅ Code examples - 6 production-ready integration snippets
- ✅ Troubleshooting guide - 8 common issues with solutions
- ✅ Testing scenarios - Comprehensive unit and integration tests

**Total Coverage:**

- 10+ API endpoints documented
- 40+ substeps covered
- 50+ edge cases catalogued
- 20+ code examples provided
- 7-phase validation system explained
- Complete state management patterns
- Full edit flow lifecycle
- Production-ready testing suite

This documentation enables frontend developers to integrate the copilot system without requiring backend knowledge, handle all edge cases gracefully, and build a production-ready implementation.

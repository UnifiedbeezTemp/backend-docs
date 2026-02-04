# Copilot Edit Flow Documentation

## Section A: Edit API Reference

### Edit Endpoint

```typescript
POST /copilot/edit/:substepId

Path Parameter:
  substepId: string  // ID of the substep to edit

Request Body: EditSubstepDto
{
  substepId: string,      // Must match path parameter (redundant but validated)
  newValue: any           // Type varies by substep - see table below
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: string,
    botMessage: [...],
    options: [...]
  } | null,
  uiDirectives: {
    isInEditFlow?: boolean,        // True if navigating to affected substeps
    editComplete?: boolean,         // True if edit finished inline
    returnedFromEdit?: boolean,     // True if returning from edit flow
    exitToManualSetup?: boolean,    // True if switching to manual config
    editContext?: {                 // Present if isInEditFlow === true
      editedSubstep: string,
      editedSection: string,
      affectedSubsteps: Array<{
        substep: string,
        section: string
      }>
    },
    components: [...]
  },
  lastUserMessage?: {
    messageType: "USER_EDIT",
    content: string,
    metadata: {
      section: string,
      substep: string,
      action: "edit",
      formField: string,
      previousValue: any
    },
    createdAt: string
  }
}
```

### Edit Value Types by Substep

```typescript
// Text input substeps:
{
  businessName: {
    newValue: string,              // Example: "New Business Name Ltd"
    validation: "1-200 chars"
  }
}

// Single choice substeps:
{
  businessIndustry: {
    newValue: IndustryType,        // Example: "HEALTHCARE_CLINICS"
    validation: "Must be valid IndustryType enum"
  },

  selectBusinessNameMatch: {
    newValue: BusinessMatch | "",  // Full object OR empty string for "not listed"
    validation: "Must be from original search results or empty"
  },

  confirmChannelsConfiguration: {
    newValue: boolean,             // true = recommended, false = manual
    validation: "Must be boolean"
  },

  noReplyConfiguration: {
    newValue: "escalate" | "followUp" | "none",
    validation: "Must be one of three values"
  },

  aiAssistantsForChannels: {
    newValue: "single" | "multiple",
    validation: "Must be 'single' or 'multiple'"
  }
}

// Multiple choice substeps:
{
  channels: {
    newValue: string[],            // Example: ["whatsapp", "gmail", "slack"]
    validation: "Array of valid channel values, length >= 1"
  },

  adjustGoalsObjectives: {
    newValue: string[],            // Example: ["goal:1", "goal:3", "objective:2"]
    validation: "Array of 'goal:id' or 'objective:id' or ['keepCurrent']"
  }
}

// Range choice substeps:
{
  teamSize: {
    newValue: "1" | "2-5" | "6-20" | "21",
    validation: "Must be one of four size ranges"
  }
}

// Special substeps:
{
  planConfirmation: {
    // Handled via separate POST /copilot/change-plan endpoint
    // Not editable via edit endpoint
  },

  businessLogo: {
    // Handled via POST /copilot/edit-logo with multipart/form-data
    // Not editable via JSON edit endpoint
  }
}
```

### Edit Response Patterns

#### Pattern 1: Inline Edit (Same Section, No Affected Substeps)

```typescript
// Request:
POST /copilot/edit/noReplyConfiguration
{
  substepId: "noReplyConfiguration",
  newValue: "escalate"
}

// Response:
{
  currentSubstep: {
    id: "confirmNoReplyConfiguration",  // Current substep (unchanged)
    botMessage: [
      {
        type: "text",
        message: "Updated fallback behavior to \"escalate\"."
      },
      {
        type: "text",
        message: "Great! When a customer doesn't reply..."  // Original bot message
      }
    ]
  },
  uiDirectives: {
    editComplete: true,                 // ✅ Edit finished
    isInEditFlow: false,                // No navigation needed
    components: [...]
  },
  lastUserMessage: {
    messageType: "USER_EDIT",
    content: "escalate",
    metadata: {
      section: "fallbackLogic",
      substep: "noReplyConfiguration",
      action: "edit",
      formField: "noReplyConfiguration",
      previousValue: "followUp"
    },
    createdAt: "2024-01-15T11:00:00Z"
  }
}

// Frontend action:
// - Display confirmation message
// - Update collected_data locally
// - Stay on current screen
// - No navigation needed
```

#### Pattern 2: Edit with Affected Substeps (Same Section)

```typescript
// Request:
POST /copilot/edit/businessIndustry
{
  substepId: "businessIndustry",
  newValue: "HEALTHCARE_CLINICS"
}

// Response:
{
  currentSubstep: {
    id: "confirmBusinessData",          // Navigated to affected substep
    botMessage: [
      {
        type: "text",
        message: "Updated industry to HEALTHCARE_CLINICS. I've regenerated your business goals based on this industry."
      },
      {
        type: "text",
        message: "**Acme Electronics Inc.**\n\n🎯 Goals:\n- Improve patient satisfaction..."
      }
    ]
  },
  uiDirectives: {
    editComplete: true,                 // ✅ Edit finished (same section)
    isInEditFlow: false,                // Not cross-section
    components: [
      { name: "businessLogo", metadata: {...} }
    ]
  },
  lastUserMessage: {
    messageType: "USER_EDIT",
    content: "HEALTHCARE_CLINICS",
    metadata: {
      section: "businessIdentity",
      substep: "businessIndustry",
      action: "edit",
      formField: "industry",
      previousValue: "ECOMMERCE_RETAIL"
    },
    createdAt: "2024-01-15T11:05:00Z"
  }
}

// Backend actions performed:
// 1. Updated industry in collected_data
// 2. Cleared suggested_goals, suggested_objectives (affected data)
// 3. Cleared confirmBusinessData, adjustGoalsObjectives (affected substeps)
// 4. Regenerated goals via LLM using new industry
// 5. Navigated to confirmBusinessData
// 6. Added to edit_history

// Frontend action:
// - Navigate to confirmBusinessData substep
// - Display updated goals
// - User continues from here (can confirm or adjust again)
```

#### Pattern 3: Cross-Section Edit (Edit from Different Section)

```typescript
// Current position: channels section, channels substep
// User edits: businessIndustry (from businessIdentity section)

// Request:
POST /copilot/edit/businessIndustry
{
  substepId: "businessIndustry",
  newValue: "REAL_ESTATE"
}

// Response:
{
  currentSubstep: {
    id: "confirmBusinessData",          // First affected substep
    botMessage: [
      {
        type: "text",
        message: "Updated industry to REAL_ESTATE. I've regenerated your business goals based on this industry."
      },
      {
        type: "text",
        message: "**Acme Electronics Inc.**\n\n🎯 Goals:\n- Close more property deals..."
      }
    ]
  },
  uiDirectives: {
    isInEditFlow: true,                 // ✅ Cross-section edit
    editComplete: false,                // Not done yet
    returnedFromEdit: false,
    editContext: {
      editedSubstep: "businessIndustry",
      editedSection: "businessIdentity",
      affectedSubsteps: [
        { substep: "confirmBusinessData", section: "businessIdentity" },
        { substep: "adjustGoalsObjectives", section: "businessIdentity" }
      ]
    },
    components: [...]
  },
  lastUserMessage: {
    messageType: "USER_EDIT",
    content: "REAL_ESTATE",
    metadata: {
      section: "businessIdentity",
      substep: "businessIndustry",
      action: "edit",
      formField: "industry",
      previousValue: "ECOMMERCE_RETAIL"
    },
    createdAt: "2024-01-15T11:10:00Z"
  }
}

// Backend actions performed:
// 1. Detected cross-section edit (current: channels, editing: businessIdentity)
// 2. Set edit_return_position = { section: "channels", substep: "channels" }
// 3. Set is_in_edit_flow = true
// 4. Cleared affected substeps and data
// 5. Regenerated goals
// 6. Navigated to first affected substep (confirmBusinessData)

// Frontend action:
// - Navigate to confirmBusinessData (different section!)
// - Show edit context UI (e.g., "Editing business identity, will return to channels")
// - User must complete affected substeps
// - After completion, will return to original position
```

#### Pattern 4: Edit Return (Completing Cross-Section Edit)

```typescript
// User in edit flow (editing businessIndustry from channels section)
// User completes confirmBusinessData

// Request:
POST /copilot/message
{
  inputType: "selection",
  content: "Confirm",
  metadata: {
    substepId: "confirmBusinessData",
    selectedOption: "confirm"
  }
}

// Response:
{
  currentSubstep: {
    id: "channels",                     // ✅ Returned to original position
    botMessage: []                      // Empty - already displayed
  },
  uiDirectives: {
    editComplete: true,                 // ✅ Edit flow finished
    returnedFromEdit: true,             // ✅ Returned from edit
    isInEditFlow: false,                // No longer in edit flow
    components: [...]
  },
  lastUserMessage: null                 // Included for consistency
}

// Backend actions performed:
// 1. Detected section completion during edit flow
// 2. Retrieved edit_return_position = { section: "channels", substep: "channels" }
// 3. Cleared edit context (is_in_edit_flow = false, edit_return_position = null)
// 4. Navigated back to original position
// 5. No new bot message (user resumes from where they left off)

// Frontend action:
// - Navigate back to channels substep
// - Hide edit context UI
// - Show success message: "Business identity updated"
// - User continues normal flow from channels
```

#### Pattern 5: Edit Requiring Plan Upgrade

```typescript
// Request:
POST /copilot/edit/teamSize
{
  substepId: "teamSize",
  newValue: "21"  // User on BUSINESS plan (max 10 seats)
}

// Response:
{
  currentSubstep: {
    id: "teamSizeOverLimit",            // Navigated to upgrade flow
    botMessage: [
      {
        type: "text",
        message: "Your current plan doesn't support team size \"21 or more\"."
      },
      {
        type: "text",
        message: "Your BUSINESS plan allows up to 10 seats. To add 21 or more..."
      }
    ],
    options: [
      { label: "Upgrade my plan", value: "upgrade", ... },
      { label: "View plan details", value: "planDetails", ... },
      { label: "Choose a smaller size", value: "smaller", ... }
    ]
  },
  uiDirectives: {
    isInEditFlow: true,                 // ✅ If cross-section
    editComplete: false,
    components: [...]
  },
  lastUserMessage: {
    messageType: "USER_EDIT",
    content: "21 or more",
    metadata: {
      section: "teamMembers",
      substep: "teamSize",
      action: "edit",
      formField: "team_size",
      previousValue: "2-5"
    },
    createdAt: "2024-01-15T11:15:00Z"
  }
}

// Backend actions performed:
// 1. Validated new size against plan: validateTeamSizeAgainstPlan()
// 2. Validation failed: requires upgrade
// 3. Stored team_size_attempt = "21", team_size_attempt_label = "21 or more"
// 4. Did NOT update team_size (validation failed)
// 5. Navigated to teamSizeOverLimit
// 6. Set edit context if cross-section

// Frontend action:
// - Navigate to upgrade flow
// - User must complete upgrade or select smaller size
// - team_size only updates after validation passes
```

#### Pattern 6: Edit to Manual Setup Exit

```typescript
// Request:
POST /copilot/edit/confirmChannelsConfiguration
{
  substepId: "confirmChannelsConfiguration",
  newValue: false  // Switch from recommended to manual
}

// Response:
{
  currentSubstep: null,                 // ✅ No next substep
  uiDirectives: {
    editComplete: true,                 // ✅ Edit finished
    exitToManualSetup: true,            // ✅ Exit to manual UI
    isInEditFlow: false
  },
  lastUserMessage: {
    messageType: "USER_EDIT",
    content: "Configure now (Manual Setup)",
    metadata: {
      section: "channels",
      substep: "confirmChannelsConfiguration",
      action: "edit",
      formField: "useRecommendedSettings",
      previousValue: true
    },
    createdAt: "2024-01-15T11:20:00Z"
  }
}

// Backend actions performed:
// 1. Updated useRecommendedSettings = false
// 2. Cleaned up all draft assistants and configs
// 3. Cleared edit context
// 4. Did NOT mark conversation complete

// Frontend action:
// - Navigate to /channels/configure (manual setup UI)
// - Conversation remains active (user can return to copilot later via restart)
```

### Edit-Specific Endpoints

#### Edit Logo (Multipart)

```typescript
POST /copilot/edit-logo
Content-Type: multipart/form-data

Request:
{
  logo: File,                           // Max 5MB, PNG/JPG/WEBP
  substepId: "businessNotListed"        // Or "confirmBusinessData" if editing after match
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "confirmBusinessData",          // Current substep (may be unchanged)
    botMessage: [
      {
        type: "text",
        message: "Logo updated successfully."
      },
      // ... rest of original bot message
    ]
  },
  uiDirectives: {
    editComplete: true,
    components: [
      {
        name: "businessLogo",
        metadata: {
          logoUrl: "https://s3.../new-logo.png",  // Updated URL
          businessName: "Acme Electronics",
          website: "https://acme.com"
        }
      }
    ]
  },
  lastUserMessage: {
    messageType: "USER_EDIT",
    content: "Logo updated",
    metadata: {
      section: "businessIdentity",
      substep: "businessNotListed",     // Or substepId from request
      action: "edit",
      formField: "business_logo",
      previousValue: "https://s3.../old-logo.png"
    },
    createdAt: "2024-01-15T11:25:00Z"
  }
}

// Backend actions performed:
// 1. Validated file type and size
// 2. Deleted old logo from S3 (if exists)
// 3. Uploaded new logo to S3
// 4. Updated business_logo in collected_data
// 5. Updated selected_business.logo_url if exists
// 6. Added to edit_history

// Frontend action:
// - Update logo display
// - Show confirmation message
// - Stay on current screen (same section edit)
```

#### Change Plan (Special Edit)

```typescript
POST /copilot/change-plan
{
  newPlan: "ORGANISATION"  // PlanType enum
}

Response: CopilotResponseDto
{
  currentSubstep: {
    id: "businessIndustry",             // First substep OR first affected substep
    botMessage: [...]
  },
  uiDirectives: {
    components: [...]
  }
}

// Backend actions performed:
// 1. Switched user plan via planFeaturesService.switchPlan()
// 2. Updated selected_plan in collected_data
// 3. Revalidated ALL plan-dependent data:
//    - team_size against new plan limits
//    - channels against new plan features
//    - AI assistants against new plan limits
// 4. Cleared invalidated fields and substeps
// 5. Determined affected substeps
// 6. If completed planConfirmation: added to edit_history
// 7. Navigated to first affected substep OR next substep

// Special behaviors:
// - If called before planConfirmation complete: normal flow advancement
// - If called after planConfirmation: triggers revalidation cascade
// - May clear team_size if new plan has lower limit
// - May disable channels if new plan lacks addons
```

### Edit Validation Rules

```typescript
// Validation Order (same 7-phase system applies):

Phase 1: Entry Validation
- Active conversation exists
- User owns conversation

Phase 2: Edit-Specific Validation
Location: validateEdit()
Checks:
- substepId exists in flow config
- substepId has been completed (in completed_substeps)
- substep.canEdit !== false
- newValue type matches substep requirements
- User not already in edit flow (no nested edits)

Example error:
{
  message: "Edit validation failed",
  errors: [
    "Substep 'planConfirmation' cannot be edited (use change-plan endpoint)",
    "Substep 'businessName' not yet completed"
  ],
  substepId: "planConfirmation",
  currentState: {
    section: "businessIdentity",
    substep: "confirmBusinessData"
  }
}

Phase 3: Plan Validation (if applicable)
- Same as normal flow
- New value must meet plan requirements
- May trigger upgrade flow

Phase 4: Text/Choice Validation (if applicable)
- Same as normal flow
- newValue must be valid for substep type

Phase 7: Context Validation
Location: validateEditContext()
Checks:
- Edit return position is valid substep
- Affected substeps exist in flow
- No circular edit dependencies

Example error:
{
  message: "Invalid edit context",
  editSubstep: "businessIndustry",
  returnPosition: "channels/invalidSubstep",
  hint: "Return position no longer exists in flow"
}
```

### Edit Error Responses

```typescript
// Cannot Edit Error:
Status: 400 Bad Request
{
  message: "This substep cannot be edited",
  substepId: "planConfirmation",
  reason: "Use POST /copilot/change-plan to change your plan",
  canEdit: false
}

// Not Completed Error:
Status: 400 Bad Request
{
  message: "Cannot edit incomplete substep",
  substepId: "channels",
  currentState: {
    section: "businessIdentity",
    substep: "businessName"
  },
  hint: "Complete this substep first before editing"
}

// Nested Edit Error:
Status: 400 Bad Request
{
  message: "Cannot edit while in edit flow",
  currentEditContext: {
    editedSubstep: "businessIndustry",
    affectedSubsteps: ["confirmBusinessData"]
  },
  hint: "Complete current edit flow before starting a new edit"
}

// Invalid Value Error:
Status: 400 Bad Request
{
  message: "Invalid edit value",
  substepId: "channels",
  errors: [
    "At least one channel must be selected"
  ],
  providedValue: [],
  validation: "Array length >= 1"
}

// Plan Validation Error (triggers upgrade flow instead of error):
Status: 200 OK  // Not an error - navigation response
{
  currentSubstep: {
    id: "teamSizeOverLimit",
    // ... upgrade flow
  },
  uiDirectives: {
    isInEditFlow: true  // If cross-section
  }
}
```

---

**Phase 2, Section A Complete**

This section covered:

- ✅ Edit endpoint structure and request/response formats
- ✅ Edit value types for all editable substeps
- ✅ Six distinct edit response patterns
- ✅ Special edit endpoints (logo, plan change)
- ✅ Edit-specific validation rules
- ✅ Comprehensive error responses

# Section B: Edit State Management

## Edit Context Lifecycle

### Edit Context Structure

```typescript
interface EditContext {
  // Stored in conversation.sessionState:
  is_in_edit_flow: boolean              // Flag indicating active edit
  edit_return_position: {               // Where to return after edit completes
    section: string,
    substep: string
  } | null
  affected_substeps_in_edit: string[]   // Substeps cleared/requiring update
}

// Example state during cross-section edit:
{
  current_section: "businessIdentity",
  current_substep: "confirmBusinessData",
  is_in_edit_flow: true,
  edit_return_position: {
    section: "channels",
    substep: "channels"
  },
  affected_substeps_in_edit: [
    "confirmBusinessData",
    "adjustGoalsObjectives"
  ],
  completed_substeps: [
    "planConfirmation",
    "businessIndustry",
    "businessName",
    "selectBusinessNameMatch",
    // confirmBusinessData was cleared (affected by edit)
    "channels"  // Original position
  ]
}
```

### When Edit Context Is Set

```typescript
// Edit context is ONLY set for cross-section edits
// Determined by: shouldSetEditContext calculation

const shouldSetEditContext =
  !isSameSection ||                    // Different section
  editImpact?.affectedSubsteps?.length > 0;  // Has affected substeps

// Pattern 1: Same section, no affected substeps
Edit businessIndustry from businessIdentity section:
→ isSameSection = true
→ affectedSubsteps = ["confirmBusinessData", "adjustGoalsObjectives"]
→ shouldSetEditContext = true (has affected substeps)
→ Set edit context

// Pattern 2: Same section, inline edit
Edit noReplyConfiguration from fallbackLogic section:
→ isSameSection = true
→ affectedSubsteps = []
→ shouldSetEditContext = false
→ NO edit context (inline edit)

// Pattern 3: Cross-section edit
Edit businessIndustry from channels section:
→ isSameSection = false
→ affectedSubsteps = ["confirmBusinessData", "adjustGoalsObjectives"]
→ shouldSetEditContext = true (different section)
→ Set edit context

// Backend implementation:
if (shouldSetEditContext) {
  await stateService.setEditContext(
    conversationId,
    { section: currentSection, substep: currentSubstep },  // Return position
    editImpact.affectedSubsteps                            // Affected substeps
  )
}
```

### Edit Context State Transitions

```typescript
// Transition 1: Normal Flow → Edit Flow
State before edit:
{
  current_section: "channels",
  current_substep: "confirmChannelsConfiguration",
  is_in_edit_flow: false,
  edit_return_position: null
}

User edits: businessIndustry → "HEALTHCARE_CLINICS"

State after edit:
{
  current_section: "businessIdentity",        // Navigated to affected section
  current_substep: "confirmBusinessData",     // First affected substep
  is_in_edit_flow: true,                      // ✅ Edit flow active
  edit_return_position: {                     // ✅ Return position stored
    section: "channels",
    substep: "confirmChannelsConfiguration"
  },
  affected_substeps_in_edit: [
    "confirmBusinessData",
    "adjustGoalsObjectives"
  ]
}

// Transition 2: Edit Flow → Completing Affected Substep
User completes: confirmBusinessData (first affected substep)

Check: More affected substeps remaining?
→ adjustGoalsObjectives still pending
→ Navigate to adjustGoalsObjectives
→ Stay in edit flow

State after completion:
{
  current_section: "businessIdentity",
  current_substep: "adjustGoalsObjectives",   // Next affected substep
  is_in_edit_flow: true,                      // Still in edit flow
  edit_return_position: {                     // Still set
    section: "channels",
    substep: "confirmChannelsConfiguration"
  }
}

// Transition 3: Edit Flow → Return to Origin
User completes: adjustGoalsObjectives (last affected substep)

Backend detects:
- Section completion triggered (end of businessIdentity)
- is_in_edit_flow === true
- edit_return_position exists

Backend executes return:
await stateService.clearEditContext(conversationId)
await stateService.updateCurrentPosition(
  conversationId,
  "channels",
  "confirmChannelsConfiguration"
)

State after return:
{
  current_section: "channels",
  current_substep: "confirmChannelsConfiguration",
  is_in_edit_flow: false,                     // ✅ Cleared
  edit_return_position: null,                 // ✅ Cleared
  affected_substeps_in_edit: []               // ✅ Cleared
}

Response to user:
{
  currentSubstep: {
    id: "confirmChannelsConfiguration",
    botMessage: []  // Empty - already displayed
  },
  uiDirectives: {
    editComplete: true,
    returnedFromEdit: true,
    isInEditFlow: false
  }
}
```

### Edit Context Clearing Triggers

```typescript
// Edit context is cleared in these scenarios:

1. Successful Edit Return
Location: handleSectionComplete() OR handleConfirmBusinessData()
Condition: is_in_edit_flow && edit_return_position exists
Action: Navigate to return position, clear context

2. Exit to Manual Setup
Location: handleConfirmChannelsConfiguration() with false
Condition: User selects "Configure now (Manual Setup)"
Action: Clear context, exit conversation

3. Conversation Restart
Location: restartConversation()
Condition: Always
Action: Full state reset, clear all edit context

4. Conversation Completion
Location: handleFinalizeSetup() OR handleConfirmAutomations()
Condition: User completes final substep
Action: Mark complete, clear context

// Edit context is NOT cleared when:
- User completes non-affected substep during edit
- User navigates between affected substeps
- Validation error occurs
- User adds/deletes assistants during edit

// Implementation:
async clearEditContext(conversationId: number) {
  await this.prisma.copilotConversation.update({
    where: { id: conversationId },
    data: {
      sessionState: {
        ...currentState,
        is_in_edit_flow: false,
        edit_return_position: null,
        affected_substeps_in_edit: []
      }
    }
  })
}
```

## Edit Impact Chains

### Edit Impact Map

```typescript
// Defined in: copilot/config/edit-impact.config.ts

export const EDIT_IMPACT_MAP: Record<string, EditImpact> = {
  // Business Identity Section
  businessIndustry: {
    affectedSubsteps: ["confirmBusinessData", "adjustGoalsObjectives"],
    clearedFields: [
      "suggested_goals",
      "suggested_objectives",
      "ai_summary",
      "business_search_results",
    ],
    customHandler: "handleIndustryEdit",
    reason: "Industry change requires goal regeneration",
  },

  businessName: {
    affectedSubsteps: [
      "selectBusinessNameMatch",
      "confirmBusinessData",
      "adjustGoalsObjectives",
    ],
    clearedFields: [
      "business_search_results",
      "selected_business",
      "business_logo",
      "suggested_goals",
      "suggested_objectives",
      "ai_summary",
    ],
    customHandler: "handleBusinessNameEdit",
    reason: "Business name change triggers new search and goal regeneration",
  },

  selectBusinessNameMatch: {
    affectedSubsteps: ["confirmBusinessData", "adjustGoalsObjectives"],
    clearedFields: ["suggested_goals", "suggested_objectives", "ai_summary"],
    customHandler: "handleBusinessMatchEdit",
    reason: "Business match change requires goal regeneration",
  },

  adjustGoalsObjectives: {
    affectedSubsteps: ["adjustGoalsConfirm"],
    clearedFields: [],
    customHandler: "handleAdjustGoalsEdit",
    reason: "Goals adjustment affects confirmation step",
  },

  // Team Members Section
  teamSize: {
    affectedSubsteps: [], // May trigger upgrade flow instead
    clearedFields: [],
    customHandler: "handleTeamSizeEdit",
    reason: "Team size may require plan validation",
  },

  // Channels Section
  channels: {
    affectedSubsteps: [
      "confirmChannelsConfiguration",
      "aiAssistantsForChannels",
      "beezaroAssistants",
    ],
    clearedFields: [
      "draft_channel_configs",
      "created_assistants",
      "aiAssistantsForChannels",
      "business_search_results",
    ],
    customHandler: "handleChannelsEdit",
    reason: "Channel changes affect entire AI assistant setup",
  },

  confirmChannelsConfiguration: {
    affectedSubsteps: ["noReplyConfiguration", "beezaroAssistants"],
    clearedFields: ["draft_channel_configs", "created_assistants"],
    customHandler: "handleChannelConfigStrategyEdit",
    reason: "Config strategy change rebuilds entire setup",
  },

  // Fallback Logic Section
  noReplyConfiguration: {
    affectedSubsteps: [],
    clearedFields: [],
    customHandler: "handleNoReplyConfigEdit",
    reason: "Updates existing draft configs in-place",
  },

  // AI Assistant Section
  aiAssistantsForChannels: {
    affectedSubsteps: ["beezaroAssistants"],
    clearedFields: ["created_assistants", "draft_channel_configs"],
    customHandler: "handleAssistantStrategyEdit",
    reason: "Strategy change rebuilds all assistants and assignments",
  },

  // Plan Change (special)
  planConfirmation: {
    affectedSubsteps: [], // Dynamically determined
    clearedFields: [], // Dynamically determined based on revalidation
    customHandler: "handlePlanChange",
    reason: "Plan change triggers comprehensive revalidation",
  },
};

// Helper function to get edit impact:
export function getEditImpact(substepId: string): EditImpact | null {
  return EDIT_IMPACT_MAP[substepId] || null;
}

// Helper function to get section for substep:
export function getSectionForSubstep(
  substepId: string,
  flowConfig: FlowConfig
): string {
  for (const [sectionId, section] of Object.entries(flowConfig)) {
    if (section.subSteps[substepId]) {
      return sectionId;
    }
  }
  throw new Error(`Substep ${substepId} not found in flow config`);
}
```

### Impact Chain Execution

```typescript
// When edit is processed:

1. Retrieve Edit Impact
const editImpact = getEditImpact(editDto.substepId)

2. Clear Affected Substeps
if (editImpact?.affectedSubsteps?.length) {
  // Remove from completed_substeps
  await stateService.clearAffectedSubsteps(
    conversationId,
    editImpact.affectedSubsteps
  )

  // Implementation:
  // Filter out affected substeps from completed_substeps array
  const newCompleted = state.completed_substeps.filter(
    s => !affectedSubsteps.includes(s)
  )
}

3. Clear Affected Data
if (editImpact?.clearedFields?.length) {
  await stateService.clearAffectedCollectedData(
    conversationId,
    editImpact.clearedFields
  )

  // Implementation:
  // Set each field to null in collected_data
  for (const field of clearedFields) {
    collected_data[field] = null
  }
}

4. Execute Custom Handler (if exists)
if (editImpact?.customHandler) {
  return await this[editImpact.customHandler](
    conversationId,
    newValue,
    state,
    targetSubstep,
    oldValue
  )
}

5. Navigate to First Affected Substep
const firstAffected = editImpact.affectedSubsteps[0]
const affectedSection = getSectionForSubstep(firstAffected, flowConfig)

await stateService.updateCurrentPosition(
  conversationId,
  affectedSection,
  firstAffected
)

6. Set Edit Context (if cross-section)
if (shouldSetEditContext) {
  await stateService.setEditContext(
    conversationId,
    { section: currentSection, substep: currentSubstep },
    editImpact.affectedSubsteps
  )
}
```

### Cascading Impact Example

```typescript
// Example: Edit businessName from channels section

Initial State:
{
  current_section: "channels",
  current_substep: "channels",
  collected_data: {
    business_name: "Old Business",
    business_search_results: [...],
    selected_business: {...},
    suggested_goals: [...],
    channels: ["whatsapp"],
    ...
  },
  completed_substeps: [
    "planConfirmation",
    "businessIndustry",
    "businessName",
    "selectBusinessNameMatch",
    "confirmBusinessData",
    "channels"
  ]
}

User Edit:
POST /copilot/edit/businessName
{ newValue: "New Business Inc" }

Edit Impact Retrieval:
{
  affectedSubsteps: [
    "selectBusinessNameMatch",
    "confirmBusinessData",
    "adjustGoalsObjectives"
  ],
  clearedFields: [
    "business_search_results",
    "selected_business",
    "business_logo",
    "suggested_goals",
    "suggested_objectives",
    "ai_summary"
  ],
  customHandler: "handleBusinessNameEdit"
}

Execution Steps:

Step 1: Update business_name
collected_data.business_name = "New Business Inc"

Step 2: Clear affected fields
collected_data.business_search_results = null
collected_data.selected_business = null
collected_data.business_logo = null
collected_data.suggested_goals = null
collected_data.suggested_objectives = null
collected_data.ai_summary = null

Step 3: Clear affected substeps
completed_substeps = [
  "planConfirmation",
  "businessIndustry",
  "businessName",
  // selectBusinessNameMatch REMOVED
  // confirmBusinessData REMOVED
  "channels"  // Still completed
]

Step 4: Perform new business search
const matches = await businessLookupService.searchBusiness("New Business Inc")
collected_data.business_search_results = matches

Step 5: Set edit context (cross-section)
is_in_edit_flow = true
edit_return_position = { section: "channels", substep: "channels" }
affected_substeps_in_edit = [
  "selectBusinessNameMatch",
  "confirmBusinessData",
  "adjustGoalsObjectives"
]

Step 6: Navigate to first affected substep
current_section = "businessIdentity"
current_substep = "selectBusinessNameMatch"

Step 7: Record edit history
edit_history.push({
  timestamp: "2024-01-15T11:30:00Z",
  section: "businessIdentity",
  substep: "businessName",
  field: "business_name",
  old_value: "Old Business",
  new_value: "New Business Inc",
  affected_substeps: [
    "selectBusinessNameMatch",
    "confirmBusinessData",
    "adjustGoalsObjectives"
  ]
})

Final State:
{
  current_section: "businessIdentity",
  current_substep: "selectBusinessNameMatch",
  is_in_edit_flow: true,
  edit_return_position: {
    section: "channels",
    substep: "channels"
  },
  affected_substeps_in_edit: [
    "selectBusinessNameMatch",
    "confirmBusinessData",
    "adjustGoalsObjectives"
  ],
  collected_data: {
    business_name: "New Business Inc",
    business_search_results: [...],  // New search results
    selected_business: null,         // Cleared
    suggested_goals: null,           // Cleared
    channels: ["whatsapp"],          // Preserved
    ...
  },
  completed_substeps: [
    "planConfirmation",
    "businessIndustry",
    "businessName",
    "channels"
  ]
}

User Flow After Edit:
1. User sees selectBusinessNameMatch with new search results
2. User selects a match → advances to confirmBusinessData
3. Backend regenerates goals based on new business
4. User confirms → advances to adjustGoalsObjectives (if selected)
5. User completes adjustGoalsObjectives
6. Section completes → backend detects edit flow
7. Backend returns to channels substep
8. User resumes normal flow from channels
```

## Edit History Tracking

### Edit History Structure

```typescript
interface EditHistoryEntry {
  timestamp: string; // ISO 8601 timestamp
  section: string; // Section of edited substep
  substep: string; // Edited substep ID
  field: string; // formField that was changed
  old_value: any; // Previous value
  new_value: any; // New value
  affected_substeps: string[]; // Substeps cleared by this edit
}

// Stored in: conversation.sessionState.edit_history[]

// Example edit_history:
edit_history: [
  {
    timestamp: "2024-01-15T10:30:00Z",
    section: "businessIdentity",
    substep: "businessIndustry",
    field: "industry",
    old_value: "ECOMMERCE_RETAIL",
    new_value: "HEALTHCARE_CLINICS",
    affected_substeps: ["confirmBusinessData", "adjustGoalsObjectives"],
  },
  {
    timestamp: "2024-01-15T11:15:00Z",
    section: "channels",
    substep: "channels",
    field: "channels",
    old_value: ["whatsapp"],
    new_value: ["whatsapp", "gmail", "slack"],
    affected_substeps: [
      "confirmChannelsConfiguration",
      "aiAssistantsForChannels",
      "beezaroAssistants",
    ],
  },
];
```

### When Edit History Is Recorded

```typescript
// Edit history is ALWAYS recorded during edits

await stateService.addEditHistory(conversationId, {
  section: targetSection,
  substep: editDto.substepId,
  field: targetSubstep.formField,
  old_value: oldValue,
  new_value: editDto.newValue,
  affected_substeps: editImpact?.affectedSubsteps || []
})

// Implementation:
async addEditHistory(conversationId: number, entry: EditHistoryEntry) {
  const conversation = await this.getConversationById(conversationId)
  const state = parseSessionState(conversation.sessionState)

  state.edit_history = state.edit_history || []
  state.edit_history.push({
    ...entry,
    timestamp: new Date().toISOString()
  })

  await this.prisma.copilotConversation.update({
    where: { id: conversationId },
    data: { sessionState: state }
  })
}

// NOT recorded for:
- Normal flow progression (only edits)
- Assistant add/delete (separate tracking)
- File uploads during normal flow (only edit uploads)
```

### Edit History Use Cases

```typescript
// Use Case 1: Audit Trail
// Frontend can display edit history to user

function EditHistoryTimeline({ history }) {
  return (
    <div>
      <h3>Your Changes</h3>
      {history.map((entry) => (
        <div key={entry.timestamp}>
          <time>{formatTime(entry.timestamp)}</time>
          <p>
            Updated {entry.field} in {entry.substep}
            <br />
            From: {JSON.stringify(entry.old_value)}
            <br />
            To: {JSON.stringify(entry.new_value)}
          </p>
          {entry.affected_substeps.length > 0 && (
            <p>Affected: {entry.affected_substeps.join(", ")}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Use Case 2: Undo Functionality (Future Enhancement)
// Edit history provides data for potential undo feature

async function undoLastEdit(conversationId: number) {
  const state = await getState(conversationId);
  const lastEdit = state.edit_history[state.edit_history.length - 1];

  if (!lastEdit) return;

  // Restore old value
  await editSubstep(conversationId, {
    substepId: lastEdit.substep,
    newValue: lastEdit.old_value,
  });

  // Remove from history
  state.edit_history.pop();
}

// Use Case 3: Change Detection
// Detect if user has made any edits

function hasUserMadeEdits(state: CopilotSessionState): boolean {
  return state.edit_history?.length > 0;
}

function getEditCount(state: CopilotSessionState): number {
  return state.edit_history?.length || 0;
}

// Use Case 4: Section-Specific Edit Count
// Track edits per section for analytics

function getEditsBySection(
  history: EditHistoryEntry[]
): Record<string, number> {
  return history.reduce((acc, entry) => {
    acc[entry.section] = (acc[entry.section] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// Example:
// {
//   businessIdentity: 2,
//   channels: 1,
//   teamMembers: 1
// }
```

## Return Flow Navigation

### Return Flow Decision Tree

```typescript
// At section completion, backend checks:

if (state.is_in_edit_flow && state.edit_return_position) {
  // RETURN FLOW: Navigate back to origin

  const { section, substep } = state.edit_return_position

  await stateService.clearEditContext(conversationId)
  await stateService.updateCurrentPosition(conversationId, section, substep)

  return {
    currentSubstep: await getSubstep(section, substep),
    uiDirectives: {
      editComplete: true,
      returnedFromEdit: true,
      isInEditFlow: false,
      components: []
    }
  }

} else {
  // NORMAL FLOW: Advance to next section

  const nextSection = await flowService.getNextSection(currentSection)

  if (!nextSection) {
    await stateService.completeConversation(conversationId)
    return {
      currentSubstep: null,
      conversationComplete: true
    }
  }

  const entrySubstep = await flowService.getSubstep(
    nextSection,
    section.entry
  )

  await stateService.updateCurrentPosition(
    conversationId,
    nextSection,
    section.entry
  )

  return {
    currentSubstep: entrySubstep,
    sectionComplete: true,
    uiDirectives: {
      components: [...]
    }
  }
}
```

### Return Flow Scenarios

#### Scenario 1: Simple Return (All Affected Substeps in Same Section)

```typescript
// Setup:
Current position: channels/channels
User edits: businessIndustry
Affected substeps: confirmBusinessData, adjustGoalsObjectives
Both affected substeps in: businessIdentity section

// Execution:
1. User completes confirmBusinessData
   → Advances to adjustGoalsObjectives (still in businessIdentity)

2. User completes adjustGoalsObjectives
   → Section completes (end of businessIdentity)
   → Backend detects edit flow
   → Returns to channels/channels

3. Response:
{
  currentSubstep: { id: "channels", botMessage: [] },
  uiDirectives: {
    editComplete: true,
    returnedFromEdit: true,
    isInEditFlow: false
  }
}

// User sees: Original channels screen, no new bot message
```

#### Scenario 2: Multi-Section Return (Affected Substeps Span Sections)

```typescript
// Setup:
Current position: automation/addAutomations
User edits: channels (removes WhatsApp, adds Slack)
Affected substeps:
  - confirmChannelsConfiguration (channels section)
  - aiAssistantsForChannels (aiAssistant section)
  - beezaroAssistants (aiAssistant section)

// Execution:
1. User completes confirmChannelsConfiguration
   → Section completes (end of channels)
   → Still in edit flow (more affected substeps)
   → Advances to aiAssistant/aiAssistantsForChannels

2. User completes aiAssistantsForChannels
   → Advances to beezaroAssistants (still in aiAssistant)

3. User completes beezaroAssistants
   → Section completes (end of aiAssistant)
   → Backend detects edit flow complete
   → Returns to automation/addAutomations

4. Response:
{
  currentSubstep: { id: "addAutomations", botMessage: [] },
  uiDirectives: {
    editComplete: true,
    returnedFromEdit: true,
    isInEditFlow: false
  }
}

// Note: User navigated through 2 sections during edit,
// then returned to original position in 3rd section
```

#### Scenario 3: Return with Dynamic Rehydration

```typescript
// Setup:
Current position: aiAssistant/beezaroAssistants
User edits: channels (adds new channel)
Return position: aiAssistant/beezaroAssistants

// Special case: beezaroAssistants needs updated assistant data

// Execution:
1. User completes channel edit flow
   → New assistants created for new channels
   → Returns to beezaroAssistants

2. Backend rehydrates return substep:
const returnSubstep = await getSubstep("aiAssistant", "beezaroAssistants")

// Fetch fresh assistant data
const assistants = await prisma.aiAssistant.findMany({
  where: { userId, onboardingDraft: true }
})

// Build fresh bot message with updated assistant cards
const botMessage = [
  {
    type: "component",
    component: "CopilotContext",
    metadata: { event: "edit_complete" }
  },
  ...assistants.map(a => ({
    type: "component",
    component: "AssistantCard",
    metadata: { id: a.id, name: a.name, onboardingDraft: true }
  }))
]

3. Response:
{
  currentSubstep: {
    id: "beezaroAssistants",
    botMessage: botMessage  // ✅ Fresh assistant data
  },
  uiDirectives: {
    editComplete: true,
    returnedFromEdit: true,
    components: [...]  // Updated components
  }
}
```

#### Scenario 4: Return After Upgrade Flow

```typescript
// Setup:
Current position: channels/channels
User edits: teamSize → "21" (requires upgrade)
Edit triggers: teamSizeOverLimit → teamUpgradeOptions → teamUpgradeConfirm

// Execution:
1. User at teamUpgradeConfirm
   → Validates team size now fits new plan
   → Marks teamSize as complete
   → Checks edit context: is_in_edit_flow = true

2. Backend detects:
   → In edit flow
   → No more affected substeps (upgrade flow complete)
   → Return position: channels/channels

3. Backend returns:
await stateService.clearEditContext(conversationId)
await stateService.updateCurrentPosition(
  conversationId,
  "channels",
  "channels"
)

4. Response:
{
  currentSubstep: {
    id: "channels",
    botMessage: [
      {
        type: "text",
        message: "Team size updated to 21 or more. Plan upgraded successfully."
      }
      // Original bot message omitted (already displayed)
    ]
  },
  uiDirectives: {
    editComplete: true,
    returnedFromEdit: true,
    isInEditFlow: false
  }
}

// Note: Confirmation message prepended to return substep
```

### Return Position Edge Cases

```typescript
// Edge Case 1: Return position no longer exists
// Scenario: Flow config changed between edit start and return

if (state.edit_return_position) {
  try {
    const returnSubstep = await getSubstep(
      state.edit_return_position.section,
      state.edit_return_position.substep
    );
  } catch (error) {
    // Return position invalid - log and clear
    logger.error("Invalid return position", state.edit_return_position);
    await stateService.clearEditContext(conversationId);

    // Fall back to normal flow
    return await handleSectionComplete(conversationId, state);
  }
}

// Edge Case 2: Return position in skipped substep
// Scenario: User skipped substep, then edited earlier step

// This shouldn't happen (can't skip during active conversation)
// But if it does, return position is still valid
// User returns to skipped substep (which shows previous data)

// Edge Case 3: Multiple nested edits (prevented)
// Scenario: User tries to edit while already in edit flow

if (state.is_in_edit_flow) {
  throw new BadRequestException({
    message: "Cannot edit while in edit flow",
    currentEditContext: {
      editedSubstep: state.affected_substeps_in_edit[0],
      returnPosition: state.edit_return_position,
    },
    hint: "Complete current edit flow before starting a new edit",
  });
}

// Edge Case 4: Return after conversation restart
// Scenario: User restarts conversation during edit flow

// Restart clears ALL state including edit context
// No return flow - user starts fresh from beginning
```

## Cleanup and Data Clearing Patterns

### Field Clearing Strategies

```typescript
// Strategy 1: Explicit Field Clearing (Most Common)
// Used when edit impact specifies exact fields to clear

const editImpact = {
  clearedFields: ["suggested_goals", "suggested_objectives", "ai_summary"],
};

await stateService.clearAffectedCollectedData(
  conversationId,
  editImpact.clearedFields
);

// Implementation:
for (const field of clearedFields) {
  state.collected_data[field] = null;
}

// Strategy 2: Transient Field Clearing (Section Boundary)
// Used at section completion to remove temporary data

// Example: End of businessIdentity section
await stateService.updateCollectedData(
  conversationId,
  "business_search_results",
  null
);

// Strategy 3: Draft Record Cleanup (Database + State)
// Used when channels or assistants change

await cleanupOnboardingDraftAssistantsAndConfigs(userId);

// Implementation:
// 1. Find all draft channel configs
const draftConfigs = await prisma.channelAiConfig.findMany({
  where: {
    connectedChannelId: { in: userChannelIds },
    onboardingDraft: true,
  },
});

// 2. Delete related records
await prisma.escalationKeyword.deleteMany({
  where: { channelAiConfigId: { in: draftConfigIds } },
});
await prisma.channelWorkingDay.deleteMany({
  where: { channelAiConfigId: { in: draftConfigIds } },
});
await prisma.channelAiAccess.deleteMany({
  where: { channelAiConfigId: { in: draftConfigIds } },
});

// 3. Delete configs
await prisma.channelAiConfig.deleteMany({
  where: { id: { in: draftConfigIds } },
});

// 4. Delete draft assistants
await prisma.aiAssistant.deleteMany({
  where: { userId, onboardingDraft: true },
});

// 5. Clear state fields
await stateService.clearAffectedCollectedData(conversationId, [
  "draft_channel_configs",
  "created_assistants",
]);
```

### Substep Clearing Implementation

```typescript
// Clearing affected substeps from completed_substeps

async clearAffectedSubsteps(
  conversationId: number,
  affectedSubsteps: string[]
) {
  const conversation = await this.getConversationById(conversationId)
  const state = parseSessionState(conversation.sessionState)

  // Filter out affected substeps
  state.completed_substeps = state.completed_substeps.filter(
    substepId => !affectedSubsteps.includes(substepId)
  )

  await this.prisma.copilotConversation.update({
    where: { id: conversationId },
    data: { sessionState: state }
  })
}

// Example:
Before edit:
completed_substeps: [
  "planConfirmation",
  "businessIndustry",
  "businessName",
  "selectBusinessNameMatch",
  "confirmBusinessData",
  "adjustGoalsObjectives",
  "teamSize",
  "channels"
]

After editing businessIndustry:
affectedSubsteps: ["confirmBusinessData", "adjustGoalsObjectives"]

Result:
completed_substeps: [
  "planConfirmation",
  "businessIndustry",
  "businessName",
  "selectBusinessNameMatch",
  // confirmBusinessData removed
  // adjustGoalsObjectives removed
  "teamSize",
  "channels"
]

// Note: User must re-complete removed substeps
```

### Channel Deletion During Edit

```typescript
// Special case: User removes channels during edit

// Before:
channels: ["whatsapp", "gmail", "slack"]
connected_channels: [
  { id: 1, name: "whatsapp" },
  { id: 2, name: "gmail" },
  { id: 3, name: "slack" }
]
draft_channel_configs: [
  { connectedChannelId: 1, aiAssistantId: 10 },
  { connectedChannelId: 2, aiAssistantId: 10 },
  { connectedChannelId: 3, aiAssistantId: 11 }
]

// User edits channels to: ["whatsapp", "gmail"]

// Cleanup process:
1. Identify removed channels:
const removed = ["slack"]  // Difference between old and new

2. Find connected channel records:
const channelToDelete = connectedChannels.find(
  ch => ch.availableChannel.name === "slack"
)

3. Delete channel configs:
await prisma.channelAiConfig.deleteMany({
  where: { connectedChannelId: channelToDelete.id }
})

4. Delete connected channel:
await prisma.connectedChannel.delete({
  where: { id: channelToDelete.id }
})

5. Update state:
collected_data.channels = ["WhatsApp", "Gmail"]
collected_data.selected_channel_values = ["whatsapp", "gmail"]

6. Cleanup and rebuild:
// Delete ALL draft assistants and configs
await cleanupOnboardingDraftAssistantsAndConfigs(userId)

// Rebuild with new channel count
// (Happens in affected substep flow)
```

### Assistant Deletion During Edit

```typescript
// Special case: User deletes assistant during beezaroAssistants

// Before:
created_assistants: [
  { id: 10, name: "Beezaro Alpha" },
  { id: 11, name: "Beezaro Swift" },
  { id: 12, name: "Beezaro Zen" }
]
draft_channel_configs: [
  { connectedChannelId: 1, aiAssistantId: 10 },
  { connectedChannelId: 2, aiAssistantId: 11 },
  { connectedChannelId: 3, aiAssistantId: 12 }
]

// User deletes: Beezaro Swift (id: 11)

DELETE /copilot/assistants/11

// Cleanup process:
1. Validate: At least one assistant remains
if (remainingAssistants.length === 0) {
  throw new BadRequestException(
    "Cannot delete the last remaining assistant"
  )
}

2. Delete assistant:
await prisma.aiAssistant.delete({ where: { id: 11 } })

3. Recompute assignments:
const assignments = computeDraftAssignments(
  [1, 2, 3],  // Channel IDs
  [10, 12]    // Remaining assistant IDs
)

// Result:
// [
//   { connectedChannelId: 1, aiAssistantId: 10 },
//   { connectedChannelId: 2, aiAssistantId: 12 },
//   { connectedChannelId: 3, aiAssistantId: 12 }  // 12 takes both
// ]

4. Update channel configs:
await prisma.channelAiConfig.updateMany({
  where: { connectedChannelId: 1 },
  data: { aiAssistantId: 10 }
})
await prisma.channelAiConfig.updateMany({
  where: { connectedChannelId: 2 },
  data: { aiAssistantId: 12 }
})
await prisma.channelAiConfig.updateMany({
  where: { connectedChannelId: 3 },
  data: { aiAssistantId: 12 }
})

5. Update state:
collected_data.created_assistants = [
  { id: 10, name: "Beezaro Alpha" },
  { id: 12, name: "Beezaro Zen" }
]
collected_data.draft_channel_configs = [
  { connectedChannelId: 1, aiAssistantId: 10, ... },
  { connectedChannelId: 2, aiAssistantId: 12, ... },
  { connectedChannelId: 3, aiAssistantId: 12, ... }
]

6. Response:
{
  currentSubstep: {
    id: "beezaroAssistants",
    botMessage: [
      {
        type: "text",
        message: "Assistant removed. Channels were reassigned automatically."
      },
      // Updated assistant cards
    ]
  }
}
```

### Draft Finalization Pattern

```typescript
// When user completes beezaroAssistants:

1. Finalize assistants:
await prisma.aiAssistant.updateMany({
  where: { userId, onboardingDraft: true },
  data: { onboardingDraft: false }
})

2. Finalize channel configs:
await prisma.channelAiConfig.updateMany({
  where: {
    connectedChannelId: { in: userChannelIds },
    onboardingDraft: true
  },
  data: { onboardingDraft: false }
})

3. State remains unchanged:
// collected_data.created_assistants stays
// collected_data.draft_channel_configs stays
// These are used for reference but no longer "draft"

4. Future edits:
// If user edits channels again:
// - Finalized configs are NOT deleted
// - New draft configs are created alongside
// - User can switch between draft and finalized setups
```

---

**Phase 2, Section B Complete**

This section covered:

- ✅ Edit context lifecycle and state transitions
- ✅ Edit impact chains with complete execution flow
- ✅ Edit history tracking and use cases
- ✅ Return flow navigation with 4 scenarios + edge cases
- ✅ Cleanup patterns for fields, substeps, channels, and assistants

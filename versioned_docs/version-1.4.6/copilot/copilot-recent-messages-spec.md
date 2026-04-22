# Copilot — `recentMessages` Structure Spec

**Source:** `GET /copilot/state` → `recentMessages[]` (full history, ordered oldest → newest)

**Optional filter:** `GET /copilot/state?step=<sectionId>` — returns only messages where `metadata.section === sectionId`. Valid section IDs: `businessIdentity`, `teamMembers`, `channels`, `fallbackLogic`, `aiAssistant`, `automation`.

All messages share this base envelope:

```json
{
  "messageType": "USER_INPUT | USER_SELECTION | USER_EDIT | SYSTEM | SECTION_COMPLETE | AI_RESPONSE",
  "content": "string or parsed array (see per-type detail below)",
  "metadata": { ... },
  "createdAt": "2024-01-15T10:22:00.000Z"
}
```

---

## 1. `USER_INPUT` — user typed free text

Produced when the user submits a text-input substep (business name, custom industry category).

```json
{
  "messageType": "USER_INPUT",
  "content": "Acme Corp",
  "metadata": {
    "section": "businessIdentity",
    "substep": "businessName",
    "action": "business_name_input",
    "substepConfig": {
      "id": "businessName",
      "type": "input",
      "formField": "business_name",
      "options": []
    }
  },
  "createdAt": "2024-01-15T10:22:00.000Z"
}
```

**`content`** — the raw sanitised string the user typed.

**`metadata.action`** values:
| action | substep |
|---|---|
| `business_name_input` | `businessName` |
| `industry_input` | `categoryNotListed` |

**Render as:** a chat bubble containing `content` attributed to the user.

---

## 2. `USER_SELECTION` — user picked from options

Produced when the user selects from a `choice` or `multi` substep.

### Simple choice (single selection)

```json
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
      "formField": "industry",
      "options": [
        {
          "label": "E-Commerce & Retail",
          "value": "ECOMMERCE_RETAIL",
          "type": "radio",
          "selected": false
        },
        {
          "label": "Healthcare & Clinics",
          "value": "HEALTHCARE_CLINICS",
          "type": "radio",
          "selected": true
        },
        {
          "label": "Category not listed",
          "value": "none",
          "type": "radio",
          "selected": false
        }
      ]
    }
  },
  "createdAt": "2024-01-15T10:23:00.000Z"
}
```

### Boolean choice (yes/no)

```json
{
  "messageType": "USER_SELECTION",
  "content": "Yes, Proceed with my current plan",
  "metadata": {
    "section": "businessIdentity",
    "substep": "planConfirmation",
    "action": "select",
    "formField": "",
    "selectedValue": true,
    "substepConfig": {
      "id": "planConfirmation",
      "type": "choice",
      "options": [
        {
          "label": "Yes, Proceed with my current plan",
          "value": true,
          "type": "radio",
          "selected": true
        },
        {
          "label": "No, Change plan",
          "value": false,
          "type": "radio",
          "selected": false
        }
      ]
    }
  },
  "createdAt": "2024-01-15T10:20:00.000Z"
}
```

### Multi-select with sub-options (e.g. `addAutomations`)

```json
{
  "messageType": "USER_SELECTION",
  "content": "Tag new leads, Auto-respond after hours",
  "metadata": {
    "section": "automation",
    "substep": "addAutomations",
    "action": "select",
    "selectedValue": "yes",
    "subSelectValues": ["Tag new leads", "Auto-respond after hours"],
    "substepConfig": {
      "id": "addAutomations",
      "type": "choice",
      "options": [
        {
          "label": "Yes, add automation",
          "value": "yes",
          "type": "radio",
          "selected": true,
          "options": [
            {
              "label": "Tag new leads",
              "value": "Tag new leads",
              "selected": true
            },
            {
              "label": "Auto-respond after hours",
              "value": "Auto-respond after hours",
              "selected": true
            },
            {
              "label": "Follow-up after 24h",
              "value": "Follow-up after 24h",
              "selected": false
            }
          ]
        },
        {
          "label": "No, skip",
          "value": "no",
          "type": "radio",
          "selected": false
        }
      ]
    }
  },
  "createdAt": "2024-01-15T10:35:00.000Z"
}
```

### Business match selection

```json
{
  "messageType": "USER_SELECTION",
  "content": "{\"name\":\"Acme Corp\",\"logo_url\":\"https://...\",\"address\":\"...\",\"phone\":\"...\",\"website\":\"https://...\"}",
  "metadata": {
    "section": "businessIdentity",
    "substep": "selectBusinessNameMatch",
    "action": "business_selected",
    "formField": "selected_business",
    "selectedValue": {
      "name": "Acme Corp",
      "logo_url": "https://...",
      "address": "123 Main St",
      "phone": "+1 555 0100",
      "website": "https://acmecorp.com"
    },
    "substepConfig": {
      "id": "selectBusinessNameMatch",
      "type": "choice",
      "options": [
        { "label": "Acme Corp",                "value": { "name": "Acme Corp", ... },  "type": "radio", "selected": true  },
        { "label": "Acme Corporation Ltd",     "value": { "name": "Acme Cor...", ... }, "type": "radio", "selected": false },
        { "label": "My business isn't listed", "value": "",                            "type": "radio", "selected": false }
      ]
    }
  },
  "createdAt": "2024-01-15T10:24:00.000Z"
}
```

**Key fields:**

| Field                                                   | Purpose                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `metadata.selectedValue`                                | The exact value selected (kept for backward compatibility)           |
| `metadata.subSelectValues`                              | Present only on multi-select substeps — the sub-option values chosen |
| `metadata.substepConfig.options[i].selected`            | `true` for the chosen option(s), `false` for the rest                |
| `metadata.substepConfig.options[i].options[j].selected` | Present when sub-options exist                                       |

**Render as:** disabled options list with `selected: true` option visually checked. Read `option.selected` directly — do not re-derive from `selectedValue`. Guard: `option.selected ?? false` for messages recorded before the Phase 1 fix.

---

## 3. `USER_EDIT` — user changed a previous answer

Produced when the user goes back through the edit flow and submits a different value.

```json
{
  "messageType": "USER_EDIT",
  "content": "ECOMMERCE_RETAIL",
  "metadata": {
    "section": "businessIdentity",
    "substep": "businessIndustry",
    "action": "edit",
    "formField": "industry",
    "previousValue": "HEALTHCARE_CLINICS",
    "triggeredReconfigurations": ["noReplyConfiguration"],
    "substepConfig": {
      "id": "businessIndustry",
      "type": "choice",
      "formField": "industry",
      "options": [
        {
          "label": "E-Commerce & Retail",
          "value": "ECOMMERCE_RETAIL",
          "type": "radio"
        },
        {
          "label": "Healthcare & Clinics",
          "value": "HEALTHCARE_CLINICS",
          "type": "radio"
        },
        { "label": "Category not listed", "value": "none", "type": "radio" }
      ]
    }
  },
  "createdAt": "2024-01-15T11:05:00.000Z"
}
```

**Note:** `substepConfig.options` on `USER_EDIT` messages do **not** have `selected` flags — the edit message captures the available options but does not annotate which was selected (use `content` for the new value and `previousValue` for what it was before). The `selected` flag is only on `USER_SELECTION` messages.

**`metadata.triggeredReconfigurations`** — substep IDs that were cleared/reset because of this edit. Useful for showing an "affected steps were reset" notice.

**Render as:** a chat bubble showing the new value, with a "changed from X" sub-label using `previousValue`. Guard: `metadata.substepConfig ?? null` for messages recorded before the Phase 1 fix.

---

## 4. `SYSTEM` — bot message

Produced by the backend each time the bot sends a prompt or information to the user.

`content` is either a plain string or a **parsed JSON array** of message parts. The API returns it already parsed (not as a string) when it is an array.

### Plain text bot message

```json
{
  "messageType": "SYSTEM",
  "content": "Perfect! I'll set you up as Healthcare & Clinics.",
  "metadata": {
    "section": "businessIdentity",
    "substep": "businessName",           // substep this bot message introduced
    "action": "substep_advance",
    "originSubstep": "businessIndustry", // substep the user was at when this message was triggered
    "substepConfig": { "id": "businessName", "type": "input", ... }
  },
  "createdAt": "2024-01-15T10:22:30.000Z"
}
```

**`metadata.originSubstep`** — the substep the user just completed that caused this bot message to be sent. This allows the `?step` filter to correctly associate transition messages with the substep that triggered them. `null` for the conversation initialization message.

### Mixed text + component bot message

`content` is a parsed array of parts. Render each part in order.

```json
{
  "messageType": "SYSTEM",
  "content": [
    { "type": "text",      "message": "Hi Adaeze, I'm Beezaro 👋\n\nPlease confirm your selected plan:", "component": null },
    { "type": "component", "message": null, "component": "planSummary" }
  ],
  "metadata": {
    "section": "businessIdentity",
    "substep": "planConfirmation",
    "action": "conversation_started",
    "originSubstep": null,               // null for the initialization message (no prior substep)
    "substepConfig": { ... }
  },
  "createdAt": "2024-01-15T10:20:00.000Z"
}
```

### Component types used in bot messages

| `component` value | What to render                        | Data source                                            |
| ----------------- | ------------------------------------- | ------------------------------------------------------ |
| `planSummary`     | The user's current plan card          | Live: `GET /account` or current plan from session      |
| `plansPreview`    | All available plans for selection     | Live: `GET /plans`                                     |
| `businessLogo`    | Business logo + name                  | Snapshot: `metadata.componentSnapshots.businessLogo`   |
| `logoUpload`      | Logo upload widget                    | No snapshot — always live                              |
| `AssistantCard`   | AI assistant card (name, tone, style) | Snapshot: `metadata.componentSnapshots.assistants[i]`  |
| `AddAssistant`    | "Add another assistant" button        | No data — UI control only                              |
| `CopilotContext`  | Internal event marker (not rendered)  | `metadata` on the part: `{ event: "assistant_added" }` |

### Bot message with `componentSnapshots`

When a `SYSTEM` message contains `AssistantCard` or `businessLogo` components, `metadata.componentSnapshots` holds the data that was live at the time the message was created. Use this for replay — do not fetch live data for these components when replaying history.

```json
{
  "messageType": "SYSTEM",
  "content": [
    { "type": "text",      "message": "We created 1 assistant and assigned them to your channels.", "component": null },
    { "type": "component", "message": null, "component": "AssistantCard" },
    { "type": "component", "message": null, "component": "AddAssistant" }
  ],
  "metadata": {
    "section": "aiAssistant",
    "substep": "beezaroAssistants",
    "action": "draft_assistants_created",
    "substepConfig": { ... },
    "componentSnapshots": {
      "assistants": [
        { "id": 201, "name": "Beezaro Alpha", "tone": "PROFESSIONAL", "style": "CONCISE" }
      ]
    }
  },
  "createdAt": "2024-01-15T10:34:00.000Z"
}
```

```json
{
  "messageType": "SYSTEM",
  "content": [
    { "type": "component", "message": null, "component": "businessLogo" },
    { "type": "text", "message": "Nice, here's what I found for your business:\n\n**Acme Corp**\n🌐 https://acmecorp.com\n📞 +1 555 0100", "component": null }
  ],
  "metadata": {
    "section": "businessIdentity",
    "substep": "confirmBusinessData",
    "action": "substep_advance",
    "substepConfig": { ... },
    "componentSnapshots": {
      "businessLogo": {
        "logoUrl": "https://cdn.example.com/logos/acme.png",
        "businessName": "Acme Corp"
      }
    }
  },
  "createdAt": "2024-01-15T10:25:00.000Z"
}
```

**Rendering rule for components in replay:**

- `businessLogo`, `AssistantCard` — read from `metadata.componentSnapshots` (data frozen at message time)
- `planSummary`, `plansPreview` — fetch live (plan may have changed; showing current is correct)
- `logoUpload` — not shown in replay history (it's a widget, not a display)
- `AddAssistant` — render as a disabled "added" state or omit in replay
- `CopilotContext` — do not render; it is an internal event marker

**Guard:** `metadata.componentSnapshots ?? null` for messages recorded before the Phase 1 fix.

---

## 5. `SECTION_COMPLETE` — section finished

Produced once when all substeps in a section are marked complete.

```json
{
  "messageType": "SECTION_COMPLETE",
  "content": "Section businessIdentity completed",
  "metadata": {
    "section": "businessIdentity",
    "substep": "",
    "action": "section_complete"
  },
  "createdAt": "2024-01-15T10:26:00.000Z"
}
```

**Render as:** a section divider / progress milestone in the chat history. `metadata.section` gives you the section ID to display a label.

---

## 6. `AI_RESPONSE` — AI-generated content

Produced when the backend makes an LLM call and returns the result inline (industry suggestion from custom input, goals generation).

```json
{
  "messageType": "AI_RESPONSE",
  "content": "Based on your description, I've categorised your business as Healthcare & Clinics.",
  "metadata": {
    "section": "businessIdentity",
    "substep": "categoryNotListed",
    "action": "industry_suggestion"
  },
  "createdAt": "2024-01-15T10:23:30.000Z"
}
```

**`metadata.action`** values:
| action | when |
|---|---|
| `industry_suggestion` | After user types a custom industry, LLM maps it to an enum |
| `goals_generated` | After `businessNotListed` flow, LLM generates goals |
| `step_awareness` | General conversational AI response (rare) |

**Render as:** a bot chat bubble. Visually identical to a `SYSTEM` text message — both are "bot" bubbles from the user's perspective.

---

## Full rendering decision tree

```
messageType
├── USER_INPUT       → user bubble, content is the typed string
├── USER_SELECTION   → user bubble, render disabled options list using substepConfig.options[i].selected
├── USER_EDIT        → user bubble with "changed from {previousValue}" label
├── AI_RESPONSE      → bot bubble, content is plain text
├── SECTION_COMPLETE → section divider / milestone marker
└── SYSTEM
    ├── content is string  → bot bubble, plain text
    └── content is array   → render each part in order:
        ├── { type: "text" }       → bot bubble text segment
        └── { type: "component" } → render component by name:
            ├── planSummary        → live plan card
            ├── plansPreview       → live plans list
            ├── businessLogo       → snapshot: componentSnapshots.businessLogo
            ├── AssistantCard      → snapshot: componentSnapshots.assistants[i]
            ├── AddAssistant       → disabled / omit in replay
            └── CopilotContext     → do not render
```

---

## Guard patterns for backward compatibility

Messages recorded before the Phase 1 fix (deployed April 2026) may be missing fields:

| Field                                   | Guard                                                              |
| --------------------------------------- | ------------------------------------------------------------------ |
| `option.selected` on USER_SELECTION     | `option.selected ?? false`                                         |
| `metadata.substepConfig` on USER_EDIT   | `metadata.substepConfig ?? null`                                   |
| `metadata.componentSnapshots` on SYSTEM | `metadata.componentSnapshots ?? null`                              |
| USER_INPUT messages for businessName    | May not exist in old sessions — the history simply won't have them |

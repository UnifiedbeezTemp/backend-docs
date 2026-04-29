---
sidebar_position: 7
---

# Design Handoff — March 6, 2026

Continuation of section 4 from the [February 27 handoff](design-handoff-feb27.md).

This document covers the new UI surfaces required for manual contact management, the Beehive Dashboard expansion, and RC automation list scoping. All sections below either extend or supersede the specs in 4a–4d of the February 27 doc.

---

## 1. Campaign List Members View — Updated (extends 4d)

The members view described in 4d is now interactive. The following changes are required.

### 1a. New columns in the members table

Add the following columns to the right of the existing ones:

| Column             | Notes                                    |
| ------------------ | ---------------------------------------- |
| Source             | Badge — see values below                 |
| WhatsApp           | WhatsApp ID — show as "—" if not set     |
| Facebook Messenger | FB Messenger ID — show as "—" if not set |
| LinkedIn           | LinkedIn ID — show as "—" if not set     |
| Telegram           | Telegram ID — show as "—" if not set     |

**Source badge values:**

| Value      | Colour | Meaning                                                                                    |
| ---------- | ------ | ------------------------------------------------------------------------------------------ |
| Automation | Green  | Enrolled automatically when a Sales & Lead Generation automation captured this contact     |
| Manual     | Blue   | Added directly by the user                                                                 |
| Import     | Grey   | Added via bulk upload _(future — include the badge style now even if not yet triggerable)_ |

### 1b. New actions

- **"Add Contact" button** — top-right of the members table. Opens the Add Contact modal (see section 2).
- **"Remove" action** — per row. Removes the contact from this list only. Does not delete the contact record from the account. Show a confirmation prompt before removing.

---

## 2. Add Contact Modal (new)

Opened when the user clicks "Add Contact" from the members view. The list context is already known — no list picker is needed inside this modal.

The modal has two tabs:

### Tab A — New Contact

Create a brand-new contact and add them to the current list.

| Field                 | Required | Input type   | Notes                                                 |
| --------------------- | -------- | ------------ | ----------------------------------------------------- |
| First name            | Yes      | Text         | —                                                     |
| Last name             | No       | Text         | —                                                     |
| Email                 | Yes      | Email        | —                                                     |
| Phone                 | No       | Text         | Placeholder: "+44 7911 123456 (include country code)" |
| WhatsApp ID           | No       | Text         | —                                                     |
| Facebook Messenger ID | No       | Text         | —                                                     |
| LinkedIn ID           | No       | Text         | LinkedIn member ID or profile URL                     |
| Telegram ID           | No       | Text         | Telegram username or numeric user ID                  |
| Tags                  | No       | Multi-select | Drawn from the user's existing tag list               |
| Notes                 | No       | Textarea     | Free-text field for context                           |

Source is set to "Manual" automatically — no UI control for this field.

On save: contact is created and added to the current list. Success state should show the contact appearing in the members table.

### Tab B — Add Existing Contact

Search for a contact already in the user's account and add them to the current list without re-entering their details.

- Search bar at the top — searches by name or email address
- Results list: each result shows name + email
- Per result: an "Add to list" button
  - If the contact is already on this list, show a disabled "Already added" label instead of the button
- On "Add to list": contact is enrolled in the list with source "Manual"

---

## 3. Contact Creation Form — Standalone (new, bidirectional flow)

This is a separate screen from the modal above. It is the form used when a user creates a new contact from the contacts section of the app — not from within a Campaign List.

**Fields:** same as Tab A in section 2.

**Additional field at the bottom of the form:**

| Field                 | Required | Input type   | Notes                                                                                              |
| --------------------- | -------- | ------------ | -------------------------------------------------------------------------------------------------- |
| Add to Campaign Lists | No       | Multi-select | Shows all the user's campaign lists (name + member count). The user can select zero or more lists. |

Behaviour:

- If one or more lists are selected, the contact is added to those lists on save with source "Manual".
- The picker should include a "Create new list" option that lets the user create a list inline (name field only, no description required at this step) without leaving the form.

---

## 4. Beehive Dashboard — Campaign Lists Overview (updates 4a)

The campaign list card or table row described in 4a should be updated to show the following:

| Field         | Notes                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Name          | —                                                                                                |
| Description   | Show if set                                                                                      |
| URL           | Show if set                                                                                      |
| Members       | Total contacts enrolled. Break this down into two sub-values:                                    |
| — Automated   | Count of members enrolled via automation                                                         |
| — Manual      | Count of members added manually                                                                  |
| Configured in | Names of automations that use this list as their contact pool (read-only, linked — zero or more) |
| Created date  | —                                                                                                |

### Delete safeguard

A Campaign List cannot be deleted while any automation is using it.

**Behaviour:**

- If the user attempts to delete a list that one or more automations reference, block the action and show an inline error that names the specific automations that must be updated or deactivated first.
- Once no automation references the list, the delete action completes normally.

This applies to both the list overview and any delete affordance inside the list detail view.

---

## 5. RC Automation — Campaign List Selector (new)

Applies to: **Reengagement & Campaigns automations only.** Not required for Sales & Lead Generation, Support & Escalation, or Retention & Nurture.

### What to add

A "Contact Pool" field within the RC automation setup. This field scopes the automation — the trigger and all steps will only apply to contacts on the selected list.

**Field spec:**

| Property         | Value                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Label            | Contact Pool                                                                                                                    |
| Description hint | "This automation will only run for contacts on the selected list."                                                              |
| Input type       | Single-select dropdown                                                                                                          |
| Options          | All of the user's Campaign Lists, each showing: name + member count                                                             |
| Inline create    | A "Create new list" option inside the dropdown — opens a small inline form (name only) without leaving the automation setup     |
| Required         | Yes — the automation cannot be activated without a list selected. Show a validation message on the activation attempt if empty. |

### Placement

This field appears in two flows:

**Template flow (user applies an RC template):**
Show the "Contact Pool" field on the template application screen, alongside the automation Name and Description fields.

```
Apply Template
──────────────
Automation name   [___________________]
Description       [___________________]  (optional)
Contact Pool      [Select a list ▾   ]   ← new field
```

**Scratch flow (user creates a blank RC automation):**
The placement here is a decision point for the design team — two options:

- Show "Contact Pool" as a field on the trigger configuration panel (alongside trigger type and threshold settings)
- Show "Contact Pool" as a dedicated first step before the user selects a trigger

Either approach is acceptable technically. Recommend option 1 (inline with trigger config) to avoid adding an extra step, but defer to design judgement.

---

## Summary of screens needed

| Screen                                                                    | Status              |
| ------------------------------------------------------------------------- | ------------------- |
| Campaign List members table — updated columns + actions                   | Update existing     |
| Add Contact modal (New Contact tab + Add Existing Contact tab)            | New                 |
| Standalone Contact Creation Form with list picker                         | New                 |
| Beehive Dashboard list overview — updated member count + delete safeguard | Update existing     |
| RC Automation — Contact Pool field (template flow)                        | New                 |
| RC Automation — Contact Pool field (scratch flow)                         | New (placement TBD) |

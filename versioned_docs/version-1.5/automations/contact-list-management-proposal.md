---
sidebar_position: 6
---

# Campaign Lists & Contact Management — Feature Proposal

## Background: How the Four Automations Work Today

The platform has four automation categories. Each one knows which contacts it operates on in a different way.

### Sales & Lead Generation

The user creates a **Campaign List** — a named container for contacts (e.g. "Q1 Leads", "Website Visitors"). When configuring the automation, the user selects which Campaign List newly captured leads should fall into.

From that point the automation handles everything automatically:

1. A visitor interacts with the website chat, fills in a form, or accepts a consent popup
2. The system captures them as a lead and immediately enrolls them in the selected Campaign List
3. The automation continues — tagging the lead, sending outreach emails, assigning them to an AI handler — all scoped to contacts on that same list

The Campaign List is doing two jobs simultaneously: it **collects incoming leads**, and it **defines who the subsequent automation steps apply to**.

---

### Support Escalation

Configured with a set of FAQ questions. When any contact asks one of those questions via chat, the automation fires for that specific contact. There is no pre-selected pool of contacts — the contact self-identifies by performing the action.

---

### Retention & Nurture

Configured with a set of tags. When a tag is applied to any contact, the automation fires for that contact. Again the contact self-selects by receiving the tag.

Support Escalation and Retention & Nurture work well with this model because their trigger is always tied to a specific contact doing a specific thing in real time. There is no ambiguity about who to run the automation against.

---

## The Problem: Reengagement & Campaigns Has No Defined Contact Pool

Reengagement & Campaigns works differently from the other three categories. Rather than reacting to real-time events (a form submission, a tag being applied, a question being asked), it operates by **scanning contacts on a schedule** — for example, checking every 30 minutes whether any contact has been inactive for more than 30 days.

This creates an immediate question: **which contacts is it scanning?**

Currently the system scans every contact in the user's account with no way to narrow it down. This creates several real problems:

- A "Contact inactive for 30 days" trigger is ambiguous — inactive compared to what? A contact who last messaged via WhatsApp three weeks ago is very different from one who signed up to a newsletter two years ago.
- There is no way to intentionally target a specific group of contacts. A win-back campaign aimed at high-value lapsed customers will also catch every cold lead from years ago that was never really warm to begin with.
- Two different Reengagement automations could both fire for the same contact, with neither automation aware of the other.
- There is no auditable record of who this automation is meant to cover before it starts running.

The solution is to give Reengagement & Campaigns the same grounding that Sales & Lead Generation already has: **a Campaign List as the defined contact pool**.

---

## What We Are Proposing

### 1. Manual Contact Management for Campaign Lists

Today, the only way a contact appears on a Campaign List is automatically — an SLG automation enrolls them when they are captured via chat, form, or popup. There is no way for a user to manually add a contact to a list.

We propose adding full manual contact management. A user should be able to create a contact directly and place them on one or more Campaign Lists. This is the foundational requirement for Reengagement automations — the user needs to decide who they want to target before the automation can meaningfully run.

Each manually created contact would carry the following information:

| Field                 | Notes                                      |
| --------------------- | ------------------------------------------ |
| First name            |                                            |
| Last name             |                                            |
| Email address         |                                            |
| Phone number          | Including country code                     |
| WhatsApp ID           | For WhatsApp outreach                      |
| Facebook Messenger ID | For Messenger outreach                     |
| LinkedIn ID           | For LinkedIn outreach                      |
| Telegram ID           | For Telegram outreach                      |
| Tags                  | Selected from the user's existing tag list |
| Notes                 | Free-text field for context                |

These fields mirror the messaging channels the platform already supports (WhatsApp, Facebook Messenger, LinkedIn Messenger, Telegram, SMS, Email), so that when an automation sends a message to this contact, it knows which identifier to use for each channel.

---

### 2. Contact Source Tracking

Every contact on a Campaign List will carry a **source** field indicating how they got there:

| Source         | Meaning                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| **Automation** | Enrolled automatically when captured by a Sales & Lead Generation automation |
| **Manual**     | Added directly by the user through the contact creation interface            |
| **Import**     | Added via bulk upload _(planned for a future release)_                       |

This distinction matters for reporting. A user running a win-back campaign should be able to see at a glance how many contacts were automatically captured versus deliberately added. It also helps with data quality — automatically captured contacts have a known origin, while manually added ones rely on the user's own data.

---

### 3. Bidirectional Creation Flow

There are two natural entry points for connecting a contact to a list. Both should be supported seamlessly:

**Starting from the Contact form:**
The user fills in the contact's details and, at the bottom of the form, selects which Campaign List(s) to add them to. If no list exists yet, they can create a new one in-line without leaving the form.

**Starting from the Campaign List view:**
The user opens an existing Campaign List and uses an "Add Contact" button. The same contact creation form opens with the list already pre-selected. They can also search for a contact already in their account and add that person to the list without re-entering their details.

Both paths produce the same outcome — a contact enrolled in a list with source "manual" — and should feel equally natural regardless of which direction the user starts from.

---

### 4. Reengagement Automation Is Scoped to a Campaign List

With manual contact management in place, a Reengagement & Campaigns automation setup becomes clearly defined.

**Step 1 — Prepare the contact pool**

```
1. User selects or creates a Campaign List
         ↓
2. User adds contacts to the list
   (manually, or already there from a Sales & Lead Generation automation)
         ↓
```

**Step 2 — Create the automation**

There are two equivalent ways to do this:

```
  Path A — Using a template (faster)        Path B — From scratch
  ──────────────────────────────────        ──────────────────────────────────
  User applies a Reengagement template      User creates a blank automation
  → trigger and steps are pre-filled        → selects a trigger manually
         ↓                                    (e.g. "Contact inactive for X days")
  User reviews and adjusts steps            → adds and configures steps one by one
  as needed                                 → reviews the full configuration
```

Both paths produce an identical result. The template is a convenience — it pre-fills a proven starting configuration — but the user is never required to use one.

**Step 3 — Activate**

```
  User attaches the Campaign List to the automation
         ↓
  User activates the automation
         ↓
  The trigger fires only for contacts on the attached list
```

A "Contact inactive for 30 days" trigger is now unambiguous: it evaluates inactivity for contacts on the list called "High-value clients from 2025" — not every contact in the account. Different Reengagement automations can target different lists simultaneously without interfering with each other.

---

### 5. Automation Steps That Work with Lists Should Use Campaign Lists

The platform already has an automation step type that performs list operations — for example, moving a contact from one list to another after a certain action, or copying a contact into a new list when they make a purchase. These steps currently operate on an internal system concept that is invisible to the user and cannot be managed through any interface.

We propose aligning these steps to operate on user-created Campaign Lists instead. When a user adds a "Move to list" step inside a Reengagement automation, the lists they choose from are the same Campaign Lists they create and manage elsewhere in the platform.

Similarly, when a Smart Rule step evaluates a condition such as "Is this contact already on a list?", it should check against the user's Campaign Lists.

This creates a single, consistent model: **Campaign Lists are the one concept for contact grouping across the entire platform.** There is no invisible internal alternative that behaves differently.

---

## Summary of What Needs to Change

| Area                          | What Changes                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Contact profile               | Add social channel identifiers: WhatsApp, Facebook Messenger, LinkedIn, Telegram |
| Campaign List members         | Record how a contact was enrolled — automation, manual, or import                |
| Contact creation              | New contact form with an optional Campaign List selector                         |
| Campaign List view            | Add and remove contacts manually; search for existing contacts                   |
| Reengagement automation setup | A Campaign List selector to define the contact pool before activation            |
| Automation list steps         | Operate on user-created Campaign Lists instead of the current internal model     |
| Smart rule conditions         | Support "Is this contact on Campaign List X?" as a condition                     |

---

## What This Unlocks

Once Campaign Lists become the unified contact pool concept across the platform:

- Users manage all their contacts in one place, regardless of how those contacts were originally acquired
- Reengagement automations have a clear, auditable scope and will not accidentally reach the wrong people
- Moving a contact between lists — for example, from "Cold leads" to "Active customers" — is a first-class automation action that users can configure themselves
- Reporting on list membership becomes meaningful: you can see exactly which automation enrolled a contact, when, and from which source
- A future bulk import feature can drop contacts directly into a Campaign List using the same model

---

## How This Relates to the Existing Automations

| Automation               | How it finds contacts                                    | Changes with this proposal                                                             |
| ------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Sales & Lead Generation  | Campaign List — auto-populated when leads are captured   | No change to how SLG works; manually added contacts on the same list are also eligible |
| Support Escalation       | Event-driven — any contact who triggers a configured FAQ | No change                                                                              |
| Retention & Nurture      | Event-driven — any contact who receives a configured tag | No change                                                                              |
| Reengagement & Campaigns | Currently: all contacts in account (unscoped)            | **Scoped to a selected Campaign List**                                                 |

---

## The Beehive Dashboard — Central List Management

All Campaign Lists, regardless of how they were created or which automation uses them, should be visible and manageable from a single place: the **Beehive Dashboard**.

### What the Beehive Dashboard Shows

The Beehive Dashboard presents all of the user's Campaign Lists in a table view. Every list displayed here is the same Campaign List that Sales & Lead Generation and Reengagement & Campaigns automations use as their contact pool. There is no separate concept — the dashboard is a direct window into the lists that power the automations.

Each row in the table represents one Campaign List and should surface at a glance:

- List name and description
- Total number of contacts enrolled (with a breakdown by source: automation vs. manual)
- Which automations are currently using this list (linked for quick navigation)
- Date created and last modified

### What a User Can Do From Here

**Create a new list**
The same list creation flow available elsewhere on the platform works here. A user can name a new list and immediately begin adding contacts to it before linking it to any automation.

**View and edit contacts within a list**
Clicking into a list opens its contact table. From here the user can:

- View all enrolled contacts with their profile details and source (how they were added)
- Add a new contact manually using the contact creation form
- Search for an existing contact in their account and enroll them without re-entering details
- Edit the profile details of any contact on the list
- Remove a contact from the list

**View linked automations**
For each list, the user can see which automations are actively using it as their contact pool. This is read-only context — it is not possible to link or unlink automations from this view; that association is managed inside the automation setup itself.

**Delete a list — with a safeguard**
A list cannot be deleted while any automation is actively using it. If the user attempts to delete a list that one or more automations depend on, the system will block the action and show which automations need to be updated or deactivated first. This prevents accidentally breaking a running automation by removing its contact pool from under it.

Once no automation references the list, it can be deleted freely.

### Why This Approach

Campaign Lists were originally created as a supporting data structure for the Sales & Lead Generation automation. With the expansion to Reengagement & Campaigns and the addition of manual contact management, they become a first-class entity that users actively maintain over time — not just a side effect of running an automation.

The Beehive Dashboard makes this shift explicit. It gives users a dedicated space to understand and manage their contact groups without having to open individual automations to find that information. The lists live independently; the automations reference them.

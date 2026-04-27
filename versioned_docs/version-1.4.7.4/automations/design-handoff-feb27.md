---
sidebar_position: 3
---

# Design Handoff — February 27, 2026

Changes and corrections for the automation templates and FAQ flows.

---

## 1. Sales & Lead Generation — Remove FAQ Step

The **"Select FAQs"** step has been removed from the Sales & Lead Generation automation template. FAQs are no longer part of that flow.

**Current step list (Sales & Lead Generation):**

| #   | Step                          |
| --- | ----------------------------- |
| 1   | Add BeeBot to Your Website    |
| 2   | Smart Consent Flow            |
| 3   | Select Connected Channels     |
| 4   | Integrate Your Form           |
| 5   | Configure Sender Email        |
| 6   | Create Campaign List          |
| 7   | Select BeeBot Handler         |
| 8   | CRM Tags / Keywords           |
| 9   | CRM Tag Notification Settings |
| 10  | Build Your Outreach Email     |

Remove any "Select FAQs" or FAQ-related step from the SLG template UI entirely.

---

## 2. Support & Escalation — Step 3 Label Change

Step 3 of the Support & Escalation template should be renamed:

|            | Before            | After                 |
| ---------- | ----------------- | --------------------- |
| Step label | Smart FAQ Mapping | **FAQ Configuration** |

No change to the position or order of the step — just the label.

**Full step list (Support & Escalation) for reference:**

| #   | Step                  |
| --- | --------------------- |
| 1   | Add Marketing Channel |
| 2   | Smart Rule            |
| 3   | **FAQ Configuration** |
| 4   | Campaign Preview      |

---

## 3. FAQ Creation Screen — Heading Copy Change

On the screen where a user creates a FAQ entry under the Support & Escalation template, the heading currently reads:

> **"What type of tag category do you want to add?"**

This should be changed to:

> **"What type of FAQ category do you want to add?"**

Context: FAQs are organised into 5 fixed categories that the user selects from when creating a FAQ entry:

1. Contact Type
2. Intent & Action
3. Source / Origin
4. Engagement Level
5. Actions & Behaviour

The heading should reflect that the user is picking a **FAQ category**, not a tag category.

---

## 4. Campaign List — Backend Proposal

> This section describes a new capability being proposed from the backend. Designs will be needed for the flows below.

### Background

Campaign lists can now hold actual leads. When a Sales & Lead Generation automation fires (a lead gets tagged and matches the automation's trigger), the system automatically adds that lead to every campaign list that was configured in the automation's "Create Campaign List" step. If the lead is already in a list, nothing changes — no duplicates.

---

### 4a. Campaign List — Overview / List View

Each campaign list card should display:

| Field         | Notes                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Name          | Always shown                                                                                                       |
| Description   | Show if set                                                                                                        |
| URL           | Show if set                                                                                                        |
| Configured in | Names of any automations that have this list selected in their Campaign List step (read-only, can be zero or more) |
| Member count  | Number of leads currently enrolled in this list                                                                    |
| Created date  | When the list was created                                                                                          |

---

### 4b. Create / Edit Campaign List Form

Fields to collect when a user creates or edits a campaign list:

| Field       | Required | Input type | Notes            |
| ----------- | -------- | ---------- | ---------------- |
| Name        | Yes      | Text       | —                |
| Description | No       | Textarea   | —                |
| URL         | No       | URL field  | Validated format |

---

### 4c. "Create Campaign List" Step — Inside the SLG Automation Builder (Step 6)

When the user is on step 6 of the SLG automation builder, they need to select which campaign lists this automation should enroll leads into.

**What to collect:**

- A multi-select picker showing all the user's existing campaign lists
- Each list item should show: list name + description (if available)
- The user can select one or more lists

**Behaviour note:** Once the automation is active, any lead that triggers it will be automatically added to each selected list. The user does not need to do anything manually.

---

### 4d. Campaign List Members View (New Screen)

When a user opens a specific campaign list, there should be a view (tab or section) showing all leads that have been enrolled in that list.

**Table columns:**

| Column             | Notes                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| Name               | Lead's full name                                                          |
| Email              | Lead's email address                                                      |
| Phone              | Lead's phone number (shown as "—" if not available)                       |
| Source             | How the lead originally entered the system (e.g. "chat", "form", "popup") |
| Date added to list | When this lead was enrolled in this specific list                         |
| Lead created date  | When the lead record was first created in the system                      |

Leads should be ordered with the most recently enrolled first.

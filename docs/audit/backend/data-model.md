---
sidebar_position: 4
---

# Data Model

This page covers the core entity relationships. The full schema is in [`prisma/schema.prisma`](https://github.com/UnifiedbeezTemp/unifiedbeez/blob/main/prisma/schema.prisma) (7,900+ lines, 100+ models).

---

## Ownership Hierarchy

Every row in the system is owned by a `User`. This is the root of multi-tenant isolation.

```mermaid
graph TD
  User --> TeamMember["TeamMember\n(team members under this tenant)"]
  User --> ConnectedChannel["ConnectedChannel\n(WhatsApp, FB, Email, SMS, etc.)"]
  User --> Conversation["Conversation\n(inbox threads)"]
  User --> Contact["Contact\n(CRM contacts)"]
  User --> Automation["Automation\n(flows + steps)"]
  User --> AiAssistant["AiAssistant\n(AI configs)"]
  User --> CampaignList["CampaignList\n(contact lists for campaigns)"]
  User --> Website["Website\n(crawled for knowledge base)"]
  User --> BusinessKnowledgeFile["BusinessKnowledgeFile\n(uploaded docs)"]
  User --> CallLog["CallLog\n(voice call records)"]
  User --> CopilotConversation["CopilotConversation\n(onboarding wizard state)"]
```

---

## Core Messaging Entities

```mermaid
erDiagram
  User ||--o{ ConnectedChannel : owns
  User ||--o{ Conversation : owns
  ConnectedChannel ||--o{ Conversation : "messages arrive on"
  Conversation ||--o{ Message : contains
  Conversation }o--|| Contact : "linked to"
  Conversation }o--o| Thread : "grouped in"
  Conversation }o--o| TeamMember : "assigned to"

  ConnectedChannel {
    int id
    int userId
    ChannelType channelType
    string name
    bool isActive
  }

  Conversation {
    bigint id
    int userId
    int channelId
    ChannelType channelType
    string participantId
    string status
    bool isInternal
  }

  Message {
    bigint id
    bigint conversationId
    string content
    MessageSender sender
    MessageType messageType
    bool isRead
    datetime createdAt
  }

  Contact {
    int id
    int userId
    string name
    string email
    string phone
  }
```

### Channel Types

`ChannelType` enum: `WHATSAPP`, `FACEBOOK`, `INSTAGRAM`, `TELEGRAM`, `SMS`, `EMAIL`, `WEBCHAT`, `LIVECHAT`

Each channel type has a corresponding account model:

| ChannelType | Account model |
|---|---|
| WHATSAPP | `WhatsappAccount` |
| FACEBOOK / INSTAGRAM | `FacebookAccount` |
| SMS | `SmsAccount` |
| EMAIL | `EmailAccount` |
| TELEGRAM | `TelegramAccount` |
| WEBCHAT / LIVECHAT | (no separate account model — configured via `ConnectedChannel`) |

---

## Automation

```mermaid
erDiagram
  User ||--o{ Automation : owns
  Automation ||--o{ AutomationStep : "ordered steps"
  Automation }o--o{ CampaignList : "targets contacts in"
  AutomationStep ||--o| SmartRuleStepConfig : "SMART_RULE type"
  AutomationStep ||--o| WaitStepConfig : "WAIT type"
  AutomationStep ||--o| MessageStepConfig : "MESSAGE type"

  Automation {
    int id
    int userId
    string name
    AutomationStartType startType
    AutomationStatus status
  }

  AutomationStep {
    int id
    int automationId
    AutomationStepType type
    int position
    Json config
  }

  CampaignList {
    int id
    int userId
    string name
  }
```

---

## AI & Knowledge Base

```mermaid
erDiagram
  User ||--o{ AiAssistant : owns
  AiAssistant ||--o{ ChannelAiConfig : "configured on channels"
  AiAssistant ||--o{ Website : "uses knowledge from"
  AiAssistant ||--o{ BusinessKnowledgeFile : "uses knowledge from"
  AiAssistant ||--o{ FaqGroup : "answers FAQs from"

  AiAssistant {
    int id
    int userId
    string name
    string systemPrompt
    string pineconeNamespace
  }

  Website {
    int id
    int userId
    string url
    string crawlStatus
  }

  BusinessKnowledgeFile {
    int id
    int userId
    string fileName
    string fileType
    string processingStatus
  }
```

Pinecone namespace format: `tenant-{userId}` for shared knowledge, `tenant-{userId}-ai-{aiAssistantId}` for assistant-specific knowledge.

---

## Billing & Plan

```mermaid
erDiagram
  User ||--o| UserBudget : has
  User ||--o| CreditWallet : has
  User ||--o{ UserAddon : "purchased addons"
  PlanFeature }o--|| PlanType : "defines limits for"

  PlanFeature {
    int id
    PlanType planType
    int maxSeats
    int maxAiAssistants
    int maxWhatsappChannels
    int priceEur
  }

  UserAddon {
    int id
    int userId
    AddonType addonType
    int quantity
    datetime expiresAt
  }
```

---

## Voice & Video

```mermaid
erDiagram
  User ||--o{ CallLog : owns
  CallLog }o--|| ConnectedChannel : "via channel"
  CallLog }o--o| Contact : "linked to"

  CallLog {
    int id
    int userId
    CallDirection direction
    CallStatus status
    string twilioCallSid
    string transcript
    datetime startedAt
    datetime endedAt
  }
```

`CallDirection`: `INBOUND`, `OUTBOUND`  
`CallStatus`: `INITIATED`, `RINGING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `BUSY`, `NO_ANSWER`

---

## Identity & Auth

```mermaid
erDiagram
  User ||--o{ UserSession : "active sessions"
  User ||--o{ TeamMember : "team under this tenant"
  User ||--o{ UserRole : has
  UserRole }o--|| Role : references
  Role ||--o{ RolePermission : has
  RolePermission }o--|| Permission : references
  TeamMember ||--o{ TeamMemberSession : "active sessions"

  UserSession {
    string id
    int userId
    datetime expiresAt
  }

  TeamMember {
    int id
    int userId
    string email
    string role
    bool isActive
  }
```

---

## Compliance (Extended Schema)

The schema includes an extensive compliance module (`src/common/compliance/`) with 40+ models covering GDPR, AML/KYC, healthcare consent, data subject rights, and regulatory archiving. These are present to support enterprise and regulated-industry customers. Key models: `DataProcessingRecord`, `DataSubjectRequest`, `AMLCheck`, `KYCDocument`, `HealthcareConsentRecord`.

---

## Conventions

All models follow these conventions:

| Convention | Example |
|---|---|
| Primary key | `id Int @id @default(autoincrement())` |
| Timestamps | `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` |
| Table name | `@@map("snake_case_plural")` |
| FK field name | camelCase, descriptive: `connectedChannelId` |
| Cascade delete | Explicit `onDelete: Cascade` or `onDelete: SetNull` — never implicit |
| Tenant scoping | Every user-owned model has `userId Int` + `user User @relation(...)` |

---

## Related Docs

- [Module Catalogue](./module-catalogue) — which module owns which models
- [Getting Started](./getting-started) — how to run migrations and explore with Prisma Studio

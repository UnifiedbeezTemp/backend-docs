---
sidebar_position: 3
---

# Module Catalogue

All feature modules registered in `src/app.module.ts`, grouped by domain. Each row shows the source directory, what the module does, and which Prisma models it primarily owns.

---

## Auth & Identity

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **AuthModule** | `src/auth/` | Login, logout, password reset, invitations, role assignment, session management | `UserSession`, `UserInvitation`, `UserRole`, `Role`, `Permission` |
| **SecurityModule** | `src/security/` | Rate-limit helpers, IP blocklists, security event logging | — |
| **TeamModule** | `src/team/` | Team member management under a tenant, seat tracking | `TeamMember`, `TeamMemberInternal`, `TeamMemberSession`, `BulkSeatPackage` |
| **IdentityModule** | `src/identity/` | Contact deduplication and identity resolution across channels | `MasterCustomerRecord`, `IdentityFragment`, `IdentityMergeLog`, `IdentityConflict` |

---

## Messaging & Channels

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **MessagesModule** | `src/messages/` | Core message handling — inbound processing, AI response generation (`generateAiResponse()`), conversation management, Socket.IO events | `Conversation`, `Message`, `ConversationComment`, `ConversationNote` |
| **ChannelsModule** | `src/channels/` | Channel connection management, AI config per channel, escalation keywords, working hours, channel health | `ConnectedChannel`, `ChannelAiConfig`, `ChannelAiAccess`, `EscalationKeyword`, `EscalationContact`, `ChannelWorkingDay` |
| **FacebookWabaModule** | `src/facebook-waba/` | WhatsApp Business API (WABA) — webhook handling, message sending, template management | `WhatsappAccount` |
| **WebchatModule** | `src/webchat/` | Webchat widget integration — session init, message relay, widget config | `ConnectedChannel` (webchat type) |
| **LiveChatModule** | `src/livechat/` | LiveChat widget integration — similar to webchat but with livechat provider API | `ConnectedChannel` (livechat type) |
| **SmsModule** | `src/sms/` | SMS channel via Twilio — inbound/outbound message handling | `SmsAccount` |
| **SystemEmailModule** | `src/email/` | Transactional email sending (AWS SES), email channel management (IMAP/SMTP connect + inbound) | `EmailAccount` |

---

## AI

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **AiModule** | `src/ai/` | LLM service (`EnhancedLLMService` — Gemini → OpenAI → Anthropic fallback), knowledge base management (Pinecone), FAQ management, NLP intent recognition, tag prediction, web scraper, cost tracking | `AiAssistant`, `BusinessKnowledgeFile`, `Website`, `WebsitePage`, `FaqGroup`, `KnowledgeConfig`, `AiUsageMetrics` |
| **CopilotModule** | `src/copilot/` | Multi-step onboarding wizard (Beezaro) — state machine, substep progression, plan selection | `CopilotConversation`, `CopilotMessage`, `CopilotBugReport` |

---

## Automation & Campaigns

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **AutomationModule** | `src/automation/` | Automation flows — steps, conditions, triggers, execution engine, campaign scheduler | `Automation`, `AutomationStep`, `AutomationTemplate`, `AutomationExecution` |
| **LeadGenerationModule** | `src/automation/sales-and-lead/` | Lead gen campaigns, tag groups, tag audits, contact tagging | `LeadGenerationCampaign`, `TagGroup`, `CampaignList` |
| Campaign sub-module | `src/automation/campaign/` | Unified campaign management (broadcast, drip) | `CampaignList` |
| Email template sub-module | `src/automation/email-template/` | Reusable email templates for automation steps | `EmailTemplate` |
| Form builder sub-module | `src/automation/form-builder/` | Lead capture forms embedded via webchat widget | `FormBuilder` |
| Async management sub-module | `src/automation/async-management/` | SQS queue health monitoring, queue metrics admin | — |

---

## Contacts & CRM

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **ContactsModule** | `src/contacts/` | Contact CRUD, contact list management, import/export, bulk operations | `Contact`, `ContactList` |
| **AttributesModule** | `src/attributes/` | Custom contact attribute definitions and values | `AttributeDefinition` |
| **MergeFieldsModule** | `src/merge-fields/` | Template merge fields (personalisation tokens) for messages and campaigns | `MergeField` |
| **ProfilesModule** | `src/profiles/` | User profile management (name, avatar, business info) | `User` (profile fields) |

---

## Billing & Plan

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **PaymentModule** | `src/payment/` | Stripe integration — subscriptions, payment intents, webhooks, checkout | `User` (plan fields), Stripe objects |
| **BillingModule** | `src/billing/` | Billing test utilities, billing status checks | — |
| **UsageModule** | `src/usage/` | Seat usage, contact usage, email usage tracking | `ContactUsage`, `EmailUsage`, `BulkSeatPackage` |
| **BudgetModule** | `src/budget/` | Per-user AI token budget management | `UserBudget` |
| **CreditsModule** | `src/credits/` | Credit pack purchases and wallet management | `CreditPackage`, `CreditWallet`, `CreditTransaction` |
| **AddonModule** | `src/addon/` | Addon definitions, user addon purchases (contact packs, email packs, token packs) | `AddonDefinition`, `UserAddon`, `ContactPack`, `EmailPack`, `TokenComputePack` |
| **PlanModule** | `src/plan/` | Plan feature definitions and limits (seats, channels, AI assistants) | `PlanFeature` |

---

## Voice & Video

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **VoiceModule** | `src/voice/` | AI voice calls via Twilio — call management, WebRTC browser tokens, Twilio Media Streams WebSocket gateway, STT (Deepgram → Whisper → Google), TTS (ElevenLabs → OpenAI → Twilio `<Say>`) | `CallLog` |
| **VideoModule** | `src/video/` | Twilio Video rooms — access token generation, VideoGrant, room management | — |

---

## Integrations

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **Calendly** | `src/channels/calendly/` | Calendly OAuth connect, webhook relay for booking events | `CalendlyAccount` |
| **Calendar** | `src/channels/calendar/` | Google/Outlook calendar integration | `CalendarAccount` |
| **Shopify** | (via `ChannelsModule`) | Shopify store connect, order/customer data sync | `ShopifyStore` |
| **PayPal** | (via `ChannelsModule`) | PayPal account connection | `PayPalAccount` |
| **Zoom** | (via `ChannelsModule`) | Zoom account OAuth connection | `ZoomAccount` |
| **Telegram** | (via `ChannelsModule`) | Telegram Bot API — inbound/outbound messages | `TelegramAccount` |
| **Stripe Connected** | (via `ChannelsModule`) | Stripe Connect for platform payments | `StripeConnectedAccount` |

---

## Platform & Operations

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **AdminModule** | `src/admin/` | Internal admin dashboard — user management, channel health, migration tools, team member auth | `Admin`, `AdminAuditLog`, `AdminSession` |
| **BeehiveModule** | `src/beehive/` | Beehive dashboard API — aggregate metrics and reporting for platform admins | — |
| **HealthModule** | `src/health/` | `GET /health` — liveness and readiness checks (DB, Redis) | — |
| **HealthMetricsModule** | `src/health-metrics/` | Internal health metrics collection | — |
| **DiagnosticsModule** | `src/diagnostics/` | Diagnostic endpoints for debugging in non-prod | — |
| **MetricsModule** | `src/metrics/` | Prometheus-compatible metrics middleware | — |
| **BrandKitModule** | `src/brand-kit/` | Brand kit management — logos, colours, fonts extracted from website | `BrandKit` |
| **TeamInboxModule** | `src/team-inbox/` | Team inbox — conversation assignment, thread management | `Thread` |
| **InboxFilesModule** | `src/inbox-files/` | File attachments in inbox conversations | `InboxFile` |
| **SupportModule** | `src/support/` | Internal support chat between tenant and UnifiedBeez team | `SupportConversation`, `SupportMessage`, `SupportAttachment` |

---

## Infrastructure & Cross-Cutting

| Module | Directory | Purpose |
|---|---|---|
| **DatabaseModule** | `src/database/` | `PrismaService` singleton, seed service |
| **RedisModule** | `src/redis/` | Redis client factory |
| **RedisPubSubModule** | `src/redis-pub-sub/` | Redis pub/sub for cross-process events; also bootstraps `EventEmitterModule` globally |
| **QueueModule** | `src/queue/` | SQS producer/consumer abstractions (`SqsConsumer`, `SqsPoller`) |
| **StorageModule** | `src/storage/` | S3 upload/download helpers, CloudFront signed URL generation |

---

## Website Forms (Public-facing)

| Module | Directory | Purpose | Primary Prisma models |
|---|---|---|---|
| **ConsultationModule** | `src/website-forms/consultation/` | Public consultation request form (no auth required) | `ConsultationRequest` |
| **WaitlistModule** | `src/website-forms/waitlist/` | Public waitlist signup form | `WaitlistEntry` |

---

## Workers

SQS consumer workers live in `src/workers/` and are activated when `WORKER_MODE=true`:

| Worker | Purpose |
|---|---|
| `sqs-consumer.service.ts` | Long-polling SQS consumer base class |
| `sqs-poller.service.ts` | Polling orchestrator — routes messages to the correct handler |

Individual queue handlers are co-located with their owning modules (e.g., `ai/processors/`, `automation/processors/`).

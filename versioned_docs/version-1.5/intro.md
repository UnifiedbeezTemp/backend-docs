---
sidebar_position: 1
---

# UnifiedBeez Documentation

**UnifiedBeez** is a multi-tenant unified inbox, CRM, and AI automation platform for businesses. It lets teams manage conversations across WhatsApp, Facebook Messenger, Instagram, Telegram, SMS, Email, and live chat — with AI-powered auto-replies, contact management, automation flows, and voice/video calling — from a single platform.

---

## System Components

| Component | What it is |
|---|---|
| **Backend** | NestJS monolith — API + async Worker. REST API, WebSocket gateways, AI pipeline, SQS queue consumers. |
| **Infrastructure** | AWS CDK (TypeScript) — 10 stacks across ECS, RDS, Redis, SQS, S3, CloudFront, Lambda. Deployed to eu-west-1. |
| **Widget** | Embeddable JavaScript webchat widget served from CloudFront. |
| **Docs site** | This site — technical reference for the backend and infrastructure. |

---

## Quick Navigation

### Backend
- [Overview](./audit/backend/overview) — architecture, stack, request lifecycle
- [Getting Started](./audit/backend/getting-started) — local setup in under 30 minutes
- [Module Catalogue](./audit/backend/module-catalogue) — all 35+ modules and what they own
- [Data Model](./audit/backend/data-model) — entity relationships and Prisma conventions
- [Coding Standards](./audit/backend/coding-standards) — engineering rules (validation, isolation, error handling, testing)
- [Testing](./audit/backend/testing) — 3 test layers, commands, coverage requirements

### Infrastructure
- [Overview](./audit/infrastructure/overview) — AWS topology, Mermaid diagram, 10 CDK stacks
- [Environments](./audit/infrastructure/environments) — dev vs prod configuration
- [Deployment](./audit/infrastructure/deployment) — CDK deploy, application deploy, rollback
- [Secrets Management](./audit/infrastructure/secrets) — Secrets Manager paths, key inventory, rotation
- [DR & Backups](./audit/infrastructure/dr-and-backups) — RDS backup policy, PITR, DLQ recovery

### Operations
- [SQS Backlog](./audit/operations/runbooks/sqs-backlog) — DLQ investigation and redrive
- [WS Gateway Crash](./audit/operations/runbooks/ws-gateway-crash) — process death and ECS recovery
- [Prisma Migration Drift](./audit/operations/runbooks/prisma-migration-drift) — drift detection and recovery
- [LLM Provider Outage](./audit/operations/runbooks/llm-provider-outage) — AI fallback chain and key rotation
- [Stripe Webhook Failure](./audit/operations/runbooks/stripe-webhook-failure) — webhook signature and DLQ
- [Incident: Email AI Loop (2026-04-30)](./audit/operations/incidents/2026-04-email-ai-loop) — postmortem

### Security
- [Security Overview](./audit/security/overview) — auth, RBAC, network isolation, rate limiting

### Contributing
- [Branching Strategy](./audit/contributing/branching) — branch naming, PR workflow, hotfixes

---

## Key Facts for a New Reviewer

- **Primary language:** TypeScript (NestJS backend, CDK infrastructure)
- **Database:** PostgreSQL 17.6 (AWS RDS t3.small), 7,900+ line Prisma schema
- **Multi-tenancy:** Row-level scoping by `userId` — enforced in application code
- **AI stack:** Gemini → OpenAI → Anthropic fallback chain via `EnhancedLLMService`, Pinecone vector DB
- **Primary region:** eu-west-1 (Ireland); SES in eu-north-1; ACM for CloudFront in us-east-1
- **Channels supported:** WhatsApp Business, Facebook Messenger, Instagram DM, Telegram, SMS (Twilio), Email (IMAP/SMTP), Webchat widget, LiveChat
- **Voice/Video:** Twilio — AI outbound calling, browser WebRTC, STT (Deepgram → Whisper → Google), TTS (ElevenLabs → OpenAI → Twilio)

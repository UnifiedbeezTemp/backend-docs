---
sidebar_position: 2
---

# Environments

UnifiedBeez runs across two named environments. A staging environment is planned but not yet provisioned.

:::info Team action required
Fill in the AWS Account IDs, exact domain names, and access contacts for each environment before sharing this page externally.
:::

---

## Environment Matrix

| Property | Development | Production |
|---|---|---|
| **AWS Account** | _(confirm with team)_ | _(confirm with team)_ |
| **Region** | eu-west-1 | eu-west-1 |
| **API domain** | _(confirm with team)_ | api.unifiedbees.com _(confirm)_ |
| **Docs site** | — | https://unifiedbeeztemp.github.io/backend-docs/ |
| **RDS** | Shared dev instance | Dedicated prod instance, deletion protection ON |
| **Redis** | Shared dev cluster | Dedicated prod cluster |
| **SQS queues** | `-dev` suffixed queues | Primary queues (no suffix) |
| **Secrets Manager** | `unifiedbeez/app` (dev values) | `unifiedbeez/app` (prod values) |
| **CDK deploy method** | `npx cdk deploy --all` manually | CI/CD pipeline _(or manual with approval)_ |
| **Log retention** | 1 week (CloudWatch) | 1 week (CloudWatch) |
| **Alerts** | Disabled or to team Slack | Email → olaleye@unifiedbeez.com via SNS |

---

## Queue Naming Convention

The codebase routes to different queues depending on the `NODE_ENV`:

| Queue type | Dev queue name | Prod queue name |
|---|---|---|
| Inbound messages | `inbound-messages-dev` | `inbound-messages` |
| Outbound messages | `outbound-messages-dev` | `outbound-messages` |
| AI response | `ai-response-generation-dev` | `ai-response-generation` |
| Knowledge processing | `knowledge-processing-dev` | `knowledge-processing` |
| Email processing | `email-processing-dev` | `email-processing` |
| All others | same name (no suffix) | same name (no suffix) |

---

## Secrets Manager Paths

Secrets are stored at predictable paths in AWS Secrets Manager. The ECS task execution role has read access to both secrets.

| Secret name | Contents | Who reads it |
|---|---|---|
| `unifiedbeez/database` | `username`, `password` (auto-generated 32-char) | ECS task execution role (injected into container at launch) |
| `unifiedbeez/app` | Twilio, OpenAI, Anthropic, Stripe, WhatsApp Business Token, FB App Secret, Session Secret | ECS task execution role + Beezaro Copilot Lambda |

Secret values for dev are populated manually after provisioning (`REPLACE_ME` placeholders are in the CDK code). See [Secrets Management](./secrets) for rotation procedures.

---

## IAM Access

Access to AWS environments follows least-privilege. The following roles exist:

| Role | Type | Permissions |
|---|---|---|
| ECS Execution Role | IAM Role | Pull ECR images, read Secrets Manager |
| ECS Task Role | IAM Role | S3 (attachments bucket), SQS (all queues), Textract, SES, Lambda invoke (Copilot) |
| Developer access | IAM User/SSO | Defined per team member — confirm current policy with DevOps lead |

---

## Region Notes

The infrastructure spans three AWS regions for specific services:

| Service | Region | Reason |
|---|---|---|
| All compute, DB, cache, storage | eu-west-1 | Primary region |
| SES | eu-north-1 | SES sandbox approved in this region |
| ACM (for CloudFront) | us-east-1 | CloudFront requires certificates in us-east-1 |

---

## Related Docs

- [Infrastructure Overview](./overview) — topology and stack list
- [Deployment](./deployment) — how to deploy to each environment
- [Secrets Management](./secrets) — secret paths and rotation

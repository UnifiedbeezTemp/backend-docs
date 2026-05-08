---
sidebar_position: 4
---

# Secrets Management

All credentials are stored in **AWS Secrets Manager**. No secrets live in environment variables, `.env` files, or source code in production.

---

## Secret Paths

Two secrets store all credentials for the running application:

| Secret name | Contents | Who reads it |
|---|---|---|
| `unifiedbeez/database` | `username`, `password` (auto-generated 32-char, no punctuation) | ECS execution role at container start |
| `unifiedbeez/app` | All API keys and application secrets (see table below) | ECS execution role at container start; Beezaro Copilot Lambda |

---

## `unifiedbeez/app` — Key Inventory

| Key | Service | Purpose |
|---|---|---|
| `JWT_SECRET` | Auth | Session token signing |
| `JWT_REFRESH_SECRET` | Auth | Refresh token signing |
| `SESSION_SECRET` | Auth | express-session cookie signing |
| `TWILIO_ACCOUNT_SID` | Twilio | Account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio | API auth |
| `TWILIO_PHONE_NUMBER` | Twilio | Default SMS sender number |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio | Messaging service for multi-number routing |
| `TWILIO_API_KEY_SID` | Twilio | API key for Voice/Video tokens |
| `TWILIO_API_KEY_SECRET` | Twilio | API key secret for Voice/Video tokens |
| `TWILIO_TWIML_APP_SID` | Twilio | TwiML app for browser-based calling |
| `WHATSAPP_ACCESS_TOKEN` | Meta / WhatsApp Business | WABA API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta / WhatsApp Business | Sender phone number ID |
| `FACEBOOK_APP_ID` | Meta | FB app identifier |
| `FACEBOOK_APP_SECRET` | Meta | FB app secret |
| `FACEBOOK_VERIFY_TOKEN` | Meta | Webhook verification token |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Meta | Alternative webhook token |
| `FACEBOOK_WEBHOOK_SECRET` | Meta | Webhook payload signature verification |
| `GOOGLE_CLIENT_ID` | Google OAuth | OAuth app client ID |
| `GOOGLE_CLIENT_ID_IOS` | Google OAuth | iOS client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | OAuth app client secret |
| `OPENAI_API_KEY` | OpenAI | LLM + embeddings |
| `ANTHROPIC_API_KEY` | Anthropic | LLM fallback |
| `GEMINI_API_KEY` | Google Gemini | LLM primary |
| `PINECONE_API_KEY` | Pinecone | Vector DB access |
| `STRIPE_SECRET_KEY` | Stripe | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook payload verification |
| `PLUNK_API_KEY` | Plunk | Transactional email (alternative to SES) |
| `AWS_SES_SMTP_USERNAME` | AWS SES | SMTP credentials for email sending |
| `AWS_SES_SMTP_PASSWORD` | AWS SES | SMTP credentials for email sending |
| `ELEVENLABS_API_KEY` | ElevenLabs | TTS voice synthesis |
| `DEEPGRAM_API_KEY` | Deepgram | Speech-to-text |

---

## How Secrets Reach the Container

ECS injects secrets at **task start time**. The flow:

```
Secrets Manager (unifiedbeez/app)
       ↓
ECS Task Execution Role (secretsmanager:GetSecretValue)
       ↓
ECS injects each key as an environment variable
       ↓
NestJS app reads via process.env.KEY_NAME
```

This happens before the container process starts. If a secret is missing or the execution role lacks permission, the task will fail to start with an `ExecutionRolePermission` error in ECS events.

---

## Adding a New Secret

1. Add the key to the `unifiedbeez/app` secret in AWS Secrets Manager (Console or CLI):
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id unifiedbeez/app \
     --secret-string '{"EXISTING_KEY":"value","NEW_KEY":"new-value"}' \
     --region eu-west-1
   ```

2. Add the `ecs.Secret.fromSecretsManager(...)` reference in `compute-stack.ts`:
   ```typescript
   NEW_KEY: ecs.Secret.fromSecretsManager(props.appSecrets, "NEW_KEY"),
   ```

3. Redeploy the `UnifiedBeezCompute` stack:
   ```bash
   npx cdk deploy UnifiedBeezCompute
   ```

4. The new ECS task definition will include the secret. Trigger a rolling update.

---

## Rotating a Secret Without Downtime

For secrets that can be changed without a service restart (e.g., API keys with multiple valid keys during transition):

1. Update the secret value in Secrets Manager.
2. Trigger a rolling ECS update — new tasks will pick up the new secret; old tasks continue with the old value until drained.
3. Once all tasks are running the new version, the old secret value is no longer in use.

For secrets that require a coordinated cutover (e.g., DB password):
1. Generate the new password.
2. Update the DB password via RDS (or let Secrets Manager auto-rotation handle it if configured).
3. Update the secret value in Secrets Manager.
4. Trigger ECS rolling update.
5. Old tasks will fail DB connections as the old password is invalidated — plan for a short maintenance window.

---

## Security Notes

- The `SecretsStack` CDK code contains `REPLACE_ME` placeholder values. **Never commit real secret values to the CDK repo.** Actual values are set manually after provisioning via the AWS Console or CLI.
- The ECS task role (runtime) does **not** have access to Secrets Manager. Only the execution role (startup) does. This limits blast radius if a container is compromised.
- Secret ARNs are emitted as CloudFormation outputs from `SecretsStack` and passed as CDK tokens (not plaintext values) to downstream stacks.

---

## Related Docs

- [Environments](./environments) — which secrets apply to which environment
- [Deployment](./deployment) — how secrets are injected during deploy
- [Infrastructure Overview](./overview) — SecretsStack position in dependency order

---
sidebar_position: 1
---

# Security Overview

:::info Work in progress
This section is being developed as part of the documentation audit sprint. Content will be expanded with formal RBAC and compliance documentation.
:::

---

## Authentication

UnifiedBeez uses **session-based authentication** via `express-session` with a Redis-backed session store.

- Sessions are created on login and stored in Redis with a configurable TTL.
- The session cookie (`connect.sid`) is `httpOnly`, `secure`, and `sameSite: strict` in production.
- `SessionAuthGuard` validates every authenticated request by reading the session from Redis and populating `req.user = { id: userId }`.
- Team members authenticate via a separate endpoint and receive their own session scoped to their owning tenant.

---

## Multi-Tenant Isolation

Every row of user-owned data is scoped by `userId`. The backend enforces this at the Prisma query layer — every query on user-owned data includes `userId` in the `where` clause. Tenant isolation is not enforced at the database level (no row-level security) — it is enforced by application code.

See [Coding Standards — Tenant Isolation](../backend/coding-standards#3-tenant-isolation) for the query patterns required.

---

## Role-Based Access Control (RBAC)

UnifiedBeez has a permission system with:
- `Role` — named roles (e.g., Admin, Agent, Viewer)
- `Permission` — granular action permissions
- `RolePermission` — maps permissions to roles
- `UserRole` — assigns roles to users

Team members operate within their owning user's tenant. Access to specific features is gated by role checks in controllers and services.

Full RBAC documentation is in progress.

---

## Network Security

See [Infrastructure — Security Architecture](../infrastructure/overview#security-architecture) for the full network isolation model:
- RDS in isolated subnets (no internet route)
- ECS in private subnets (egress via NAT gateway)
- ALB in public subnets (443 only)
- All inter-service traffic within the VPC

---

## Secrets

All API keys and credentials are stored in AWS Secrets Manager. No secrets in environment variables, source code, or `.env` files in production. See [Secrets Management](../infrastructure/secrets).

---

## Rate Limiting

A global `ThrottlerGuard` applies to all routes (50 req / 60s by default, configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_TTL` env vars). Webhook endpoints and high-volume internal routes can override this with `@Throttle()`.

---

## Compliance

UnifiedBeez includes a comprehensive compliance module supporting GDPR, AML/KYC, data subject rights, and regulatory archiving for enterprise and regulated-industry customers. Full compliance documentation is in progress.

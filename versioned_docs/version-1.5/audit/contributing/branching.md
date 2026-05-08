---
sidebar_position: 1
---

# Branching Strategy

---

## Main Branches

| Branch | Purpose |
|---|---|
| `main` | Production-ready code. Every commit here has been reviewed and tested. |
| `develop` | Development integration branch. Feature branches merge here first. |

---

## Supporting Branches

| Type | Pattern | Branches from | Merges to |
|---|---|---|---|
| Feature | `feature/short-description` | `develop` | `develop` |
| Bug fix | `bugfix/short-description` | `develop` | `develop` |
| Hotfix | `hotfix/short-description` | `main` | `main` + `develop` |
| Release | `release/v1.x.x` | `develop` | `main` + `develop` |

### Jira integration

Branch names should include the Jira ticket ID where applicable:

```
feature/UB-1282-voice-calling-endpoints
bugfix/UB-999-fix-email-bounce-detection
```

---

## Workflow

```
develop ──────────────────────────────────────────► main
    │                                                 ▲
    └── feature/UB-xxx-my-feature                     │
              │                                       │
              └── PR → develop ──── release/v1.x.x ──┘
```

1. Create a feature branch from `develop`.
2. Develop and test locally.
3. Open a PR against `develop`.
4. CI must pass before the PR can be merged.
5. At least one reviewer must approve.
6. Merge into `develop`.
7. When `develop` is stable for release, create a `release/vX.Y.Z` branch.
8. After final testing, merge release to `main` and tag with the version number.
9. Also merge release back into `develop` to capture any release-branch fixes.

### Hotfixes

For urgent production fixes:

1. Branch from `main`: `hotfix/critical-fix-description`.
2. Fix, test, PR against `main`.
3. After merge, also merge or cherry-pick to `develop`.
4. Tag the hotfix on `main`.

---

## Naming Conventions

- Use kebab-case: `feature/add-voice-calling`, not `feature/add_voice_calling`.
- Be descriptive but concise. Reviewer should understand the scope from the branch name.
- Include Jira ticket ID where the work is tracked.

| Good | Bad |
|---|---|
| `feature/UB-1282-voice-calling-endpoints` | `feature/stuff` |
| `bugfix/fix-email-bounce-detection` | `fix` |
| `hotfix/stripe-webhook-signature-rotation` | `hotfix1` |

---

## Code Review Requirements

- CI must pass (lint, build, tests) before merge.
- At least one approval from a team member who did not write the code.
- PR description must include: what changed, why, and how to test it.
- For backend changes: confirm the [pre-ship checklist](../backend/coding-standards#10-pre-ship-checklist) has been reviewed.

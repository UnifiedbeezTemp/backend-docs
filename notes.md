# Docusaurus Versioning Guide

## How It Works

- `docs/` is always the "Next" (unreleased/latest) version where you make changes.
- Running the version command snapshots `docs/` into `versioned_docs/`, freezing it.
- Frozen versions are accessible to users via the version dropdown in the navbar.

## Workflow

1. **Snapshot the current state** before making breaking or significant changes:

   ```bash
   npx docusaurus docs:version <version-number>
   ```

   Example: `npx docusaurus docs:version 1.2.0`

2. **Make your changes** in the `docs/` folder. These only affect the "Next" version.

3. **Repeat** whenever you want to preserve another snapshot.

## Current Setup

| Version | Location                      | Status |
| ------- | ----------------------------- | ------ |
| 1.0     | `versioned_docs/version-1.0/` | Frozen |
| Next    | `docs/`                       | Active |

## Key Points

- You do **not** need to version after every edit — only when you want to preserve a snapshot.
- Frozen versions are read-only. To fix something in a past version, edit the files in `versioned_docs/version-X/`.
- The version dropdown in the navbar lets users switch between versions.
- `versions.json` lists all versioned snapshots in order.

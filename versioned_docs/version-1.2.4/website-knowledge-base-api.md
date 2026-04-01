# Website Knowledge Base — Frontend Integration Guide

## Overview

Websites are scraped and stored as a knowledge source for AI assistants. The pipeline runs asynchronously in a background worker. The frontend triggers actions via REST and tracks progress either via WebSocket push or REST polling.

---

## Endpoints

All endpoints require an authenticated session. Base path: `POST /api/v1/websites`

### Add a website

```
POST /api/v1/websites?aiAssistantId=<id>
```

`aiAssistantId` is optional. Omit it (or use `isDefaultKnowledge: true`) to add the website to the global knowledge pool shared across all assistants.

**Body**

```json
{
  "baseUrl": "https://example.com",
  "displayName": "My Site",
  "crawlType": "ENTIRE_SITE",
  "maxPages": 100,
  "maxDepth": 3,
  "isDefaultKnowledge": false
}
```

| Field                | Type    | Required | Notes                                                              |
| -------------------- | ------- | -------- | ------------------------------------------------------------------ |
| `baseUrl`            | string  | yes      | Normalised automatically (trailing slash added, fragment stripped) |
| `displayName`        | string  | no       | Defaults to domain name                                            |
| `crawlType`          | enum    | yes      | See crawl types below                                              |
| `maxPages`           | number  | no       | Default 100, max 100                                               |
| `maxDepth`           | number  | no       | Default 3                                                          |
| `isDefaultKnowledge` | boolean | no       | Default false                                                      |

**Crawl types**

| Value            | Behaviour                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `ENTIRE_SITE`    | Full crawl — sitemap then link-following. Async (returns immediately, crawls in background). |
| `SPECIFIC_PAGES` | Provide explicit URL list. Sync — returns only after pages are scraped.                      |
| `JUST_THIS_PAGE` | Single page only. Sync — returns only after the page is scraped.                             |

**Response (201)**

```json
{
  "id": 18,
  "baseUrl": "https://example.com/",
  "displayName": "Example",
  "crawlType": "ENTIRE_SITE",
  "discoveryStatus": "PENDING",
  "isDefaultKnowledge": false
}
```

For `ENTIRE_SITE` the job is enqueued and `discoveryStatus` starts as `PENDING`. Track progress via WebSocket (`website.progress` event) or poll `GET /api/v1/websites/:id`.

---

### List websites

```
GET /api/v1/websites?aiAssistantId=<id>
```

Returns all websites for the authenticated user. Pass `aiAssistantId` to filter to a specific assistant's assigned websites.

**Does not include pages.** Use this endpoint for rendering the website list/cards. Each website object includes `_count.pages` (total page count) but not the page rows themselves — call `GET /api/v1/websites/:id` to get pages for a specific site.

---

### Get website details (with pages)

```
GET /api/v1/websites/:id
```

Returns the website record plus all discovered pages, and a computed `discoveryDurationMs` field (milliseconds between `discoveryStartedAt` and `discoveryCompletedAt`, or `null` if discovery has not completed).

Safe to call at any point during discovery — pages appear in the response as soon as they are inserted (which happens before `discoveryStatus` flips to `COMPLETED`).

---

### Update website settings

```
PATCH /api/v1/websites/:id
```

Updates `displayName`, `maxPages`, `maxDepth`, `isActive`, etc.

---

### Delete website

```
DELETE /api/v1/websites/:id
```

Removes the website, all pages, all content chunks, and all Pinecone embeddings. Irreversible.

---

### Refresh (re-crawl)

```
POST /api/v1/websites/:id/refresh
```

Triggers a full re-crawl. Enqueues a new discovery job.

---

### Page management

```
PATCH /api/v1/websites/pages/:pageId           — toggle isActive on one page
PATCH /api/v1/websites/:id/pages/bulk          — bulk activate/deactivate by pageId array
PATCH /api/v1/websites/:id/pages/deactivate-all
PATCH /api/v1/websites/:websiteId/pages/:pageId/deactivate
PATCH /api/v1/websites/:websiteId/pages/:pageId/reactivate
POST  /api/v1/websites/pages/:pageId/reprocess — retry a FAILED page
GET   /api/v1/websites/pages/:pageId/chunks    — get extracted text chunks for a page
```

---

### AI assistant assignment

```
POST   /api/v1/websites/:websiteId/assign/:aiAssistantId
DELETE /api/v1/websites/:websiteId/unassign/:aiAssistantId
GET    /api/v1/websites/ai-assistant/:aiAssistantId/assigned
```

---

## Status Fields

### `discoveryStatus` (on the website)

| Value         | Meaning                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| `PENDING`     | Website created, job not yet picked up by worker                                     |
| `DISCOVERING` | Worker is crawling the site — pages are being inserted into the DB during this phase |
| `COMPLETED`   | All pages discovered and enqueued for content extraction                             |
| `FAILED`      | Discovery errored; check `discoveryError` field                                      |

> **Note:** Pages exist in the DB while the status is still `DISCOVERING`. Do not wait for `COMPLETED` before rendering the page list — render as soon as pages are present in the `GET /websites/:id` response.

### `processingStatus` (on each page)

| Value        | Meaning                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `PENDING`    | Page discovered, waiting for content extraction worker                                         |
| `PROCESSING` | Worker is scraping and embedding this page                                                     |
| `COMPLETED`  | Content extracted, chunks created, embeddings stored in Pinecone                               |
| `FAILED`     | Extraction failed; check `processingError`. Can be retried via `POST /pages/:pageId/reprocess` |

### `syncStatus` (on the website)

| Value     | Meaning                  |
| --------- | ------------------------ |
| `PENDING` | Not yet synced           |
| `SYNCED`  | All content up to date   |
| `FAILED`  | Last sync attempt failed |

---

## Tracking Progress

Two options: WebSocket (real-time push) or polling (simpler fallback).

---

## Option A — WebSocket (real-time)

Website progress events are pushed through the existing `/messages` Socket.IO namespace. No separate connection needed if the frontend is already connected there.

### Auth — cookies work automatically

The WebSocket handshake is an HTTP upgrade request. Browsers include the `session_id` cookie automatically as long as `withCredentials: true` is set on the Socket.IO client. No explicit token passing is required.

```typescript
import { io } from "socket.io-client";

const socket = io("/messages", {
  withCredentials: true, // browser sends session_id cookie automatically
  transports: ["websocket"],
});
```

> The same `session_id` cookie that authenticates REST requests also authenticates the WebSocket connection. If the user is logged in, the connection is authenticated transparently.

### Event: `website.progress`

Listen for this event after connecting. It fires on every status transition during discovery and page processing.

```typescript
socket.on("website.progress", (payload) => {
  console.log(payload);
  // { websiteId, type, status, pagesDiscovered?, pagesProcessed?, pageId? }
});
```

**Payload shape**

| Field             | Type                                           | When present        |
| ----------------- | ---------------------------------------------- | ------------------- |
| `websiteId`       | number                                         | Always              |
| `type`            | `"discovery"` \| `"page"`                      | Always              |
| `status`          | `"DISCOVERING"` \| `"COMPLETED"` \| `"FAILED"` | Always              |
| `pagesDiscovered` | number                                         | `type: "discovery"` |
| `pagesProcessed`  | number                                         | `type: "discovery"` |
| `pageId`          | number                                         | `type: "page"`      |

### Recommended usage

```typescript
socket.on("website.progress", (payload) => {
  if (payload.websiteId !== websiteId) return;

  if (payload.type === "discovery") {
    updateDiscoveryStatus(payload.status, payload.pagesDiscovered);

    if (payload.status === "COMPLETED" || payload.status === "FAILED") {
      // Re-fetch GET /websites/:id to get the full page list
      refreshWebsite(websiteId);
    }
  }

  if (payload.type === "page") {
    // Re-fetch or update individual page status in your local state
    refreshPage(payload.pageId);
  }
});
```

> **Note:** Events signal that something changed — re-fetch from REST to get the full up-to-date object rather than trying to derive state from the event payload alone.

### Event sequence for `ENTIRE_SITE` crawl

```
POST /websites → 201 (discoveryStatus: PENDING)
  ↓
website.progress { type: "discovery", status: "DISCOVERING" }
  ↓  (pages being inserted — multiple events possible)
website.progress { type: "discovery", status: "COMPLETED", pagesDiscovered: N }
  ↓  (one event per page as processing completes)
website.progress { type: "page", status: "COMPLETED", pageId: X }
website.progress { type: "page", status: "COMPLETED", pageId: Y }
  ...
```

---

## Option B — Polling

Poll `GET /api/v1/websites/:id` to track discovery and page processing state. All status fields are available in the REST response.

### Recommended polling strategy (Option B)

```typescript
// Start polling after POST /websites returns
const poll = setInterval(async () => {
  const website = await fetch(`/api/v1/websites/${websiteId}`).then((r) =>
    r.json()
  );

  // Update page list as soon as pages appear (before COMPLETED)
  renderPageList(website.pages);

  // Stop when terminal state reached
  if (
    website.discoveryStatus === "COMPLETED" ||
    website.discoveryStatus === "FAILED"
  ) {
    clearInterval(poll);
  }
}, 3000); // every 3 seconds
```

### Suggested UI states by `discoveryStatus`

| `discoveryStatus` | Suggested UI                                                    |
| ----------------- | --------------------------------------------------------------- |
| `PENDING`         | Spinner, "Queued…"                                              |
| `DISCOVERING`     | Spinner, "Scanning website…" — render any pages that appear     |
| `COMPLETED`       | Show full page list; each page shows its own `processingStatus` |
| `FAILED`          | Show error state on the website card; check `discoveryError`    |

### Suggested UI states by page `processingStatus`

| `processingStatus` | Suggested UI                                                   |
| ------------------ | -------------------------------------------------------------- |
| `PENDING`          | Grey badge, "Waiting…"                                         |
| `PROCESSING`       | Spinner badge                                                  |
| `COMPLETED`        | Show `wordCount`, `chunkCount`                                 |
| `FAILED`           | Error badge + "Retry" button (`POST /pages/:pageId/reprocess`) |

---

## Page Object Fields

Fields worth rendering:

| Field              | Notes                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| `url`              | Page URL                                                                    |
| `title`            | Extracted `<title>` — may be empty string if not found                      |
| `depth`            | 0 = base URL, 1 = directly linked, etc.                                     |
| `processingStatus` | `PENDING` / `PROCESSING` / `COMPLETED` / `FAILED`                           |
| `isActive`         | Whether this page is included in AI responses. Toggle with PATCH endpoints. |
| `wordCount`        | Available once `processingStatus: COMPLETED`                                |
| `characterCount`   | Available once `processingStatus: COMPLETED`                                |
| `chunkCount`       | Number of text chunks indexed in Pinecone                                   |
| `lastCheckedAt`    | When the page was last scraped                                              |
| `processingError`  | Error message if `processingStatus: FAILED`                                 |

---

## Error Responses

| Status | When                                                   |
| ------ | ------------------------------------------------------ |
| 400    | Invalid URL, duplicate website, malformed body         |
| 404    | Website or page not found (or belongs to another user) |
| 409    | Website with this URL already exists                   |

Error shape:

```json
{
  "statusCode": 400,
  "message": "Website already exists",
  "error": "Bad Request"
}
```

---
sidebar_position: 5
---

# Transactional Emails

How transactional emails work in the UnifiedBeez backend, and how to add or change them.

## TL;DR

- Every email is a single `.hbs` file in [`src/email/templates/partials/`](https://github.com/unifiedbeez/unifiedbeez/tree/main/src/email/templates/partials).
- The file has frontmatter (subject / preheader / title), the HTML body, a `@@text@@` marker, then the plain-text body.
- Every email is wrapped in [`layout.hbs`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/templates/layout.hbs) which owns the logo, header, footer, dark-mode CSS, and social links. **Change the logo → edit that one file.**
- [`TemplateRendererService`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/template-renderer.service.ts) auto-discovers every `.hbs` in `partials/` at boot — no registry file.
- [`SystemEmailService.sendTemplatedEmail`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/system-email.service.ts) renders the partial locally and sends via `ses.sendEmail`. Templates without a local partial fall through to whatever SES has stored (legacy path).

## File format

```handlebars
---
title: Verify Your Email
subject: Verify Your Email - UnifiedBeez
preheader: Your UnifiedBeez verification code is {{verificationCode}}.
---
<tr>
  <td>
    <h1>Welcome, {{userName}}</h1>
    <p>Your code: {{verificationCode}}</p>
  </td>
</tr>

@@text@@
Welcome, {{userName}}

Your code: {{verificationCode}}

© {{currentYear}} UnifiedBeez Ltd.
```

Rules:

- Frontmatter is between two lines that are exactly `---`.
- Keys `title`, `subject`, `preheader` are **all required**. Each is a Handlebars template itself, so `subject: Your role at {{organizationName}} has been updated` is valid.
- HTML body is `<tr>...</tr>` rows (no wrapping `<table>`, `<html>`, `<body>` — the layout provides those).
- `@@text@@` on its own line separates HTML from plain-text. If absent, text is derived by stripping HTML tags (coarse).
- `{{userName}}`, `{{resetUrl}}`, etc. get substituted from the data object the sending code passes.
- `{{currentYear}}` and `{{companyName}}` are injected automatically by [`sendTemplatedEmail`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/system-email.service.ts) — always available.

## The shared layout

[`src/email/templates/layout.hbs`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/templates/layout.hbs) is the only place that owns:

- DOCTYPE, `<html>`, `<head>`, `<body>`
- Font faces (SK Modernist from Supabase CDN)
- Dark-mode CSS
- Mobile responsive rules
- Header logo card
- Footer (brand tagline, support email, website, privacy/terms links)
- Email container wrapper

**If you change the logo, footer links, or any shared chrome, this is the only file to edit. All 38 emails update.**

Inside the layout, `{{{content}}}` is where the partial's HTML is injected. `{{title}}` sets the `<title>` tag. `{{preheader}}` sets the hidden inbox-preview text.

## How sending works

```
caller (e.g. auth.service.ts)
    ↓
systemEmailService.sendWelcomeEmail(email, userName)
    ↓
sendTemplatedEmail("welcome-email", { userName, dashboardUrl, ... })
    ↓
if (templateRenderer.has("welcome-email"))        [local path — preferred]
  rendered = render layout + partial + data
  ses.sendEmail({ Subject, Html, Text })
else                                              [legacy SES fallback]
  ses.sendTemplatedEmail({ Template: "welcome-email", TemplateData })
```

The fallback exists so templates without a local partial keep working from whatever's in SES. Every new email should have a local partial — if you add one, the fallback path is never hit.

## Adding a new email

1. Create `src/email/templates/partials/<template-name>.hbs` with the frontmatter + body + `@@text@@` + text body.
2. Add a `sendX()` wrapper to [`SystemEmailService`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/system-email.service.ts) that calls `this.sendTemplatedEmail("<template-name>", { ...data })`.
3. Add a fixture for `<template-name>` in [`template-renderer.service.spec.ts`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/template-renderer.service.spec.ts) — include every variable the template uses.
4. (Optional) Add a test endpoint to [`system-email.controller.ts`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/system-email.controller.ts) under `POST /system-email/test/<template-name>` for manual testing.
5. Run `npx jest --testPathPattern="template-renderer.service.spec"` — specs catch typos like `{{userNAME}}` vs `{{userName}}`.
6. Rebuild (`yarn build`) so the `.hbs` file gets copied into `dist/`. Dev-server watch mode *usually* picks it up but can miss edits after rename/delete — restart when in doubt.

That's it. No registry to update, no meta file.

## Changing an existing email

- **Copy, links, layout inside the email**: edit the partial.
- **Logo, header card, footer, shared chrome**: edit `layout.hbs`.
- **Subject line or preheader**: edit the frontmatter of the partial.
- **Variables**: update (a) the partial, (b) the `sendX()` wrapper's data object, (c) the spec fixture. All three must agree.

After any change, run the spec:

```bash
npx jest --testPathPattern="template-renderer.service.spec"
```

The spec asserts that every `{{variable}}` in every template resolves — no leftover `{{x}}` in the output.

## Testing an email for real

Every partial with a local render has a test endpoint:

```bash
curl -X POST https://api.unifiedbeez.com/api/v1/system-email/test/<template-name> \
  -H "Cookie: session=<your-session>" \
  -H "Content-Type: application/json" \
  -d '{ "email": "you@example.com", "userName": "Ada", ... }'
```

See the test endpoints in [`system-email.controller.ts`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/system-email.controller.ts) for each email's expected body.

## Common gotchas

### All emails suddenly show the old logo / wrong chrome

The `.hbs` files didn't make it into `dist/`. `TemplateRendererService` fails to load anything at boot, `has()` returns false for everything, and every send falls through to the old SES templates. Fix: rebuild (`NODE_OPTIONS='--max-old-space-size=8192' yarn build`) and restart the dev server. `nest-cli.json` has `watchAssets: true` but it's unreliable after bulk file renames/deletes.

### Handlebars escapes `=` in URLs

A link like `href="{{url}}"` where `url = "https://app?t=abc"` renders as `href="https://app?t&#x3D;abc"`. Email clients handle the entity correctly, but if you're diff-checking output against a raw URL, this is a false positive. Use `{{{url}}}` (triple-brace) only if an email client misbehaves — normally unnecessary.

### Send methods that bypass `sendTemplatedEmail`

A few methods used to call `ses.sendTemplatedEmail` directly, skipping our router — so they showed old chrome even with a working local renderer. All known offenders have been rerouted, but if you're writing a new `sendX()`, always go through `sendTemplatedEmail`.

### Attachments

`ses.sendTemplatedEmail` doesn't support attachments. For emails with an attached file (e.g. webchat-installation), `sendTemplatedEmail` renders the partial locally, then wraps the HTML + attachment in multipart MIME and uses `ses.sendRawEmail`. You don't need to do anything special — just pass the `attachments` argument. This only works if the template has a local partial; sending with attachments against a template that has no local partial throws.

## File map

- [`src/email/templates/layout.hbs`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/templates/layout.hbs) — shared chrome (logo, footer, CSS)
- [`src/email/templates/partials/*.hbs`](https://github.com/unifiedbeez/unifiedbeez/tree/main/src/email/templates/partials) — one file per email, 38 currently
- [`src/email/template-renderer.service.ts`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/template-renderer.service.ts) — parses frontmatter, auto-discovers partials, renders
- [`src/email/system-email.service.ts`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/system-email.service.ts) — every `sendX()` wrapper
- [`src/email/system-email.controller.ts`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/system-email.controller.ts) — test endpoints under `POST /system-email/test/<name>`
- [`src/email/template-renderer.service.spec.ts`](https://github.com/unifiedbeez/unifiedbeez/blob/main/src/email/template-renderer.service.spec.ts) — fixtures + contract tests

## Design source

Source HTML designs come from the [`be-email-templates`](https://github.com/unifiedbeez/be-email-templates) repo (handover from design/frontend). When a new design lands there, the process is:

1. Open the new HTML file from `be-email-templates/email-templates/templates/<name>.html`.
2. Find the content rows between the header-logo card and the spacer-before-footer (usually between `<!-- Header with Logo -->` and `<!-- Spacer -->` comment markers).
3. Replace the body of our existing partial with those rows.
4. Convert SCREAMING_SNAKE variables (`{{USER_NAME}}`) to the camelCase our service passes (`{{userName}}`). See the fixture for what the variable names should be.
5. Check the logo URL — the layout always uses `logo-full-new.png`, individual partials shouldn't reference a logo directly.
6. Re-run the spec.

We do not use the shared layout from `be-email-templates/email-templates/templates/base-template.html` — our own `layout.hbs` is authoritative.

# Channel Icon Cross-Reference: API Documentation

## Overview

Two endpoints expose channel data in different shapes. To render icons on the plan switch preview UI, the frontend uses `channelSlug` from the preview response as a direct key into the icon map — the same slug keys used by the `GET /channels/available/all` response.

---

## Endpoint 1: `GET /channels/available/all`

Returns the full channel catalog with access metadata per channel.

### Relevant Response Structure

```json
{
  "userPlan": "BUSINESS",
  "categories": {
    "communication": {
      "channels": [
        {
          "id": 1,
          "name": "gmail",
          "displayName": "Gmail",
          "channelType": "EMAIL",
          "category": "COMMUNICATION",
          "access": {
            "allowed": true,
            "blockedBy": null,
            "requiredPlans": null,
            "requiredAddon": null,
            "reason": null
          }
        },
        {
          "id": 2,
          "name": "instagram_direct",
          "displayName": "Instagram Direct",
          "channelType": "FACEBOOK_MESSENGER",
          "category": "COMMUNICATION",
          "access": {
            "allowed": false,
            "blockedBy": "plan",
            "requiredPlans": ["PREMIUM", "ORGANISATION"],
            "requiredAddon": null,
            "reason": "Requires PREMIUM or ORGANISATION plan"
          }
        }
      ],
      "limits": {
        "current": 2,
        "max": 5,
        "unlimited": false,
        "remaining": 3
      }
    }
  }
}
```

### Key Fields

| Field                  | Type                                  | Description                                                                                     |
| ---------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `name`                 | `string`                              | Unique slug — use as icon map key (`"gmail"`, `"instagram_direct"`, `"whatsapp"`)               |
| `displayName`          | `string`                              | Human-readable name for display                                                                 |
| `channelType`          | `string`                              | Enum value — **not unique per channel**, multiple channels share the same type (see note below) |
| `access.allowed`       | `boolean`                             | Whether the user can access this channel                                                        |
| `access.blockedBy`     | `"plan" \| "addon" \| "both" \| null` | What is blocking access                                                                         |
| `access.requiredPlans` | `string[] \| null`                    | Plans that would unlock this channel                                                            |
| `access.requiredAddon` | `string \| null`                      | Addon required to unlock this channel                                                           |

> **Why not use `channelType` as an icon key:** Multiple channels share the same enum value. `gmail`, `outlook`, and `custom_email` all have `channelType: "EMAIL"`. `facebook_messenger` and `instagram_direct` share `FACEBOOK_MESSENGER`. `twilio_sms` and `twilio_voice` share `SMS`. The `name` slug is always unique.

---

## Endpoint 2: `GET /plan/switch-preview/:planType`

Returns what would happen to the user's connected channels when switching plans.

### Relevant Response Structure

```json
{
  "currentPlan": "PREMIUM",
  "targetPlan": "BUSINESS",
  "isUpgrade": false,
  "affectedChannels": {
    "planBlocked": [
      {
        "channelId": 12,
        "channelSlug": "hubspot",
        "channelName": "My HubSpot",
        "channelType": "ECOMMERCE",
        "displayName": "HubSpot",
        "isConnected": true,
        "reason": "Requires PREMIUM or ORGANISATION plan"
      }
    ],
    "addonBlocked": [
      {
        "channelId": 7,
        "channelSlug": "google_calendar",
        "channelName": "Work Calendar",
        "channelType": "CALENDAR",
        "displayName": "Google Calendar",
        "isConnected": true,
        "requiredAddon": "CRM_CALENDAR_SYNC",
        "requiresAddonPurchase": true,
        "reason": "Requires CRM CALENDAR SYNC addon purchase to maintain access"
      }
    ],
    "quantityExceeded": {
      "current": 4,
      "newMax": 2,
      "excess": 2,
      "channels": [
        {
          "channelId": 3,
          "channelSlug": "whatsapp",
          "channelName": "Support WhatsApp",
          "isConnected": true
        },
        {
          "channelId": 4,
          "channelSlug": "whatsapp",
          "channelName": "Sales WhatsApp",
          "isConnected": false
        }
      ]
    },
    "totalAffected": 5
  }
}
```

### Key Fields

| Field                   | Type      | Description                                                                   |
| ----------------------- | --------- | ----------------------------------------------------------------------------- |
| `channelSlug`           | `string`  | Matches `name` from `/channels/available/all` — use directly as icon map key  |
| `channelName`           | `string`  | User-defined name for this connected instance (may differ from `displayName`) |
| `channelType`           | `string`  | Enum value — present but not recommended as icon key                          |
| `displayName`           | `string`  | Human-readable name from the channel catalog                                  |
| `isConnected`           | `boolean` | Whether the channel is actively connected (vs. just selected)                 |
| `requiredAddon`         | `string`  | Addon enum value the user needs to purchase (`addonBlocked` only)             |
| `requiresAddonPurchase` | `boolean` | Whether the addon can be purchased on the target plan (`addonBlocked` only)   |

---

## Cross-Reference Pattern

Since `channelSlug` in the preview response directly matches `name` in the `available/all` response, icon resolution requires no lookup:

```ts
iconMap[affectedChannel.channelSlug];
```

### Icon Map Shape (example)

```ts
const channelIconMap = {
  whatsapp: WhatsAppIcon,
  gmail: GmailIcon,
  outlook: OutlookIcon,
  custom_email: EmailIcon,
  facebook_messenger: FacebookIcon,
  instagram_direct: InstagramIcon,
  telegram: TelegramIcon,
  webchat: WebchatIcon,
  twilio_sms: SmsIcon,
  twilio_voice: VoiceIcon,
  google_calendar: GoogleCalendarIcon,
  microsoft_calendar: MicrosoftCalendarIcon,
  calendly: CalendlyIcon,
  zoom: ZoomIcon,
  shopify: ShopifyIcon,
  paypal: PaypalIcon,
  stripe: StripeIcon,
};
```

### Rendering Affected Channels (example)

```ts
// planBlocked, addonBlocked, and quantityExceeded.channels
// all carry channelSlug — same pattern for each

const icon = channelIconMap[affectedChannel.channelSlug];

// channelName is the user-defined label (e.g. "My Work Calendar")
// displayName is the catalog name (e.g. "Google Calendar")
// Use displayName alongside the icon, channelName as the subtitle
```

---

## Field Comparison Summary

| Concern           | `GET /channels/available/all` | `GET /plan/switch-preview/:planType`                                             |
| ----------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| Icon key          | `channel.name`                | `affectedChannel.channelSlug`                                                    |
| Display label     | `channel.displayName`         | `affectedChannel.displayName`                                                    |
| User label        | N/A                           | `affectedChannel.channelName`                                                    |
| Channel type enum | `channel.channelType`         | `affectedChannel.channelType`                                                    |
| Access blocked by | `channel.access.blockedBy`    | Implicit from array position (`planBlocked`, `addonBlocked`, `quantityExceeded`) |

---

## Notes

- `quantityExceeded.channels` only ever contains WhatsApp channels since it is the only channel type with a quantity limit. All entries will have `channelSlug: "whatsapp"`.
- `channelName` is the user-defined label and should be shown as a subtitle. Use `displayName` as the primary label next to the icon.
- A channel in `addonBlocked` with `requiresAddonPurchase: true` means the user can buy the addon on the target plan to retain access — the UI should surface an upgrade path rather than treating it as a hard block.

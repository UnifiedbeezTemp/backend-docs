# Get All Channels with Access Metadata - API Documentation

## Endpoint

```
GET /channels/available/all
```

## Description

Returns all active channels with detailed access information for the current user. Unlike `/channels/available` which filters out inaccessible channels, this endpoint shows everything and indicates why certain channels are blocked.

## Authentication

Requires authentication via session cookie `credentials: include` header.

## Access Status Logic

### `access.allowed = true`

User can select and connect this channel. No upgrade needed.

### `access.allowed = false`

User cannot access this channel. Check `blockedBy` field:

**`blockedBy: "plan"`**

- User's plan is insufficient
- `requiredPlans`: Array of plans that unlock this channel
- Show: "Requires [BUSINESS] plan" or "Requires [BUSINESS or PREMIUM] plan"

**`blockedBy: "addon"`**

- User has correct plan but missing addon
- `requiredAddon`: Specific addon needed (e.g., "CRM_CALENDAR_SYNC")
- Show: "Requires CRM Calendar Sync addon"

**`blockedBy: "both"`**

- User needs both plan upgrade AND addon
- `requiredPlans` + `requiredAddon` both populated
- Show: "Requires [BUSINESS] plan and CRM Calendar Sync addon"

## Communication Channel Limits

For `communication` category only, the `limits` object contains:

```typescript
{
  current: 2,        // Channels user has selected
  max: 5,           // Maximum allowed (null if unlimited)
  unlimited: false,  // Whether user has unlimited channels
  remaining: 3      // Slots available (null if unlimited)
}
```

## Example Response

```json
{
  "userPlan": "INDIVIDUAL",
  "categories": {
    "communication": {
      "channels": [
        {
          "id": 1,
          "name": "whatsapp",
          "displayName": "WhatsApp Business",
          "description": "Connect WhatsApp Business API for messaging",
          "category": "COMMUNICATION",
          "channelType": "WHATSAPP",
          "requiresPlan": ["BUSINESS", "PREMIUM", "ORGANISATION"],
          "requiresAddon": null,
          "access": {
            "allowed": false,
            "blockedBy": "plan",
            "requiredPlans": ["BUSINESS", "PREMIUM", "ORGANISATION"],
            "requiredAddon": null,
            "reason": "Requires BUSINESS or PREMIUM or ORGANISATION plan"
          }
        },
        {
          "id": 3,
          "name": "facebook_messenger",
          "displayName": "Facebook Messenger",
          "description": "Connect Facebook Page for messaging",
          "category": "COMMUNICATION",
          "channelType": "FACEBOOK_MESSENGER",
          "requiresPlan": ["INDIVIDUAL", "BUSINESS", "PREMIUM", "ORGANISATION"],
          "requiresAddon": null,
          "access": {
            "allowed": true,
            "blockedBy": null,
            "requiredPlans": null,
            "requiredAddon": null,
            "reason": null
          }
        }
      ],
      "limits": {
        "current": 2,
        "max": 5,
        "unlimited": false,
        "remaining": 3
      }
    },
    "crmCalendar": {
      "channels": [
        {
          "id": 11,
          "name": "google_calendar",
          "displayName": "Google Calendar",
          "description": "Sync meetings and availability",
          "category": "CRM_CALENDAR",
          "channelType": "CALENDAR",
          "requiresPlan": ["BUSINESS", "PREMIUM", "ORGANISATION"],
          "requiresAddon": "CRM_CALENDAR_SYNC",
          "access": {
            "allowed": false,
            "blockedBy": "both",
            "requiredPlans": ["BUSINESS", "PREMIUM", "ORGANISATION"],
            "requiredAddon": "CRM_CALENDAR_SYNC",
            "reason": "Requires BUSINESS or PREMIUM or ORGANISATION plan and CRM_CALENDAR_SYNC addon"
          }
        }
      ],
      "limits": {
        "message": "Feature-based access"
      }
    }
  }
}
```

## Frontend Implementation Guide

### 1. Display Channel Cards

```typescript
channels.map((channel) => {
  const isAccessible = channel.access.allowed;
  const isLocked = !isAccessible;

  return (
    <ChannelCard
      channel={channel}
      locked={isLocked}
      lockReason={channel.access.reason}
      onUpgrade={() => handleUpgrade(channel.access)}
    />
  );
});
```

### 2. Upgrade CTA Logic

```typescript
function getUpgradeCTA(access: AccessMetadata) {
  if (access.blockedBy === "plan") {
    return {
      text: "Upgrade Plan",
      action: "SHOW_PLAN_MODAL",
      plans: access.requiredPlans,
    };
  }

  if (access.blockedBy === "addon") {
    return {
      text: "Add Feature",
      action: "SHOW_ADDON_MODAL",
      addon: access.requiredAddon,
    };
  }

  if (access.blockedBy === "both") {
    return {
      text: "Upgrade Required",
      action: "SHOW_UPGRADE_MODAL",
      plans: access.requiredPlans,
      addon: access.requiredAddon,
    };
  }
}
```

### 3. Channel Limit Warning

```typescript
const { limits } = categories.communication;

if (!limits.unlimited && limits.remaining === 0) {
  showWarning("Channel limit reached. Upgrade to add more channels.");
}

if (!limits.unlimited && limits.remaining <= 2) {
  showInfo(`${limits.remaining} channel slots remaining`);
}
```

### 4. Filter/Sort Channels

```typescript
// Show accessible first
const sorted = channels.sort(
  (a, b) => Number(b.access.allowed) - Number(a.access.allowed)
);

// Group by access status
const accessible = channels.filter((c) => c.access.allowed);
const locked = channels.filter((c) => !c.access.allowed);
```

## Use Cases

1. **Channel selection page**: Show all channels with visual indicators (lock icon, upgrade badge)
2. **Upgrade prompts**: Direct users to specific plan or addon based on `blockedBy`
3. **Feature discovery**: Let users see what they're missing without hiding it
4. **Limit tracking**: Show progress bars for communication channel usage
5. **Smart upselling**: Target messaging based on which channels user wants but can't access

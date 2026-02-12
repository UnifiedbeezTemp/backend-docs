# Addon System - Frontend Integration Guide

## Core Concepts

**Addon Types:**

- **Quantifiable**: EXTRA_SEAT, EXTRA_AI_ASSISTANT, TWILIO_MESSAGE_PACK (have quantities)
- **Feature**: CRM_CALENDAR_SYNC, ECOMMERCE_PACK (binary - you have it or don't)
- **Special**: MULTI_LANGUAGE_AI (one instance per language)

**Addon States:**

- `active`: Currently usable
- `scheduledForCancellation`: Active until `expiresAt`, then deactivates
- Plan limits apply to `active` count only

---

## API Endpoints

### Get Available Addons

```http
GET /addon/available
```

**Response:**

```json
{
  "addons": [
    {
      "id": 1,
      "type": "EXTRA_SEAT",
      "name": "Extra Seat",
      "priceEur": 700,
      "currentQuantity": 3,
      "basePlanAllowance": 5,
      "maxAllowed": 10,
      "remainingPurchasable": 2,
      "isIncludedInPlan": false
    }
  ]
}
```

### Purchase Addon

```http
POST /addon/purchase

{
  "addonType": "EXTRA_SEAT",
  "quantity": 2
}
```

**MULTI_LANGUAGE_AI requires pre-selection:**

```http
# 1. Select languages first
PATCH /addon/multi-language/preferences
{ "languages": ["spanish", "french"] }

# 2. Purchase matching quantity
POST /addon/purchase
{ "addonType": "MULTI_LANGUAGE_AI", "quantity": 2 }
```

### Get Purchased Addons

```http
GET /addon/purchased
```

**Response:**

```json
{
  "addons": [
    {
      "type": "EXTRA_SEAT",
      "name": "Extra Seat",
      "quantity": 5,
      "active": 3,
      "scheduledForCancellation": 2,
      "priceEur": 700
    },
    {
      "type": "MULTI_LANGUAGE_AI",
      "quantity": 3,
      "active": 2,
      "scheduledForCancellation": 1,
      "instances": [
        {
          "id": 4,
          "language": "spanish",
          "scheduledForCancellation": false,
          "expiresAt": "2026-03-14T11:32:23.700Z"
        },
        {
          "id": 6,
          "language": "french",
          "scheduledForCancellation": true,
          "expiresAt": "2026-03-14T11:35:10.858Z"
        }
      ]
    }
  ]
}
```

### Cancel Addon

```http
# For MULTI_LANGUAGE_AI (specific instance)
DELETE /addon/cancel/MULTI_LANGUAGE_AI
{ "userAddonId": 4 }

# For other addons (by quantity)
DELETE /addon/cancel/EXTRA_SEAT
{ "quantity": 2 }

# Cancel all
DELETE /addon/cancel/EXTRA_SEAT
```

### Immediate Cancel (Admin)

```http
DELETE /addon/cancel-immediate/EXTRA_SEAT
{ "quantity": 1 }
```

Returns prorated refund amount.

### Batch Purchase

```http
POST /addon/purchase-batch

{
  "purchases": [
    { "addonType": "EXTRA_SEAT", "quantity": 2 },
    { "addonType": "CRM_CALENDAR_SYNC", "quantity": 1 }
  ]
}
```

### Check Free Allowance

```http
GET /addon/free-addons/CRM_CALENDAR_SYNC
```

### Language-Specific Endpoints

```http
GET /addon/available-languages
GET /addon/multi-language/preferences
PATCH /addon/multi-language/preferences
```

---

## Response Fields

**All Addons:**

- `quantity`: Total count
- `active`: Currently active (not scheduled for cancellation)
- `scheduledForCancellation`: Count cancelling at end of billing cycle
- `priceEur`: Price in cents (1000 = €10.00)

**MULTI_LANGUAGE_AI Only:**

- `instances[]`: Array of individual addon records
- `instances[].id`: Use for cancellation
- `instances[].language`: Language code
- `instances[].scheduledForCancellation`: Boolean

---

## Validation Rules

**Purchase Limits:**

- Active count + new quantity ≤ plan max
- Scheduled cancellations don't block new purchases
- Example: Plan allows 10 seats. Have 5 active, 3 scheduled. Can purchase 5 more.

**MULTI_LANGUAGE_AI:**

- Must select languages before purchase
- `languages.length === quantity`
- Cannot modify languages after purchase (must cancel and repurchase)
- Each addon = 1 language

**Feature Addons:**

- If included in plan, cannot purchase
- Max quantity usually 1

---

## Error Handling

**Common Errors:**

```json
// 400 - Plan doesn't support addons
{ "message": "Individual plan does not support addon purchases" }

// 400 - Exceeds limit
{ "message": "Cannot exceed 10 total seats for BUSINESS plan..." }

// 400 - Language mismatch
{ "message": "You have selected 2 language(s) but are purchasing 1 addon(s)" }

// 400 - Already included
{ "message": "CRM/Calendar Sync is already included in your PREMIUM plan" }

// 400 - Modify locked languages
{ "message": "Language preferences cannot be modified after purchase..." }
```

---

## UI Patterns

### Display Purchased Addons

```tsx
{
  addon.scheduledForCancellation > 0 && (
    <Badge variant="warning">
      {addon.scheduledForCancellation} cancelling on{" "}
      {formatDate(firstExpiryDate)}
    </Badge>
  );
}
<Text>
  {addon.active} active / {addon.quantity} total
</Text>;
```

### MULTI_LANGUAGE_AI Instance List

```tsx
{
  addon.instances.map((instance) => (
    <Row key={instance.id}>
      <Language>{instance.language}</Language>
      {instance.scheduledForCancellation ? (
        <Badge>Expires {formatDate(instance.expiresAt)}</Badge>
      ) : (
        <CancelButton onClick={() => cancel(instance.id)} />
      )}
    </Row>
  ));
}
```

### Purchase Flow

```tsx
// 1. Check availability
const { maxAllowed, remainingPurchasable } = await getAvailable(addonType);

// 2. For MULTI_LANGUAGE_AI
if (addonType === "MULTI_LANGUAGE_AI") {
  await updatePreferences({ languages: selectedLanguages });
}

// 3. Purchase
await purchase({ addonType, quantity });
```

### Quantity Limits

```tsx
const canPurchase = addon.remainingPurchasable > 0;
const maxQuantity = addon.remainingPurchasable;

<Input max={maxQuantity} disabled={!canPurchase} />;
```

---

## State Management

**Track locally:**

- Selected languages (for MULTI_LANGUAGE_AI)
- Purchase quantities
- Cancellation confirmations

**Refetch after:**

- Purchase success
- Cancellation success
- Plan change

**Optimistic updates:**

- Show loading state during purchase
- Don't optimistically update - wait for API confirmation
- Scheduled cancellations remain visible until expiry

---

## Plan Integration

**On plan upgrade/downgrade:**

- Addons transfer if within new limits
- Excess addons get refunded
- Language preferences may be truncated
- Refetch `/addon/purchased` after plan change

**Check plan features:**

```tsx
if (addon.isIncludedInPlan) {
  return <Badge>Included in your plan</Badge>;
}
```

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

**Billing Interval:**

Addons inherit the billing interval of the user's **active Stripe subscription** — there is no per-addon interval selection. A user on a yearly subscription is always billed yearly for all addons (monthly price × 12, charged upfront). A user on a monthly subscription is billed monthly.

```ts
type BillingInterval = "MONTHLY" | "YEARLY";
```

> **Note:** The addon billing interval is derived from the actual Stripe subscription, not from `user.planBillingInterval`. These can temporarily differ when a monthly → yearly switch is scheduled but not yet applied (the switch takes effect at the end of the current monthly period). During that window, addon purchases use monthly pricing to match the live subscription.

The `GET /addon/available` response includes a top-level `billingInterval` field and per-addon `effectivePriceEur` — use these directly rather than reading from the user profile separately.

---

## API Endpoints

### Get Available Addons

```http
GET /addon/available
```

**Response:**

```json
{
  "billingInterval": "YEARLY",
  "addons": [
    {
      "id": 1,
      "type": "EXTRA_SEAT",
      "name": "Extra Seat",
      "priceEur": 700,
      "yearlyPriceEur": 8400,
      "effectivePriceEur": 8400,
      "currentQuantity": 3,
      "basePlanAllowance": 5,
      "maxAllowed": 10,
      "remainingPurchasable": 2,
      "isIncludedInPlan": false
    }
  ]
}
```

**Price fields:**

- `priceEur` — monthly base price in pence, always present (700 = £7.00/month)
- `yearlyPriceEur` — always `priceEur × 12`, present regardless of billing interval, useful for comparison UIs
- `effectivePriceEur` — the amount that will actually be charged: equals `yearlyPriceEur` on yearly plans, `priceEur` on monthly plans. **Use this as the primary display price.**
- `billingInterval` — top-level field reflecting the user's current billing interval; use this to label prices and drive UI state without a separate profile call

### Purchase Addon

```http
POST /addon/purchase

{
  "addonType": "EXTRA_SEAT",
  "quantity": 2
}
```

The backend automatically determines the billing interval from the user's **active Stripe subscription** (not `user.planBillingInterval`) and uses it to select the Stripe price and set the addon expiry (30 days for monthly, 365 days for yearly). No `billingInterval` field is needed in the request.

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
      "priceEur": 700,
      "billingInterval": "YEARLY"
    },
    {
      "type": "MULTI_LANGUAGE_AI",
      "quantity": 3,
      "active": 2,
      "scheduledForCancellation": 1,
      "billingInterval": "MONTHLY",
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

Returns a prorated refund amount. The refund calculation is billing-interval-aware:

- Monthly: prorated over 30 days
- Yearly: prorated over 365 days

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

**`GET /addon/available` (available addons):**

- `billingInterval` — top-level, user's current plan billing interval
- `priceEur` — monthly base price in pence, always present
- `yearlyPriceEur` — `priceEur × 12`, always present
- `effectivePriceEur` — actual charge amount based on billing interval; use this for the primary price display
- `currentQuantity`, `basePlanAllowance`, `maxAllowed`, `remainingPurchasable`, `isIncludedInPlan`

**`GET /addon/purchased` (purchased addons):**

- `quantity`: Total count
- `active`: Currently active (not scheduled for cancellation)
- `scheduledForCancellation`: Count cancelling at end of billing cycle
- `priceEur`: Monthly base price in pence
- `billingInterval`: `"MONTHLY"` or `"YEARLY"` — interval at time of purchase

**MULTI_LANGUAGE_AI Only:**

- `instances[]`: Array of individual addon records
- `instances[].id`: Use for cancellation
- `instances[].language`: Language code
- `instances[].scheduledForCancellation`: Boolean

---

## Displaying Addon Prices

Use `effectivePriceEur` and `billingInterval` from the `GET /addon/available` response directly — no manual calculation needed:

```tsx
function formatAddonPrice(
  addon: AvailableAddon,
  billingInterval: "MONTHLY" | "YEARLY"
) {
  const effective = addon.effectivePriceEur / 100;
  if (billingInterval === "YEARLY") {
    const monthly = addon.priceEur / 100;
    return {
      label: `£${effective.toFixed(2)}/year`,
      subLabel: `£${monthly.toFixed(2)}/mo equivalent`,
    };
  }
  return {
    label: `£${effective.toFixed(2)}/month`,
    subLabel: null,
  };
}
```

Example display:

```tsx
// billingInterval and effectivePriceEur come directly from GET /addon/available
const { billingInterval, addons } = await getAvailableAddons();

addons.map((addon) => {
  const { label, subLabel } = formatAddonPrice(addon, billingInterval);
  return (
    <PriceTag>
      {label}
      {subLabel && <SmallText>{subLabel}</SmallText>}
    </PriceTag>
  );
});
```

For comparison UIs showing both prices side by side:

```tsx
<MonthlyPrice>{(addon.priceEur / 100).toFixed(2)}/mo</MonthlyPrice>
<YearlyPrice>{(addon.yearlyPriceEur / 100).toFixed(2)}/yr</YearlyPrice>
```

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

### Show Billing Interval on Purchased Addon

```tsx
<Badge variant={addon.billingInterval === "YEARLY" ? "purple" : "default"}>
  {addon.billingInterval === "YEARLY" ? "Yearly" : "Monthly"}
</Badge>
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
// 1. Fetch availability — includes billingInterval and pricing
const { addons, billingInterval } = await getAvailableAddons();
const addon = addons.find((a) => a.type === addonType);

// 2. Show the correct price to the user
const { label } = formatAddonPrice(addon, billingInterval);

// 3. For MULTI_LANGUAGE_AI
if (addonType === "MULTI_LANGUAGE_AI") {
  await updatePreferences({ languages: selectedLanguages });
}

// 4. Purchase (billing interval is automatic — derived from user's plan on the backend)
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

**On billing interval change (monthly → yearly):**

- Existing monthly addons remain until their `expiresAt`
- New addon purchases after the switch will use yearly pricing
- Refetch `/addon/purchased` after the yearly subscription activates

**Check plan features:**

```tsx
if (addon.isIncludedInPlan) {
  return <Badge>Included in your plan</Badge>;
}
```

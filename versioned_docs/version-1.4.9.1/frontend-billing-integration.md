# Frontend Billing Integration Guide

This document covers everything the frontend needs to implement trial setup, subscription billing, yearly billing, and payment method management.

---

## Overview

Billing is built on Stripe. The backend owns all Stripe logic — the frontend only interacts with two things:

1. **Stripe.js / Stripe Elements** — to securely collect card details in the browser (card numbers never touch your servers)
2. **Backend API endpoints** — to set up intents, attach/update cards, and read billing state

There are two distinct flows:

| Flow            | When                              | Endpoints                                                                                         |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Trial setup** | New user, no card on file         | `POST /auth/setup/trial` → _(Stripe Elements)_ → `POST /auth/payment/attach`                      |
| **Card update** | Existing user changing saved card | `POST /payment/create-setup-intent` → _(Stripe Elements)_ → `POST /payment/update-payment-method` |

---

## Billing Intervals

Every plan and addon supports **monthly** and **yearly** billing. Yearly billing is charged as a single upfront payment for the full year.

| Plan         | Monthly | Yearly    |
| ------------ | ------- | --------- |
| Individual   | £19/mo  | £190/yr   |
| Business     | £99/mo  | £1,000/yr |
| Premium      | £299/mo | £3,050/yr |
| Organisation | £499/mo | £5,090/yr |

**Key rules:**

- Addons inherit the user's billing interval — a yearly-plan user pays yearly prices for all addons (monthly × 12, no additional discount).
- Yearly → Monthly downgrade is **blocked** while on a yearly plan. The user must wait until their yearly period ends.
- Monthly → Yearly switch on an active subscription schedules the switch: the monthly plan runs to the end of its current period, then the yearly subscription starts automatically.
- Trial plans can be started on either interval. The 30-day trial behaviour is the same regardless.

The `billingInterval` field is optional on all endpoints and defaults to `MONTHLY` if omitted.

```ts
type BillingInterval = "MONTHLY" | "YEARLY";
```

---

## Billing Details

Both card collection flows require billing details to be passed alongside the card. These are stored directly on the Stripe PaymentMethod (card data never touches your backend) and synced to the Stripe Customer record by the backend after attach.

### Fields

| Field           | Stripe key                            | Notes                                                               |
| --------------- | ------------------------------------- | ------------------------------------------------------------------- |
| Cardholder name | `billing_details.name`                | Name as it appears on the card — may differ from the account holder |
| Address line 1  | `billing_details.address.line1`       | Street address                                                      |
| City            | `billing_details.address.city`        |                                                                     |
| County / State  | `billing_details.address.state`       | "County" in IE/UK, "State" elsewhere                                |
| Postal code     | `billing_details.address.postal_code` | Works for Eircodes, UK postcodes, EU postal codes                   |
| Country         | `billing_details.address.country`     | ISO 3166-1 alpha-2 code (e.g. `"IE"`, `"GB"`, `"DE"`)               |

All fields are required. The submit button should remain disabled until all billing fields and the card element are complete.

> **Organisation accounts:** The person entering the card details may be a staff member rather than the account owner. Collect billing details from the form — do not pre-fill from the user profile.

---

## Setup

Install Stripe.js:

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

Initialise the Stripe instance once at the top of your app (outside any component so it's not re-created on renders):

```ts
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);
```

The publishable key can also be fetched from the backend:

```
GET /payment/config
→ { publishableKey: "pk_live_..." }
```

---

## Reading the User's Payment State

The user profile (returned on login, signup, and `GET /auth/profile`) includes a `paymentMethod` field and a `planBillingInterval` field:

```ts
// Returned when a card is saved
paymentMethod: {
  last4: "4242",
  brand: "visa",        // "visa" | "mastercard" | "amex" | "discover" | etc.
  expMonth: 12,
  expYear: 2027,
} | null                // null = no card on file

// Current billing interval for the user's plan
planBillingInterval: "MONTHLY" | "YEARLY"
```

Use this to decide which UI to render:

```ts
if (user.paymentMethod === null) {
  // Show trial setup / add card prompt
} else {
  // Show saved card + "Change card" option
}
```

You can also fetch card details independently at any time:

```
GET /payment/payment-method
Authorization: (session cookie)

→ { last4, brand, expMonth, expYear } | null
```

---

## Flow 1: Trial Setup (New Users)

This flow runs when a user has no card on file and wants to start their 30-day trial.

### Step 1 — Select plan and billing interval, call `confirmTrial`

```ts
POST /auth/setup/trial
Content-Type: application/json

{
  "planType": "BUSINESS",        // "INDIVIDUAL" | "BUSINESS" | "PREMIUM" | "ORGANISATION"
  "billingInterval": "YEARLY"    // optional, defaults to "MONTHLY"
}

→ {
    "message": "Trial setup initiated",
    "trialEndsAt": "2025-03-26T10:00:00.000Z",
    "clientSecret": "seti_..._secret_...",
    "customerId": "cus_..."
  }
```

Store `clientSecret` and `trialEndsAt` — you'll need them in the next step.

### Step 2 — Collect card with Stripe Elements

Wrap the card form in an `<Elements>` provider and use the `clientSecret` from step 1:

```tsx
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// In your component tree:
<Elements stripe={stripePromise}>
  <CardForm clientSecret={clientSecret} />
</Elements>;
```

Inside the form, collect billing details alongside the card and pass them when calling `stripe.confirmCardSetup`:

```ts
const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: elements.getElement(CardElement),
    billing_details: {
      name: cardholderName, // name as on the card
      address: {
        line1: addressLine1,
        city: city,
        state: state, // county in IE/UK, state elsewhere
        postal_code: postalCode, // Eircode, UK postcode, EU postal code
        country: country, // ISO 3166-1 alpha-2, e.g. "IE", "GB", "DE"
      },
    },
  },
});

if (error) {
  // Show error.message to the user
  return;
}

const paymentMethodId =
  typeof setupIntent.payment_method === "string"
    ? setupIntent.payment_method
    : setupIntent.payment_method.id;
```

> **Important:** `confirmCardSetup` contacts Stripe directly. No card data or billing details touch your backend. The backend syncs billing details to the Stripe Customer record after the payment method is attached.

### Step 3 — Attach the payment method

```ts
POST /auth/payment/attach
Content-Type: application/json

{ "payment_method_id": "pm_..." }

→ {
    "message": "Payment method attached successfully",
    "paymentMethod": {
      "last4": "4242",
      "brand": "visa",
      "expMonth": 12,
      "expYear": 2027
    }
  }
```

This call:

- Attaches the card to the Stripe customer
- Sets it as the default payment method for future charges
- Stores card details in the database
- Creates the 30-day trial subscription automatically (on the selected billing interval)

After this succeeds, update the user's local state with `paymentMethod` from the response and show a success screen.

---

## Flow 2: Updating a Saved Card (Existing Users)

Use this when a user wants to change the card that gets charged.

### Step 1 — Create a new SetupIntent

```ts
POST /payment/create-setup-intent
(no body required)

→ {
    "client_secret": "seti_..._secret_...",
    "customer_id": "cus_..."
  }
```

### Step 2 — Collect the new card with Stripe Elements

Same as trial setup — collect billing details alongside the card and pass them to `stripe.confirmCardSetup`:

```ts
const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: elements.getElement(CardElement),
    billing_details: {
      name: cardholderName,
      address: {
        line1: addressLine1,
        city: city,
        state: state,
        postal_code: postalCode,
        country: country,         // ISO 3166-1 alpha-2
      },
    },
  },
});

const paymentMethodId = /* extract from setupIntent as above */;
```

### Step 3 — Save the updated card

```ts
POST /payment/update-payment-method
Content-Type: application/json

{ "payment_method_id": "pm_..." }

→ {
    "last4": "1234",
    "brand": "mastercard",
    "expMonth": 8,
    "expYear": 2026
  }
```

This call:

- Attaches the new card to the Stripe customer
- Updates the customer's default payment method (used for all future charges)
- Updates the default on the active subscription
- Overwrites the stored card details in the database
- **Does not** modify the subscription or create a new one

Update the saved card state in your UI with the response.

---

## Flow 3: Switching Billing Interval (Monthly → Yearly)

> **Trial vs active behaviour differs:**
>
> - **Active (paid) monthly user** → switch is **scheduled**: current monthly period runs to its end, then the yearly subscription starts automatically.
> - **Trial user** → switch is **immediate**: the monthly trial subscription is cancelled and replaced with a new yearly trial subscription. The remaining trial days are preserved.

Users on an active monthly plan can switch to yearly billing. The switch is scheduled — the monthly plan continues until the end of its current period, then the yearly subscription starts automatically.

```ts
POST /plan/switch
Content-Type: application/json

{
  "planType": "BUSINESS",         // same plan or a new plan
  "billingInterval": "YEARLY"
}

→ {
    "message": "Your plan will switch to yearly billing at the end of your current monthly period.",
    "pendingSwitch": true
  }
```

**While a pending switch is active:**

- The user remains on their current monthly subscription until it expires
- A second switch request to the same target will return `400 SWITCH_ALREADY_PENDING`
- Show a banner informing the user of the scheduled change and when it takes effect (`subscription.currentPeriodEnd`)

### Yearly → Monthly

This is **blocked** while the user is on a yearly plan:

```json
// 400
{
  "error": "YEARLY_DOWNGRADE_NOT_ALLOWED",
  "message": "You cannot switch to monthly billing while on a yearly plan. Your yearly plan will continue until the end of the current period."
}
```

Do not show a monthly billing option to yearly users. You can check `user.planBillingInterval` to conditionally disable or hide the option.

---

## Flow 4: Switching Plans (Same Billing Interval)

Use this flow when a user upgrades or downgrades to a different plan while keeping their current billing interval (e.g. Business Monthly → Premium Monthly, or Business Yearly → Premium Yearly).

This is also the flow for switching plan **and** interval at the same time (e.g. Business Monthly → Premium Yearly) — the "scheduled at period end" path only applies when switching interval on the **same** plan.

### Addon Transfer & Refund Logic

When a plan switch occurs, the backend automatically reconciles existing addons to match the limits of the new plan.

#### 1. Quantifiable Addons (Capped by Addon-Only capacity)

For addons like **Extra Seats**, **Extra AI Assistants**, and **Extra WhatsApp Channels**, the transfer limit is calculated as the new plan's **total capacity minus its base allowance**.

- **Example**: Switching from **Organisation** to **Business**
  - **Current (Organisation)**: 5 base WhatsApp + 5 purchased addons = 10 total.
  - **Target (Business)**: 1 base WhatsApp + 1 max addon = 2 total.
  - **Result**: Only **1** purchased addon is transferred. The other 4 are refunded.

Any quantity exceeding the new plan's addon limit is automatically cancelled, and a **prorated refund** is issued to the user's last payment method.

#### 2. Usage Packs (Always Transferred)

Addons in the `USAGE_PACK` category (e.g., **Contact Packs**, **Email Packs**, **AI Compute Packs**) are **always transferred in full**. They do not expire or get refunded during plan changes.

#### 3. Feature Addons (Included vs Paid)

- **Becomes Included**: If a paid addon (e.g., CRM Sync) is included for free in the target plan, the existing addon is marked for refund.
- **No Longer Included**: If a feature was free (included) in the old plan but is a paid addon in the new plan, it is **converted to a paid addon** record (at which point standard limits apply).

#### 4. Specialized Addons

- **Multi-Language AI**: If the new plan has a lower limit for languages than currently active, the list is truncated starting from the most recently added languages.

---

### Step 1 — Preview the impact (recommended)

Before confirming, show the user what will happen to their addons:

```ts
GET /plan/switch-preview/:planType
Authorization: (session cookie)

// e.g. GET /plan/switch-preview/PREMIUM

→ {
    "currentPlan": "BUSINESS",
    "targetPlan": "PREMIUM",
    "isUpgrade": true,
    "changes": {
      "transferred": [
        {
          "addonType": "EXTRA_SEAT",
          "name": "Extra Seat",
          "currentQuantity": 2,
          "transferredQuantity": 2
        }
      ],
      "refunded": [
        {
          "addonType": "EXTRA_WHATSAPP_CHANNEL",
          "name": "Extra WhatsApp Channel",
          "quantity": 1,
          "estimatedRefund": 4.50,
          "reason": "Included in new plan"
        }
      ],
      "converted": []
    },
    "affectedChannels": {
      "planBlocked": [],
      "addonBlocked": [],
      "quantityExceeded": null,
      "totalAffected": 0
    },
    "totalEstimatedRefund": 4.50,
    "newMonthlyTotal": 299.00,
    "summary": {
      "addonsTransferred": 1,
      "addonsRefunded": 1,
      "featuresConverted": 0,
      "channelsAffected": 0
    }
  }
```

Display a confirmation screen summarising the addon changes and the prorated charge or refund before the user confirms.

### Step 2 — Execute the switch

```ts
POST /plan/switch
Content-Type: application/json

{
  "planType": "PREMIUM",
  "billingInterval": "MONTHLY"   // pass the user's current interval to keep it the same
}

→ {
    "message": "Plan switch successful",
    "newPlan": "PREMIUM",
    "previousPlan": "BUSINESS",
    "transferredAddons": 1,
    "cancelledAddons": 1
  }
```

The switch is immediate — the user's plan is updated in the response. No polling required.

> **Note:** If the user is also changing their billing interval (e.g. Business Monthly → Premium Yearly), pass the target `billingInterval` in the same call. The switch is still immediate; the "scheduled at period end" path only applies to same-plan interval changes (Monthly → Yearly on the same plan).

### Downgrade constraints

On a downgrade, the backend validates before switching:

- **Contact limit**: if the user has more contacts than the new plan allows (including any contact packs), the switch is blocked.

```json
// 400
{
  "statusCode": 400,
  "message": "Cannot downgrade: You have 1200 contacts but the new plan allows 500. Delete contacts or purchase contact packs first.",
  "error": "Bad Request"
}
```

- **Yearly → Monthly** is still blocked regardless of plan change:

```json
// 400
{
  "error": "YEARLY_DOWNGRADE_NOT_ALLOWED",
  "message": "You cannot switch from a yearly plan to monthly billing. Please cancel your subscription first and re-subscribe on a monthly plan."
}
```

### UI pattern

```tsx
async function handlePlanSwitch(targetPlan: PlanType) {
  // 1. Preview
  const preview = await api.get(`/plan/switch-preview/${targetPlan}`);

  // 2. Show confirmation with addon impact + prorated amount
  const confirmed = await showConfirmDialog({
    addonsTransferred: preview.summary.addonsTransferred,
    addonsRefunded: preview.summary.addonsRefunded,
    estimatedRefund: preview.totalEstimatedRefund,
    newMonthlyTotal: preview.newMonthlyTotal,
  });

  if (!confirmed) return;

  // 3. Execute
  await api.post("/plan/switch", {
    planType: targetPlan,
    billingInterval: user.planBillingInterval, // keep current interval
  });

  // 4. Refresh user profile to get updated plan
  await refreshUserProfile();
}
```

### Flow diagram

```
PLAN SWITCH (same billing interval)
────────────────────────────────────
User selects a different plan (e.g. Business → Premium)
        │
        ▼
GET /plan/switch-preview/PREMIUM
        │ returns addon impact + estimated prorated amounts
        ▼
Show confirmation screen
        │ user confirms
        ▼
POST /plan/switch { planType: "PREMIUM", billingInterval: "MONTHLY" }
        │ immediate: prorated charge/refund + new subscription created
        ▼
Refresh user profile → show updated plan
```

---

## Other Billing Endpoints

### Subscription status

```
GET /payment/subscription-status

→ {
    "subscription": {
      "subscriptionId": "sub_...",
      "status": "trialing",           // "trialing" | "active" | "past_due" | "canceled"
      "currentPeriodEnd": "2025-03-26T...",
      "trialEnd": "2025-03-26T...",
      "billingInterval": "MONTHLY",   // "MONTHLY" | "YEARLY"
      "cancelAtPeriodEnd": false      // true when cancellation is scheduled at period end
    },
    "isOnTrial": true,
    "trialInfo": {
      "planType": "BUSINESS",
      "billingInterval": "MONTHLY"
    },
    "gracePeriod": null,
    "accessRevoked": null
  }
```

Use `isOnTrial` and `subscription.status` to conditionally show trial banners, upgrade prompts, or payment failure notices. Use `subscription.billingInterval` to show the current billing cycle in settings.

**Pending cancellation:** When `subscription.cancelAtPeriodEnd === true`, the subscription is scheduled to cancel at the end of the current period (`currentPeriodEnd`). The user retains access until then.

- If `status === "trialing"` and `cancelAtPeriodEnd === true`: the user cancelled during their trial — the subscription ends at `trialEnd`. Show a pending cancellation banner with a reactivate CTA.
- If `status === "active"` and `cancelAtPeriodEnd === true`: the user cancelled a paid subscription. It ends at `currentPeriodEnd`. Show a pending cancellation banner.

```ts
if (subscription.cancelAtPeriodEnd) {
  // Show: "Your subscription will end on [currentPeriodEnd]."
  // Show: Reactivate button → POST /payment/reactivate-subscription
}
```

### Cancel subscription (at period end)

```
POST /payment/cancel-subscription
(no body)

→ { "message": "Subscription cancelled successfully" }
```

Soft cancel — sets `cancelAtPeriodEnd: true`. The subscription remains active and the user retains access until `currentPeriodEnd`. Can be undone with `POST /payment/reactivate-subscription`.

After soft-cancelling, `Switch plan / interval` remains available. However, **yearly → monthly switching is still blocked** until the yearly period expires. To switch from yearly to monthly, let the plan expire naturally (do not reactivate), then re-subscribe on a monthly plan.

### Cancel subscription immediately

```
POST /payment/cancel-subscription-immediately
(no body)

→ { "message": "Subscription cancelled immediately" }
```

Hard cancel — terminates the subscription in Stripe immediately. The user loses access at once. **No refund is issued.** Use this only when the user explicitly chooses to forfeit their remaining access period.

> Show a prominent warning before calling this endpoint: "You will lose access immediately. No refund will be issued."

### Reactivate subscription

```
POST /payment/reactivate-subscription
(no body)

→ { "message": "Subscription reactivated successfully" }
```

Used after a subscription was cancelled or access was revoked due to payment failure.

---

## Subscription Status Reference

| `status`   | Meaning                         | What to show                                |
| ---------- | ------------------------------- | ------------------------------------------- |
| `trialing` | Within 30-day trial             | Trial banner with days remaining            |
| `active`   | Paid and current                | Normal access                               |
| `past_due` | Payment failed, in grace period | Payment failure banner with update card CTA |
| `canceled` | Subscription ended              | Subscription ended screen                   |

The `gracePeriod` and `accessRevoked` fields in `/payment/subscription-status` indicate whether the user is in a recovery window or has had access fully revoked after non-payment.

---

## Billing Interval UI Patterns

### Plan selector with interval toggle

```tsx
const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">(
  "MONTHLY"
);

// Price display helper
function getPlanPrice(plan: Plan, interval: "MONTHLY" | "YEARLY") {
  if (interval === "YEARLY") {
    return { amount: plan.yearlyPrice, label: "/year" };
  }
  return { amount: plan.monthlyPrice, label: "/month" };
}

// Toggle
<Toggle
  options={["MONTHLY", "YEARLY"]}
  value={billingInterval}
  onChange={setBillingInterval}
/>;

// Pass to trial setup
await confirmTrial({ planType, billingInterval });
```

### Pending yearly switch banner

A pending yearly switch shows as `cancelAtPeriodEnd: true` on the subscription (the monthly sub is set to cancel at period end so the yearly one can start). Distinguish it from a plain cancellation by comparing the profile's `planBillingInterval` against the subscription's actual `billingInterval`:

```tsx
const isPendingYearlySwitch =
  subscription.cancelAtPeriodEnd &&
  user.planBillingInterval === "YEARLY" &&
  subscription.billingInterval === "MONTHLY";

{
  isPendingYearlySwitch && (
    <Banner variant="info">
      Your plan switches to yearly billing on{" "}
      {formatDate(subscription.currentPeriodEnd)}.
    </Banner>
  );
}
```

`user.planBillingInterval` is returned by `GET /auth/profile` (and login/signup). `subscription.billingInterval` comes from `GET /payment/subscription-status`.

### Block monthly option for yearly users

```tsx
<BillingToggle
  value={user.planBillingInterval}
  onYearlyDisabledClick={() =>
    showToast("Switch to monthly is not available on a yearly plan.")
  }
  yearlyDisabled={user.planBillingInterval === "YEARLY"}
/>
```

---

## Displaying Card Brand

The `brand` field returned by the API is a lowercase string from Stripe. Map it to display names:

```ts
const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  jcb: "JCB",
  unionpay: "UnionPay",
  diners: "Diners Club",
  unknown: "Card",
};

function formatBrand(brand: string): string {
  return CARD_BRAND_LABELS[brand.toLowerCase()] ?? brand;
}

function formatExpiry(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}
```

---

## Error Handling

All backend endpoints return standard NestJS error shapes on failure:

```json
{
  "statusCode": 400,
  "message": "No default payment method found",
  "error": "Bad Request"
}
```

Stripe Elements errors come back on the `error` object from `confirmCardSetup`:

```ts
const { error } = await stripe.confirmCardSetup(...);
if (error) {
  // error.message is user-safe (e.g. "Your card was declined.")
  // error.type gives the category: "card_error" | "validation_error" | etc.
}
```

Common Stripe error types to handle:

| `error.type`       | Cause                                      | Suggested UX                                   |
| ------------------ | ------------------------------------------ | ---------------------------------------------- |
| `card_error`       | Card declined, insufficient funds, expired | Show `error.message` inline                    |
| `validation_error` | Incomplete card number / CVC               | Show inline, usually pre-validated by Elements |
| `api_error`        | Stripe-side issue                          | Generic "please try again" message             |

Billing-specific error codes:

| `error` field                  | Cause                                     | Suggested UX                     |
| ------------------------------ | ----------------------------------------- | -------------------------------- |
| `YEARLY_DOWNGRADE_NOT_ALLOWED` | User tried to switch yearly → monthly     | Hide option or show locked state |
| `SWITCH_ALREADY_PENDING`       | Monthly → yearly switch already scheduled | Show pending switch banner       |

---

## Reference: Complete Flow Diagram

```
NEW USER TRIAL SETUP
────────────────────
User selects plan + billing interval
        │
        ▼
POST /auth/setup/trial { planType, billingInterval }
        │ returns clientSecret
        ▼
stripe.confirmCardSetup(clientSecret, { card, billing_details })
        │ billing details stored on PaymentMethod in Stripe
        │ returns paymentMethodId
        ▼
POST /auth/payment/attach { payment_method_id }
        │ attaches card + creates trial subscription
        │ syncs billing_details to Stripe Customer record
        ▼
Show success (trial active)


EXISTING USER — CARD UPDATE
────────────────────────────
User clicks "Change card"
        │
        ▼
POST /payment/create-setup-intent
        │ returns clientSecret
        ▼
stripe.confirmCardSetup(clientSecret, { card, billing_details })
        │ billing details stored on PaymentMethod in Stripe
        │ returns paymentMethodId
        ▼
POST /payment/update-payment-method { payment_method_id }
        │ updates card + subscription default, no subscription changes
        │ syncs billing_details to Stripe Customer record
        ▼
Show updated card details


MONTHLY → YEARLY SWITCH (same plan)
────────────────────────────────────
User selects yearly billing
        │
        ▼
POST /plan/switch { planType, billingInterval: "YEARLY" }
        │ schedules switch at end of current monthly period
        ▼
Show pending switch banner with effective date
        │ (automatic — no frontend action needed)
        ▼
Webhook fires at period end → yearly subscription created


PLAN SWITCH (same billing interval, or plan + interval together)
────────────────────────────────────────────────────────────────
User selects a different plan
        │
        ▼
GET /plan/switch-preview/:planType
        │ returns addon impact + prorated amounts
        ▼
Show confirmation screen
        │ user confirms
        ▼
POST /plan/switch { planType, billingInterval: (current or target) }
        │ immediate: prorated charge/refund, new subscription created
        ▼
Refresh user profile → show updated plan
```

---

## Reference Component

A working reference implementation of both flows is available at:

```
docs/TrialSetup.tsx
```

It handles loading state, error display, the plan selector, initial card collection (including billing address fields), and the card update flow with cancel support.

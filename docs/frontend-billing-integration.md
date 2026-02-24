# Frontend Billing Integration Guide

This document covers everything the frontend needs to implement trial setup, subscription billing, and payment method management.

---

## Overview

Billing is built on Stripe. The backend owns all Stripe logic — the frontend only interacts with two things:

1. **Stripe.js / Stripe Elements** — to securely collect card details in the browser (card numbers never touch your servers)
2. **Backend API endpoints** — to set up intents, attach/update cards, and read billing state

There are two distinct flows:

| Flow | When | Endpoints |
|------|------|-----------|
| **Trial setup** | New user, no card on file | `POST /auth/setup/trial` → *(Stripe Elements)* → `POST /auth/payment/attach` |
| **Card update** | Existing user changing saved card | `POST /payment/create-setup-intent` → *(Stripe Elements)* → `POST /payment/update-payment-method` |

---

## Setup

Install Stripe.js:

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

Initialise the Stripe instance once at the top of your app (outside any component so it's not re-created on renders):

```ts
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
```

The publishable key can also be fetched from the backend:

```
GET /payment/config
→ { publishableKey: "pk_live_..." }
```

---

## Reading the User's Payment State

The user profile (returned on login, signup, and `GET /auth/profile`) includes a `paymentMethod` field:

```ts
// Returned when a card is saved
paymentMethod: {
  last4: "4242",
  brand: "visa",        // "visa" | "mastercard" | "amex" | "discover" | etc.
  expMonth: 12,
  expYear: 2027,
} | null                // null = no card on file
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

### Step 1 — Select plan and call `confirmTrial`

```ts
POST /auth/setup/trial
Content-Type: application/json

{ "planType": "BUSINESS" }   // "INDIVIDUAL" | "BUSINESS" | "PREMIUM" | "ORGANISATION"

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
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

// In your component tree:
<Elements stripe={stripePromise}>
  <CardForm clientSecret={clientSecret} />
</Elements>
```

Inside the form, call `stripe.confirmCardSetup` when the user submits:

```ts
const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: { card: elements.getElement(CardElement) },
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

> **Important:** `confirmCardSetup` contacts Stripe directly. No card data touches your backend.

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
- Creates the 30-day trial subscription automatically

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

Same as trial setup — use `stripe.confirmCardSetup` with the new `client_secret`:

```ts
const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: { card: elements.getElement(CardElement) },
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

## Other Billing Endpoints

### Subscription status

```
GET /payment/subscription-status

→ {
    "subscription": {
      "subscriptionId": "sub_...",
      "status": "trialing",           // "trialing" | "active" | "past_due" | "canceled"
      "currentPeriodEnd": "2025-03-26T...",
      "trialEnd": "2025-03-26T..."
    },
    "isOnTrial": true,
    "trialInfo": { "planType": "BUSINESS", ... },
    "gracePeriod": null,
    "accessRevoked": null
  }
```

Use `isOnTrial` and `subscription.status` to conditionally show trial banners, upgrade prompts, or payment failure notices.

### Cancel subscription

```
POST /payment/cancel-subscription
(no body)

→ { "message": "Subscription cancelled successfully" }
```

Cancellation takes effect at the end of the current billing period (`currentPeriodEnd`). The user retains access until then.

### Reactivate subscription

```
POST /payment/reactivate-subscription
(no body)

→ { "message": "Subscription reactivated successfully" }
```

Used after a subscription was cancelled or access was revoked due to payment failure.

---

## Subscription Status Reference

| `status` | Meaning | What to show |
|----------|---------|-------------|
| `trialing` | Within 30-day trial | Trial banner with days remaining |
| `active` | Paid and current | Normal access |
| `past_due` | Payment failed, in grace period | Payment failure banner with update card CTA |
| `canceled` | Subscription ended | Subscription ended screen |

The `gracePeriod` and `accessRevoked` fields in `/payment/subscription-status` indicate whether the user is in a recovery window or has had access fully revoked after non-payment.

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

| `error.type` | Cause | Suggested UX |
|---|---|---|
| `card_error` | Card declined, insufficient funds, expired | Show `error.message` inline |
| `validation_error` | Incomplete card number / CVC | Show inline, usually pre-validated by Elements |
| `api_error` | Stripe-side issue | Generic "please try again" message |

---

## Reference: Complete Flow Diagram

```
NEW USER TRIAL SETUP
────────────────────
User selects plan
        │
        ▼
POST /auth/setup/trial
        │ returns clientSecret
        ▼
stripe.confirmCardSetup(clientSecret, { card })
        │ returns paymentMethodId
        ▼
POST /auth/payment/attach { payment_method_id }
        │ attaches card + creates trial subscription
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
stripe.confirmCardSetup(clientSecret, { card })
        │ returns paymentMethodId
        ▼
POST /payment/update-payment-method { payment_method_id }
        │ updates card + subscription default, no subscription changes
        ▼
Show updated card details
```

---

## Reference Component

A working reference implementation of both flows is available at:

```
docs/TrialSetup.tsx
```

It handles loading state, error display, the plan selector, initial card collection, and the card update flow with cancel support.

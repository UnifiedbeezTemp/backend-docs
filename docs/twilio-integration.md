---
sidebar_position: 7
---

# Frontend Twilio SMS Integration Flow

## 1. **Search Available Numbers**

```typescript
GET /api/twilio/sms/available-numbers
Query params:
  - countryCode: "US" | "GB" etc.
  - areaCode?: string
  - numberType: "local" | "mobile" | "tollFree" | "all"
  - limit: number (max 50)

Response: List of available numbers with pricing
```

## 2. **Purchase Number**

```typescript
POST /api/twilio/sms/purchase-number
Body: {
  phoneNumber: "+1234567890",
  countryCode?: "US",
  capabilities?: { sms: true, voice: true }
}

Response: {
  success: true,
  number: VoiceNumber object,
  billing: { monthlyPrice, nextBilling }
}
```

## 3. **View Owned Numbers**

```typescript
GET /api/twilio/sms/my-numbers

Response: {
  numbers: VoiceNumber[],
  usage: { sent, limit, remaining }
}
```

## 4. **Send SMS**

```typescript
POST /api/twilio/sms/send
Body: {
  to: "+1234567890",
  message: "Hello",
  from?: "+0987654321", // Optional, uses first number if omitted
  mediaUrls?: string[] // For MMS
}

Response: {
  success: true,
  messageId: "SM...",
  status: "queued"
}
```

## 5. **Check Usage/Limits**

```typescript
GET /api/twilio/sms/usage/current
Response: { sent, limit, remaining, period }

GET /api/twilio/sms/usage/check-limit
Response: { canSend: boolean, reason?: string }
```

## 6. **Release Number**

```typescript
DELETE /api/twilio/sms/release/:numberId

Response: { success: true }
```

## 7. **Receive Incoming SMS (Real-time)**

Backend emits event → Frontend listens via WebSocket/SSE:

```typescript
// Event: 'sms.message.received'
{
  channelId, senderId, content, attachments,
  metadata: { channelMessageId: "SM..." }
}
```

## Key Implementation Notes

- **Authentication**: All endpoints require `SessionAuthGuard` (JWT)
- **Prerequisites**: User needs `TWILIO_MESSAGE_PACK` addon active
- **Plan Limits**: Business (1+4), Premium (2+8), Organisation (unlimited)
- **Webhooks**: Backend auto-configures Twilio webhooks on purchase
- **Billing**: Prorated charges apply (£20/month per number)

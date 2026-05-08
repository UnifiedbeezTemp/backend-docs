# Voice & Video Calling — Management Overview

---

## What Was Built

UnifiedBeez has been extended with full voice and video calling capabilities. Businesses can now make and receive phone calls, have an AI assistant handle calls autonomously, and host video calls — all from within the same platform they already use for messaging.

This completes the communication stack: UnifiedBeez now covers every major channel a business uses to interact with customers.

---

## Business Value

**Before this update**, a business using UnifiedBeez could manage customer conversations across WhatsApp, Facebook, Instagram, Telegram, SMS, and email — but any phone or video interaction happened outside the platform, in a separate system, with no connection to the conversation history.

**After this update**, voice and video are fully integrated. Every call is logged, transcribed, summarised, and linked to the customer's existing conversation thread. Nothing falls through the cracks.

---

## The Four Capabilities

### 1. Browser Calling for Business Operators

Staff can make and receive phone calls directly from the UnifiedBeez dashboard — no desk phone, no separate app. The customer sees the business's registered number. Calls are logged automatically.

### 2. AI-Handled Inbound Calls

When a customer calls, the AI can answer on behalf of the business. It holds a natural conversation, draws on the business's knowledge base to answer questions accurately, and hands the operator a full transcript and summary when it's done. No staff involvement required for routine enquiries.

### 3. AI-Initiated Outbound Calls

The platform can proactively call customers. An operator sets a goal — for example, "follow up on unpaid invoice" or "confirm tomorrow's appointment" — and the AI places the call and carries it out. Results are saved and reported back automatically.

### 4. "Call Me Now" from Any Channel

If a customer on WhatsApp, Telegram, Instagram, or any other connected channel asks to be called, the AI handles it automatically: it identifies the customer's phone number, places a Twilio outbound call, and when the call ends, posts a summary back to the original chat thread. The customer journey stays in one place regardless of where it started.

---

## Video Calling

Video rooms can be created instantly and shared with customers or internal team members. No downloads required — participants join from any modern browser. One-on-one rooms carry no additional Twilio cost. Group rooms (up to 50 participants) can be recorded.

---

## Call Records & Audit Trail

Every call — regardless of who initiated it or how — produces a permanent record containing:

- Who called whom, when, and for how long
- Full word-for-word transcript
- AI-generated summary
- Whether AI or a human handled the call
- A link to the originating conversation if the call came from a message

This gives management complete visibility into every customer interaction, including those handled autonomously by the AI.

---

## What Channels Support Voice Calls

A common question: can the AI call customers through WhatsApp or Telegram directly?

The short answer is no — and this is a hard limitation set by those platforms, not by UnifiedBeez. WhatsApp Business, Facebook Messenger, Instagram, and Telegram do not allow programmatic voice calls through their business APIs. No platform can work around this.

UnifiedBeez's solution: when a customer requests a call on any channel, the platform bridges to a standard phone call via Twilio and posts the outcome back to the original conversation. The customer experience is seamless; the business gets a complete record.

---

## Infrastructure & Dependencies

The feature is built on top of services already in use:

- **Twilio** — already the SMS provider. Voice and video are extensions of the same account.
- **OpenAI** — already connected. Used as the fallback for speech recognition and the AI voice.

Two new credentials are required in the Twilio console (a one-time setup step). Two optional third-party services — Deepgram for real-time speech recognition and ElevenLabs for a more natural AI voice — can be added to improve call quality but are not required for the system to operate.

No new infrastructure is needed. The feature runs within the existing backend.

---

## Rollout Status

| Component                                              | Status                          |
| ------------------------------------------------------ | ------------------------------- |
| Browser calling for operators                          | Complete                        |
| AI inbound call handling                               | Complete                        |
| AI outbound calls                                      | Complete                        |
| "Call me now" cross-channel bridge                     | Complete                        |
| Video rooms                                            | Complete                        |
| Call transcripts and summaries                         | Complete                        |
| Live transcript streaming to dashboard                 | Complete                        |
| One-time Twilio setup                                  | Pending (console configuration) |
| Database migration                                     | Pending (one command)           |
| Optional voice quality upgrades (Deepgram, ElevenLabs) | Optional                        |

# Voice & Video Calling — System Overview

## What This Document Covers

This document explains the voice and video calling capabilities built into UnifiedBeez — what they do, how they work, and what is needed to operate them. It is written for both technical and non-technical readers.

---

## Background & Purpose

UnifiedBeez allows businesses to communicate with their customers across many channels — WhatsApp, Facebook Messenger, Instagram, Telegram, SMS, and email — from a single inbox. When this feature set was built, voice and video were not yet part of the platform.

This update adds three new capabilities:

1. **Users (business operators) can make and receive phone calls** directly from the UnifiedBeez dashboard, using their purchased phone numbers.
2. **The AI assistant can autonomously handle phone calls** — answering inbound calls, making outbound calls, and conducting conversations using the business's knowledge base.
3. **Video calls can be created and shared** between participants using browser-based video rooms.

All voice calling is powered by Twilio, which is already the provider used for SMS on the platform.

---

## Phone Numbers

### How Numbers Are Used for Calling

When a user purchases a phone number through UnifiedBeez, that number is already configured to receive both SMS messages and voice calls. No additional setup is required on the number itself.

Numbers are gated by plan:

| Plan         | Included Numbers | Maximum   |
| ------------ | ---------------- | --------- |
| Individual   | 0                | 0         |
| Business     | 1                | 5         |
| Premium      | 2                | 10        |
| Organisation | Unlimited        | Unlimited |

Voice calling requires the **Twilio Voice Pack** add-on. Numbers without this add-on can still receive and send SMS.

---

## Voice Calling

### 1. User-Placed Calls (Browser Calling)

A business operator can make and receive calls directly from their browser — no phone, no app required.

**How it works:**

- The UnifiedBeez backend generates a short-lived security token for the user's browser session.
- The frontend uses this token to activate a call interface (powered by Twilio's browser SDK).
- The user can dial any phone number, and the call will show the user's purchased UnifiedBeez number as the caller ID.
- Inbound calls to the user's number will ring in the browser if the user is active in the dashboard.

**What's needed to enable this:**

- `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET` (separate from the main Twilio credentials — generated in the Twilio console under API Keys)
- `TWILIO_TWIML_APP_SID` (a TwiML App must be created in the Twilio console, pointing its Voice URL to the UnifiedBeez backend)

### 2. AI-Answered Inbound Calls

When a customer calls a user's purchased number, the AI assistant can answer on behalf of the business.

**How it works:**

- Twilio receives the inbound call and immediately notifies the UnifiedBeez backend.
- The backend checks whether the user has an active AI assistant configured for voice.
- If yes, the call is connected to a real-time audio pipeline — the AI listens, understands, and speaks back to the caller.
- The entire conversation is transcribed and saved. After the call, a summary is generated and stored.
- If no AI is configured, the caller hears a default hold message.

### 3. AI-Initiated Outbound Calls

The AI can call a customer's phone number on behalf of the business.

**How it works:**

- A request is made with a destination number, the user's purchased number to call from, and optionally a goal (e.g. "Follow up on unpaid invoice" or "Confirm appointment for tomorrow").
- Twilio places the call. Once the customer answers, the AI takes over using the same real-time audio pipeline as inbound calls.
- The AI uses the business's knowledge base to answer questions and stay on-topic.

### 4. "Call Me Now" from Any Channel

When a customer sends a message like "call me now", "please call me", "ring me", or similar phrases on **any** connected channel — including WhatsApp, Telegram, Facebook Messenger, Instagram, or SMS — the AI automatically handles it.

**Important clarification:** WhatsApp, Facebook Messenger, Instagram, and Telegram do not support voice calls through their business APIs. It is technically impossible to place or receive calls through those platforms programmatically. However, UnifiedBeez bridges this gap:

**How it works:**

- The AI detects the call request intent from the customer's message.
- It looks up the customer's phone number (from the message, their contact profile, or by asking them to share it).
- It places a Twilio outbound call from the user's purchased number to the customer's regular phone.
- After the call ends, a summary of the conversation is posted back to the original channel thread — so the WhatsApp or Telegram conversation stays complete and in context.
- If a phone number is not yet known, the AI replies asking the customer to share one before initiating the call.

---

## How AI Calls Work (The Audio Pipeline)

Understanding the AI call pipeline helps clarify what the system does in real time.

```
Customer calls (or AI calls customer)
        ↓
Twilio receives the audio and streams it in real time to UnifiedBeez
        ↓
Speech-to-Text: the customer's words are transcribed as they speak
        ↓
The transcript is sent to the AI with the relevant knowledge base context
        ↓
The AI generates a response (concise, phone-appropriate — 1–3 sentences)
        ↓
Text-to-Speech: the response is converted to audio
        ↓
The audio is streamed back to Twilio and played to the customer
        ↓
This loop continues until the call ends
        ↓
Call transcript and AI-generated summary saved to the database
```

This all happens in near real time — the target latency from end of speech to AI response is under 1 second.

---

## Speech-to-Text (STT) — Hybrid Provider Setup

Three STT providers are supported, used in order of availability:

| Priority       | Provider              | Characteristics                                                               |
| -------------- | --------------------- | ----------------------------------------------------------------------------- |
| 1st (Primary)  | Deepgram              | Real-time streaming, lowest latency, best for live conversations              |
| 2nd (Fallback) | OpenAI Whisper        | Batch processing, slightly higher latency, reuses existing OpenAI credentials |
| 3rd (Tertiary) | Google Speech-to-Text | Streaming support, good accuracy                                              |

If the primary provider is unavailable or returns an error, the system automatically falls back to the next.

**Environment variables:**

- `DEEPGRAM_API_KEY` — primary STT
- `OPENAI_API_KEY` — already configured; used for Whisper fallback
- `GOOGLE_SPEECH_API_KEY` — optional tertiary
- `STT_PRIMARY_PROVIDER` — override the default order (values: `deepgram`, `whisper`, `google`)

---

## Text-to-Speech (TTS) — Hybrid Provider Setup

Three TTS providers are supported, used in order of availability:

| Priority             | Provider        | Characteristics                                                                                    |
| -------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| 1st (Primary)        | ElevenLabs      | Most natural, human-like voice quality                                                             |
| 2nd (Fallback)       | OpenAI TTS      | Good quality, multiple voice options (alloy, nova, echo, etc.), reuses existing OpenAI credentials |
| 3rd (Final fallback) | Twilio built-in | Zero extra cost, always available, uses Amazon Polly voices                                        |

The final fallback always works with no additional setup — meaning AI calls will function out of the box even without ElevenLabs or OpenAI TTS configured.

**Environment variables:**

- `ELEVENLABS_API_KEY` — primary TTS
- `ELEVENLABS_VOICE_ID` — specific voice ID to use (optional, defaults to a standard voice)
- `OPENAI_API_KEY` — already configured; used for TTS fallback
- `TTS_PRIMARY_PROVIDER` — override the default order (values: `elevenlabs`, `openai`, `twilio`)

---

## Video Calling

Video rooms are powered by Twilio Video (WebRTC — no plugins or downloads required for end users).

### How it works

1. A video room is created via the API — it gets a unique name and a room type.
2. Any participant (user or customer) is given a short-lived access token for that room.
3. The participant's browser uses the `twilio-video` JavaScript SDK to join — camera and microphone are shared peer-to-peer or via Twilio's servers.
4. Rooms can be recorded if configured.
5. When the session ends, the room is closed via the API.

### Room Types

| Type           | Max Participants | Billed by Twilio             | Supports Recording |
| -------------- | ---------------- | ---------------------------- | ------------------ |
| `go` (default) | 2                | No                           | No                 |
| `peer-to-peer` | 2                | No                           | No                 |
| `group`        | Up to 50         | Yes (per participant-minute) | Yes                |

For one-on-one customer calls, `go` rooms are recommended — they are free on Twilio's side.

### API Endpoints

| Action                  | Method | Path                               |
| ----------------------- | ------ | ---------------------------------- |
| Create a room           | POST   | `/video/rooms`                     |
| Get a participant token | POST   | `/video/rooms/:roomSid/token`      |
| Check room status       | GET    | `/video/rooms/:roomSid`            |
| End a room              | DELETE | `/video/rooms/:roomSid`            |
| List recordings         | GET    | `/video/rooms/:roomSid/recordings` |

**Environment variables required for video:**

- `TWILIO_API_KEY_SID` — same key used for browser voice calling
- `TWILIO_API_KEY_SECRET` — same secret used for browser voice calling
- `VIDEO_AUTO_RECORD` — set to `true` to automatically record all group rooms (optional)

---

## Call History & Transcripts

Every call — inbound or outbound, AI-handled or human-placed — is logged in the database.

Each call log stores:

- Direction (inbound / outbound)
- From and to phone numbers
- Status (initiated, ringing, in-progress, completed, failed, busy, no-answer, canceled)
- Duration in seconds
- Whether the call was handled by AI
- Which AI assistant handled it (if applicable)
- The full call transcript (each turn: who said what, and when)
- An AI-generated summary of the call
- A link back to the source channel conversation (if the call was triggered by a "call me now" message)
- Recording URL (if recording was enabled)

### Voice API Endpoints

| Action                     | Method | Path                    |
| -------------------------- | ------ | ----------------------- |
| Place outbound call (user) | POST   | `/voice/call`           |
| Place AI outbound call     | POST   | `/voice/ai/call`        |
| Get browser call token     | GET    | `/voice/client/token`   |
| List call history          | GET    | `/voice/calls`          |
| Get call status            | GET    | `/voice/calls/:callSid` |
| End an active call         | DELETE | `/voice/calls/:callSid` |

---

## Webhook Endpoints (Internal — Twilio Callbacks)

These endpoints are called by Twilio automatically and do not require authentication. They handle the real-time call lifecycle.

| Purpose                           | Method | Path                                          |
| --------------------------------- | ------ | --------------------------------------------- |
| Inbound call router (AI or human) | POST   | `/webhooks/twilio/voice/:userId`              |
| TwiML for human-placed calls      | POST   | `/webhooks/twilio/voice/:userId/twiml`        |
| TwiML for AI calls (Media Stream) | POST   | `/webhooks/twilio/voice/:userId/ai-twiml`     |
| Call status updates               | POST   | `/webhooks/twilio/voice/:userId/status`       |
| Recording callback                | POST   | `/webhooks/twilio/voice/:userId/recording`    |
| Browser call TwiML                | POST   | `/webhooks/twilio/voice/:userId/browser-call` |

The `voiceUrl` set on each purchased number already points to `/webhooks/twilio/voice/:userId`, so inbound calls are automatically routed when a number is purchased.

---

## Channel Voice Support — Platform Limitations

This is a common point of confusion. Here is the definitive answer for each channel:

| Channel               | Can Place/Receive Voice Calls via API? | Notes                                                                                   |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| Twilio phone number   | ✅ Yes                                 | Full inbound and outbound support                                                       |
| WhatsApp Business API | ❌ No                                  | WhatsApp calls exist only in the consumer app; the Business API has no voice capability |
| Facebook Messenger    | ❌ No                                  | The Messenger Platform API has no voice call support                                    |
| Instagram Direct      | ❌ No                                  | Instagram's messaging API has no voice support                                          |
| Telegram Bot API      | ❌ No                                  | Telegram bots cannot place or receive voice calls                                       |
| Email                 | ❌ Not applicable                      |                                                                                         |
| LinkedIn Messenger    | ❌ No                                  | LinkedIn's API has no voice capability                                                  |

**The workaround:** When a customer requests a call on any of these channels, UnifiedBeez bridges to a Twilio phone call and posts the call summary back to the original channel conversation when it ends.

---

## Required Environment Variables — Full Reference

### Already in use (no change needed)

| Variable             | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier                             |
| `TWILIO_AUTH_TOKEN`  | Twilio authentication                                 |
| `OPENAI_API_KEY`     | Used for Whisper STT fallback and OpenAI TTS fallback |

### New — Required for voice/video to work

| Variable                | Purpose                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `TWILIO_API_KEY_SID`    | Twilio API key SID (create in Twilio console under API Keys)       |
| `TWILIO_API_KEY_SECRET` | Twilio API key secret (created alongside the SID)                  |
| `TWILIO_TWIML_APP_SID`  | SID of the TwiML App created in Twilio console for browser calling |

### New — Optional (for better voice quality)

| Variable                | Purpose                           | Default if not set                     |
| ----------------------- | --------------------------------- | -------------------------------------- |
| `DEEPGRAM_API_KEY`      | Deepgram real-time STT            | Falls back to Whisper                  |
| `GOOGLE_SPEECH_API_KEY` | Google STT (tertiary)             | Skipped                                |
| `ELEVENLABS_API_KEY`    | ElevenLabs TTS                    | Falls back to OpenAI TTS               |
| `ELEVENLABS_VOICE_ID`   | Specific ElevenLabs voice         | Default voice                          |
| `STT_PRIMARY_PROVIDER`  | Override STT provider order       | `deepgram` if key set, else `whisper`  |
| `TTS_PRIMARY_PROVIDER`  | Override TTS provider order       | `elevenlabs` if key set, else `openai` |
| `VIDEO_AUTO_RECORD`     | Auto-record all group video rooms | `false`                                |
| `VOICE_AI_ENABLED`      | Feature flag for AI calling       | `true`                                 |

---

## One-Time Setup Steps

These steps must be completed once in the Twilio console before voice and video features are fully operational:

1. **Create a Twilio API Key** — In the Twilio console, go to Account → API Keys → Create New API Key. Save the SID and Secret as `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET`.

2. **Create a TwiML App** — In the Twilio console, go to Voice → TwiML Apps → Create new TwiML App. Set the Voice Request URL to `https://your-api-domain.com/webhooks/twilio/voice/{userId}/browser-call`. Save the App SID as `TWILIO_TWIML_APP_SID`.

3. **Run the database migration** — `npx prisma migrate dev --name add_call_log` to create the call logs table.

4. **Install the frontend SDK** — Add `@twilio/voice-sdk` (for browser calling) and `twilio-video` (for video rooms) to the frontend package.

---

## Frontend Integration Summary

The backend exposes everything needed for the frontend to build:

- **Browser calling:** Fetch a token from `GET /voice/client/token`, pass it to the Twilio Voice SDK `Device`, then use `device.connect()` to dial and listen for `incoming` events to receive.
- **Video rooms:** Create a room via `POST /video/rooms`, fetch a token via `POST /video/rooms/:roomSid/token`, then use the `twilio-video` SDK to connect.
- **Call history:** `GET /voice/calls` with optional `direction` and pagination filters.
- **AI call:** `POST /voice/ai/call` with a `to` number and optional `goal` string.

Detailed frontend integration examples are in [beehive/support-frontend-integration-guide.md](beehive/support-frontend-integration-guide.md).

---

## Files Reference

### New files added

| File                                | Purpose                                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| `src/voice/voice.service.ts`        | Core voice service — call management, tokens, webhooks       |
| `src/voice/voice.controller.ts`     | REST and webhook endpoints for voice                         |
| `src/voice/ai-voice.service.ts`     | AI call pipeline — session, LLM, knowledge, transcripts      |
| `src/voice/voice-stream.gateway.ts` | WebSocket gateway for Twilio Media Streams (real-time audio) |
| `src/voice/stt.service.ts`          | Hybrid Speech-to-Text with provider fallback                 |
| `src/voice/tts.service.ts`          | Hybrid Text-to-Speech with provider fallback                 |
| `src/voice/voice.module.ts`         | NestJS module declaration                                    |
| `src/voice/dto/voice.dto.ts`        | Request/response type definitions                            |
| `src/video/video.service.ts`        | Twilio Video Rooms management                                |
| `src/video/video.controller.ts`     | REST endpoints for video                                     |
| `src/video/video.module.ts`         | NestJS module declaration                                    |

### Modified files

| File                                       | What changed                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                     | Added `CallLog` model, `CallDirection` and `CallStatus` enums                     |
| `src/app.module.ts`                        | Registered `VoiceModule` and `VideoModule`                                        |
| `src/ai/nlp/intent-recognition.service.ts` | Added `call_request` intent, `isCallRequest()` and `extractPhoneNumber()` helpers |
| `src/messages/messages.service.ts`         | Added "call me now" detection before AI response generation                       |
| `src/sms/twilio-sms.controller.ts`         | Updated legacy voice webhook stub                                                 |

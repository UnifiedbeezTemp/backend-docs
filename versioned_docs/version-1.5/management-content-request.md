# Content Request: UnifiedBeez Platform Knowledge Base

To ensure Beezora AI can provide high-quality support to our users, we need the following content curated and structured for the platform knowledge base.

## Required Content Areas

### 1. Product Documentation & Features
- **Account Setup**: Step-by-step guides for new users, organization management, and invitation flows.
- **Channel Integrations**: Detailed instructions for connecting WhatsApp (WABA), Email, SMS, Facebook, etc.
- **AI Configuration**: How to train Beezora, set tones, styles, and instructions.
- **Message Hub**: Usage of the central inbox, labels, and assignment features.

### 2. Billing & Subscription
- **Pricing Plans**: Details of each tier (Starter, Pro, Enterprise) and what's included.
- **Add-ons**: Information on WhatsApp seats, AI assistants, and usage packs.
- **Stripe Integration**: How to manage payment methods, download invoices, and handle failed payments.

### 3. Technical & API
- **Webchat Installation**: Detailed code snippets and troubleshooting for the webchat widget.
- **API Reference**: Core endpoints for power users (identity, messages, contacts).
- **Webhooks**: How to receive events from UnifiedBeez.

### 4. Support & FAQs
- **Troubleshooting Common Issues**: "Why is my WhatsApp disconnected?", "How to reset my password?", etc.
- **Release Notes**: A historical log of updates to reassure users of continuous improvement.

## Instructions for Content Preparation
- **Format**: Markdown preferred for better semantic parsing.
- **Structure**: Use clear headings (H1, H2, H3) and bullet points.
- **Tone**: Professional, helpful, and concise (matches Beezora AI default).
- **Images**: If including screenshots, provide alt-text descriptions as well.

## Submission
Please upload these documents to the internal `knowledge-prep` S3 bucket or share via the project management tool. Once uploaded, we will trigger the platform knowledge indexing script (`setup-platform-knowledge.ts`).

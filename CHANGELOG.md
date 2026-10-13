# Changelog

## 1.0.2 - 2026-10-13

- Fixed Ollama generation formatting by sending explicit response schemas for quote and social-content modes.
- Reduced generation randomness and raised the output budget for the small local Gemma model.
- Added HTTP integration assertions confirming the schemas are sent to Ollama.

## 1.0.1 - 2026-10-13

- Made generated WhatsApp, aftercare, follow-up, caption, story, hashtag and call-to-action drafts editable in place.
- Added server-side quote-response guardrails to normalize detected currency amounts and neutralize common direct booking-confirmation claims.
- Made existing service session durations editable.
- Hardened oversized-body and malformed-path handling and added HTTP integration coverage.
- Added desktop/mobile UI preview screenshots and expanded the release check command.

## 1.0.0 - 2026-10-13

- Initial Week 2 Side Hustle MVP for independent nail artists.
- Added deterministic, configurable estimates and human-reviewed client messages.
- Added Gemma 3 1B / Ollama local generation with clearly labelled template fallback.
- Added local client pipeline, editable service catalogue, content studio, data export and clear controls.
- Added Gujarati/Hinglish template fallback, PWA shell caching, README, MIT license, submission draft, and automated tests.

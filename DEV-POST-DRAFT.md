---
title: "NailFlow AI: A Local-First Studio Assistant for Nail Artists"
published: false
tags: devchallenge, hf26challenge, ai, opensource
---

*This is a submission draft for the [Hacktoberfest Open-Source AI Challenge: Week 2 — Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).* 

## What I Built

NailFlow AI is a local-first workflow assistant for independent nail artists and small beauty studios. A service inquiry can become a transparent estimate, an editable WhatsApp reply, general aftercare guidance, and a follow-up message. A separate content studio drafts social captions and story/status copy from the studio's own details.

The problem is small but frequent: solo artists do the creative work and the business admin. They need to answer enquiries clearly, apply consistent prices, follow up politely, and promote their work without spending the day writing variations of the same message.

NailFlow keeps the human in charge. The quote is calculated deterministically from the studio's editable menu, chosen complexity, and explicit add-ons. After generation, server-side guardrails normalize detected currency amounts to the approved estimate and neutralize several common direct booking-confirmation claims. These safeguards are not perfect, so every reply still requires human review; the app never sends messages or books appointments automatically.

## Demo

**Live demo:** https://nail-flow-ai-lemon.vercel.app/\n\nThe deployed Vercel app demonstrates the current web experience. Local Gemma generation requires Ollama on the user’s machine; the hosted deployment should not be described as running local inference unless that behavior has been separately verified.

Recommended short walkthrough: edit the starter service prices, enter a sample client request, generate a pack, edit the draft before copying, save it to the pipeline, and create a social content pack. Use sample details in the recording. Clearly distinguish the deployed experience from local Ollama/Gemma inference.

## Code

Repository: https://github.com/yagnik-satani-otelier/NailFlow-AI

## How I Built It

NailFlow uses a dependency-free Node.js HTTP server, vanilla JavaScript, and CSS. The AI path uses Gemma 3 1B through Ollama, running locally by default. The app calls the local server, and the server forwards a structured prompt to the local Ollama API. Model selection can be changed using `OLLAMA_MODEL`.

The prompts and output parsing are visible in `lib/core.js`. A native Node test suite currently passes 20 tests covering input bounds, deterministic pricing, prompt constraints, post-generation quote guardrails, response parsing, template fallback, a mocked Ollama bridge, and HTTP error/security cases. If Ollama isn't running or the model is missing, the UI marks the result as `TEMPLATE MODE` rather than labelling it AI-generated.

## Why Does Open Innovation Matter?

For a solo studio, a per-message API bill and a cloud dependency can make a small admin assistant harder to justify. Local inference means drafts can be generated on the studio's own machine without a NailFlow-hosted inference account or API key. The studio controls its service menu, pricing logic, prompts, and model choice instead of relying on a closed writing endpoint.

This also changes the privacy boundary: when configured for local use, enquiry text goes to the local Ollama service rather than a hosted AI provider. The browser workspace is local to the device. The trade-off is that the user must install and run Ollama and a model, and small local models may need editing and review. Gemma's weights and runtime terms should still be reviewed separately; open weights should not be casually equated with OSI-approved open-source software.

## My Agent Session

Optional. Add a real DevRelay session link or embed after capturing it. Do not claim a session that was not saved.

## My First User

Optional. Remove this section unless someone outside the build process has tried the app. If tested, share what workflow they attempted, what feedback they gave, and whether they would pay or use it again. Do not invent a testimonial or payment.

## Prize Categories

Potential category: **Best Use of Gemma**, if the finished, demonstrated project meaningfully uses Gemma and the final implementation meets the category rules. Confirm eligibility and name the category explicitly before publishing. Remove this section if it does not qualify.

## What I Tested

- Automated tests: `npm test` (20 passing unit and HTTP integration tests; the Ollama integration uses a mock server, not actual Gemma weights).
- A browser UI smoke test with a mocked generation response covered in-place quote/content edits, saving to the client pipeline, service-duration editing, and 390px mobile layout without horizontal overflow.
- Before publishing, still verify actual Ollama/Gemma inference locally, the `LOCAL AI` / `TEMPLATE MODE` labels, persistence across a real page refresh, export/clear, and capture a short video walkthrough of the deployed app.
- I have not conducted a field or customer test yet. Replace this note with only what was actually tested.

---

**Submission checklist:** repository and deployed demo links are now included; capture a genuine walkthrough, publish using the official Week 2 submission template and `#hf26challenge` tag, verify current contest rules, and submit only one entry during the entry period. Do not publish this draft until placeholders are resolved and the demo has been recorded.

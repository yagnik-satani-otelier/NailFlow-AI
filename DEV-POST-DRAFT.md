---
title: "NailFlow AI: Local AI for the Admin Side of a Nail Studio"
published: false
tags: devchallenge, hf26challenge, ai, opensource
---

Running a small nail studio means doing two jobs: the creative work clients come for, and the admin that happens between appointments. NailFlow AI is a small assistant I built for independent nail artists and beauty studios to make that second job easier.

## What I Built

NailFlow turns a service inquiry into a transparent price estimate and editable client-ready copy. It can prepare a WhatsApp reply, general aftercare notes, a follow-up message, and social content such as captions, stories, hashtags, and calls to action. A local client pipeline lets the artist save a quote and track it as Draft, Follow-up, or Done. The service menu can be edited to reflect the studio's own prices and session durations.

The idea is deliberately focused: independent artists shouldn't have to rewrite the same kinds of messages all day or guess at a price on every inquiry. NailFlow gives them a draft they can review and adapt, not an automation that speaks to a client without permission.

The quote itself is calculated in code from the artist's editable menu, design complexity, and selected add-ons. AI helps with wording; it does not decide the final price. Server-side guardrails normalize detected currency amounts to the computed estimate and neutralize some common false booking-confirmation claims. These safeguards reduce risk but are not perfect, so every message should still be reviewed before sending. NailFlow does not send messages or book appointments automatically.

## Demo

**Live web demo:** https://nail-flow-ai-lemon.vercel.app/

The deployed Vercel version demonstrates the web interface and its template fallback. It is **not connected to Ollama running on my computer**, so the hosted demo should not be treated as proof of live Gemma inference.

For an AI demonstration, run the project locally with Ollama and Gemma 3 1B. In the local app, look for the **LOCAL AI** label on generated output. If the app shows **TEMPLATE MODE**, it used the built-in fallback instead.

## Code

**Public repository:** https://github.com/yagnik-satani-otelier/NailFlow-AI

## How I Built It

NailFlow uses a dependency-free Node.js HTTP server, vanilla JavaScript, CSS, and browser localStorage. The local-AI path is designed to use **Gemma 3 1B through Ollama**. The browser calls the local Node server, which forwards a structured prompt to the Ollama API on the same machine. The model can be changed with the `OLLAMA_MODEL` environment variable.

The prompts, validation, output parsing, deterministic pricing, and post-generation quote guardrails are visible in `lib/core.js`. When Ollama or the model is unavailable, the interface clearly labels generated content as template fallback rather than pretending it came from AI.

To run the local AI path, install [Ollama](https://ollama.com/download), then run these commands in the repository folder:

```powershell
ollama pull gemma3:1b
npm run check
npm test
npm start
```

Open http://127.0.0.1:4174. Generate a sample client pack and confirm that the result says **LOCAL AI**. If it says **TEMPLATE MODE**, the request did not use Gemma.

## Why Does Open Innovation Matter?

For a solo studio, a per-message AI bill or a dependency on a hosted writing API can make a small admin assistant less practical. Local inference can avoid a NailFlow-hosted inference service or API key, while letting the studio control its own service menu, prompts, and model choice. When run with Ollama on the same machine, enquiry text goes to that local Ollama service rather than to a hosted AI provider.

There is a trade-off: the user must install and run Ollama and download a model, and a small model can produce wording that needs editing. The hosted web demo is useful for seeing the interface, while local setup is necessary to demonstrate the Gemma path. Gemma is an open-weight model; open weights should not automatically be described as OSI-approved open-source software, and model terms should be reviewed separately.

## What I Tested

- **Automated suite:** 20 passing unit and HTTP integration tests covering input bounds, deterministic pricing, prompt constraints, quote guardrails, parsing, template fallback, a mocked Ollama bridge, and HTTP error/security cases.
- **Browser smoke test:** with mocked generation responses, I checked in-place quote and content editing, saving a quote to the client pipeline, service-duration editing, and a 390px mobile layout without horizontal overflow.
- **Important limitation:** the HTTP integration tests use a mock Ollama server, not the actual Gemma weights. These tests validate the app's bridge and guardrails but do not prove live Gemma output quality.

I haven't run a customer trial yet, so I won't claim that a nail artist has paid for or adopted the tool. A useful next validation is to put it in front of one artist, observe a sample inquiry workflow, and use their feedback to improve it.

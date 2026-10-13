# NailFlow AI — contest demo guide

The Week 2 submission requires a deployed project or a video demo. This project currently runs locally and uses local Ollama inference, so a short screen recording is the most straightforward honest demo.

## Before recording

1. Install/start Ollama and download the model:

   ```powershell
   ollama pull gemma3:1b
   ollama list
   ```

2. In the NailFlow project folder, run:

   ```powershell
   npm run check
   npm test
   npm start
   ```

3. Open <http://127.0.0.1:4174> and wait for the sidebar to report **Gemma ready**. If the app shows Template Mode, the model is not ready; troubleshoot Ollama first if you intend to demonstrate AI generation.

4. Use fictional sample details. Do not show real client names, private messages, or personal data.

## Suggested 60–90 second walkthrough

1. **Problem and home screen (5–10 sec):** explain that independent nail artists often handle client replies, pricing, follow-ups, and social posts manually.
2. **Studio menu (10 sec):** change one demo service price and session duration to show that the artist controls the numbers.
3. **Quote workflow (20–25 sec):** open Quote Studio, enter a fictional client name, choose a service and complexity, then generate the client pack. Show the separate estimate and the `LOCAL AI` label. Edit the WhatsApp draft in place, then copy it without sending it.
4. **Pipeline (10 sec):** save the quote and mark the conversation as Follow-up.
5. **Content workflow (15–20 sec):** create a social content pack, adjust the caption or hashtags, and save the draft.
6. **Open innovation and privacy (10 sec):** show the local model status and explain that the browser workspace is local to the device and that generation calls go to the local Ollama service by default.

## Important accuracy rules

- Do not claim the generated text is ready to send without human review.
- Do not claim an appointment has been booked, an availability slot has been verified, or the app communicates with clients automatically.
- The quote guardrails are safeguards, not perfect guarantees. Always review the final draft.
- If the result shows `TEMPLATE MODE`, describe it as the built-in fallback, not as output produced by Gemma.
- Do not claim that a real client tested the app or would pay for it unless you have actually asked them.

## After recording

Upload the video to a link that the judges can access, then replace the Demo placeholder in `DEV-POST-DRAFT.md` with that verified link. Add the public GitHub repository URL after pushing the code. Review the official Week 2 submission template and deadline before publishing or submitting.

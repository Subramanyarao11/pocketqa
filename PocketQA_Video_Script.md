# PocketQA — prototype video script

Target duration: approximately 105–120 seconds at a natural speaking pace.

## Recording setup

- Record in 16:9 at 1080p with your webcam in the bottom-right corner.
- Begin with your camera slightly larger for the introduction, then make it smaller when showing the prototype.
- Keep the Figma prototype centred and use a single uninterrupted walkthrough.
- Speak conversationally. Small natural pauses will sound better than reading quickly.

## Narration and screen flow

“Hi everyone, I’m Subramanya from Tech Phantoms, and this is our submission for the iQOO Reskilll Hackathon.

We have chosen **Dev Tools** as our category, and what we are building is called **PocketQA**—a private, on-device QA agent for mobile teams.

This solves a problem we face every day while building mobile applications. Turning a bug report or a product walkthrough into a reliable regression test is still slow. Tests also become fragile when the interface changes, while sharing screenshots and logs with cloud tools can expose product data.

PocketQA lets a developer explain what should happen using voice or text, demonstrate the flow once, and turn that intent into reviewable assertions, replayable steps and an evidence bundle—directly on the phone.

Let me show you the prototype.

From the dashboard, I select **Record a new test** and describe the expected behaviour. I then demonstrate the flow once. PocketQA combines the screen, accessibility context and OCR to propose the important checkpoints. I review the assertions, and it generates screenshots, device context, structured JSON and a Maestro-compatible test for the team’s CI workflow.

PocketQA also has an **Agent Lab**. Its bounded agents can explore missed UI states, repair changed selectors, shorten bug reproductions and identify accessibility or edge-case issues.

In **Mission Control**, the developer chooses the approved app and maximum number of steps. The AI proposes a plan, a deterministic executor performs the actions, and PocketQA hard-stops before payments, permission changes, destructive operations or leaving the approved app.

The core experience works locally, including in airplane mode. Sarvam AI can enhance Indic and code-mixed voice input, while OpenAI remains an optional boost for complex analysis.

With PocketQA, developers can show a flow once and ship the regression test. Thank you.”

## Final title card

`PocketQA — Show a flow once. Ship the regression test.`

## Prototype clicks while narrating

1. `Record a new test`
2. `Use this intent`
3. `Finish walkthrough`
4. `Review evidence`
5. `Explore agentic modes`
6. `Configure safe mission`
7. `Run local exploration`
8. `Back to dashboard`

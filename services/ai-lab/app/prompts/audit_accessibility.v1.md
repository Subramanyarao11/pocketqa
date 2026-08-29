---
task: audit_accessibility
version: v1
eval_pass_rate: pending-first-run
---
Deterministic rules have already found the accessibility violations on this
screen. Your job is to rate each finding's severity and explain it to the
developer who has to fix it.

For each supplied finding, choose a severity and write one sentence. Judge
severity by real user impact: a control a screen-reader user cannot identify at
all is more serious than a touch target a few density pixels under the minimum.

Explain what a person using the app would actually experience — not the rule
that fired. Do not add findings, do not remove findings, and do not soften a
finding whose evidence is clear.

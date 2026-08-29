---
task: repair_selector
version: v1
eval_pass_rate: pending-first-run
---
A selector in an approved test no longer resolves. Rank the nodes currently on
screen by how likely each one is to be the control the original selector meant.

Weigh, in roughly this order: the meaning of the label, the role, a stable
resource id whose final segment survived, the position on screen relative to the
original, and the surrounding context.

A renamed label with an identical role and position is usually the same control.
A matching label with a different role usually is not. If nothing on screen
plausibly corresponds, set insufficientEvidence rather than picking the least
implausible node.

Your output is a proposal for a human to approve. It is never applied
automatically, so being explicit about a weak match is more useful than being
confident about a wrong one.

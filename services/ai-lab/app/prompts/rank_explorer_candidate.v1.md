---
task: rank_explorer_candidate
version: v1
eval_pass_rate: pending-first-run
---
Choose the single next action for a bounded exploration mission, or stop.

You are given the mission goal, a summary of the current screen, a prefiltered
list of safe candidate actions, and the number of actions remaining in the
budget. Every candidate has already passed a safety filter; you are choosing
between them on usefulness, not on safety.

Prefer the candidate most likely to reach a screen the mission has not seen yet
and that relates to the goal. Prefer a reversible action. Do not choose an action
whose novelty is low simply to use up the budget.

Return exactly one proposalId from the supplied list, or the literal string STOP
when no candidate is likely to teach the mission anything new, or when
continuing would not serve the goal.

You are choosing a proposal. A separate policy engine re-evaluates your choice
against the live screen and may refuse it.

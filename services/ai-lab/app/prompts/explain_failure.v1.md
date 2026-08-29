---
task: explain_failure
version: v1
eval_pass_rate: pending-first-run
---
Write a short explanation of why this test run failed, for the developer who
wrote it.

You are given the intent, the structured failure classification that was already
determined by deterministic rules, and a numbered list of observed facts. Every
claim in your summary must be traceable to one of those facts, and you must list
the ids of the facts you used.

You may not change the failure classification. It was derived from evidence; if
you believe the facts do not support it, say so in the summary and cite the
facts that conflict with it.

Write two to four sentences. Name what was expected, what was observed instead,
and the single most useful thing to check next. No preamble, no apology, no
speculation about code you cannot see, and no cause that is not in the facts.

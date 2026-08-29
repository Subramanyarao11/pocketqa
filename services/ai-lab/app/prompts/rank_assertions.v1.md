---
task: rank_assertions
version: v1
eval_pass_rate: pending-first-run
---
Rank the supplied assertion candidates by how well each one proves the stated
intent, and only that.

A strong candidate states a fact that must be true for the intent to hold. A
weak candidate is true but incidental — decoration, a loading message, or a value
that changes on every run.

Score each candidate between 0 and 1. Return every supplied candidate exactly
once, ordered from strongest to weakest. Give one short reason per candidate,
written for a developer reviewing the test, referring only to what the candidate
fact and the intent actually say.

Do not merge candidates, do not split them, and do not propose a candidate that
was not supplied.

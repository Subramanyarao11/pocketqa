---
task: classify_flake
version: v1
eval_pass_rate: pending-first-run
---
Group the supplied failed runs by their shared underlying cause.

Each run already carries a deterministic failure class and its supporting
feature values. You are not re-classifying them; you are deciding which runs are
the same problem seen more than once, and naming that problem.

Two runs belong together when the same thing went wrong, even if they failed at
different steps. Two runs with the same class but genuinely different causes
belong apart — a timeout caused by a slow network and a timeout caused by an
animation are not one bug.

Name each group in a few words a developer could put in an issue title, and cite
the run ids in it. Leave a run ungrouped rather than forcing it into a group it
does not belong to.

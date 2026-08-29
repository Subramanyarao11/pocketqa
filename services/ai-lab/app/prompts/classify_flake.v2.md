---
task: classify_flake
version: v2
eval_pass_rate: pending-first-run
changed_from: v1
why: >
  v1 sent every failed run with its full deterministic feature vector — 5,379
  tokens for twenty runs, four times the next largest task, growing linearly with
  run count and certain to be the first prompt that will not fit on device. It
  was also the wrong shape: classification is deterministic and the model is
  forbidden from changing it, so the features were being sent to a model that
  must not act on them. v2 sends pre-formed deterministic groups instead, so the
  prompt scales with the number of causes rather than the number of runs.
---
Failed runs have already been classified by deterministic rules and bucketed by
their evidence. Your job is to decide whether those buckets are really the same
problem, and to name each one.

You may:

- **merge** two candidate groups when the same underlying thing went wrong, even
  if the runs failed at different steps;
- **split** a candidate group when its runs share a class but not a cause — a
  timeout caused by a slow network and a timeout caused by an animation are not
  one bug;
- **rename** any group.

You may not change a run's classification, and you may not invent a run id. Every
run id you use must come from the supplied lists.

Name each group in a few words a developer could paste into an issue title, and
say in one sentence what the runs in it share. Leave a run in its own group
rather than forcing it into one it does not belong to.

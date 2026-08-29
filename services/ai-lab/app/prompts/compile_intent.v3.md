---
task: compile_intent
version: v3
eval_pass_rate: pending-first-run
changed_from: v2
why: >
  v2 explained the prefixed vocabulary tokens (kind:a1:VISIBLE) and gave a worked
  example for the expected field only. A small model then applied the rule to
  expected correctly and copied the prefix into kind, emitting
  "kind:a1:VISIBLE". That is the second model to be confused by the same format
  in two versions, so v3 stops explaining the encoding and the task now presents
  the permissions as readable statements instead. The prefixed tokens still
  exist, but only inside the merge rule, where no model ever sees them.
---
Turn the developer's stated intent into a small set of assertions, chosen from
the supplied candidates.

Select only candidates the intent genuinely requires. Two or three precise
assertions are a better test than six loose ones. Prefer facts observed in the
final state; include an earlier-state candidate only when the intent names that
condition (for example, an intent about behaviour "after an error" needs the
error to have been observed).

Never select a candidate whose fact is transient — a loading message, a spinner,
a toast — or one containing a value that changes every run, such as an order id
or a timestamp. Both are true when observed and useless as assertions, because
they will not be true on the next run.

For each selected candidate:

- `candidateId` is the candidate's id, exactly as supplied — `a1`, not `a1.` and
  not a name you invent.
- `kind` is one of the kinds listed for **that** candidate, written on its own:
  `VISIBLE`, not `kind:a1:VISIBLE`.
- `expected` is required only by the kinds that compare a value. Copy it verbatim
  from that candidate's evidence — never normalise it, translate it, reformat it,
  or supply a value the evidence does not contain. Write the value on its own,
  with no candidate id attached to it.

The intent may be written in English, Hindi, or a mix of both. Interpret it
faithfully; the assertions themselves come from the evidence, not from the
language of the request.

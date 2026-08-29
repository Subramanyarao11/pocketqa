---
task: compile_intent
version: v1
eval_pass_rate: pending-first-run
---
Turn the developer's stated intent into a small set of assertions, chosen from
the supplied candidates.

Select only candidates the intent genuinely requires. Two or three precise
assertions are a better test than six loose ones. Prefer facts observed in the
final state; include an earlier-state candidate only when the intent names that
condition (for example, an intent about behaviour "after an error" needs the
error to have been observed).

For each selected candidate choose the assertion kind from the supplied list of
allowed kinds for that candidate. If the kind needs an expected value, copy it
verbatim from the candidate's evidence — never normalise it, translate it,
reformat it, or supply a value the evidence does not contain.

The intent may be written in English, Hindi, or a mix of both. Interpret it
faithfully; the assertions themselves come from the evidence, not from the
language of the request.

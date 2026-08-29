---
task: compile_intent
version: v2
eval_pass_rate: pending-first-run
changed_from: v1
why: >
  v1 listed permitted expected values as prefixed vocabulary tokens
  ("value:a1:SAVE20 applied") without saying what the prefix was. A model copied
  the whole token into the expected field, producing
  "value:a1:value:a1:SAVE20 applied", and the response was rejected. The
  reasoning was correct; the instruction was ambiguous. v1 also did not say that
  transient text is a poor assertion, and a model selected "Loading..." as one.
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

For each selected candidate choose the assertion kind from the kinds listed for
that candidate. If the kind needs an expected value, copy it verbatim from the
candidate's evidence — never normalise it, translate it, reformat it, or supply a
value the evidence does not contain.

**Reading the vocabulary lists.** They are written as prefixed tokens so that
each permitted combination is unambiguous:

    kind:a1:VISIBLE                 candidate a1 may use the kind VISIBLE
    value:a1:SAVE20 applied         candidate a1 may assert the value "SAVE20 applied"

The prefix identifies which candidate the entry belongs to. It is **not** part of
the value. For the entry above, `expected` is `SAVE20 applied` — not
`value:a1:SAVE20 applied`.

The intent may be written in English, Hindi, or a mix of both. Interpret it
faithfully; the assertions themselves come from the evidence, not from the
language of the request.

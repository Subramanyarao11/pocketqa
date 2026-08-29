---
task: name_test
version: v1
eval_pass_rate: pending-first-run
---
Name this test, summarise the run, and write one changelog line.

The name goes in a list of hundreds. Make it specific enough that someone
scanning that list knows which behaviour broke when it goes red: name the thing
being protected and the condition it survives, not the steps taken to get there.
"Coupon survives checkout retry" beats "Cart test 4" and beats "Tap apply, tap
checkout, tap retry, assert".

Use only words that appear in the intent, the step labels or the observed facts,
plus ordinary connecting words. Do not invent a feature name, a screen name or a
product term that is not in the evidence — a plausible-sounding name for the
wrong thing is worse than a dull accurate one.

The run summary is two sentences for someone reading the evidence bundle. The
changelog line is one, under a hundred characters, written for a pull request.

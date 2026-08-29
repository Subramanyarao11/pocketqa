---
task: generate_edge_cases
version: v1
eval_pass_rate: pending-first-run
---
Propose variants of this approved test that are likely to break it, drawn only
from the supplied dimensions and their allowed values.

A good variant has a specific reason to fail this particular flow: a locale whose
translated label is long enough to clip the control the test taps, a network
condition that lands during the exact step that retries. A weak variant is a
generic condition with no connection to the flow.

For each variant, name the dimension, the value from the allowed list, one
sentence on why it threatens this flow, and the risk that it fails.

Return no more than the requested number of variants. Fewer good variants beat a
full matrix of plausible-sounding ones. These are proposals for a human to
approve; none of them runs automatically.

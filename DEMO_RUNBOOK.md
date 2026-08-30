# PocketQA — live demo runbook

Three paths, run by hand on the device. Timings are what they actually took on
the iQOO test phone, so you can pace your narration instead of guessing.

Read **Pre-flight** once and do it every time. Most demo failures are setup, not
software.

---

## Pre-flight (5 minutes, do it before you present)

**1. Start the AI service and bridge it to the phone.**

```bash
cd services/ai-lab && make dev          # serves on :8000
adb reverse tcp:8000 tcp:8000           # phone's localhost:8000 -> your Mac
curl -s localhost:8000/health           # expect openai READY
```

`adb reverse` dies when the cable is unplugged or the phone reboots. Re-run it
if the app suddenly says it is offline.

**2. Confirm the accessibility service is on.**

Settings → Accessibility → PocketQA capture → **On**.

> **Never `adb shell am force-stop` PocketQA.** Force-stopping silently disables
> its accessibility service, and the app will then say "Needs action" on the
> readiness screen with no obvious cause. This cost hours during development.
> Close the app with the back gesture or the recents switcher instead.

**3. Put the target apps in a known state.**

```bash
adb shell am start -a android.intent.action.VIEW -d "demoshop://reset?fixture=reset"  com.techphantoms.pocketqa.demoshop
adb shell am start -a android.intent.action.VIEW -d "demotasks://reset?fixture=reset" com.techphantoms.pocketqa.demotasks
```

You can also pick the fixture in the app (it appears under the target app once
you select one) — that is the better story to tell an evaluator, because it is
the product doing it rather than you.

**4. Stop the screen sleeping.** Display timeout → 10 minutes, or Developer
options → Stay awake. The device slept mid-run during testing and the session
had to be restarted.

**5. Check the home screen says `Online`** (top right). That pill is how you
know the AI endpoint is reachable. If it says otherwise, redo step 1.

---

## Path A — The core loop (≈4 min)

**The one to lead with.** Everything else is supporting evidence.

| # | Do this | Expect | Say |
|---|---|---|---|
| 1 | Home → **New test** | "Define intent and capture scope" | "I describe what must stay true, in my words." |
| 2 | Tap the intent box, type: `The cart shows Wireless Headphones after adding it` | counter shows ~48 / 500 | Under 10 characters and Continue stays disabled — deliberate. |
| 3 | Tap **Search**, type `Shop` | one row: Demo Shop | "Only the app I pick is in scope." |
| 4 | **Tap the Demo Shop row** | fixture chips appear | Selecting is the consent — it is not auto-picked. |
| 5 | Tick **I acknowledge…**, tap **Continue** | "Before we switch to Demo Shop" | Names your target, not a hardcoded sample. |
| 6 | Tap **Start demonstration** | Demo Shop opens, recording | "Now I just use the app." |
| 7 | Tap **Add** on Wireless Headphones | button reads **Added**, cart shows (1) | — |
| 8 | Tap **Cart** | cart screen | — |
| 9 | Switch back to PocketQA (recents) | "2 steps captured" | "It watched; it did not record my taps blindly." |
| 10 | Tap **Finish** | ~10–30 s, then "Review draft" | **Talk here.** This is the longest wait. |
| 11 | Read the draft aloud | `testId=add_to_cart_1`, `testId=cart_button` | "Stable IDs, not screen coordinates." |
| 12 | Scroll to **Final assertions** | 1–2 proposed, "Proposed from your intent" | "The model *chose* from candidates the deterministic layer produced. It did not invent them." |
| 13 | Tap **Approve** | Replay screen | — |
| 14 | Tap **Replay locally** | Demo Shop drives itself, ~7 s | "No ADB, no script. The app is replaying the test." |
| 15 | Back to PocketQA | **PASS**, 2 steps · ~6.9 s | — |
| 16 | Point at the provenance pills | `connected-assist`, `No network used`, `schema …` | "Two different facts: the *test* used AI, this *run* did not." |

**The line that lands:** step 14. Let them watch the phone drive itself.

---

## Path B — Honesty and offline (≈3 min)

**The differentiator.** Any demo can show a happy path; this shows the product
refusing to overclaim.

### B1 — It says what it used

On the draft from Path A, point at:

- **"Named by google/gemini-2.5-flash — edit freely before approve"** — the name came from a model, and it says so.
- **"Compiled by connected-assist"** — not "offline", because AI was involved.
- On the evidence screen, `No network used` — true of *that run*, even though the test was compiled with AI.

> "It distinguishes what built the test from what ran it. Most tools blur that."

### B2 — Pull the plug (the strongest 30 seconds you have)

```bash
adb reverse --remove tcp:8000
```

Now run **Path A steps 1–10 again** with intent `Coupon SAVE20 stays applied in the cart`.

| Expect | Say |
|---|---|
| Compile finishes in **~7 s** (faster, not slower) | "The AI was never on the critical path." |
| **"Compiled by deterministic-local"** | — |
| **"Offline compile"** chip | "Same test, same steps. It just tells you the truth about how it got there." |

Restore afterwards: `adb reverse tcp:8000 tcp:8000`

### B3 — When the model declines (optional, 30 s)

Use an intent containing something sensitive:
`Receipt for asha@example.com card 4111111111111111 stays visible`

- The draft shows your intent **in full, locally**.
- Final assertions says **"Couldn't propose assertions — add one below"**.

> "Redaction stripped the sensitive parts before anything left the device, so
> the model had nothing to work with and said so. It didn't guess, and it didn't
> pretend it was never asked."

If an evaluator asks whether redaction really happens: it is verified on the
wire, not asserted — a proxy between phone and service confirms the email and
card number never leave the device.

---

## Path C — Agent Lab (≈2 min)

**Show this only if you have time.** It is the least-exercised screen.

| # | Do this | Expect |
|---|---|---|
| 1 | Home → **Agent Lab** | "Bounded exploratory testing" |
| 2 | Leave the goal as-is | "Find a nearby checkout state…" |
| 3 | Set **Max actions 3**, **Max seconds 60** | — |
| 4 | Scroll to **Target app**, tap **Demo Shop** | pill reads `Allowlist: …demoshop` |
| 5 | **Review mission** | shows `Actions ≤ 3`, `Time ≤ 60s`, hard stops |
| 6 | **Approve mission** | Demo Shop opens, mission runs |
| 7 | Back to PocketQA | `Actions n/3`, `Time 60s left`, **"Ranked by google/gemini-2.5-flash"** |

**What to say:** "The agent proposes; it never acts outside the budget I
approved, and the budget on the review screen is the budget it runs with. It
only reorders candidates the policy engine already allowed — it cannot invent a
target."

⚠️ The app list here is long and has no search. Scroll to find Demo Shop, or
practise the scroll distance beforehand.

---

## Path D — A second, very different app (≈2 min)

Only if asked *"does this work on anything but your sample app?"*

Run **Path A** against **Demo Tasks** instead:

- intent: `The Done tab lists Write release notes`
- demonstrate: tick the checkbox on **Write release notes**, then tap the **Done** tab
- expect: 2 steps, `accessibilityLabel=toggle task_1` and `testId=tab_done`, replay **PASS**

**Why it is worth showing:** Demo Tasks is a classic View/XML app with a
RecyclerView, not Compose. Its checkboxes all share the id `task_checkbox`, so
PocketQA deliberately picks the *unique* content description over the ambiguous
id — you can point at the selector and explain why it did not take the
"stronger" one.

---

## What Agent Lab actually is

Everywhere else, **you** demonstrate and PocketQA records. Agent Lab inverts
that: you give it a goal and a budget, and it pokes at the app itself looking
for a state you are not testing yet.

It observes the screen, asks the model to pick the most promising control *from
a list the policy engine has already filtered*, taps it, observes again — until
it exhausts its actions, exhausts its time, or decides to stop. It returns **a
proposal**: candidate assertions from what it found. It cannot create an
approved test; "Open in review" drops you into the same review screen as Path A.

> "It explores inside a budget I approved, and comes back with a suggestion — it
> never acts on its own conclusions."

**Be honest about what you will see.** In testing the model often chose to stop
immediately (`Actions 0/3`) and still returned three candidate assertions from
its first observation. Correct when the goal does not match the screen, but
undramatic. For visible exploration, use a goal reachable from the product list
such as `Find the cart state after adding an item`.

---

## Path E — Showing a failure (≈1–3 min)

Not required, but a QA tool that only ever goes green proves nothing. Three
ways, safest first.

**E1 — open a failure you already have (zero risk).** The device holds 10 failed
runs beside 12 passing ones. The best is **"SAVE20 coupon survives checkout
retry"**: category `assertion-regression`, summary *Final assertion failed:
expected "SAVE20 applied"*, with the Failure Detective, the AI explanation and
the flake verdict all on screen.

> "The checkout failed, so the coupon confirmation never appeared — and the test
> caught exactly that, without me telling it what to look for."

**E2 — cause one live with `coupon-retry`.** That fixture makes the first
checkout attempt fail and turns the button into *Retry*. Record with the fixture
selected, demonstrate as far as **Place Order** and *stop there* — do not tap
Retry — assert `SAVE20 applied`, approve, replay. It fails with
`assertion-regression`.

**E3 — assert something untrue.** Add a final assertion for text that will not
be on the last screen. Quickest, but say what you are doing.

> **The Add assertion button sits under the keyboard.** Type the target, dismiss
> the keyboard, *then* tap Add assertion. Tapping with the keyboard up hits the
> keyboard and the assertion is silently not added.

**Not a failure fixture:** `selector-drift` renames Apply to "Use coupon" but
keeps its test id, so a recorded test still passes. That is a resilience story —
"we changed the wording and the test held, because it anchors on identity, not
words."

---

## Which intents actually work

**The intent does not choose the steps.** Your demonstration produces the steps.
The intent names the test and decides which *final assertions* get proposed.
Nothing checks the two agree — you can type one thing, demonstrate another, and
it compiles happily.

Assertion candidates are built from **every visible piece of text on the last
screen of your demonstration**, so:

> An intent works when it is about something visible on the final screen.

| Intent | Outcome |
|---|---|
| `The cart shows Wireless Headphones after adding it` | 2 assertions proposed |
| `The Done tab lists Write release notes` | 1 assertion proposed |
| `Coupon SAVE20 stays applied in the cart` | works if you demonstrate as far as the discount showing |
| `Checkout should feel responsive` | nothing to assert — "Couldn't propose assertions" |
| `Receipt for a@b.com card 4111…` | redacted before it leaves, so the model declines |

If an evaluator's own intent yields nothing, that is not a crash — the screen
says so and they can add an assertion by hand. Say: *"it only proposes things it
can actually observe; it will not invent an assertion to look clever."*

---

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| "Needs action" on readiness | accessibility service off, usually after a force-stop | Settings → Accessibility → PocketQA capture → On |
| Home says offline / no AI attribution | `adb reverse` dropped | `adb reverse tcp:8000 tcp:8000` |
| Continue is greyed out | intent < 10 chars, no app tapped, or consent unticked | all three are required |
| Replay fails `TARGET_NOT_FOUND` | app not in its start state | re-run the reset deep link, or pick the fixture in-app |
| Replay fails `TARGET_NOT_VISIBLE` | control is off-screen or under the keyboard | scroll it into view before demonstrating |
| Compile hangs past ~40 s | service unreachable and timing out | it will finish on the deterministic path — keep talking |
| App resumes on an old screen | it restores your last screen | back out to Test library before starting |

**Golden rule:** if a run goes wrong mid-demo, do not fight it. Say *"this is
the part that hard-stops rather than guessing"*, go back to Test library, and
re-run. A visible honest stop is a better story than a silent wrong answer —
that is genuinely the product's thesis.

---

## Numbers worth quoting

- Compile with AI: **10–30 s**. Without: **~7 s**.
- Replay: **~3.4 s per step** (2 steps ≈ 6.9 s, 8 steps ≈ 26.6 s).
- Test suites: **41 Kotlin**, **30 React Native**, **175 Python**, **0 TypeScript errors**.
- The loop passes with the AI service unreachable — verified by killing it.

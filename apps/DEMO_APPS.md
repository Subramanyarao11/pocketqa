# Demo target apps

Four apps PocketQA can be pointed at. They exist to be *targets*, not products:
each one is shaped around a specific thing PocketQA's capture, selector, policy
or replay layers have to get right, and several are shaped around things we
already know it gets wrong.

| App | Package | Stack | Fixtures |
|---|---|---|---|
| Demo Shop | `…demoshop` | Compose | `reset, coupon-retry, selector-drift` |
| Demo Bank | `…demobank` | Compose | `reset, low-balance, transfer-declined, locked-out` |
| Demo Tasks | `…demotasks` | **View / XML + RecyclerView** | `reset, many-tasks, all-done` |
| Demo Settings | `…demosettings` | Compose | `reset, all-enabled, restricted-profile` |

All four declare their fixtures as `pocketqa.fixtures` meta-data in the manifest
and accept `<scheme>://reset?fixture=<id>`. Declaring them is how an app opts
in — PocketQA cannot guess what states a third-party app can reset to.

## Build and install

```bash
cd apps/demo-bank && ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Same for `demo-tasks` and `demo-settings`. Each is a standalone Gradle project,
so nothing needs the React Native workspace to be installed.

---

## Why each app exists

### Demo Tasks — the path that has never been exercised

The most important of the three, and the reason it is not Compose.

**Compose dispatches no `TYPE_VIEW_CLICKED` for a finger tap.** Every capture we
have ever run went through `InteractionInference`, and the platform event path —
the branch that produces `method: "event"` at confidence 1.0 — has never run
against a real app. A View/XML app takes that branch.

What it should prove, and what it may well disprove:

- **Real click events arrive.** Steps should attribute at confidence 1.0 with no
  signals listed, not through the diff.
- **`TYPE_VIEW_TEXT_CHANGED` on a real `EditText`**, not a Compose text field.
- **Checkbox toggles.** `checkable`/`checked` flips feed inference signal 2
  (+0.80), which no existing target has ever produced.
- **A known trap, deliberately built in:** a `RecyclerView` recycles its rows, so
  `resource-id=task_checkbox` is **identical for all nine visible rows** while
  `content-desc="toggle task_1"` is unique. PocketQA's ranker prefers
  `resourceId` (0.94) over `accessibilityLabel`. If it takes the id, nine nodes
  match and the run should hard-stop with `TARGET_AMBIGUOUS`. Either it stops
  honestly — correct, but no test can be recorded against any RecyclerView app —
  or it silently picks one, which is worse. **This is a prediction, not a
  measurement: it has not been run yet.**
- Bottom-nav tabs: navigation that swaps content while the chrome stays put.
- A validation dialog that stays open on bad input — the tree changes without
  the window going away.
- `Delete` behind a confirm dialog, as a destructive control policy should refuse.

### Demo Bank — sensitive input, policy, and dialogs

- **A PIN field.** PocketQA must classify it sensitive from the input type alone
  and redact it. No existing target has a password field, so redaction has only
  ever been unit-tested against strings, never against a live capture.
- **An irreversible money transfer** behind a confirm dialog. This is what the
  policy engine is *for*: a QA tool that cheerfully replays a transfer against a
  real bank is dangerous. Expected behaviour is a hard stop at
  `confirm_transfer_button`.
- **A dialog is a window, not a screen.** It replaces most of the tree with no
  navigation, which is the case the "did we navigate?" heuristic has to survive.
- **A 32-row history that must be scrolled.** Scroll suppression (CAP-09) is
  still unimplemented; this is where that shows up.
- **Amounts are integers in paise, never floats.** A balance rendered from a
  double drifts in its last digit between runs and turns a correct assertion
  into a flake. That is a real defect in banking UIs, avoided here on purpose:
  the app should hand PocketQA hard cases, not noise it cannot act on.
- `low-balance`, `transfer-declined` and `locked-out` give failure paths to
  record a regression against without waiting for a real one.

### Demo Settings — adversarial for the navigation heuristic

Navigation is currently detected structurally: *you have navigated when most of
the ids that identified the previous screen are gone.* This app attacks that
rule from both sides.

- **Live search.** Typing `cam` takes twenty-two rows down to one. Nearly every
  id on screen disappears and **no navigation happened.** If the rule
  misfires here, a control can be blamed for a tap that landed somewhere else —
  which is exactly the bug that once had the cart's `Remove` claiming a coupon
  tap.
- **A dark-theme switch.** The mirror image: every node repaints, the structure
  is identical. Nothing should be attributed to navigation.
- **Control variety Compose shop apps never show** — `Switch`, `RadioButton`
  group, `Slider`, each with a stable tag.
- **A `Slider`** has no single correct value to replay, so any selector leaning
  on the rendered number is guaranteed to drift.
- **Three levels of back stack**, so `popBackStack` is more than one hop.

---

## Suggested first runs

Ordered so each run answers one question.

1. **Demo Tasks → toggle `task_1`, switch to the Done tab.**
   Does attribution come back as `method: "event"` at 1.0, or does it fall
   through to inference? Does the checkbox selector resolve, or hard-stop
   ambiguous on `task_checkbox`?
2. **Demo Settings → type `cam` into search, toggle `switch_camera_access`.**
   Does the filtered list read as navigation? Check `screenChanged` in the
   attribution signals.
3. **Demo Bank → unlock with PIN 1234, open Transfer, pick a payee, enter an
   amount, press Review.**
   Is the PIN redacted in the captured state? Does policy stop at the confirm
   dialog rather than dispatching the transfer?
4. **Demo Bank → History, scroll to the bottom.**
   Is the scroll recorded as a step? It should not be.

Record what actually happens against these, including where the prediction was
wrong — the value of these apps is the failures they surface, not the passes.

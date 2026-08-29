# PocketQA Mac Setup and New Developer Guide

**Audience:** Teammates who are new to mobile development and are setting up a Mac from scratch  
**Project:** PocketQA Android hackathon build  
**Team:** Tech Phantoms  
**Last updated:** 29 August 2026  
**Related documents:** `PocketQA_PRD.md` and `PocketQA_Technical_Spec.md`

---

## 1. What this guide will help you do

By the end of this guide, you should be able to:

1. Clone the PocketQA repository.
2. Open and edit the React Native and Android code.
3. Build both PocketQA and PocketQA Demo Shop.
4. Run them on an Android emulator or physical Android phone.
5. View JavaScript and Android logs.
6. Run unit tests and Maestro UI tests.
7. Create a small branch and submit a pull request safely.

PocketQA is an Android project. You do **not** need full Xcode, an iOS simulator, CocoaPods, or an Apple Developer account for this build. You do need the small Xcode Command Line Tools package because it provides Git and native build utilities used on macOS.

## 2. Do not panic about the architecture

PocketQA has two main layers:

| Layer | Language | What it does | Good beginner tasks |
|---|---|---|---|
| React Native app | TypeScript/React | Screens, buttons, forms, review UI, evidence timeline, Mission Control | Yes |
| Native Android core | Kotlin | Accessibility capture, screenshots, Room storage, policy engine, deterministic execution, ML Kit | Pair with an experienced teammate first |
| Demo Shop | Kotlin/Compose or the stack selected by the team | Safe test app with coupon, retry, and fixture states | Yes |
| Test/export packages | TypeScript/Kotlin/JSON | Schemas, fixtures, Maestro YAML, deterministic rules | Yes, with review |

The most important safety rule is:

> The AI can propose. Validated policy and deterministic code decide. Only the deterministic executor acts.

New contributors should not change the executor, AccessibilityService permissions, policy hard stops, redaction, or credential handling without pairing with the owner of that module.

## 3. Before installing anything

### 3.1 Check the Mac

Open **Terminal** from Applications → Utilities and run:

```bash
sw_vers
uname -m
sysctl -n hw.memsize
df -h /
```

Interpret the processor result:

- `arm64` means Apple Silicon: M1, M2, M3, M4, or later.
- `x86_64` means Intel.

Current Android Studio requirements list macOS 12 and 8 GB RAM as the minimum for the IDE. Running the emulator needs at least 16 GB RAM, while 32 GB RAM and 32 GB free SSD space are recommended. Intel Mac support is being phased out, but a supported Intel Mac can still be used for the project. If a Mac has only 8 GB RAM, use a physical Android phone instead of the emulator.

### 3.2 Required hardware

- Mac running macOS 12 or newer.
- At least 16 GB free disk space; 32 GB free is strongly recommended.
- Reliable internet for the initial tool and dependency downloads.
- A data-capable USB cable if using a physical Android phone.
- Access to the shared iQOO device for integration testing. Daily UI work can use an emulator or another Android phone.

### 3.3 Accounts and access the team lead must provide

- GitHub account added to the PocketQA repository.
- Repository URL.
- Issue/task assignment.
- Access to the team communication channel.
- The exact branch naming and pull-request review rules.

New contributors do not need Sarvam or OpenAI credentials to build and run PocketQA. The deterministic local path is the required baseline.

## 4. Tool checklist

Install these tools in the order shown:

1. Xcode Command Line Tools.
2. Homebrew.
3. Git.
4. Node.js 22.11 or newer.
5. Watchman.
6. JDK 17.
7. Android Studio stable.
8. Android SDK, platform tools, and emulator image if needed.
9. Code editor, preferably VS Code or Android Studio.
10. Maestro CLI.

Do not install random global React Native CLI packages. The project must use the CLI version supplied by its repository dependencies.

## 5. Step-by-step Mac setup

### Step 1 — Install Xcode Command Line Tools

In Terminal:

```bash
xcode-select --install
```

Complete the macOS dialog. Verify:

```bash
xcode-select -p
git --version
```

Expected: a path such as `/Library/Developer/CommandLineTools` and a Git version.

If macOS says the tools are already installed, continue.

### Step 2 — Install Homebrew

Homebrew is the package manager used for the remaining command-line tools.

Open [brew.sh](https://brew.sh), copy the current official installation command, and run it in Terminal. Use the command from the official site rather than an old blog post.

At the end, the installer prints one or two commands that add Homebrew to the shell. Run exactly those commands. This is especially important on Apple Silicon, where Homebrew normally lives under `/opt/homebrew`.

Verify:

```bash
brew --version
brew --prefix
brew doctor
```

`brew doctor` may print optional warnings. Do not start deleting or changing system files to eliminate every warning. Ask the team lead if a warning blocks an installation.

### Step 3 — Install Git, Node, and Watchman

```bash
brew install git node watchman
```

Verify:

```bash
git --version
node --version
npm --version
watchman --version
```

The current React Native setup guide requires Node 22.11.0 or newer. The repository’s `.nvmrc`, `.node-version`, or `package.json` becomes the final source of truth once the project is bootstrapped.

Do not run `sudo npm install -g react-native-cli`.

### Step 4 — Configure Git identity

Use the name and email associated with your GitHub account:

```bash
git config --global user.name "YOUR NAME"
git config --global user.email "YOUR_GITHUB_EMAIL"
git config --global init.defaultBranch main
git config --global pull.ff only
```

Verify:

```bash
git config --global --list
```

Never paste a GitHub password or access token into source files. GitHub Desktop is optional if a teammate is more comfortable with a visual Git client, but everyone should still understand branch, commit, pull, push, and pull request.

### Step 5 — Install JDK 17

React Native recommends JDK 17 and warns that higher JDK versions can cause Gradle compatibility problems.

```bash
brew install --cask zulu@17
```

Verify installed JDKs:

```bash
/usr/libexec/java_home -V
```

Open the shell profile:

```bash
open -e ~/.zprofile
```

If the file does not exist, TextEdit will create it. Add:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

Save the file, return to Terminal, and run:

```bash
source ~/.zprofile
java -version
echo "$JAVA_HOME"
```

Expected: Java 17 and a path under `/Library/Java/JavaVirtualMachines/`.

Do not set `JAVA_HOME` to an Android Studio internal runtime path unless the project lead explicitly decides to standardize on it.

### Step 6 — Install Android Studio stable

Download Android Studio from the [official Android Studio page](https://developer.android.com/studio).

- Apple Silicon Mac: choose the Apple chip/ARM build.
- Intel Mac: choose the Intel build.
- Use the latest **stable** channel, not Canary or Preview.

Installation:

1. Open the downloaded `.dmg`.
2. Drag Android Studio into Applications.
3. Open Android Studio.
4. Choose **Do not import settings** if this is a fresh installation.
5. Complete the Standard Setup Wizard.
6. Allow it to install the Android SDK and related tools.

macOS may ask for permission to open the downloaded application. Android Studio downloaded from the official Android developer site is signed; do not bypass Gatekeeper for unofficial copies.

### Step 7 — Install the Android SDK components

From the Android Studio Welcome screen:

1. Select **More Actions → SDK Manager**.
2. Note the **Android SDK Location**. The default is usually:

   ```text
   /Users/YOUR_MAC_USERNAME/Library/Android/sdk
   ```

3. Under **SDK Platforms**, enable **Show Package Details** and install:
   - Android SDK Platform 35 / Android 15, as recommended by the current React Native guide.
   - Any additional platform required by the checked-in project configuration.
4. Under **SDK Tools**, install:
   - Android SDK Build-Tools 36.0.0, as recommended by the current React Native guide;
   - Android SDK Platform-Tools;
   - Android SDK Command-line Tools (latest);
   - Android Emulator, only if this Mac will run an emulator.
5. Apply the changes and accept the licenses.

Once the repository exists, its `compileSdk`, `targetSdk`, Gradle version, and version catalog override this general setup guide. Do not independently upgrade Gradle, the Android Gradle Plugin, Kotlin, or an SDK version in a feature pull request.

### Step 8 — Configure the Android command-line environment

Open the shell profile again:

```bash
open -e ~/.zprofile
```

Add these lines below `JAVA_HOME`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/emulator"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin"
```

If Android Studio shows a different SDK location, use that real path instead.

Save, then reload and verify:

```bash
source ~/.zprofile
echo "$ANDROID_HOME"
adb --version
sdkmanager --version
```

### Step 9 — Install a code editor

Recommended choices:

- **VS Code** for React Native/TypeScript work.
- **Android Studio** for Kotlin, Gradle, Logcat, emulator, layout inspection, and native debugging.

Useful VS Code extensions:

- ESLint.
- Prettier, if the repository uses it.
- React Native Tools, optional.
- GitHub Pull Requests and Issues, optional.
- Error Lens, optional.

Do not let editor auto-formatters rewrite the entire project. Use only repository-configured formatting.

### Step 10 — Install Maestro CLI

PocketQA exports Maestro YAML, so at least the teammate working on export or end-to-end tests needs Maestro. Installing it on all development Macs is recommended.

JDK 17 and `JAVA_HOME` must already work.

```bash
brew tap mobile-dev-inc/tap
brew install mobile-dev-inc/tap/maestro
```

Verify:

```bash
maestro --version
maestro --help
```

Use the same Maestro version in the team and CI once it is pinned. Do not upgrade it alone on demo day.

## 6. Emulator setup

An emulator is convenient for UI work, but PocketQA’s screenshot, AccessibilityService, and on-device AI behavior must also be tested on the physical iQOO device.

### 6.1 Create an Android Virtual Device

1. Open Android Studio.
2. Open **Tools → Device Manager**.
3. Select **Create Virtual Device**.
4. Choose a modern Pixel phone profile.
5. Choose an Android 15/API 35 Google APIs image unless the repository specifies another image.
6. Choose the correct architecture:
   - Apple Silicon: ARM 64 v8a/arm64 image.
   - Intel: x86_64 image.
7. Finish and start the emulator.

### 6.2 Lower-spec Mac settings

If the Mac has 8–16 GB RAM:

- run only one emulator;
- close Chrome tabs and other heavy applications;
- use a smaller phone profile;
- disable unnecessary emulator snapshots if they cause instability; and
- prefer a physical Android device for integration work.

Do not treat Gemini Nano/ML Kit Prompt unavailability on the emulator as a blocker. PocketQA must use the deterministic local compiler fallback.

### 6.3 Verify the emulator

```bash
adb devices
```

Expected output includes an `emulator-...` entry with status `device`.

## 7. Physical Android and iQOO setup

macOS does not require an OEM USB driver for ADB.

### 7.1 Enable Developer options

Menu names vary slightly across iQOO/Funtouch OS versions:

1. Open Settings.
2. Open About phone or Software information.
3. Tap **Build number** or **Software version** seven times.
4. Confirm the device PIN if asked.
5. Return to Settings and open **Developer options**.
6. Enable **USB debugging**.

Only enable additional security debugging settings if Android Studio cannot interact with the device and the device explicitly requires them. Do not enable bootloader unlocking or OEM unlocking.

### 7.2 Connect by USB

1. Use a data-capable USB cable.
2. Unlock the phone.
3. Choose File Transfer/Android Auto USB mode if charging-only mode is not detected.
4. Accept the RSA debugging prompt on the phone.
5. Run:

```bash
adb devices -l
```

Expected: the device serial followed by `device`.

If it says `unauthorized`, unlock the phone and accept the prompt. If no prompt appears, use Developer options → Revoke USB debugging authorizations, reconnect, and accept the new prompt.

### 7.3 Optional wireless debugging

Android 11+ supports wireless ADB:

1. Put the Mac and phone on the same trusted network.
2. On the phone, enable **Wireless debugging**.
3. In Android Studio, choose **Pair Devices Using Wi-Fi**.
4. Pair with the QR code or pairing code.

Use USB for the main demo when possible. Venue Wi-Fi can be unreliable.

### 7.4 Enable PocketQA capture service

After installing PocketQA:

1. Open PocketQA and complete its in-app disclosure.
2. Follow **Enable capture service**.
3. In Android Accessibility settings, find PocketQA under Installed/Downloaded services.
4. Enable the service and confirm Android’s warning.
5. Return to PocketQA and verify the readiness check.

Disable the service when testing is finished on a personal device. Use only the Demo Shop package during development.

## 8. Repository setup

The team lead must replace the placeholder below when the repository is created.

### 8.1 Clone

Choose a normal development directory, then run:

```bash
mkdir -p "$HOME/Developer"
cd "$HOME/Developer"
git clone REPLACE_WITH_GITHUB_REPOSITORY_URL pocketqa
cd pocketqa
```

If the repository is private and authentication fails, sign in with GitHub CLI/Desktop or configure an SSH key with GitHub. Never ask a teammate to send a personal access token through chat.

### 8.2 Confirm repository state

```bash
git status
git remote -v
git branch --show-current
ls
```

Expected: clean working tree on the default branch and folders described in the technical specification.

### 8.3 Use the checked-in package manager

Never mix npm, Yarn, and pnpm in the same checkout.

| Lockfile | Install command |
|---|---|
| `package-lock.json` | `npm ci` |
| `pnpm-lock.yaml` | Enable/install the project’s pinned pnpm version, then `pnpm install --frozen-lockfile` |
| `yarn.lock` | Enable/install the project’s pinned Yarn version, then `yarn install --immutable` |

If two lockfiles exist, stop and ask the project lead. Do not delete one yourself.

### 8.4 Local Android configuration

Android Studio or Gradle normally creates `android/local.properties`. If the build reports `SDK location not found`, confirm the file contains your actual SDK path:

```properties
sdk.dir=/Users/YOUR_MAC_USERNAME/Library/Android/sdk
```

`local.properties` is machine-specific and must remain in `.gitignore`.

### 8.5 Required lead-provided files

Before onboarding the two new teammates, the experienced developer should commit:

- `.nvmrc` or another Node version pin;
- exactly one JavaScript lockfile;
- Gradle wrapper;
- `.java-version` or clear JDK 17 documentation;
- `.env.example` containing placeholders only;
- `.gitignore` covering local secrets and build outputs;
- top-level setup, lint, test, and run scripts;
- sample redacted test fixtures;
- pull request template; and
- `CODEOWNERS` for executor, policy, redaction, and credential modules.

## 9. First project build

The exact command names should be defined by the repository. The team should expose these beginner-friendly top-level scripts:

```text
setup:check              Verify Node, Java, Android SDK, ADB, and local config
start                    Start React Native Metro
android:pocketqa         Build/install PocketQA debug
android:demo-shop        Build/install Demo Shop debug
test                     Run fast unit tests
test:contracts           Run schema and golden fixture tests
test:safety              Run policy/redaction safety fixtures
lint                     Run TypeScript/Kotlin linting
maestro:canonical        Run the canonical Demo Shop flow
```

Until those scripts exist, use the checked-in README and Gradle tasks. Typical React Native commands are:

### Terminal 1 — Start Metro

```bash
npm start
```

### Terminal 2 — Build/install PocketQA

```bash
npm run android
```

or, if the repository uses explicit scripts:

```bash
npm run android:pocketqa
```

### Build from Android Studio

1. Open the repository’s PocketQA `android` folder in Android Studio.
2. Let Gradle Sync finish.
3. Select the correct `internalLabDebug` build variant.
4. Select the emulator/phone.
5. Click Run.

Do not select a `playRelease` or production-signing variant for hackathon development.

### Build the Demo Shop

Use the repository script:

```bash
npm run android:demo-shop
```

If Demo Shop is a separate Gradle project, its local README will specify the wrapper command. Always use `./gradlew` from the repository rather than a globally installed Gradle.

## 10. Verify the installation

Run:

```bash
adb shell pm list packages | grep techphantoms
```

Expected package IDs:

```text
com.techphantoms.pocketqa
com.techphantoms.pocketqa.demoshop
```

Then perform this smoke test:

1. Open Demo Shop.
2. Add a product and confirm the coupon/retry fixture works.
3. Open PocketQA.
4. Confirm readiness recognizes the capture service state.
5. Start a typed-intent capture using Demo Shop only.
6. Finish capture and confirm at least one captured state is visible.
7. Do not test Explorer until an experienced teammate has enabled and reviewed its policy fixture suite.

## 11. Logs and debugging

### 11.1 React Native logs

Watch the Metro terminal and the in-app developer console configured by the project.

If Metro cannot connect over USB:

```bash
adb reverse tcp:8081 tcp:8081
```

### 11.2 Android Logcat

In Android Studio:

1. View → Tool Windows → Logcat.
2. Select the connected device.
3. Select the PocketQA process.
4. Filter with a project tag such as `PocketQA`.

Command-line option:

```bash
adb logcat | grep -i pocketqa
```

Never paste logs containing real private data, provider keys, screenshots, OTPs, or user content into GitHub issues. Use the redacted support bundle when it exists.

### 11.3 Native breakpoints

Use Android Studio for Kotlin breakpoints. Do not pause the AccessibilityService callback for long periods while the system expects a response; prefer structured logs and breakpoints in off-main-thread processing.

## 12. Running tests

### 12.1 Before every pull request

Run the repository equivalents of:

```bash
npm run lint
npm test
npm run test:contracts
npm run test:safety
```

If a command is not yet present, note it in the pull request and run the module-specific tests documented by the owner.

### 12.2 Maestro

Start the emulator or connect a physical device, install Demo Shop, then run:

```bash
maestro test path/to/generated-or-canonical-flow.yaml
```

For the canonical PocketQA flow, use the top-level script once provided:

```bash
npm run maestro:canonical
```

Generated YAML must be tested, not merely viewed.

### 12.3 Airplane-mode test

Only after the primary local flow works:

1. Pre-install both apps and any optional model assets.
2. Enable airplane mode.
3. Use typed intent.
4. Capture, compile with deterministic local fallback, approve, replay, and export.
5. Confirm evidence records `networkUsed: false`.

## 13. AI and credentials setup

### 13.1 What works without any API key

- Typed intent.
- Accessibility capture.
- Screenshot/UI-tree collection.
- Bundled OCR.
- Deterministic compiler.
- Test review and approval.
- Deterministic replay.
- Evidence and Maestro export.

This is the path both new teammates should use first.

### 13.2 Gemini Nano / ML Kit Prompt

- Availability depends on the physical Android device and model state.
- Use PocketQA’s readiness screen to check `AVAILABLE`, `DOWNLOADABLE`, or `UNAVAILABLE`.
- Complete any model download before the offline demo.
- Do not spend onboarding time trying to force Gemini Nano to work on an unsupported emulator.
- Never remove the deterministic fallback.

### 13.3 Sarvam

Sarvam is optional and used only to transcribe voice intent in the planned build.

- The team lead owns the hackathon credential.
- Enter it only through PocketQA’s debug Developer Settings after that vault exists.
- Do not place it in React Native source, Kotlin source, `gradle.properties`, `local.properties`, `.env` committed to Git, screenshots, or chat.
- Remove it from the device after the event.
- New contributors can use typed intent and do not need the key.

### 13.4 OpenAI

Official OpenAI documentation states that API keys must not be exposed in client-side code such as mobile apps. The planned production topology is:

```text
PocketQA → authenticated PocketQA proxy → OpenAI Responses API
```

For the hackathon only, an internal debug build may accept an ephemeral runtime key if the lead explicitly enables that feature and understands that a mobile client cannot protect a long-lived secret.

Rules:

- Never compile `OPENAI_API_KEY` into the APK or JavaScript bundle.
- Never add a real key to `.env.example`.
- Never commit `.env.local` or provider credential files.
- Never put an API key in a pull request, issue, video, screenshot, or log.
- If a key is exposed, stop using it and rotate/revoke it immediately.
- Connected analysis receives only a redacted, user-approved payload and never controls the executor.

## 14. Git workflow for new contributors

### 14.1 Start clean

```bash
git switch main
git pull --ff-only
git status
```

The working tree should be clean before starting a task.

### 14.2 Create a branch

Examples:

```bash
git switch -c feat/demo-shop-empty-cart
git switch -c feat/evidence-step-card
git switch -c test/coupon-state-fixtures
git switch -c docs/setup-fix
```

One branch should solve one issue.

### 14.3 Work in small commits

```bash
git status
git diff
git add PATHS_YOU_INTENTIONALLY_CHANGED
git commit -m "feat: add empty-cart fixture"
```

Never use `git add .` without reviewing `git status`. Never commit build folders, screenshots containing private data, local configuration, APK signing files, or secrets.

### 14.4 Before pushing

```bash
git status
git diff main...HEAD
```

Run the required lint/tests, then:

```bash
git push -u origin YOUR_BRANCH_NAME
```

Open a pull request and include:

- linked issue;
- what changed;
- how it was tested;
- emulator/device and Android version;
- screenshots only if redacted;
- known limitations; and
- confirmation that no secret or private data is included.

### 14.5 If Git reports a conflict

Stop and ask an experienced teammate to pair. Do not solve it using `git reset --hard`, deleting the repository, or copying entire files over someone else’s changes.

## 15. Good first tasks for the two new teammates

### Teammate A — Demo Shop and fixtures

Recommended tasks:

- Product card and cart UI.
- Coupon input and local `SAVE20` validation.
- Simulated checkout error and retry state.
- Empty-cart fixture.
- Stable test/resource IDs.
- Accessibility labels and 48 dp touch targets.
- Unit tests for the fixture reducer/repository.
- Canonical Maestro flow.

Avoid initially:

- PocketQA AccessibilityService.
- Android gesture dispatch.
- package boundary policy.
- payment-like safety classification.

### Teammate B — PocketQA React Native UI and evidence

Recommended tasks:

- Home/Test Library static UI.
- Intent form and validation.
- Device-readiness status cards using mocked/native contract data.
- Capture progress UI.
- Review step card.
- Evidence timeline and screenshot thumbnails.
- Empty, loading, error, and offline states.
- Storybook/component fixtures if the team uses them.
- TypeScript tests.

Avoid initially:

- Provider credentials.
- model prompts that can affect action proposals.
- approval hashing.
- policy engine or deterministic executor.
- redaction logic without pairing.

### Pairing rule

Any task touching these paths requires an experienced reviewer before merge:

```text
android/.../capture/
android/.../execution/
android/.../policy/
android/.../redaction/
android/.../inference/
android/.../storage/credentials/
packages/schemas/
```

Schema changes require both mobile UI and native Android review because they cross the bridge.

## 16. A two-hour onboarding exercise

### First 30 minutes — understand the product

- Read the PRD executive summary, product principles, MVP goals, safety policy, canonical demo, and definition of done.
- Read the technical spec architecture decisions and component model.
- Watch the submitted prototype/video if available.

### Next 30 minutes — prove the toolchain

- Start emulator or connect a phone.
- Confirm `adb devices`.
- Install a trivial debug build.
- Open Logcat.
- Run one unit test.

### Next 30 minutes — understand the demo

- Run Demo Shop.
- Reset the coupon-retry fixture.
- Perform the canonical flow manually.
- Run its Maestro YAML.

### Final 30 minutes — first pull request

Make one intentionally small change, such as:

- improve an empty-state message;
- add a missing accessibility label;
- add one fixture unit test; or
- add one evidence-card loading state.

Create a branch, run tests, push, and open a pull request.

## 17. Common setup problems

### `brew: command not found`

- Close and reopen Terminal.
- Run the Homebrew shell setup commands printed by its installer.
- Verify `/opt/homebrew/bin/brew` on Apple Silicon or `/usr/local/bin/brew` on Intel.

### `node` is too old

```bash
brew update
brew upgrade node
node --version
```

Use the version pinned by the repository when provided.

### `Unable to locate a Java Runtime` or wrong Java version

```bash
/usr/libexec/java_home -V
source ~/.zprofile
java -version
echo "$JAVA_HOME"
```

Confirm Java 17. Do not independently change Gradle to support a newer JDK.

### `SDK location not found`

- Confirm Android Studio’s SDK location.
- Confirm `ANDROID_HOME`.
- Confirm `android/local.properties` has the correct `sdk.dir`.
- Reload `~/.zprofile`.

### `adb: command not found`

```bash
source ~/.zprofile
echo "$ANDROID_HOME"
ls "$ANDROID_HOME/platform-tools"
adb --version
```

### Device shows `unauthorized`

- Unlock the phone.
- Accept the RSA prompt.
- Reconnect the cable.
- If necessary, revoke USB debugging authorizations and pair again.

### No device appears

- Confirm the cable transfers data.
- Try another port/cable.
- Select File Transfer USB mode.
- Run Android Studio → Tools → Troubleshoot Device Connections.
- Restart ADB:

```bash
adb kill-server
adb start-server
adb devices -l
```

### Metro cannot reach the USB device

```bash
adb reverse tcp:8081 tcp:8081
```

Confirm Metro is running and the device is listed.

### Port 8081 is already in use

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN
```

Identify the process before stopping anything. Do not kill unrelated processes blindly.

### Gradle daemon behaves strangely after a JDK change

From the correct Android project directory:

```bash
./gradlew --stop
java -version
./gradlew tasks
```

Do not delete global Gradle caches unless the experienced Android owner confirms it is necessary.

### Metro cache appears stale

Use the repository reset script if provided. Otherwise:

```bash
npx react-native start --reset-cache
```

### Accessibility service is enabled but no state is captured

Check, in order:

1. PocketQA shows the service as connected.
2. A capture session is actually recording.
3. Demo Shop is the selected and allowlisted package.
4. The target control has an accessibility label/test ID.
5. No other replay or mission is active.
6. Stop and restart the session.
7. Capture diagnostics/Logcat shows events.

Do not broaden capture to every package as a quick workaround.

### On-device AI shows unavailable

This is expected on many emulators/devices. Confirm the deterministic compiler works. Only the integration owner should investigate model eligibility/downloads on the target iQOO device.

## 18. Daily development routine

At the start:

```bash
git switch main
git pull --ff-only
git status
```

Then switch/create the issue branch, install dependencies only if the lockfile changed, and run the smallest relevant test while working.

Before stopping for the day:

- commit coherent work;
- push the branch;
- update the issue/PR with status and blocker;
- do not leave the shared iQOO device with personal accounts, keys, or debugging captures;
- export only redacted evidence; and
- disable PocketQA’s accessibility service on a personal phone.

## 19. “Ready to contribute” checklist

A teammate is ready when every checked item is true:

- [ ] macOS 12+ and sufficient disk space.
- [ ] `uname -m` architecture is known.
- [ ] Xcode Command Line Tools installed.
- [ ] Homebrew works.
- [ ] Git identity configured.
- [ ] Node meets the repository version.
- [ ] Watchman works.
- [ ] Java 17 and `JAVA_HOME` work.
- [ ] Android Studio stable installed.
- [ ] Required SDK platform/build tools installed.
- [ ] `ANDROID_HOME`, `adb`, and `sdkmanager` work.
- [ ] Emulator or physical device appears in `adb devices`.
- [ ] Maestro CLI works.
- [ ] GitHub repository cloned without local changes.
- [ ] JavaScript dependencies installed from the single lockfile.
- [ ] PocketQA debug app builds.
- [ ] Demo Shop builds and canonical fixture works.
- [ ] Unit/contract tests run.
- [ ] One small pull request completed.
- [ ] Contributor understands modules that require pairing/review.
- [ ] No Sarvam/OpenAI key is required for their normal workflow.

## 20. Team lead onboarding checklist

Before sending this guide to the two teammates:

- [ ] Replace `REPLACE_WITH_GITHUB_REPOSITORY_URL`.
- [ ] Pin Node, JDK, Gradle, Android SDK, package manager, and Maestro versions.
- [ ] Commit one JavaScript lockfile.
- [ ] Provide a one-command setup check.
- [ ] Provide one-command PocketQA and Demo Shop debug installs.
- [ ] Add `.env.example` with placeholders only.
- [ ] Confirm secret patterns are ignored/scanned.
- [ ] Add both teammates to GitHub and assign starter issues.
- [ ] Mark code-owner paths for capture, execution, policy, redaction, schemas, and credentials.
- [ ] Confirm CI passes on a clean clone.
- [ ] Test the entire guide on one clean Mac user account if possible.
- [ ] Keep the physical iQOO integration slot scheduled so teammates do not block each other.

## 21. Official references

- [React Native: Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment)
- [Android Studio installation and Mac requirements](https://developer.android.com/studio/install)
- [Run Android apps on a hardware device](https://developer.android.com/studio/run/device)
- [Homebrew](https://brew.sh)
- [Maestro CLI installation](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli)
- [OpenAI API authentication and key security](https://developers.openai.com/api/reference/overview)
- [ML Kit Prompt API Android setup](https://developers.google.com/ml-kit/genai/prompt/android/get-started)
- [Android AccessibilityService API](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)

---

## Appendix A — Setup verification report

When asking for help, copy this template into the team chat and fill it without secrets:

```text
Mac model/year:
Processor: Apple Silicon / Intel
macOS version:
RAM:
Free disk space:

git --version:
node --version:
npm --version:
watchman --version:
java -version:
JAVA_HOME path:
adb --version:
ANDROID_HOME path:
maestro --version:

adb devices output: [serial may be partially redacted]
Emulator or physical device:
Android version/API:

Repository commit:
Command that failed:
Safe error message:
What was already tried:
```

Never include provider keys, passwords, tokens, private screenshots, OTPs, or full personal device serial numbers.

## Appendix B — What not to do

- Do not install a global React Native CLI.
- Do not use `sudo npm`.
- Do not mix package managers or regenerate the lockfile casually.
- Do not upgrade Gradle, Android Gradle Plugin, Kotlin, React Native, or SDK versions inside an unrelated feature.
- Do not commit `local.properties`, `.env.local`, provider keys, keystores, signing files, logs, APKs, or raw captures.
- Do not run PocketQA against banking, messaging, personal, payment, account, or third-party apps.
- Do not weaken a hard stop to make a demo pass.
- Do not add a coordinate fallback to Explorer.
- Do not let model output call the native executor directly.
- Do not use destructive Git commands to solve a conflict.
- Do not delete global caches or system files without checking with the relevant module owner.

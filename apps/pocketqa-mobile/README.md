# PocketQA Mobile (React Native + Android)

Implementation of the [PocketQA React Native Build Spec](../../PocketQA_React_Native_Build_Spec.md).

- **Framework:** React Native Community CLI, TypeScript strict, Hermes, New Architecture.
- **Native:** Kotlin owns AccessibilityService capture, screenshots, UI-tree normalization,
  Room persistence, deterministic execution, policy enforcement, redaction, AI capability
  routing, and artifact generation.
- **JS layer:** navigation, screens, review/editing, evidence browsing, settings, and
  consent — all through a single typed façade (`src/native/PocketQaNative.ts`).

## Quick start

```bash
# 1. Install JS deps
cd apps/pocketqa-mobile
npm install

# 2. Typecheck (no Android SDK required)
npm run typecheck

# 3. Boot Metro
npm start

# 4. In another shell, build + install the internal lab APK on the iQOO
npm run android:lab
```

If `PocketQaModule` is not yet linked (fresh RN bootstrap, first run before Kotlin
compiles), the façade transparently falls back to `src/native/mock.ts` — a
deterministic in-JS harness that reuses the same `@domain` modules the Kotlin side
will call.  Every screen therefore works end-to-end against the Demo Shop
reducer before native code exists.  The mock warns in the console so it is
never silent.

## Layout

```text
apps/pocketqa-mobile/
├── android/                # Kotlin skeleton per Build Spec §5
│   └── app/src/main/java/com/techphantoms/pocketqa/
│       ├── bridge/         # PocketQaModule, PocketQaPackage
│       ├── capture/        # AccessibilityService + CaptureCoordinator
│       ├── compiler/       # CompileCoordinator
│       ├── execution/      # ReplayExecutor
│       ├── explorer/       # ExplorerAgent
│       ├── inference/      # InferenceRouter (Gemini Nano / Sarvam / OpenAI)
│       ├── policy/         # PolicyEngine — parallel to src/domain/policy.ts
│       ├── storage/        # Room repository stub
│       └── export/         # FileProvider-backed evidence share
├── src/
│   ├── app/App.tsx         # root, subscribes to native events
│   ├── components/         # AppScreen, TopBar, Buttons, StatusPill, …
│   ├── domain/             # Zod schemas, compiler, executor, explorer, exporter
│   ├── features/           # 15 P0/P1 screens (see Build Spec §7)
│   ├── native/             # Typed façade + deterministic mock
│   ├── navigation/         # RootNavigator + RootStackParamList
│   ├── store/              # Zustand: readiness, activeOperation, draftEditor, settings
│   └── theme/              # Design tokens (Build Spec §9)
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
└── app.json
```

## Not scaffolded yet

The following need `npx @react-native-community/cli init` or manual copy from a
current React Native template — they are outside the strict-TypeScript surface
this repo can safely check in:

- `android/app/build.gradle` and root `android/build.gradle`
- Gradle wrapper + settings
- ProGuard / R8 configuration
- Signing config (never committed)
- `ios/` (out of scope — Android only per Build Spec §1)

Run the following once, replacing existing files where safe, to produce a
buildable Android project:

```bash
npx @react-native-community/cli init _bootstrap --version 0.75.4 --skip-install --template react-native@0.75.4
cp -R _bootstrap/android/gradlew _bootstrap/android/gradlew.bat _bootstrap/android/settings.gradle \
      _bootstrap/android/build.gradle _bootstrap/android/gradle.properties \
      _bootstrap/android/app/build.gradle _bootstrap/android/app/proguard-rules.pro \
      apps/pocketqa-mobile/android/
rm -rf _bootstrap
```

Then edit `applicationId`/`namespace` to `com.techphantoms.pocketqa`, wire
`PocketQaPackage()` into `PocketQaApplication.kt` (already done above), and
`npm run android:lab`.

## Testing

```bash
npm run typecheck        # tsc --noEmit against strict config
npm run lint             # @react-native/eslint-config
npm test                 # jest + RNTL
npm run test:contracts   # canonical JSON fixture round-trip
npm run maestro:demo     # end-to-end regression run on the Demo Shop
```

# Security and Sensitive Data

PocketQA can process screenshots, accessibility trees, typed values, and device state. Treat all runtime captures as sensitive even when they come from a test device.

## Reporting

Do not open a normal GitHub issue containing:

- an API key or token;
- a keystore/signing credential;
- personal data;
- raw screenshots or accessibility trees from a personal/third-party app;
- authentication, OTP, payment, account, or private device information; or
- a reproducible path that may dispatch an unsafe action before the owner can disable it.

Contact the repository owner privately. If a provider key was exposed, revoke or rotate it immediately before investigating Git history.

## Development scope

- Test only the team-owned PocketQA Demo Shop package.
- Use deterministic fixture data.
- Keep Explorer in the internal Lab build.
- Preserve package boundaries, approval, policy, redaction, action budgets, and Stop behavior.
- Never embed OpenAI, Sarvam, GitHub, signing, or other credentials in the APK or JavaScript bundle.

## Evidence

Only redacted evidence may be attached to issues or pull requests. Raw captures stay in app-private storage and are not committed.

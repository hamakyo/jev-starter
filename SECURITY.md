# Security policy

This project is published but remains pre-1.0 and should not be treated as a complete security control for production decisions. It provides decision contracts and routing recommendations; the host application remains responsible for authorization, side effects, data handling, and audit retention.

## Reporting a vulnerability

Please do not disclose an unpatched vulnerability in a public issue. Use the repository's private GitHub security reporting channel when available, or contact the maintainers through the repository's private support channel. Include a minimal reproduction, affected commit or version, impact, and a suggested mitigation when known.

## Data handling rules

- Never commit `TYPESAFE_API_KEY` or any other credential.
- Do not use production or personal data in committed fixtures or examples.
- `DecisionEvent` deliberately excludes raw state and raw answer objects; applications should review any additional observer forwarding for sensitive fields.
- Provider and SDK errors are classified for telemetry, but error messages should be redacted before external logging when they may contain request data.
- Live commands are intentionally excluded from normal CI and must be run only against an approved dataset and account.

## Decision safety

Malformed provider responses and provider failures reject; they are not converted into successful `auto` outcomes. The engine never performs the host application's business operation. Hosts must still enforce their own authorization, fallback, review, and idempotency controls.

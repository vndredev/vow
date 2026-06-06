# Security Policy

vow is in its foundation phase; there are no released versions yet.

To report a vulnerability, email **vndredev@gmail.com** with details and steps to reproduce — please don't open a public issue for security problems. We'll respond as soon as we can.

## Supply-chain practices

- **Signed commits** (GPG/SSH) — enforced on `main` via branch protection.
- **Mandatory PR reviews** + green CI before merge; no direct pushes to `main`.
- **2FA** on the GitHub (and, once we publish, npm) account.
- **Dependencies scanned** (Dependabot) and **pinned**; the `pnpm` lockfile is committed.
- _(once we publish)_ npm **Trusted Publisher** with provenance — no long-lived tokens.

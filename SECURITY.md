# Security

HevyMap is a self-hosted, single-user app: each deployment is its own private
copy, with no shared backend and no accounts (see [README](./README.md#privacy--security)).
That shapes the scope below.

## Scope

Reports are welcome about the HevyMap **codebase** — the Next.js app in this
repo — including:

- The Hevy API proxy (`app/api/hevy/[...path]/route.ts`) leaking the
  `HEVY_API_KEY` or another deployment's data, or being usable as an open
  proxy / SSRF vector.
- The access-password gate (`proxy.ts`, `lib/auth.ts`, `app/api/auth`) or the
  in-app Hevy key cookie (`lib/hevy-key.ts`) being bypassable or the key/
  password being recoverable.
- Any way client-side code, `localStorage`/IndexedDB, or logs could expose an
  API key or password.
- XSS, CSRF, or open-redirect issues in the app.

**Out of scope:** the security of a specific person's own deployment (e.g.
"my Vercel URL has no `ACCESS_PASSWORD` set") — that's a self-hosting
configuration choice, not a bug in this repo. Also out of scope: the Hevy API
or Hevy's own service.

## Reporting

Please report privately via a
[GitHub Security Advisory](https://github.com/longtimec0ming/hevymap/security/advisories/new)
rather than a public issue, so any real vulnerability isn't disclosed before
a fix ships. If that's not workable, open an issue without exploit details
and ask for a private channel.

There's no bounty program — this is a hobby open-source project. Credit in
the fix's changelog/commit is the norm unless you'd rather stay anonymous.

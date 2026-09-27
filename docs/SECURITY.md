# Local data and security

This release runs on `127.0.0.1` for a single trusted local user. It has no hosted authentication, tenant isolation or public deployment mode. Do not expose it with a tunnel or reverse proxy as a customer service without designing those controls.

`workspace/` contains photos, listing metadata, scenes and versioned backups. `.local/` contains temporary development artifacts. Both are ignored, as are `.env`, engine projects, generated engine caches and Python caches. Back up private projects separately. Public repository examples contain fictional data only.

The importer permits HTTPS Hemnet listing paths and the known Hemnet image host, refuses redirects, limits sizes and timeouts, and checks file signatures. It does not bypass restricted pages. Imported text and images are untrusted evidence. Generated output is schema-validated JSON, never executable code.

Mutations require a per-process token and reject foreign Origins and unexpected Host headers. Static routes do not serve the private workspace. This is defense for a local tool, not protection against malicious software or another user already able to read your files.

API keys come from the server environment or a session-only password field. They are not included in project files or exports. The server sends generation requests only to OpenAI's fixed Responses endpoint. The explicit Generate action transmits selected photos, listing title/description and notes. API calls use `store: false`; that flag is not a claim of zero retention under every account's data policies. Model errors omit provider response bodies and redact the key. No paid retry happens automatically.

Do not paste a key into issues or screenshots. Do not commit personal listing references, logs, full request bodies or environment files. If reporting a bug, reproduce it with the fictional demo or synthetic fixtures. Report a security issue privately using GitHub's private vulnerability reporting if enabled; otherwise contact the maintainer before publishing sensitive details.

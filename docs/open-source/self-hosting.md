# Self-hosting the browser edition

The browser build stores documents in each user's browser; it does not require a shared document backend. The local Node document server is for one person on loopback and must not be exposed as a public shared service.

## Build

Use Node.js 22.14 or newer:

```sh
npm ci
npm run build:web
```

Publish only `output/website/dist`. It contains the website, editor (`app.html`), sample, fonts, notices and pinned resources. Never upload the repository's `.data/`, environment files or local evidence directories.

The package includes Netlify `_redirects` and `_headers`. Other hosts need equivalent `/app` → `/app.html` and `/speaker` → `/speaker.html` rewrites and the supplied security headers. Use a dedicated domain/root path; subdirectory hosting is not supported by the current root-relative resource URLs. On a basic static server you can open `app.html` directly, but you still need to configure the published headers and routes for production.

Set your public origin through the build-time environment variable `DECKSPRIG_PUBLIC_ORIGIN` if it differs from the official demo. Use a bare HTTPS origin (no path, query, username or password). It controls canonical/share links and project-owned attribution links.

## Netlify

The repository's `netlify.toml` builds the browser package and includes the bounded optional resource function. To deploy a locally verified build with Netlify CLI:

```sh
netlify login
netlify sites:create
netlify deploy --no-build --dir output/website/dist --functions output/web-editor/functions
```

Review the draft deployment, including desktop/mobile edit, backup export and reload. Then use `netlify deploy --prod --no-build --dir output/website/dist --functions output/web-editor/functions` to publish that reviewed build. [Netlify CLI documentation](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/) describes account linking and deployment.

The photo proxy stays disabled unless the deployment operator sets exactly `DECKSPRIG_PHOTO_SEARCH_ENABLED=true`. Keep it off unless you have acceptable hosting budget controls and have verified the configured edge rule. Per-IP throttling is not a global spend cap. Remove the variable or set it to `false` to disable it again. A static-only deployment can omit `--functions` and the function configuration entirely; photo search then remains unavailable while uploads and bundled artwork still work.

Identify your hosting operator, contact route, access-log practices and optional provider connections in your copy of the privacy page. Provider log retention cannot be promised by this source repository. The official demonstration is maintained by Ken Pan at the URL in the README.

## Data portability

Browser libraries are scoped to the exact origin and browser profile. Moving to another domain does not move saved documents. Export Deck files before switching hosts, and import them at the new host. Clearing site data removes browser storage; the source repository cannot recover it. No service worker or offline-install guarantee is supplied in this release.

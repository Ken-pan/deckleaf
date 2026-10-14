# Optional connections

Manual editing, templates and export need none of these connections. Check a provider's current terms and access rules before using it. Keep secrets outside Git and shared documents.

## AI

Open Settings → More settings → AI models → Connect provider, or use the AI workspace settings. Choose a provider, enter a model and use a session API key. OpenAI uses its standard HTTPS API; compatible providers need their API base URL. Use a provider that permits direct browser access for the browser edition. If it blocks browser requests, use the local edition rather than disabling browser security.

Local server operators can supply `OPENAI_API_KEY` or `DECK_AI_KEY` through the process environment; `DECK_AI_MODEL` supplies a default model. The app does not automatically load `.env` files. Settings may retain provider/model preferences, but not the session API key.

Ask for a small change, inspect the proposal, choose Apply changes when satisfied, and Undo if needed. Selected document context, prompts and relevant tool results are sent to the chosen provider. This release does not supply free AI usage or a hosted AI proxy.

## Figma

Import document → Figma accepts a file link and an access token with read access to that file. The token is cleared after success or closing. For a local file workflow, load `plugins/figma-export/manifest.json` as a development plugin in Figma and export `.deck.json`, then import it into Decksprig. Provider permissions and supported design objects vary; inspect the import report. No public Figma plugin listing is supplied with this release.

## Google Slides

Import document → Google Slides accepts a file link and an OAuth access token with `presentations.readonly` access. Browser access is subject to provider restrictions. The local edition also has a personal Desktop OAuth flow for supported native-source workflows: supply your own Desktop client through `GOOGLE_OAUTH_CLIENT_ID` and, where required, `GOOGLE_OAUTH_CLIENT_SECRET` in the environment or private local client configuration. Enable the relevant Google APIs in your own project. Do not publish the configuration. This project does not ship an OAuth client or claim production OAuth verification.

Supported Google export depends on the preserved native source and the changes made. Preview the plan before authorizing a cloud write. Conversion into arbitrary native objects is not guaranteed.

## Photos, fonts and embeds

Local uploads and bundled artwork work without provider accounts. The public demonstration's open-photo proxy is disabled. A reviewed self-host may opt in as described in [self-hosting](self-hosting.md). Local operators can configure `UNSPLASH_ACCESS_KEY` or `PEXELS_API_KEY` in the server environment; these developer keys are not accepted in the browser edition.

Online font requests, remote images and embedded prototypes contact their sources. Use content and fonts you have permission to redistribute. An exported presentation may retain remote links and require network access.

## MCP and hosting

`npm run mcp` starts the optional local MCP server for compatible agents. It uses the same document operations and revision-bound proposal review as the editor; the browser demo does not offer a public MCP endpoint. Keep it scoped to your local installation and documents.

The local hosting connection is optional and uses a session Netlify token. Review the prepared HTML before publishing. In the browser edition, export Web page and upload it with your hosting provider. Hosting or sharing can expose notes, source links and content; review the export first.

See [privacy](../../PRIVACY.md) and [security scope](../../SECURITY.md).

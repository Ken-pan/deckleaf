# Decksprig name change — 0.1.1

Decksprig replaces the public name Deckleaf. The code license is still MIT, artwork licenses are unchanged, and older release tags and downloads remain available. The illustration and sticker projects are now [Duoquill](https://github.com/Ken-pan/duoquill) and [Clovlets](https://github.com/Ken-pan/clovlets).

## Existing documents

Local document files, `.data/`, document schemas, IDs, resource IDs, undo/history formats and `deck-studio-*` browser storage keys are unchanged. Keep your data folder when updating the local edition. Export a Deck JSON backup before updating. Imported source files keep their own names and provenance.

The new hosted editor is https://decksprig-kens-toolbox.netlify.app/app. The previous editor at https://deckleaf-kens-toolbox.netlify.app/app remains accessible with the new branding and compatible storage. It does not forcibly redirect to a different origin. To move a browser document, export its Deck file at the old address and import that file at the new address. Repeat for each document you want to move. Stored history and recovery drafts remain at the old origin; the exported Deck file is a document backup, not an automatic full-library migration. Clearing the old site's data can remove those records.

## Self-hosting settings

Prefer `DECKSPRIG_PUBLIC_ORIGIN`, `DECKSPRIG_SOURCE_OUTPUT` and `DECKSPRIG_PHOTO_SEARCH_ENABLED`. Their previous `DECKLEAF_*` counterparts remain accepted as fallbacks. An explicitly supplied new setting takes precedence; `false` on the new photo setting overrides an old `true` value. Photo requests remain disabled unless the resolved value is exactly `true`.

The new sample URL is `/examples/decksprig-demo.deck.json`; the old sample URL remains an alias. Historical GitHub repository links redirect to the renamed repository. GitHub Pages galleries use their new paths, so update saved gallery bookmarks.

## Naming evidence and limits

Names were chosen after public screening on 14 October 2026 in the United States, United Kingdom, Australia and TMview, plus exact-name product, GitHub and npm checks. No exact relevant product or trademark match was found in those examined searches. This is a dated public screening, not worldwide legal clearance. Similar marks require comparison of the complete name, goods and use. QUILL is a crowded root; China and WIPO independent database searches were not completed. Logos and unregistered rights are not comprehensively cleared. Recheck relevant markets before trademark filing or significant brand investment.

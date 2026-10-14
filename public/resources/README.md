# Resource sources and licenses

The editor embeds imported images in local Deck documents, preserving source, creator, license and copyright notices. SVGs remain image objects; individual paths are not converted into editable shapes.

## Verified open resource collections

- Photos: [Openverse](https://openverse.org/). Default CC0/public domain, with an explicit CC BY option. Source filters include Flickr, Wikimedia Commons, WordPress Photos and StockSnap. Anonymous requests use 20 results per page. Per-image terms come from the original source; NC/ND/ShareAlike records are excluded from this photo integration.
- Offline icons: 45,239 unique icon entries, including style variants, across Lucide, Tabler, Phosphor, Heroicons, Bootstrap, Material Symbols, Remix, Carbon, Radix and Iconoir. Search resolves common Chinese terms and synonyms, supports styles and pagination. Icon data is pinned by package-lock.json through @iconify-json packages. Sources and full notices are under `licenses/`. Lucide uses ISC with MIT notices for Feather-derived icons; other collections use MIT or Apache 2.0. Remix uses the archived Apache dataset referenced by its pinned package metadata. Notices are carried into SVGs, provenance and exports.
- [Open Doodles](https://www.opendoodles.com/about): 33 original SVGs by Pablo Stanley, CC0.
- [illlustrations legacy collection](https://illlustrations.co/explore): 130 assets by Vijay Verma, [CC0 under the current license's legacy-assets section](https://illlustrations.co/license). Source commit b6d6f3286995e6efbbf397eff21b572245c336fd. Original SVGs remain under `illlustrations/originals/`. Runtime SVGs inline static CSS and remove editor metadata without path conversion. The ticket SVG references missing relative images, so its manifest uses the author's complete PNG instead. The manifest records file source and SHA-256. Premium/builder assets are not part of this imported set.

The separately authored blue-black collection has its own manifest and licensing notes; its generated assets are not included in the 163 verified CC0 assets above.

## Local workflow

Icons and these illustrations can be searched, previewed and imported without external network access. Photos need network access for discovery/download; embedded documents remain usable offline. Favorites store validated metadata in the current browser (maximum200); recent use stores the latest40 metadata records. They do not store keys or duplicate full image bodies. Imported resources can be reused directly from the current document.

Batch insertion supports up to12 assets, prepares and decodes every image before one atomic transaction, groups and places them inside the canvas, checks the document size, and supports cancellation. A failed/canceled import does not partially edit the document. Local multi-file upload uses the same grouped transaction. Replacement preserves identity, position, size, rotation and fit. “Continue browsing” applies to online resources and local uploads.

Credits travel in Deck JSON, PowerPoint speaker notes, independent HTML's source panel, Markdown, Broadser JSON notes and the print appendix. Broadser export here is local JSON and does not publish to its cloud.

Source/licensing pages checked2026-10-12. Catalog format audit: all45,239 icons and130 new illustration import paths pass validation. Desktop/mobile, persistence, cancellation/failure, offline discovery and exported package evidence is recorded in `output/resources-v2/`.

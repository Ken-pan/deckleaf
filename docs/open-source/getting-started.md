# Getting started

[Editable sample](https://decksprig-kens-toolbox.netlify.app/app?demo=1) · [Video and walkthrough](https://decksprig-kens-toolbox.netlify.app/demo.html) · [中文指南](getting-started.zh-CN.md)

## Your first document

Use a desktop browser for the full editing workspace. Open the sample link to create a new three-slide document; it does not replace other documents. Reading the import report helps distinguish original references from editable content. Close that report to start editing. Refresh reopens the same sample copy rather than creating another one.

To start your own work, open the editor home. **Choose a template** previews an editable deck, **Start blank** creates a blank document, and **Try sample** imports the introduction. **Create with AI** is optional and needs your own provider. Templates contain fictional copy; replace it with your own evidence.

## Edit, preview, undo

1. Rename the document using the name field at the top.
2. Select a slide in the slide strip. Select text and choose **Edit text**, or double-click it to type; click outside it to finish editing.
3. Select an object to adjust its type, size, position or appearance in the editing panel. Use the insertion tools for text, images, shapes, tables and charts. Grouped template objects may require another click to select a member.
4. Use **Document menu → Undo** to reverse a change. On desktop, Command/Control+Z undoes; Shift+Command/Control+Z redoes. Escape cancels the current text edit, dismisses a panel or exits presentation as appropriate. Click outside text or use Command/Control+Enter to finish the edit.
5. Choose **Present**. Use arrows to advance and Escape to return. Hidden slides remain in the editor and are skipped during presentation.

Wait for pending save feedback to settle before closing the tab. **Open document library** lists saved documents in this installation/browser. If a save error appears, keep the tab open and use the offered recovery/export action; do not clear browser data to fix it.

## Back up and share

Choose **Document menu → Export document**:

- **Deck file** (`.deck.json`): full editable backup, including media, source metadata, notes and hidden slides. Re-import through **Import document** to create a new document.
- **PowerPoint** (`.pptx`): supported editable objects; check fonts, charts and effects in PowerPoint.
- **Web page** (`.html`): standalone presentation, including authored motion. Open the file in a browser. Remote images and prototypes may need internet access.
- **PDF**: opens the browser print flow; choose Save as PDF. Available print controls vary by browser.

Before sharing, review notes, hidden slides, source links and embedded media for private material. Deck and PowerPoint retain hidden slides; PDF and web presentations use visible slides. A browser's saved documents do not sync to another browser or the local Node edition. Back up Deck files before clearing site data. Local users should also back up `.data/` with the application stopped.

## Import your work

Choose **Import document**, or drop a supported file onto the canvas. An import creates a new document. Review the import report, compare references where available, and then inspect editable pages before exporting.

## Formats and troubleshooting

| Situation | What to do |
| --- | --- |
| Node command is unavailable | Install Node.js 22.14 or newer, reopen your terminal, then run `node --version` |
| Port 4310 is occupied | Stop the earlier Decksprig server, preserving its `.data/`; restart one instance |
| Local browser opens a blank page | Keep `npm run dev` running and use `http://127.0.0.1:4310/`; production needs `npm run build` before `npm start` |
| Documents are missing on another device | Storage is local to this installation/browser; import an exported Deck file |
| PPTX fonts/effects look different | Install the relevant licensed fonts in the target app and inspect conversion warnings |
| PDF import is mostly a reference | This is expected; text extraction is not a complete editable reconstruction |
| Keynote import is unavailable online | Export PPTX/PDF in Keynote first, or use the local Mac edition with Keynote installed |
| Archive is rejected | Re-export a smaller PPTX/PDF. Limits: 100 MB input, 15,000 entries, 40 MB per expanded entry, 256 MB total. Unsafe, encrypted and ZIP64 archives are rejected |
| Optional provider cannot connect | Check credentials and provider browser access, or use the local edition; manual editing still works |
| Save fails | Keep the original tab open, export a backup, and use recovery. Report a fictional reproduction rather than a private document |

See [optional connections](connections.md), [self-hosting](self-hosting.md), [privacy](../../PRIVACY.md), [asset terms](../../ASSET_LICENSES.md) and [issues](https://github.com/Ken-pan/decksprig/issues).

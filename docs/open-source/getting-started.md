# Decksprig user guide

[Try the sample](https://decksprig.kens-toolbox.com/app?demo=1) · [Watch the walkthrough](https://decksprig.kens-toolbox.com/demo.html) · [中文](getting-started.zh-CN.md) · [For AI agents](agent-guide.md)

Edit, present and export without an account or API key. A desktop browser provides the full workspace.

## Your first document in five minutes

1. **Open the sample.** The link above creates a three-slide copy and preserves existing documents. Read and close **Import report**.
2. **Rename it.** Click the document name at the top, type a name and press Enter.
3. **Edit.** Choose a slide, double-click text to type, then click outside to finish. Select an image or shape to change its size, position and appearance in the editing panel.
4. **Present.** Choose **Present**, use arrows to advance, then Escape to return.
5. **Back up.** Choose **Document menu → Export document → Deck file** to download an editable `.deck.json`.

Edits save automatically. Wait for “Saving…” to finish before closing. If “Not saved” appears, keep the tab open and export a backup.

## Find everyday actions

| I want to… | Where to go |
| --- | --- |
| Start my own document | Home → **Choose a template** or **Start blank** |
| Open saved work | Click the top-left brand mark → **Document library** |
| Find an action | **Search** → type its name, such as `Import document` |
| Add content | Canvas toolbar; use Search for tables, charts and other actions |
| Edit inside a group | Select the group, then its member; double-click text to edit |
| Undo / redo | **Document menu → Undo / Redo**, or ⌘/Ctrl+Z and ⇧+⌘/Ctrl+Z |
| Skip a slide in presentation | That slide's menu → **Hide slide**; its content stays editable |
| Import a file | Search for **Import document**; import creates a new document |
| Edit on a phone | Select an object, open its editing panel, then return to the canvas |

Replace fictional template copy, numbers and chart values with your own evidence.

## Choose an export

Open **Document menu → Export document**.

| Purpose | Choose | Before sharing |
| --- | --- | --- |
| Back up or continue editing elsewhere | **Deck file** · `.deck.json` | Includes media, source metadata, notes and hidden slides; import creates a new copy |
| Hand off to PowerPoint | **PowerPoint** · `.pptx` | Inspect fonts, charts and effects in PowerPoint |
| Present in a browser | **Web page** · `.html` | Remote images, fonts and prototypes may still need internet access |
| Share a static reading copy | **PDF** | Choose Save as PDF in the browser print dialog |

Deck and PowerPoint retain hidden slides; PDF and web presentations use visible slides. Review notes, source links and embedded media before sharing.

## Ask AI for a change

1. Open **Settings → More settings → AI models → Connect provider** and configure your own provider/model and session API key.
2. In the AI panel, select the intended scope: selected objects, this slide or all slides.
3. State the change, what must stay and the desired result: “Shorten this slide's title to eight words. Keep all numbers, citations and other objects unchanged.”
4. Inspect the proposal. Choose **Apply changes** when satisfied, or revise/discard it. Applied changes remain undoable.

Relevant document context goes to your chosen provider. Never paste credentials into a prompt. External agents should follow the [AI / MCP guide](agent-guide.md).

## Where documents live

- **Browser edition:** this browser at this exact website origin; no automatic sync between devices, browsers or domains.
- **Local edition:** documents, history and imported originals live in `.data/`; browser storage also holds recovery drafts.
- **Moving or clearing storage:** export Deck files first. Stop the local app before backing up `.data/`.
- **Changing domains:** export at the [previous address](https://deckleaf-kens-toolbox.netlify.app/app), then import at the new one. See [migration notes](name-change.md).

## Install locally (optional)

Install Node.js 22.14 or newer and Git, then:

```sh
git clone https://github.com/Ken-pan/decksprig.git
cd decksprig
npm ci
npm run dev
```

Open `http://127.0.0.1:4310/` and keep the terminal running. Browser and local document libraries are separate.

## Formats and troubleshooting

| Situation | What to do |
| --- | --- |
| Documents are missing in another browser | Return to the original browser/origin, export Deck, then import here |
| Saving fails | Keep the tab open, export a backup and use recovery; do not clear site data |
| Imported slides differ | Read Import report and inspect pages; complex fonts, charts and effects may change |
| PDF is mostly a reference | Expected: references and extracted text are not complete editable reconstruction |
| Keynote is unavailable online | Export PPTX/PDF first, or use the local Mac edition with Keynote |
| AI cannot connect | Check model, credentials and provider browser access; try the local edition if needed |
| Node command is missing | Install Node.js 22.14 or newer, then reopen the terminal |
| Port 4310 is occupied | Stop the earlier Decksprig instance while preserving its data |
| Local app is blank | Keep `npm run dev` running; production requires `npm run build` before `npm start` |
| PPTX / Keynote archive is rejected | Re-export a smaller file: 100 MB input, 15,000 entries, 40 MB per expanded entry and 256 MB total; unsafe, encrypted and ZIP64 archives are rejected |

[Connections](connections.md) · [Self-hosting](self-hosting.md) · [Privacy](../../PRIVACY.md) · [Report an issue](https://github.com/Ken-pan/decksprig/issues)

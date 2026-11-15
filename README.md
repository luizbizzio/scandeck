# ScanDeck

**Scan a code. Play a game.** ScanDeck is an open-source browser arcade where the game is stored **inside** a QR code, barcode or other 2D code. The symbol contains game data, not a link to another website.

**Play online:** https://scandeck.luizbizzio.com/  
**Version:** 1.0.0  
**Source:** https://github.com/luizbizzio/scandeck

## Features

- Scan supported game codes with a phone or computer camera.
- Upload a code image when camera scanning is difficult.
- Browse 12 example games, download their code images and view the embedded source.
- Create your own code-based games with the supported formats.
- Use the app offline after the files have been saved by the browser.

The Games library shows three data types: **Full** (complete HTML game), **Partial** (the complete JavaScript is inside the code, with a shared HTML interface), and **Bytecode** (small instructions that need a shared interpreter). These labels describe the code contents, not scan reliability.

## Games and formats

| Game | Format |
| --- | --- |
| Ironpass | QR Code |
| Tap Rush | Code 128 |
| Dice Streak | MicroPDF417 |
| Neon Dodge | DotCode |
| Catch 10 | Data Matrix |
| Pattern Memory | Aztec |
| Brick Rush | PDF417 |
| Perfect Timing | EAN-13 |
| Pocket Reflex | Micro QR |
| Codebreaker | GS1 DataBar Expanded Stacked |
| Wire Crisis | IRIS |
| Chroma Rush | ChromaQR |

Codebreaker uses **GS1 DataBar Expanded Stacked**, a distinct stacked linear barcode. It stores `91SDCB7`: GS1 company-internal AI (91), ScanDeck's `SDCB` instruction and the number of guesses (7). It is **Bytecode**, not Partial: the GS1 symbol does not store the JavaScript. The GS1 DataBar Expanded Stacked format has a hard maximum of 41 alphanumeric characters, too small for the complete 97-character Codebreaker JavaScript. ScanDeck supplies the local game interpreter, with the original random secret, UP/DOWN hints, WIN and LOSE. PNG generation uses ZXing-C++ (with BWIPP as a fallback) and **must pass a ZXing image-decoding test** at build time. Camera scanning remains dependent on focus and real-world tests; successful upload or build checks do not prove a mobile camera will read it. The retired JAB reader and generator have been removed; rMQR compatibility readers remain available but are not offered in the library. MicroPDF417 uses ZXing; DotCode, IRIS and ChromaQR have experimental readers.

## Run locally

You need Node.js 24 or newer.

```bash
npm ci
npm run build
npm test
npm run start
```

Open http://localhost:8000. The camera needs HTTPS or localhost. The build command generates game-code PNGs, text payloads, a size manifest and local decoder files.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html`, `src/style.css` | Website |
| `src/app.js`, `src/scanner-geometry.js`, `src/camera-scheduler.js`, `src/barcode-worker.js`, `src/upload-worker.js` | Camera and image scanning |
| `src/protocol.js`, `src/runtime.js`, `src/microvm.js`, `src/maze.js` | Game data and playback |
| `src/chroma.js`, `src/iris-worker.js`, `src/exotic-worker.js` | Experimental decoders |
| `examples/` | Original game sources |
| `assets/` | Game-code images and payloads, mostly generated at build time |
| `vendor/` | Local third-party decoder files |
| `tools/` | Build tools |
| `tests/` | Automated checks |
| `docs/` | Developer and testing documentation |
| `.github/workflows/pages.yml` | Tested GitHub Pages deployment |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Camera scanning and format limits](docs/SCANNING.md)
- [Release testing checklist](docs/QA_CHECKLIST.md)
- [Deployment, custom domain and SEO](docs/DEPLOYMENT.md)

## Security and limits

The scanner uses local decoding. Uploaded pictures run in a separate worker when the browser supports it, so the page stays responsive during long scans. A scanned game is not fetched from a remote game server. The Games tab opens predecoded copies embedded during the release build for immediate previews, so its **Play** buttons are not a camera scanning test.

Only run game code you trust. The game iframe is sandboxed, but untrusted code may still freeze a browser tab.

## License

MIT License. Created by [Luiz Bizzio](https://github.com/luizbizzio).

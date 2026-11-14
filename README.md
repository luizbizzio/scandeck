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

The Games library shows three data types: **Full** (complete HTML game), **Partial** (complete JavaScript game with a shared HTML interface), and **Bytecode** (small instructions that need a shared interpreter). These labels describe the code contents, not scan reliability.

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
| Codebreaker | rMQR |
| Wire Crisis | IRIS |
| Chroma Rush | ChromaQR |

IRIS and ChromaQR previews and downloads use PNG. Auto mode includes ChromaQR. rMQR uses AnyDCode (MIT) as an independent local WASM detector, with ZXing fallback. MicroPDF417 uses the existing ZXing reader; DotCode, IRIS and ChromaQR use experimental camera readers. DotCode stores compactly compressed JavaScript using a smaller Z85 payload (legacy Base64 DotCodes remain readable), with the HTML provided by ScanDeck. Its PNG uses the writer matching the local strict decoder. A validated photo-framing pipeline now improves focused scanning, but real devices still require testing. Dense PDF417, MaxiCode, rMQR and long Code 128 symbols may also be hard to scan. **Successful PNG decoding does not prove real-camera reliability.**

## Run locally

You need Node.js 22 or newer.

```bash
npm install
npm run build
npm test
npm run start
```

Open http://localhost:8000. The camera needs HTTPS or localhost. The build command generates game-code PNGs, text payloads, a size manifest and local decoder files.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html`, `src/style.css` | Website |
| `src/app.js`, `src/scanner-geometry.js`, `src/barcode-worker.js` | Scanner and camera processing |
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

The scanner uses local decoding. A scanned game is not fetched from a remote game server. The Games tab opens predecoded copies embedded during the release build for immediate previews, so its **Play** buttons are not a camera scanning test.

Only run game code you trust. The game iframe is sandboxed, but untrusted code may still freeze a browser tab.

## License

MIT License. Created by [Luiz Bizzio](https://github.com/luizbizzio).

# ScanDeck

**Scan a code. Play a game.**

ScanDeck is a small open-source game console in your browser. Games are stored **inside** QR codes, Code 128 barcodes, Data Matrix codes, and Aztec codes. The data is game code, not a website link.

**Status: 0.2.0 beta.** The software can generate and decode the official examples, but reading codes with real phone cameras still needs more testing. Large codes may be hard or impossible to scan reliably.

## Games

| Game | Code format | How to play |
| --- | --- | --- |
| Ironpass Micro | QR Code | Defend your towers from enemy waves |
| Snake | Code 128 | Use WASD or arrow keys on a computer, or swipe on a phone |
| Catch 10 | Data Matrix | Catch ten moving targets while a timer counts up from zero |
| Pattern Memory | Aztec Code | Tap a color to begin, listen, and repeat each sequence |

Snake is an extreme storage experiment. Its full program is about **696 bytes** and its barcode is very wide. The Play button decodes the real bars, but most phone cameras may not be able to scan the whole barcode. Do not use it as the only scanning demo.

The other games use compressed, self-contained HTML. Their HTML, styles, and JavaScript are all inside the code. Catch 10 has an elapsed-time timer that starts at zero and has no time limit. Pattern Memory creates four notes with the browser's built-in Web Audio API. Tap one of the four original color tiles to start the game and enable sound. No sound files or external game scripts are loaded. They do not need a game engine supplied by the website.

## What you can do

- Scan supported codes using your phone or computer camera.
- Upload an image of a code, including a saved SVG or PNG when your browser supports it.
- Play any compatible game after reading its data.
- Browse and download the four official examples.
- Create a new QR, Code 128, Data Matrix, or Aztec game.
- View the game source before you play it.
- Use the app offline after the site and its files have been saved by the browser.

The browser needs **HTTPS or localhost** for camera access.

## Install and test

You need Node.js 22 or newer.

```bash
npm install
npm run build
npm test
npm run start
```

Open `http://localhost:8000` in your browser.

The build command creates the Data Matrix and Aztec example images in `assets/`. It also puts the local ZXing WebAssembly scanner and QR generator in `vendor/`. These built files are created during GitHub Pages deployment as well.

### Build checks

The build creates each new code and then reads the **encoded PNG pixels** back. It checks that the result is the exact game payload. The automated tests also check the game data, the sandbox, the Snake program, and the interface.

These software tests **do not prove camera readability**. Please complete [the physical test checklist](QA_CHECKLIST.md) before a stable 1.0 release.

## Game formats

| Prefix | Code type | What the code holds |
| --- | --- | --- |
| `SD1:` | QR / Data Matrix / Aztec | Raw Deflate HTML compressed into base43 text |
| `SDS:` | Code 128 | Complete standalone JavaScript program |
| `SDJ:` | Code 128 (legacy) | Small JavaScript program that needs the old ScanDeck helper API |
| `IP3:` | QR (legacy) | Original Ironpass Micro compressed HTML |
| No prefix | Code 128 (legacy) | Exact original 126-byte Snake experiment |

`SD1:` uses this alphabet: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:`. It stores compressed UTF-8 HTML as base43 text. The HTML can include its own styles and scripts. The maximum QR payload is 4,296 alphanumeric characters in theory, but very large QR codes can be hard to scan. Data Matrix and Aztec have their own size limits, and the generator will show an error if a game does not fit.

`SDS:` holds printable ASCII JavaScript. The code is run in a clean browser frame with no ScanDeck game helpers. Normal browser APIs, such as `document`, keyboard events, and timers, are available inside that frame.

The old `SDJ:` and 126-byte Snake formats are kept for backward compatibility. New games should use `SD1:` or `SDS:`.

## How Create works

For QR, Data Matrix, or Aztec, paste a complete HTML game with its JavaScript and CSS inside the same file. ScanDeck compresses it and creates a code. For Code 128, paste a short, standalone JavaScript game.

After generating a code, you can test it, download the SVG, or copy the full encoded text. For a small, easy-to-scan result, use very short games. Code 128 gets physically wider with every extra character.

## Safety and privacy

Game code is not sent to a remote game server. The barcode scanner, QR generator, and WebAssembly engine are hosted with the site. The WebAssembly module and other files must load once before they can work offline.

Games run in an iframe with `sandbox="allow-scripts"` and a Content Security Policy that blocks outgoing network connections and external scripts. The iframe does not get the site's origin. Unknown JavaScript is still a risk: a bad game could use too much CPU or freeze the browser tab. **Only play codes from sources you trust.**

## Project files

- `index.html`, `style.css`: website layout
- `app.js`: game scanner, player, library, and creator
- `protocol.js`: encoding and decoding of game data
- `runtime.js`: isolated browser runtime
- `code128.js`: local Code 128 generator and validator
- `examples/`: HTML sources and standalone Snake source
- `tools/build-matrix.mjs`: builds the Data Matrix and Aztec samples and copies local browser libraries
- `assets/`: images and encoded example data
- `vendor/`: local browser libraries, generated during build
- `tests/`: automated tests
- `QA_CHECKLIST.md`: physical release checks

## Publishing

GitHub Actions installs the dependencies, builds the codes, runs the tests, and publishes the static site. The beta runs without a server-side database or API.

The ScanDeck source is under the MIT license. See [LICENSE](LICENSE). The bundled libraries include ZXing WebAssembly (MIT, Apache-2.0, and BSD-3-Clause components) and qrcode-generator (MIT).

## Extra code experiments

The beta also contains **Breakout Mini** (PDF417), **Tap 10** (MaxiCode), **Micro Math** (Micro QR) and **Math Check** (rMQR).

- **PDF417:** contains a compressed, complete HTML/JavaScript Breakout game.
- **MaxiCode:** contains a short, standalone JavaScript tap counter.
- **rMQR:** contains a short, standalone JavaScript math game.
- **Micro QR:** due to its very low data capacity, contains a tiny `MQ:Q2+2=4` bytecode instruction. **This is not independent JavaScript**. ScanDeck provides a general-purpose arithmetic-question interpreter and input UI. It is deliberately labeled separately from complete standalone games.

Large codes and MaxiCode in particular can be difficult to read from real cameras. Automatic pixel round-trip tests are not physical-camera validation.

## Experimental color codes: JAB Code and Ultracode

- **Color Path (JAB Code):** a compressed, complete HTML game encoded into an eight-color symbol with the experimental etiket writer. It has **not** passed an independent image-decoding check.
- **Color Match (Ultracode):** a standalone JavaScript program encoded by the Zint barcode generator. The program is held in the color symbol, not a URL.

**Neither format is supported by the in-browser ZXing scanner.** The Play sample button deliberately loads the exact payload used to create the code from the packaged .txt file. It does **not** read or validate the pixels of these two symbols. Only PDF417, MaxiCode, Micro QR and rMQR have a working in-browser decoding path at this stage.

The JAB writer is experimental and cannot be represented as independently verified. Real-camera scanning support for both color formats requires new decoders.

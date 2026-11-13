# ScanDeck

**Scan a code. Play a game.**

ScanDeck is a small open-source game console in your browser. Games are stored **inside** QR codes, Code 128 barcodes, Data Matrix codes, and Aztec codes. The data is game code, not a website link.

**Status: 1.0.0.** The software generates and decodes sample codes, but real mobile-camera reliability still needs testing. Large codes may be hard or impossible to scan reliably.

## Games

| Game | Code format | How to play |
| --- | --- | --- |
| Ironpass Micro | QR Code | Defend your towers from enemy waves |
| Snake | Codablock F (experimental) | Use WASD or arrow keys on a computer, or swipe on a phone |
| Tap Rush | Code 128 | Tap as many times as possible in five seconds; the complete JavaScript is embedded |
| Neon Dodge | DotCode (experimental) | Switch lanes to dodge obstacles as speed increases |
| Catch 10 | Data Matrix | Catch ten moving targets while a timer counts up from zero |
| Pattern Memory | Aztec Code | Tap a color to begin, listen, and repeat each sequence |

Snake's original program is about 696 bytes. Its old Code 128 barcode was 7,759 modules wide, too large for practical camera scanning. Its independent source remains available in a legacy QR Code file. The new Tap Rush Code 128 contains its full independent JavaScript source including tap counting, the five-second timer and the final score. It is still physically long, so a phone may struggle to scan it. The full Snake source is showcased in Codablock F.

The other games use compressed, self-contained HTML. Their HTML, styles, and JavaScript are all inside the code. Catch 10 has an elapsed-time timer that starts at zero and has no time limit. Pattern Memory creates four notes with the browser's built-in Web Audio API. Tap one of the four original color tiles to start the game and enable sound. No sound files or external game scripts are loaded. They do not need a game engine supplied by the website.

## What you can do

- Scan supported codes using your phone or computer camera.
- Upload a PNG image of a game code.
- Play any compatible game after reading its data.
- Browse and download the game examples as PNG images.
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
| `LO:` | Code 128 (legacy) | Seven-character Lights Out level, with rules implemented by ScanDeck |
| `SDS:` | Code 128 and other compatible formats | Complete standalone JavaScript program |
| `SDJ:` | Code 128 (legacy) | Small JavaScript program that needs the old ScanDeck helper API |
| `IP3:` | QR (legacy) | Original Ironpass Micro compressed HTML |
| No prefix | Code 128 (legacy) | Exact original 126-byte Snake experiment |

`SD1:` uses this alphabet: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:`. It stores compressed UTF-8 HTML as base43 text. The HTML can include its own styles and scripts. The maximum QR payload is 4,296 alphanumeric characters in theory, but very large QR codes can be hard to scan. Data Matrix and Aztec have their own size limits, and the generator will show an error if a game does not fit.

`SDS:` holds printable ASCII JavaScript. The code is run in a clean browser frame with no ScanDeck game helpers. Normal browser APIs, such as `document`, keyboard events, and timers, are available inside that frame.

The old `SDJ:` and 126-byte Snake formats are kept for backward compatibility. New games should use `SD1:` or `SDS:`.

## How Create works

For QR, Data Matrix, or Aztec, paste a complete HTML game with its JavaScript and CSS inside the same file. ScanDeck compresses it and creates a code. For Code 128, paste a short standalone JavaScript game; the Tap Rush example is a complete 61-character script with a five-second timer. Older Lights Out levels still decode as backward-compatible bytecode.

After generating a code, you can test it, download the PNG, or copy the full encoded text. For a small, easy-to-scan result, use very short games. Code 128 gets physically wider with every extra character.

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

GitHub Actions installs the dependencies, builds the codes, runs the tests, and publishes the static site. The site runs without a server-side database or API.

The ScanDeck source is under the MIT license. See [LICENSE](LICENSE). The bundled libraries include ZXing WebAssembly (MIT, Apache-2.0, and BSD-3-Clause components) and qrcode-generator (MIT).

## Extra code experiments

The site also contains **Breakout Mini** (PDF417), **Tap 10** (MaxiCode), **Micro Math** (Micro QR) and **Math Check** (rMQR).

- **PDF417:** contains a compressed, complete HTML/JavaScript Breakout game.
- **MaxiCode:** contains a short, standalone JavaScript tap counter.
- **rMQR:** contains a short, standalone JavaScript math game.
- **Micro QR:** due to its very low data capacity, contains a tiny `MQ:Q2+2=4` bytecode instruction. **This is not independent JavaScript**. ScanDeck provides a general-purpose arithmetic-question interpreter and input UI. It is deliberately labeled separately from complete standalone games.

Large codes and MaxiCode in particular can be difficult to read from real cameras. Automatic pixel round-trip tests are not physical-camera validation.

## Color codes: ChromaQR and IRIS

- **Chroma Rush (ChromaQR):** the complete compressed HTML game is encoded across three aligned RGB QR layers. The MIT-licensed [ChromaQR](https://github.com/w-henderson/ChromaQR) method is implemented in browser JavaScript and decoded locally through the ZXing WebAssembly QR reader.
- **Wire Crisis (IRIS):** the compact standalone JavaScript program is inside an experimental eight-color circular symbol. The MIT-licensed [IRIS](https://github.com/AllTerrainDeveloper/iris) implementation is pinned in `vendor/iris` at commit `4a59a8b165afd1633f497188bd47ff8e8c98640c`.
- This assignment reduces IRIS from a 48-ring Chroma Rush symbol to a 16-ring Wire Crisis symbol, making camera localization and color sampling more practical. Both formats use the real game bytes, not URLs, alternate QR codes, or hardcoded fallback text.
- Generated game symbols are served and downloaded as **PNG**, not SVG. The page Create also exports PNG. Internally, SVG may be used as a temporary rendering representation before rasterization.
- The scanner uses a higher-resolution camera feed, disables ZXing's automatic downscaling and offers focused scanning for PDF417, MaxiCode, rMQR, Code 128, IRIS and ChromaQR. Focused IRIS reading analyzes a central square crop in a Web Worker.
- PNG pixel round trips are automated, but real phone-camera scanning remains dependent on focus, lighting, screen size, perspective and symbol density. This is **not** a guarantee that every format scans reliably on every device.

## Practical scanning limits

The original Snake was over 700 JavaScript characters and produced a Code 128 symbol **7,759 modules wide**. That is not practical for a typical phone camera. The full self-contained Snake program is now showcased in Codablock F, while Tap Rush uses an independent JavaScript game in Code 128. Both may be hard to scan with a physical camera. Neither barcode relies on an external game URL.

When scanning a dense code from another screen, open the complete PNG, not the small gallery thumbnail. Under **Scan**, set **Scanner focus** to the exact code type, keep it centered, and provide bright, even light. A PNG image that decodes in automated tests may still fail from an unfocused or low-resolution camera frame.

## Redesigned games

- **Brick Rush (PDF417):** a slower Breakout game with twelve bricks, three lives, scoring, pointer/keyboard control and replay. Complete HTML and JavaScript are inside the PDF417.
- **Perfect Timing (MaxiCode):** a fast-changing number; click when it reaches seven. A compact standalone program is stored inside MaxiCode. Reload the game to retry.
- **Pocket Maze (Micro QR):** the complete level data, wall bitmap and move limit are encoded as `MQ:M36509` (nine characters). ScanDeck provides the *generic* movement, maze and rendering interpreter. This is bytecode, **not independent JavaScript**.
- **Codebreaker (rMQR):** discover a secret number from 0 to 98 in seven guesses using UP/DOWN hints. Its standalone JavaScript is encoded in rMQR.
- **Chroma Rush (ChromaQR):** ten color targets, three lives, progressively faster reaction times and replay. The full HTML game is embedded across the RGB channels.
- **Wire Crisis (IRIS):** memorize three to seven wires in five timed rounds. Wrong cuts and expired timers end the game. Its complete JavaScript program is encoded in IRIS.

IRIS and ChromaQR both have browser image decoders. Real mobile-camera testing is still required.

## UX fixes in the player

Pocket Maze is now accepted by Play after the scanner decodes its Micro QR level. Standalone JavaScript games have a generic dark player, readable input controls, instructions and a clear visual result for boolean feedback. Their game-specific program logic remains embedded in the respective code.

Perfect Timing uses a randomized millisecond target and offers Play Again after each result. Codebreaker submits only on the GO button, preventing input focus from spending a turn. Chroma Rush is now a color-word attention game: tap the color of the letters, not the word, before the visible timer expires. Wire Crisis has colored R, G and B controls and an explicit requested wire and round count. Color-code scanning is still experimental.

Perfect Timing uses the compact original one-shot timer to stay within MaxiCode's physical codeword capacity. After a hit or miss, use the shared **Retry** control to play it again. The timer and click condition are still inside MaxiCode.

## Latest mini-game redesign

- **Perfect Timing (MaxiCode):** choose a new millisecond-derived target between 999 and 1,997 milliseconds. Start the clock, then stop close to that target. The MaxiCode contains its randomized target and time-difference logic. The shared ScanDeck player renders the millisecond clock and clear result.
- **Codebreaker (rMQR):** the seven-guess program stays inside the code. The shared player displays full UP/DOWN hints in a separate status section and the remaining attempts below. The time-derived number changes when a new game starts, though duplicate numbers remain statistically possible.
- **Pocket Maze (Micro QR):** this remains a bytecode game. The Micro QR holds a seed and difficulty; the generic ScanDeck interpreter generates randomized, fully connected 6×6 mazes and move limits. The engine is not embedded in the Micro QR.
- **Chroma Rush (ChromaQR):** the word color, status, lives, timer bar and buttons now have separate spaces. The first reaction window is three seconds, gradually shortening as you score.
- **Wire Crisis (IRIS):** five increasingly difficult memory rounds. Memorize three to seven colored wires and cut them in order. One wrong cut or the decreasing timer ends the run. The shared player renders large wire buttons, a memorization preview, a shrinking countdown and status text.
- **Brick Rush (PDF417):** centered canvas and platform through shared presentation CSS without increasing the encoded physics program.

IRIS and ChromaQR decode generated PNG pixels independently. Physical mobile-camera testing remains necessary.


## Mobile full-screen camera and focused reading

On mobile, **Open camera** uses a full-viewport camera view that shows the entire video frame without cropping it. A **Close** button stays inside the top safe area, while the format selector remains accessible at the bottom. Switching formats inside the camera changes the scanner focus immediately. The CSS overlay does not rely on a platform Fullscreen API permission.

For **rMQR**, select rMQR in the camera view and hold the long rectangular code straight and sharply focused, preferably with the phone in landscape if the symbol spans the display. The reader alternates full-frame and centered high-resolution attempts and tries distinct contrast processing.

For **MaxiCode**, select MaxiCode, keep the symbol flat and upright, and move close enough for the code to almost fill the center square. The current ZXing decoder requires a pure black-and-white, essentially unrotated and unskewed MaxiCode image. ScanDeck attempts a centered, thresholded crop, but this limitation means **reliable mobile-camera scanning is not guaranteed**. A straight-on, sharply focused PNG upload is often more practical.

The **Tap Rush** Code 128 symbol contains a complete 61-character JavaScript program (65 characters with its ScanDeck prefix). It needs no external game library or hidden level interpreter. Because the symbol is long, a clean PNG decoding test does not guarantee real camera success.


## Codablock F and DotCode

- **Snake (Codablock F):** the complete original 697-character JavaScript program is stored in a single stacked barcode. All rows must be present to recover it.
- **Neon Dodge (DotCode):** a complete HTML document with its own canvas, graphics, movement, obstacle collision and restart logic is compressed inside the symbol.
- Both formats are generated and decoded by the MIT-licensed **Sythos Barcode Universal 1.6.8** package. The browser ESM bundle and its license are stored locally in `vendor/`.
- The site uses a Web Worker to decode Codablock F and DotCode on an uploaded PNG or focused live-camera frame. A checksum-valid full result is required. Failed reads do not silently load a text-file fallback.
- **Important limitation:** their open-source image detectors support clean integer-scaled, axis-aligned symbols, not arbitrary camera perspective, blur, or heavy distortion. They are explicitly experimental, and mobile camera success is unverified.
- The full-size matrices pass a strict format-decoder integrity test during build. Large PNG camera-raster decoding remains experimental and is not claimed as verified.
- The site still ships a QR Snake PNG for compatibility with earlier links, but the Games gallery presents the Codablock F version.


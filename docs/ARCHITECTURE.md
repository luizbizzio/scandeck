# Architecture

ScanDeck is a static single-page application deployed with GitHub Pages. The root `index.html` and `sw.js` retain their existing URLs and service-worker scope. All JavaScript modules and third-party decoders run locally in the browser.

## Repository layout

- `src/app.js` manages the single-page interface, camera lifecycle, game cards and code creator.
- `src/scanner/` contains capture geometry, scan scheduling, upload and camera workers, experimental format detection and compatibility decoders.
- `src/formats/` contains game payload encoding and decoding, DataBar, Code 128 and ChromaQR helpers.
- `src/games/` contains the sandboxed game document runtime and bytecode/maze interpreters.
- `src/ui/` holds game metadata/source labels and responsive gallery layout helpers.
- `src/style.css` styles the browser app.
- `examples/` holds the source programs for published games and compatibility samples still used by automated tests.
- `tests/fixtures/` contains test-only HTML source samples not shipped as games.
- `tools/build/` generates code PNGs, encoded text payloads, metadata and browser dependencies. `tools/automation/` refreshes README screenshots; `tools/diagnostics/` holds manual engineering probes.
- `tests/` contains automated unit, integration, scanner and static deployment checks.
- `vendor/` contains generated or vendored third-party decoder assets and their licenses.
- `docs/` contains technical information and the README screenshot.

## Why code files are inside assets/

`assets/` contains **published artifacts**, not ordinary JavaScript source modules. Each game has a downloadable `.png` symbol and an encoded `.txt` payload. For a complete game, the text payload contains the game's encoded program rather than a URL to a hosted game. ScanDeck uses the same payloads to show source and play games, including when offline.

The Ironpass `assets/ironpass-micro-v3.txt` file is the actual packed QR content; `assets/ironpass-micro-v3-qr.png` is its scannable image. Those two baseline assets remain tracked so source checkouts and external links retain their known references. The build regenerates them from `examples/ironpass-micro-v3.html`. Other generated `assets/*.png`, `assets/*.txt` and `assets/code-sizes.json` are produced by `npm run build`. Keep public paths stable: downloaded or bookmarked code images may use them.

`src/scanner/exotic-shapes.js` is the generated geometry metadata for the experimental scanner; it is rewritten by `tools/build/build-exotic.mjs`.

## Decoding and execution

1. The camera or an uploaded code image provides pixels.
2. Standard formats use bundled ZXing WebAssembly; native `BarcodeDetector` can accelerate supported formats.
3. Dedicated local workers handle IRIS, ChromaQR, DotCode, Codablock F and compatible rMQR decode paths.
4. `src/formats/protocol.js` validates decoded game payloads. Unrelated barcodes are not treated as ScanDeck games.
5. `src/games/runtime.js` opens the game inside a sandboxed frame. The deploy build embeds the 12 decoded library games into `index.html` for immediate Play.

The published library has 12 code formats. rMQR remains supported as an experimental compatibility decoder and build/test fixture; it is not a current library card. Codablock F and Snake are also used in engineering tests outside the 12-card library.

## Build, tests and deployment

- `npm ci`: install exact dependencies.
- `npm run build`: regenerate code assets and local browser libraries.
- `npm test`: execute the Node test suite (run the build first on a fresh clone).
- `npm run build:cloudflare`: create the complete static `dist/` directory. Despite its historical name, the same output is now used for GitHub Pages.
- `.github/workflows/pages.yml`: run build, syntax validation and tests, then deploy `dist/`.
- `.github/workflows/audit-ci.yml`: security and browser-smoke checks for pull requests and audit branches.

The distribution step copies `src/` recursively; flat copy rules such as `src/*.js` would miss nested scanner and game modules. The service-worker precache paths, worker URLs, tests and deployment output must change together if a module is moved. Do not change public `assets/` URLs without redirects.

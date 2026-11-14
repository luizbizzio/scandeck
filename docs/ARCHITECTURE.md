# Architecture

ScanDeck is a static single-page application hosted with GitHub Pages. The files at the repository root are kept there because the entry page, imports and service-worker scope depend on these relative URLs.

## Source layout

- `src/app.js` connects the scan screen, library, code creator and game player.
- `src/scanner-geometry.js` contains pure, unit-testable camera capture and crop sizing.
- `src/protocol.js`, `src/runtime.js`, `src/microvm.js` and `src/maze.js` decode and run the game types.
- `src/chroma.js`, `src/iris-worker.js` and `src/exotic-worker.js` handle experimental formats.
- `examples/` holds the original source of each sample game.
- `tools/` produces real PNG codes, text payloads, metadata and local vendor assets.
- `tests/` checks decoding, game behavior, UI assumptions and image round trips.
- `vendor/` includes pinned third-party code. Avoid editing it for local application changes.
- `assets/` includes the favicon and the legacy Ironpass QR in Git. Most generated codes are built during deployment.

## Scan flow

1. A device camera or PNG produces pixels.
2. Standard formats use local ZXing WebAssembly, with native BarcodeDetector tried when a supported browser implementation is available.
3. IRIS runs in a worker. ChromaQR is split into RGB planes. Codablock F and DotCode run in an isolated worker.
4. The decoded text must match a supported ScanDeck game protocol. Unrelated barcodes do not open games.
5. The selected game runs inside the site's sandboxed game frame. The release build also embeds the original decoded sample games in a JSON data script, avoiding a separate fetch/decompression step when the user presses Play.

The Codebreaker game uses GS1 DataBar Expanded Stacked with a seven-character Bytecode configuration. The decoder does not store JavaScript in the GS1 symbol; ScanDeck provides the game runtime. The old JAB and rMQR decoders remain available only as legacy modules and are not active library formats.

The live camera uses a single in-flight frame in its ZXing worker. Auto prioritizes standard QR/linear/matrix codes and schedules PDF417, ChromaQR and IRIS sparsely. ChromaQR and IRIS have dedicated focus modes when needed; DotCode requires dedicated focus. Native BarcodeDetector is used for Auto when available. Main and detailed capture canvases are reused, IRIS RGB conversion runs in its worker, and every worker has a bounded lifetime or recovery timeout. The camera stops its tracks and releases worker memory on close or when the page becomes hidden. Real-device performance must still be verified before release.

## Build and deployment

`npm run build` creates the output images and vendor browser dependencies. `npm test` runs local checks. The Pages workflow builds and copies a tested static distribution into `dist/`, including `src/`, `robots.txt` and `sitemap.xml`.

Files directly used by GitHub Pages should not be moved without updating imports, service-worker precache, tests and the workflow together.

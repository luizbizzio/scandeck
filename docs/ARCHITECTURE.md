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
2. Standard formats are read with local ZXing WebAssembly, or native BarcodeDetector when it supports the full standard set.
3. IRIS runs in a worker. ChromaQR is split into RGB planes. Codablock F and DotCode run in an isolated worker.
4. The decoded text must match a supported ScanDeck game protocol. Unrelated barcodes do not open games.
5. The selected game runs inside the site's sandboxed game frame. The release build also embeds the original decoded sample games in a JSON data script, avoiding a separate fetch/decompression step when the user presses Play.

The camera runs ZXing WebAssembly in `src/barcode-worker.js`, off the UI thread. Only one frame is decoded at a time and the decoder worker is stopped when the camera closes. The focused scanner mode uses a larger capture size for dense codes. PDF417, rMQR and MaxiCode also alternate full-frame and centered crop attempts. Native auto scanning avoids copying frames to a canvas. The canvas is reused during the scan session to reduce allocations and the frame interval is throttled. Experimental modes run only when selected.

## Build and deployment

`npm run build` creates the output images and vendor browser dependencies. `npm test` runs local checks. The Pages workflow builds and copies a tested static distribution into `dist/`, including `src/`, `CNAME`, `robots.txt` and `sitemap.xml`.

Files directly used by GitHub Pages should not be moved without updating imports, service-worker precache, tests and the workflow together.

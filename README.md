# ScanDeck

**Scan a code. Play a game.**

ScanDeck is an open web app that reads games from QR codes and Code 128 barcodes. A game is stored in the code itself, not behind a link. The website acts as the game console.

## What it can do

- Scan QR codes and Code 128 with a phone or laptop camera.
- Open a QR or barcode image, or paste the code text.
- Play the original **Ironpass Micro V3** QR game and the **126-byte Snake** barcode game.
- Run compatible games made by other people.
- Create a QR game from a small HTML file.
- Create a Code 128 microgame from a small JavaScript program.
- Work offline for saved website files, when browser support allows it.

The site uses the built-in browser scanner when possible. If that is not available, it tries ZXing from a third-party CDN. The QR image generator also loads a small library from a CDN. Those two extra features need an internet connection the first time.

## Run locally

No build tool is needed. Serve the folder with a local HTTP server:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in your browser. Camera access needs HTTPS or localhost. Opening `index.html` with `file://` is not supported because the app uses JavaScript modules.

Run tests:

```bash
npm test
```

## Game formats

| Prefix | Type | Details |
| --- | --- | --- |
| `IP3:` | QR Code | Original Ironpass Micro V3. Raw Deflate, custom base43 encoding. |
| `SD1:` | QR Code | Open ScanDeck format. Raw Deflate, custom base43 encoding, self-contained HTML. |
| `SDJ:` | Code 128 | Open mini JavaScript format. The script runs with ScanDeck's microgame canvas API. |
| none | Code 128 | Exact 126-byte original Snake source. This legacy format is checked against the original source. |

**SD1** and **SDJ** are open formats. Games are not restricted to the two official examples. Random barcodes, URLs, and normal HTML5 game repositories cannot be played unless their content is packed in a supported format.

### SD1: QR HTML games

1. Build an HTML game that works without external files.
2. Paste the HTML into the **Create** tab.
3. ScanDeck compresses the UTF-8 HTML with raw Deflate.
4. Bytes are encoded with the QR-friendly 43-character alphabet: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:`.
5. Each group of two bytes becomes three alphabet characters. The first character is `1` when the final byte needs padding, or `0` otherwise.
6. The final payload starts with `SD1:`.

The maximum payload is 4,296 QR alphanumeric characters, which uses QR version 40, error correction L. This is a theoretical maximum and may be very hard to scan on a phone. The author must fit the game inside that limit.

### SDJ: Code 128 microgames

The code contains `SDJ:` followed by one line of printable ASCII JavaScript. The host provides these global objects:

- `c`: 320×320 canvas
- `g`: 2D canvas drawing context
- `gameAPI.canvas` and `gameAPI.ctx`: same canvas and context
- `gameAPI.onDirection(callback)`: listen for `U`, `D`, `L`, `R`
- `gameAPI.score(number)`: show a score
- `gameAPI.end(message)`: show a game end message

Example:

```js
let x=4,y=4;g.fillStyle='#b9ef79';gameAPI.onDirection(v=>{x=(x+(v==='R')-(v==='L')+10)%10;y=(y+(v==='D')-(v==='U')+10)%10;g.clearRect(0,0,320,320);g.fillRect(x*32,y*32,30,30)});g.fillRect(x*32,y*32,30,30)
```

Code 128 does not have a simple fixed maximum. Longer programs create very wide barcodes that most phone cameras cannot read well. Keep programs as small as possible.

## Security and privacy

Games run inside an iframe with `sandbox="allow-scripts"`. The frame has an opaque origin and a Content Security Policy that blocks network requests, forms, and external scripts. Game code cannot read the ScanDeck page or use its permissions. Still, do not play unknown code you do not trust: hostile code can use CPU or freeze its own frame. A code is decoded first; you press **Play game** to run it.

Game data stays in the browser when you scan, decode, and create it. The fallback scanner and QR generator may download their public libraries from external CDNs, but the game is not uploaded to them.

## GitHub Pages

An included GitHub Actions workflow builds, tests, and deploys the static site. Open **Settings → Pages**, select **GitHub Actions** as the build source, and push to `main`. The repo may need a suitable GitHub plan to publish Pages while private.

## Project layout

- `index.html`, `style.css`: user interface
- `app.js`: scanner, player, example games, creator
- `protocol.js`: formats and compression
- `runtime.js`: isolated game runtime
- `code128.js`: barcode image generator
- `assets/`: example barcode and QR files
- `tests/`: format and runtime tests
- `tools/generate_examples.py`: rebuild the Ironpass QR code

## License

MIT. See [LICENSE](LICENSE).

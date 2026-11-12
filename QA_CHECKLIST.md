# ScanDeck beta release checklist

Do not mark the camera checks as passed until tested on real devices. Unit tests and generated image decoding cannot replace them.

## 1. Camera scanning

- [ ] Android Chrome: scan the Catch 10 Data Matrix from a second screen.
- [ ] Android Chrome: scan the Pattern Memory Aztec Code from a second screen.
- [ ] Android Chrome: scan the Ironpass QR from a second screen.
- [ ] iPhone Safari: repeat the three tests above.
- [ ] Confirm each game opens and the whole game can be played.
- [ ] Repeat each code five times in normal indoor light. Record successes and scan time.
- [ ] Check that stopping the camera turns off the device's camera indicator.
- [ ] Test camera denied, missing camera, switching browser tabs, and retrying.
- [ ] Test uploading downloaded PNG and SVG code images on both mobile browsers.
- [ ] Keep Snake clearly labeled as an extra-wide barcode experiment. Do not promise it can be scanned with a phone.

## 2. Game controls

- [ ] Snake: WASD, arrow keys, and mobile swipes work.
- [ ] Snake: growing, losing, winning, and starting again work.
- [ ] Catch 10: the target moves and the game ends after ten taps.
- [ ] Pattern Memory: wrong answers restart; five correct rounds win.
- [ ] The Exit button closes every game.
- [ ] The site does not move or zoom while playing.

## 3. Creation and compatibility

- [ ] Create and download one new QR, Data Matrix, Aztec, and Code 128 game.
- [ ] Test each generated game directly using the Test game button.
- [ ] Scan or upload each newly generated code from a different device.
- [ ] Long input returns a readable error; the website stays responsive.
- [ ] Invalid or unrelated barcodes are rejected without opening a game.
- [ ] Existing SDJ and old Snake codes still open.
- [ ] Offline mode works after an initial online visit, including Create and image upload.

## 4. Safety and browser behavior

- [ ] Only the expected local vendor files load during scanning and code creation.
- [ ] A game cannot read the ScanDeck page through its sandbox.
- [ ] A game cannot make network requests under its Content Security Policy.
- [ ] Test invalid images, huge files, and malformed code data.
- [ ] Test recovery after a game error. Closing and reopening the player still works.
- [ ] Be clear that untrusted game scripts can freeze the tab. Do not promise full isolation.

## 5. Release

- [ ] All GitHub Actions tests and the deployment finish successfully.
- [ ] README, About, version, game descriptions, and license are correct.
- [ ] Test the public Pages URL on a fresh phone, with no saved site data.
- [ ] Have one other person test the app without instructions.
- [ ] Keep the public version marked beta until the real camera checks pass.

## Suggested feedback form

Record: device model, OS version, browser version, code format, display or printed size, distance, lighting, scan success, time to detect, and the error message if one appears.

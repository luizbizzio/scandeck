# ScanDeck release QA checklist

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
- [ ] Catch 10: the timer starts at zero and counts up continuously, even after 20 seconds; ten successful taps win and stop the timer.
- [ ] Pattern Memory: the original four rounded color tiles are visible immediately; tapping one enables audio, all four colors have distinct tones, mistakes restart, and five correct rounds win.
- [ ] On iPhone Safari and Android Chrome, Pattern Memory plays sound after tapping a color tile. Check volume and silent mode.
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
- [ ] Verify the public version is 1.0.0 and distinguish experimental camera support from verified results.

## Suggested feedback form

Record: device model, OS version, browser version, code format, display or printed size, distance, lighting, scan success, time to detect, and the error message if one appears.

## New format release checks

- [ ] PDF417: move the paddle and clear all bricks in Breakout Mini.
- [ ] MaxiCode: count ten taps and confirm the WIN message is shown.
- [ ] Micro QR: scan an MQ arithmetic bytecode symbol, confirm the interpreter displays the exact problem and accepts its answer.
- [ ] rMQR: solve the math puzzle using the input field.
- [ ] IRIS Wire Crisis: the complete game decodes from the image pixels, with no fallback payload lookup.
- [ ] ChromaQR Chroma Rush: all three RGB QR channels decode and reconstruct the complete game, with no fallback payload lookup.
- [ ] IRIS and ChromaQR: independently validate camera framing, focus, lighting and perspective on real mobile devices.

## Redesigned games
- [ ] Brick Rush: slow ball, bouncing angles, three lives, 15 bricks, touch controls and restart
- [ ] Perfect Timing: watch the changing number and stop exactly at seven
- [ ] Pocket Maze: 4 by 4 map, nine moves, walls, exit and restart
- [ ] Codebreaker: seven guesses with UP/DOWN hints, WIN and LOSE
- [ ] Chroma Rush: color matching, time pressure, 10 targets, 3 lives and retry
- [ ] Wire Crisis: three to seven random wires across five timed rounds, BOOM on wrong cut or timeout

## Fixes to check on real devices
- [ ] Pocket Maze: Play decodes and opens the maze, with no unsupported-program error
- [ ] Perfect Timing: dark background, large repeating number and visible PERFECT/MISS result
- [ ] Codebreaker: dark input and GO button; touching input does not spend a guess
- [ ] Chroma Rush: match the actual ink color, not the word; timer and three lives are visible
- [ ] Wire Crisis: the CUT prompt and round count are clear; red, green, blue buttons are visually distinct

- [ ] Retry resets Perfect Timing and other games without refreshing the ScanDeck page

## New UI and gameplay QA
- [ ] Perfect Timing: random target, Start/Stop, visible milliseconds, different target on Retry, clear accuracy result
- [ ] Codebreaker: a full UP or DOWN hint, remaining attempts in a separate area, guess only on GO
- [ ] Pocket Maze: randomized 6x6 layout with a solvable route, keyboard, buttons and mobile swipe
- [ ] Chroma Rush: balanced spacing, three-second initial response window, 3 lives and 10 rounds
- [ ] Wire Crisis: memorize three to seven wires, 1.6-second preview, shrinking ten-to-six-second timer, no continuing after BOOM or timeout
- [ ] Brick Rush: the full game area is centered on desktop and mobile

## PNG and focused camera regression

- [ ] Every game card previews and downloads a PNG, including Code 128, PDF417, MaxiCode, rMQR, IRIS and ChromaQR.
- [ ] Create outputs PNG files, without exposing SVG downloads.
- [ ] QR Snake carries the complete original standalone script. Short Code 128 Lucky Six also carries a full game.
- [ ] Test focused PDF417, MaxiCode and rMQR scanning from a second screen with a real mobile phone.
- [ ] Test the compact 16-ring IRIS Wire Crisis and the RGB ChromaQR Chroma Rush under bright and dim lighting.
- [ ] Compare default All formats with individual focused scanning; verify the camera runs without freezing.

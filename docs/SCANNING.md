# Camera scanning

Code generation and real-phone decoding are different problems. A perfect downloadable PNG can still be too dense to capture through a camera.

## Recommended test order

1. Download the original PNG from Games. Upload it in Scan. Record whether the exact game is decoded.
2. Open that full-size PNG on a second device at a reasonable display brightness.
3. Use **Open camera**, choose the matching **Scan format**, and keep the whole symbol visible with its quiet margins.
4. Try portrait and landscape. Avoid glare and motion. If the image is blurry, change the distance instead of zooming the webpage.
5. Repeat each format at least five times on Android Chrome and iPhone Safari.

## Formats

| Format | Current camera considerations |
| --- | --- |
| QR Code, Data Matrix, Aztec, Micro QR | Standard decoder support, but game size and camera quality still matter |
| Code 128 | Very wide when it contains a full JavaScript game. Keep both side margins visible |
| PDF417 | Fine stacked bars. Dedicated mode retains more capture detail and tries a centered crop |
| rMQR | Narrow rectangle. Dedicated mode tries a broad centered crop as well as the full frame |
| MaxiCode | Best upright, frontal and sharp. Reliable camera reading is not guaranteed |
| Codablock F | Experimental reader; full stacked code and clean straight lines are required |
| DotCode | Experimental reader; dot spacing and perspective can cause failure |
| IRIS | Experimental ring/color detection. Use even light and a centered symbol |
| ChromaQR | RGB planes are affected by screen brightness, camera white balance and blur |

Standard Auto mode includes intermittent ChromaQR scans but not IRIS, Codablock F or DotCode. Select them explicitly. There is no debug scanner mode. The standard live-camera decoder now runs in a separate worker with one in-flight frame, frame throttling and cleanup on stop. The change targets preview responsiveness; it does not make unsupported symbols camera-readable.

## Test reports

Record device, OS, browser, source screen or print dimensions, orientation, distance, brightness, format, upload result, camera result and time to detection. Do not mark a format as camera verified based only on its Play button or a PNG unit test.

See [QA_CHECKLIST.md](QA_CHECKLIST.md) for full test cases.

## Color code display

IRIS and ChromaQR previews and downloads use PNG. If a vector preview scans and the PNG does not, compare the displayed sizes before changing the decoder. A vector source improves image sharpness but does not eliminate camera color calibration issues.

## DotCode interoperability

The previous independent BWIPP-generated PNG was 1941 × 1371 pixels and was too large for the two-million-pixel reader input limit. The current first-party PNG uses the Sythos writer matching the local strict decoder. The original game remains inside it, and the exact PNG is decoded in tests. Interoperability with readers from other vendors is not established.

## Codablock F camera recovery

The experimental scanner now rotates, increases contrast, and periodically tries a centered crop with the stricter camera decoding settings. These attempts improve tolerance to framing but do not replace a perspective-correcting decoder. Keep the full stacked code and quiet margins visible; scanning on real hardware remains unverified.

The Codablock F generator tries multiple row counts and chooses a balanced layout that fully decodes. The latest successful matrix is 365 × 169 modules. The full JavaScript game is inside the code. Show the PNG large enough to preserve individual bar widths.

## Compact game data

The latest samples store their original executable sources as DEFLATE plus Z85 text (`SDB` for standalone JavaScript and `SDC` for complete HTML). This reduces barcode density without converting the content into a URL or a server-side game lookup. ScanDeck also decodes older base64 (`SDZ`, `SDH`) and original (`SDS`, `SD1`) payloads.

## rMQR and MaxiCode practical limits

The rMQR writer compared raw JavaScript byte mode (147 characters) against an uppercase alphanumeric compressed representation (197 characters). Both generated the same pixel area (432432 square pixels at the configured scale), so the smaller text representation was retained. That is the actual symbol choice, not a claim that compression never works for other programs.

ZXing-C++ marks MaxiCode reading as partial. The scanner alternates whole-frame, monochrome aligned square, tighter centered square and rotated passes. The monochrome square uses the ZXing isPure setting; raw camera photos are not guaranteed to meet the decoder's no-skew requirement. Device validation is still needed.

## Exotic image decoding update

The previous DotCode image was 1941 × 1371 pixels and exceeded the experimental reader's two-million-pixel input limit. The first-party PNG now uses the same strict DotCode encoder as its on-device decoder, so the exact PNG can be decoded independently of browser frame geometry. The reader also attempts to reconstruct the real barcode matrix from a centered white card, using symbol **dimensions only**. Every candidate is verified with the full barcode checksum; no payload is looked up from image identity. The generic scanner remains a secondary, bounded fallback. Physical perspective and camera focus remain separate limitations.

## Camera matrix recovery

Focused Codablock F and DotCode now attempt to recover a real module grid from the camera's white card region and verify every candidate using the respective strict barcode decoder. Module dimensions are generated with the published PNGs, but neither the payload nor a game ID is used as a hint. Automated tests cover centered, resized images and two-degree in-plane tilt on both symbols. Larger perspective distortion, blur, missing modules, and third-party decoder interoperability remain unverified. Expensive generic image scans are skipped for dense Codablock F video frames to avoid lengthy worker timeouts; arbitrary layouts still require a more capable detector.

## Perspective-aware white-card recovery

The experimental reader additionally isolates the largest light card component in a camera frame, finds its four image corners, and samples a projectively corrected symbol matrix. The decoder must verify all Codablock F checksums or DotCode error correction before accepting a game; no game bytes are passed as hints. The original front-facing detector remains available on alternating frames. A camera-ready code still needs adequate on-screen module size and focus. Tests include synthetic perspective-distorted raw pixel frames.

## Dense-code camera and upload performance

Exotic camera scans now alternate strict frontal and projective quadrilateral sampling instead of sending megapixel frames through the expensive generic detector. When available, continuous camera autofocus is requested without blocking preview. Uploaded photos above the 2-megapixel decoder bound get a downscaled full view and a centered, higher-detail crop. Both views are tested with exact checksums. DotCode and Codablock F sample programs were further minified without removing their games. These changes are tested on simulated images; physical device read rates remain unverified.

## Symbol footprint optimization

The build now tests DEFLATE window sizes from 9 through 15 and selects the shortest complete Z85 representation for each full game. Codablock F tests multiple legal row and column counts, checks each candidate with its actual strict decoder and prefers a narrower, balanced symbol for camera scanning. This avoids reducing complexity by throwing away game behavior.

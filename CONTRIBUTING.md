# Contributing to ScanDeck

Run `npm start` from the repository root to serve the app with Python on port 8000. Run `npm test` for the Node test suite. See the [architecture](docs/ARCHITECTURE.md), [scanner notes](docs/SCANNING.md), and [QA checklist](docs/QA_CHECKLIST.md) for the affected area.

## Review a change

- For codec and format changes, round-trip a fixture through encode, scan or upload, and play. Include the format, payload size, and the browser or camera you tested.
- For scanner changes, check uploaded images, live scanning if available, and a damaged or unsupported input. For a UI or runtime change, load an existing game as well as a newly generated one.
- For changes that affect generated assets, follow the [deployment instructions](docs/DEPLOYMENT.md) and run the relevant build locally.

Add a minimal code image or payload fixture when it makes a regression reproducible. Use games and assets you can share.

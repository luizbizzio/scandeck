# Security policy

ScanDeck is a browser-based game scanner and creator. It reads data from images and can run game code in a sandboxed iframe. Security reports are welcome, especially when a crafted code, image, or game can affect another part of the browser or the website.

## Supported versions

| Version | Security updates |
| :--- | :--- |
| Latest `main` and current live website | Supported |
| Older commits, copies, and deployments | Not actively supported |

The public website and the source in `main` are the main supported versions. Version numbers alone do not guarantee that an old copy has the latest fixes.

## Report a vulnerability privately

**Please do not open a public issue for a security vulnerability.**

1. If GitHub private vulnerability reporting is available, go to the repository's **Security** tab and select **Report a vulnerability**.
2. Otherwise, email **contact@luizbizzio.com** with the subject **ScanDeck security report**.

Please include the affected URL or version, your browser and operating system, steps to reproduce the issue, its possible impact, and a small proof of concept when safe. Do not send passwords, private keys, or real user data.

Reports will be reviewed, but no fixed response or repair time is promised. Please allow time for a fix before sharing the details publicly.

## What to report

Examples include cross-site scripting, a way to escape the game iframe sandbox, unsafe handling of a scanned image or code, unexpected data access, and security problems in the bundled readers or workers.

For normal bugs, camera compatibility, and feature requests, use [GitHub Issues](https://github.com/luizbizzio/scandeck/issues).

## Safe testing

Test only with accounts, devices, and data you control. Avoid traffic floods, service disruption, or access to someone else's information.

Scanned games may contain executable code. Use only game codes you trust. Browser sandboxing and local decoding reduce risk but do not make unknown code fully safe.

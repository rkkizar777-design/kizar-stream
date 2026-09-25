# KIZAR Stream - User Edition

Chrome (Manifest V3) extension for streaming Netflix and Prime Video using live
session pools, with activation tiers, swap requests, a loyalty ladder and a
built-in cookie checker.

## Install

1. Download the release zip from the [releases page](https://github.com/rkkizar777-design/kizar-stream-user/releases).
2. Extract it.
3. Open `chrome://extensions`, turn on **Developer mode**.
4. **Load unpacked** and pick the extracted folder (the one holding `manifest.json`).
5. Pin the extension, then sign in with your activation key.

## Layout

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest, version, permissions |
| `popup.html` | Popup markup |
| `popup.css` | Popup styling |
| `popup.js` | All behaviour: sign-in, tiers, swap, check-in, loyalty, fingerprint |
| `preview.html` | Standalone preview page |

There is no build step. Edit, then hit the reload arrow on the extension card.

## Notes

- Not affiliated with Netflix, Amazon or Prime Video.
- You are responsible for the accounts you use and for each service's terms.

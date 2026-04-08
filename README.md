# desktop-test-app-electron

Electron companion to [trycua/desktop-test-app](https://github.com/trycua/desktop-test-app) for `cua-sandbox` MITM proxy integration tests.

## Usage

```bash
npm install
# Default (loads https://example.com)
npx electron .

# Custom URL
CUA_LOAD_URL=https://example.com npx electron .
```

## HTTP API

Same contract as the Tauri app — port **6769**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | 200 OK |
| GET | `/events` | All logged events |
| POST | `/reset` | Clear events |
| GET | `/clipboard` | Clipboard text |
| GET | `/window-title` | Current window title |
| GET | `/screen-size` | `{width, height}` |

## Security posture

Simulates a typical closed-source Electron app:
- `nodeIntegration: false`, `contextIsolation: true`, `webSecurity: true`
- No `--ignore-certificate-errors`
- Respects system CA store via `--use-system-default-ca` (Linux)

For MITM tests install the proxy CA with `update-ca-certificates` and launch:

```bash
electron --use-system-default-ca .
```

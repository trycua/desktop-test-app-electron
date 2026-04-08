/**
 * desktop-test-app-electron — Electron companion to trycua/desktop-test-app.
 *
 * Loads an arbitrary URL (CUA_LOAD_URL env var) or https://example.com by
 * default. Exposes the same HTTP test API on port 6769 as the Tauri app so
 * the cua-sandbox pytest suite can use both apps interchangeably.
 *
 * Security posture (simulates average closed-source Electron app):
 * - nodeIntegration: false  (renderer is sandboxed)
 * - contextIsolation: true
 * - webSecurity: true       (honour HTTPS cert validation)
 * - No --ignore-certificate-errors flag
 * - Respects the system CA store via --use-system-default-ca (Linux)
 *   and NODE_EXTRA_CA_CERTS (cross-platform, Node.js TLS only)
 *
 * For MITM proxy tests, install the proxy CA into the system trust store
 * (update-ca-certificates on Linux) and launch Electron with
 * --use-system-default-ca so the renderer honours it.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const express = require('express');
const http = require('http');

// ── State (mirrors Tauri app's AppState) ────────────────────────────────────

const state = {
  events: [],
  clipboard: '',
  windowTitle: '',
  screenWidth: 0,
  screenHeight: 0,
};

// ── HTTP API (port 6769, same contract as Tauri app) ─────────────────────────

function startApiServer() {
  const api = express();
  api.use(express.json());

  api.get('/health', (_req, res) => res.sendStatus(200));

  api.get('/events', (_req, res) => res.json(state.events));

  api.post('/reset', (_req, res) => {
    const cleared = state.events.length;
    state.events = [];
    res.json({ cleared });
  });

  api.get('/clipboard', (_req, res) => res.json({ text: state.clipboard }));

  api.get('/window-title', (_req, res) => res.json({ title: state.windowTitle }));

  api.get('/screen-size', (_req, res) =>
    res.json({ width: state.screenWidth, height: state.screenHeight })
  );

  const server = http.createServer(api);
  server.listen(6769, '127.0.0.1', () => {
    // Signal ready — tests poll this (same format as Tauri app)
    console.log('APP_HTTP_PORT=6769');
  });
}

// ── IPC from renderer ────────────────────────────────────────────────────────

ipcMain.on('log-event', (_event, { type, details }) => {
  state.events.push({ type, details, timestamp: Date.now() });
});

ipcMain.on('set-screen-size', (_event, { width, height, title }) => {
  state.screenWidth = width;
  state.screenHeight = height;
  state.windowTitle = title;
});

// ── Main window ──────────────────────────────────────────────────────────────

function createWindow() {
  const targetUrl = process.env.CUA_LOAD_URL || 'https://example.com';

  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Desktop Test App (Electron)',
    webPreferences: {
      // Realistic closed-source Electron app security defaults:
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,        // enforce HTTPS cert validation
      sandbox: true,
      // preload would go here for apps that need IPC — omitted for purity
    },
  });

  win.on('page-title-updated', (_e, title) => {
    state.windowTitle = title;
  });

  win.webContents.on('did-finish-load', () => {
    const { width, height } = win.getBounds();
    state.screenWidth = width;
    state.screenHeight = height;
    state.windowTitle = win.getTitle();
  });

  win.loadURL(targetUrl);
}

app.whenReady().then(() => {
  startApiServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

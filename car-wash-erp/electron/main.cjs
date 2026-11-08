const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

// Keep the original WashDesk user-data folder so Windows updates retain local records.
app.setPath('userData', path.join(app.getPath('appData'), 'WashDesk'));

let mainWindow = null;
let pendingAuthUrl = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

function dispatchAuthUrl(url) {
  if (!url || !String(url).startsWith('primeautocare://')) return;
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingAuthUrl = url;
    return;
  }
  const dispatch = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.executeJavaScript(
      'window.dispatchEvent(new CustomEvent("prime-auto-native-auth-url", { detail: { url: ' + JSON.stringify(url) + ' } }));'
    ).catch(error => console.error('Could not return from Prime Auto Care sign-in link:', error));
  };
  if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', dispatch);
  else dispatch();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 680,
    title: 'Prime Auto Care — Business Manager',
    backgroundColor: '#111111',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingAuthUrl) {
      const url = pendingAuthUrl;
      pendingAuthUrl = null;
      dispatchAuthUrl(url);
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  Menu.setApplicationMenu(null);
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const authUrl = argv.find(arg => String(arg).startsWith('primeautocare://'));
    if (authUrl) dispatchAuthUrl(authUrl);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    dispatchAuthUrl(url);
  });

  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient('primeautocare');
    const initialAuthUrl = process.argv.find(arg => String(arg).startsWith('primeautocare://'));
    if (initialAuthUrl) pendingAuthUrl = initialAuthUrl;
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}

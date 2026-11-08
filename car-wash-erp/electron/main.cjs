const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

// Keep the existing WashDesk data folder so the Prime Auto Care Windows
// build retains records and the same local session between app updates.
app.setPath('userData', path.join(app.getPath('appData'), 'WashDesk'));

let mainWindow = null;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    title: 'Prime Auto Care — Business Manager',
    backgroundColor: '#111111',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
  Menu.setApplicationMenu(null);
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

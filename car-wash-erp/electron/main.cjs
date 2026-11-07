const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
// Keep the original WashDesk user-data folder so an in-place Windows update
// continues to read the existing local browser database.
app.setPath('userData', path.join(app.getPath('appData'), 'WashDesk'));
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 680,
    title: 'Prime Auto Care — Business Manager',
    backgroundColor: '#111111',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  Menu.setApplicationMenu(null);
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

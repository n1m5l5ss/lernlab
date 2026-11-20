// The only bridge between the window and the app. It exposes one object, `window.lernlab`,
// and nothing from Node or Electron. Types: src/bridge.ts.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lernlab', {
  invoke: (channel: string, input?: unknown) => ipcRenderer.invoke('lernlab:invoke', channel, input),
  updates: {
    /** The downloaded update waiting for a restart, or null. */
    status: () => ipcRenderer.invoke('lernlab:update-status'),
    /** Back up, then restart into the new version. */
    install: () => ipcRenderer.invoke('lernlab:update-install'),
    onReady: (cb: (u: { version: string }) => void) => {
      ipcRenderer.on('lernlab:update-ready', (_e, u) => cb(u));
    },
  },
});

// The only bridge between the window and the app. It exposes one object, `window.lernlab`,
// and nothing from Node or Electron. Types: src/bridge.ts.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lernlab', {
  invoke: (channel: string, input?: unknown) => ipcRenderer.invoke('lernlab:invoke', channel, input),
  /** The data process: 'ok', 'reconnecting' while it restarts after a crash, or 'failed' (src/DataStatus.tsx). */
  data: {
    status: () => ipcRenderer.invoke('lernlab:data-status'),
    onStatus: (cb: (status: string) => void) => {
      ipcRenderer.on('lernlab:data-status', (_e, status) => cb(status));
    },
  },
  updates: {
    /** The downloaded update waiting for a restart, or null. */
    status: () => ipcRenderer.invoke('lernlab:update-status'),
    /** Back up, then restart into the new version. */
    install: () => ipcRenderer.invoke('lernlab:update-install'),
    onReady: (cb: (u: { version: string; notes: { added: string[]; fixed: string[] } }) => void) => {
      ipcRenderer.on('lernlab:update-ready', (_e, u) => cb(u));
    },
  },
});

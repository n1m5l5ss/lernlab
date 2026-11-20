// The only bridge between the window and the app. It exposes one object, `window.lernlab`,
// and nothing from Node or Electron. Types: src/bridge.ts.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lernlab', {
  invoke: (channel: string, input?: unknown) => ipcRenderer.invoke('lernlab:invoke', channel, input),
});

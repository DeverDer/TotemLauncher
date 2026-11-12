const { contextBridge, ipcRenderer: ipc } = require('electron');
contextBridge.exposeInMainWorld('inst', {
  init: () => ipc.invoke('i:init'), setRepo: (r) => ipc.invoke('i:setRepo', r), browse: (d) => ipc.invoke('i:browse', d), pick: (d) => ipc.invoke('i:pick', d),
  start: (o) => ipc.invoke('i:start', o), cancel: () => ipc.send('i:cancel'), finish: (launch) => ipc.send('i:finish', !!launch), close: () => ipc.send('i:close'),
  onProgress: (cb) => ipc.on('i:progress', (_e, p) => cb(p)),
});

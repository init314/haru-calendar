const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('haru', Object.fromEntries(['load','sync','toggle','create','deleteLocal','openEvent'].map(name => [name, args => ipcRenderer.invoke(name,args)])));

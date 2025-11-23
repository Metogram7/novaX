const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("novaAPI", {
    searchWeb: (query) => ipcRenderer.invoke("search-web", query),
    searchImages: (query) => ipcRenderer.invoke("search-images", query)
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    setWaterReminder: (intervalMinutes) => ipcRenderer.invoke('set-water-reminder', intervalMinutes),
    stopWaterReminder: () => ipcRenderer.invoke('stop-water-reminder'),
    testReminder: () => ipcRenderer.invoke('test-reminder'),
    getReminderStatus: () => ipcRenderer.invoke('get-reminder-status'),
    getReminderHistory: () => ipcRenderer.invoke('get-reminder-history'),
    onReminderHistoryUpdated: (callback) => ipcRenderer.on('reminder-history-updated', callback)
});
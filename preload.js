// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    setWaterReminder: (intervalMinutes, notificationMode) => ipcRenderer.invoke('set-water-reminder', intervalMinutes, notificationMode),
    stopWaterReminder: () => ipcRenderer.invoke('stop-water-reminder'),
    testReminder: (notificationMode) => ipcRenderer.invoke('test-reminder', notificationMode),
    getReminderStatus: () => ipcRenderer.invoke('get-reminder-status'),
    getReminderHistory: () => ipcRenderer.invoke('get-reminder-history'),
    getNotificationMode: () => ipcRenderer.invoke('get-notification-mode'),
    onReminderHistoryUpdated: (callback) => ipcRenderer.on('reminder-history-updated', callback),
    closeReminderPopup: () => ipcRenderer.send('close-reminder-popup'),
    getCurrentInterval: () => ipcRenderer.invoke('get-current-interval')
});
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
    setWaterReminder: (intervalMinutes, notificationMode) => ipcRenderer.invoke('set-water-reminder', intervalMinutes, notificationMode),
    stopWaterReminder: () => ipcRenderer.invoke('stop-water-reminder'),
    testReminder: (notificationMode) => ipcRenderer.invoke('test-reminder', notificationMode),
    getReminderStatus: () => ipcRenderer.invoke('get-reminder-status'),
    getNotificationMode: () => ipcRenderer.invoke('get-notification-mode'),
    closeReminderPopup: () => ipcRenderer.send('close-reminder-popup'),
    getCurrentInterval: () => ipcRenderer.invoke('get-current-interval'),
    setCustomMessage: (message) => ipcRenderer.invoke('set-custom-message', message),
    getCustomMessage: () => ipcRenderer.invoke('get-custom-message'),
    onReminderTriggered: (callback) => ipcRenderer.on('reminder-triggered', callback)
});
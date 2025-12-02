// main.js (部分更新)
const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, screen } = require('electron')
const path = require('node:path')
const notifier = require('node-notifier')
app.setName('喝水提醒')
let mainWindow = null;
let waterReminderTimer = null;
let tray = null;
let isReminding = false;
let reminderHistory = []; // 存储提醒历史
let reminderPopupWindow = null; // 新增：提醒弹窗窗口
let currentNotificationMode = 'custom'; // 默认使用自定义弹窗
let currentReminderInterval = 0;
app.isQuiting = false;

// 提示语数组
const messages = [
  "💧 该喝水啦！保持水分很重要哦~",
  "🚰 喝水时间到！休息一下，喝杯水吧",
  "🌊 身体需要水分了，来喝杯水！",
  "💦 长时间工作别忘了补水，现在喝点水吧",
  "🥤 叮咚！您的喝水提醒已送达"
];

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  mainWindow.loadFile('index.html')
  
  // 监听窗口关闭事件，根据不同平台处理
  mainWindow.on('close', function (event) {
    if (process.platform === 'darwin') {
      // macOS: 点击红叉只隐藏窗口
      if (!app.isQuiting) {
        event.preventDefault();
        mainWindow.hide();
      }
    } else {
      // Windows/Linux: 点击关闭按钮隐藏窗口而不是退出
      if (!app.isQuiting) {
        event.preventDefault();
        mainWindow.hide();
      }
    }
  });
}

// 创建系统托盘
const createTray = () => {
  try {
    // 先检查图标文件是否存在
    const iconPath = path.join(__dirname, 'build', 'icon.png');
    tray = new Tray(iconPath);
  } catch (error) {
    console.log('无法加载图标文件，使用默认托盘图标');
    tray = new Tray(); // 使用默认图标
  }
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: '关闭所有提醒窗口',
      click: () => {
        closeAllReminderPopups();
      }
    },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('喝水提醒');
  
  tray.on('click', () => {
    mainWindow.show();
  });
};

// 创建提醒弹窗窗口
const createReminderPopup = (message) => {
  // 如果已经存在提醒窗口，先关闭它
  if (reminderPopupWindow) {
    reminderPopupWindow.destroy();
  }
  
  // 获取主屏幕尺寸
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  // 创建弹窗窗口
  reminderPopupWindow = new BrowserWindow({
    width: 340,
    height: 210,  // 增加高度以容纳"我知道了"按钮
    x: width - 360, // 距离右边20px
    y: 20, // 距离顶部20px
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      contextIsolation: false,  // 允许在渲染进程中使用Node.js API
      nodeIntegration: true     // 启用Node.js集成
    }
  });
  
  // 加载弹窗页面，并传递消息和时间参数
  const currentTime = new Date().toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
  reminderPopupWindow.loadFile('reminder-popup.html', {
    query: {
      message: message,
      time: currentTime
    }
  });
  
  // 禁止弹窗获得焦点
  reminderPopupWindow.on('focus', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.focus();
    }
  });
};

// 关闭所有提醒弹窗
const closeAllReminderPopups = () => {
  if (reminderPopupWindow) {
    reminderPopupWindow.destroy();
    reminderPopupWindow = null;
  }
};

// 发送系统通知
const sendSystemNotification = (message) => {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  
  if (Notification.isSupported()) {
    const electronNotification = new Notification({
      title: '该喝水啦',
      body: message,
      icon: iconPath,
      silent: false
    });
    
    // 可以监听通知点击事件
    electronNotification.on('click', () => {
      console.log('用户点击了 Electron 通知');
      if (mainWindow) {
        mainWindow.show();
      }
    });
    
    electronNotification.show();
  } else {
    console.log('当前系统不支持 Electron 原生通知');
  }
};

// 发送自定义弹窗通知
const sendCustomPopup = (message) => {
  createReminderPopup(message);
};

// 根据模式发送通知
const sendNotificationByMode = (message, mode) => {
  switch(mode) {
    case 'system':
      sendSystemNotification(message);
      break;
    case 'custom':
    default:
      sendCustomPopup(message);
      break;
  }
};

// 添加提醒历史记录
const addReminderToHistory = (message) => {
  const now = new Date();
  const historyItem = {
    time: now.toLocaleString('zh-CN'),
    timestamp: now.getTime(),
    message: message
  };
  
  reminderHistory.unshift(historyItem);
  
  // 只保留最近10条记录
  if (reminderHistory.length > 10) {
    reminderHistory = reminderHistory.slice(0, 10);
  }
  
  // 如果主窗口打开，发送更新后的历史记录
  if (mainWindow) {
    mainWindow.webContents.send('reminder-history-updated', reminderHistory);
  }
};

// 设置喝水提醒定时器
const setWaterReminder = (intervalMinutes, notificationMode) => {
   // 保存当前提醒间隔
   currentReminderInterval = intervalMinutes;
  // 保存当前通知模式
  currentNotificationMode = notificationMode || 'custom';
  
  // 清除之前的定时器
  if (waterReminderTimer) {
    clearInterval(waterReminderTimer);
  }
  
  // 设置新的定时器
  const intervalMs = intervalMinutes * 60 * 1000;
  waterReminderTimer = setInterval(() => {
    if (mainWindow) {
      // 随机选择一条提示语
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      // 根据模式发送通知
      sendNotificationByMode(randomMessage, currentNotificationMode);
      // 添加到历史记录
      addReminderToHistory(randomMessage);
    }
  }, intervalMs);
  
  isReminding = true;
  return `已设置每${intervalMinutes}分钟提醒一次喝水（${notificationMode === 'system' ? '系统弹窗' : '自定义弹窗'}）`;
};
// 添加一个新的 IPC 处理程序来获取当前提醒间隔
const getCurrentReminderInterval = () => {
  return currentReminderInterval;
};
// 停止提醒
const stopWaterReminder = () => {
  if (waterReminderTimer) {
    clearInterval(waterReminderTimer);
    waterReminderTimer = null;
  }
  isReminding = false;
  // 停止提醒时也关闭所有弹窗
  closeAllReminderPopups();
  return '已停止喝水提醒';
};

// 测试提醒功能
const testReminder = (notificationMode) => {
  if (mainWindow) {
    // 发送测试通知
    const testMessage = "🧪 这是一个测试提醒！";
    const mode = notificationMode || currentNotificationMode || 'custom';
    sendNotificationByMode(testMessage, mode);
    addReminderToHistory(testMessage);
    return `测试提醒已发送（${mode === 'system' ? '系统弹窗' : '自定义弹窗'}）`;
  }
  return '无法发送测试提醒';
};

// 检查提醒状态
const getReminderStatus = () => {
  return {
    isActive: isReminding,
    timerExists: !!waterReminderTimer
  };
};

// 获取提醒历史
const getReminderHistory = () => {
  return reminderHistory;
};

// 获取通知模式
const getNotificationMode = () => {
  return currentNotificationMode;
};

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong')
  ipcMain.handle('set-water-reminder', (event, intervalMinutes, notificationMode) => {
    return setWaterReminder(intervalMinutes, notificationMode);
  });
  ipcMain.handle('stop-water-reminder', () => {
    return stopWaterReminder();
  });
  ipcMain.handle('test-reminder', (event, notificationMode) => {
    return testReminder(notificationMode);
  });
  ipcMain.handle('get-reminder-status', () => {
    return getReminderStatus();
  });
  ipcMain.handle('get-reminder-history', () => {
    return getReminderHistory();
  });
  ipcMain.handle('get-notification-mode', () => {
    return getNotificationMode();
  });
  ipcMain.handle('get-current-interval', () => {
    return getCurrentReminderInterval();
  });
  
  // 监听关闭提醒弹窗的请求
  ipcMain.on('close-reminder-popup', () => {
    closeAllReminderPopups();
  });
  
  createWindow()
  
  // 添加错误处理
  try {
    createTray()
  } catch (error) {
    console.error('创建系统托盘失败:', error)
  }
})

// 应用退出时清除定时器
app.on('before-quit', () => {
  if (waterReminderTimer) {
    clearInterval(waterReminderTimer);
  }
});

// 处理所有窗口关闭的情况
app.on('window-all-closed', () => {
  // 在 macOS 上，即使所有窗口都关闭了，我们也希望应用继续运行在托盘中
  if (process.platform !== 'darwin') {
    // Windows/Linux 上退出应用
    app.quit();
  }
  // macOS 上不退出应用，保持在 dock 中
});

// macOS 特有的激活事件处理
app.on('activate', () => {
  // 在 macOS 上，点击 dock 图标时重新创建窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
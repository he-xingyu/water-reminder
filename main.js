const { app, BrowserWindow, ipcMain, Tray, Menu, Notification } = require('electron')
const path = require('node:path')
const notifier = require('node-notifier')
app.setName('喝水提醒')
let mainWindow = null;
let waterReminderTimer = null;
let tray = null;
let isReminding = false;
let reminderHistory = []; // 存储提醒历史
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
    height: 600,
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

// 发送双重通知（SnoreToast + Electron Notification）
const sendDualNotification = (message) => {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  
  // 使用 SnoreToast 发送通知
  // notifier.notify(
  //   {
  //     title: '该喝水啦',
  //     message: message,
  //     icon: iconPath,
  //     sound: true,
  //     wait: true,
  //     timeout: false
  //   },
  //   (err, response) => {
  //     if (err) {
  //       console.error('SnoreToast 通知发送失败:', err);
  //     }
  //   }
  // );
  
  // 同时使用 Electron 原生 Notification
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
  
  // 如果托盘支持气泡提示，也显示
  // if (tray && tray.displayBalloon) {
  //   tray.displayBalloon({
  //     icon: iconPath,
  //     title: '该喝水啦',
  //     content: message
  //   });
  // }
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
const setWaterReminder = (intervalMinutes) => {
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
      // 发送双重通知
      sendDualNotification(randomMessage);
      // 添加到历史记录
      addReminderToHistory(randomMessage);
    }
  }, intervalMs);
  
  isReminding = true;
  return `已设置每${intervalMinutes}分钟提醒一次喝水`;
};

// 停止提醒
const stopWaterReminder = () => {
  if (waterReminderTimer) {
    clearInterval(waterReminderTimer);
    waterReminderTimer = null;
  }
  isReminding = false;
  return '已停止喝水提醒';
};

// 测试提醒功能
const testReminder = () => {
  if (mainWindow) {
    // 发送测试通知
    const testMessage = "🧪 这是一个测试提醒！";
    sendDualNotification(testMessage);
    addReminderToHistory(testMessage);
    return '测试提醒已发送';
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

app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong')
  ipcMain.handle('set-water-reminder', (event, intervalMinutes) => {
    return setWaterReminder(intervalMinutes);
  });
  ipcMain.handle('stop-water-reminder', () => {
    return stopWaterReminder();
  });
  ipcMain.handle('test-reminder', () => {
    return testReminder();
  });
  ipcMain.handle('get-reminder-status', () => {
    return getReminderStatus();
  });
  ipcMain.handle('get-reminder-history', () => {
    return getReminderHistory();
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
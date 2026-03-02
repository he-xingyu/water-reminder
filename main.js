// main.js
const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  Notification,
  screen,
} = require("electron");
const path = require("node:path");
app.setName("太干了");
let mainWindow = null;
let waterReminderTimer = null;
let tray = null;
let isReminding = false;
let reminderPopupWindow = null;
let currentNotificationMode = "custom";
let currentReminderInterval = 0;
let customMessage = "";

// 提示语数组
const messages = [
  "💧 该喝水啦！保持水分很重要哦~",
  "🚰 喝水时间到！休息一下，喝杯水吧",
  "🌊 身体需要水分了，来喝杯水！",
  "💦 长时间工作别忘了补水，现在喝点水吧",
  "🥤 叮咚！您的喝水提醒已送达",
];

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadFile("index.html");

  mainWindow.on("close", function (event) {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
};
// 辅助函数：查找托盘图标路径（打包后必须用真实文件系统路径，不能用 asar 内路径）
const findTrayIconPath = () => {
  const iconNames = [
    process.platform === 'win32' ? 'icon.ico' : 'icon.png',
    'tray-icon.png',
    'app-icon.png'
  ];

  // 打包后 process.resourcesPath 指向 resources 目录，extraResources 的 assets 在此，Tray 需要真实路径不能读 asar
  const possibleDirs = app.isPackaged
    ? [
        path.join(process.resourcesPath, "assets"),
        path.join(__dirname, "assets"),
        path.join(__dirname, "resources", "assets"),
        __dirname,
      ]
    : [
        path.join(__dirname, "assets"),
        path.join(process.resourcesPath, "assets"),
        path.join(__dirname, "resources", "assets"),
        __dirname,
      ];

  for (const dir of possibleDirs) {
    for (const iconName of iconNames) {
      const iconPath = path.join(dir, iconName);
      if (require("fs").existsSync(iconPath)) {
        return iconPath;
      }
    }
  }

  return null;
};
// 创建系统托盘
const createTray = () => {
  const iconPath = findTrayIconPath();

  try {
    if (iconPath) {
      tray = new Tray(iconPath);
      console.log("成功加载托盘图标:", iconPath);
    } else {
      // Windows 上 Tray 必须要有图标路径，无参数 new Tray() 会抛错
      console.warn("未找到托盘图标，跳过创建托盘。请确保 assets/icon.ico（Windows）或 assets/icon.png 存在。");
      return;
    }
  } catch (error) {
    console.error("创建托盘图标出错:", error);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主界面",
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: "关闭所有提醒窗口",
      click: () => {
        closeAllReminderPopups();
      },
    },
    {
      label: "退出",
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip("喝水提醒");

  tray.on("click", () => {
    mainWindow.show();
  });
};

// 创建提醒弹窗窗口
const createReminderPopup = (message) => {
  if (reminderPopupWindow) {
    reminderPopupWindow.destroy();
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  reminderPopupWindow = new BrowserWindow({
    width: 340,
    height: 210,
    x: width - 360,
    y: 20,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  const currentTime = new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  reminderPopupWindow.loadFile("reminder-popup.html", {
    query: {
      message: message,
      time: currentTime,
    },
  });

  reminderPopupWindow.on("focus", () => {
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
  const iconPath = path.join(__dirname, "assets", "icon.png");

  if (Notification.isSupported()) {
    const electronNotification = new Notification({
      title: "该喝水啦",
      body: message,
      icon: iconPath,
      silent: false,
    });

    electronNotification.on("click", () => {
      console.log("用户点击了 Electron 通知");
      if (mainWindow) {
        mainWindow.show();
      }
    });

    electronNotification.show();
  } else {
    console.log("当前系统不支持 Electron 原生通知");
  }
};

// 发送自定义弹窗通知
const sendCustomPopup = (message) => {
  createReminderPopup(message);
};

// 根据模式发送通知
const sendNotificationByMode = (message, mode) => {
  switch (mode) {
    case "system":
      sendSystemNotification(message);
      break;
    case "custom":
    default:
      sendCustomPopup(message);
      break;
  }
};

// 设置喝水提醒定时器
const setWaterReminder = (intervalMinutes, notificationMode) => {
  currentReminderInterval = intervalMinutes;
  currentNotificationMode = notificationMode || "custom";

  if (waterReminderTimer) {
    clearInterval(waterReminderTimer);
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  waterReminderTimer = setInterval(() => {
    if (mainWindow) {
      const messageToSend =
        customMessage || messages[Math.floor(Math.random() * messages.length)];
      sendNotificationByMode(messageToSend, currentNotificationMode);

      if (mainWindow) {
        mainWindow.webContents.send("reminder-triggered", intervalMs);
      }
    }
  }, intervalMs);

  isReminding = true;
  return `已设置每${intervalMinutes}分钟提醒一次喝水（${
    notificationMode === "system" ? "系统弹窗" : "自定义弹窗"
  }）`;
};

// 添加设置自定义文本的函数
const setCustomMessage = (message) => {
  if (message === "重置提示文本") {
    customMessage = "";
    return "已重置为默认提醒文本";
  } else {
    customMessage = message;
    return `已设置自定义提醒文本: ${message}`;
  }
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
  closeAllReminderPopups();
  return "已停止喝水提醒";
};

// 测试提醒功能
const testReminder = (notificationMode) => {
  if (mainWindow) {
    const testMessage = "🧪 这是一个测试提醒！";
    const mode = notificationMode || currentNotificationMode || "custom";
    sendNotificationByMode(testMessage, mode);
    return `测试提醒已发送（${mode === "system" ? "系统弹窗" : "自定义弹窗"}）`;
  }
  return "无法发送测试提醒";
};

// 检查提醒状态
const getReminderStatus = () => {
  return {
    isActive: isReminding,
    timerExists: !!waterReminderTimer,
  };
};

// 获取通知模式
const getNotificationMode = () => {
  return currentNotificationMode;
};

app.whenReady().then(() => {
  ipcMain.handle("ping", () => "pong");
  ipcMain.handle(
    "set-water-reminder",
    (event, intervalMinutes, notificationMode) => {
      return setWaterReminder(intervalMinutes, notificationMode);
    }
  );
  ipcMain.handle("stop-water-reminder", () => {
    return stopWaterReminder();
  });
  ipcMain.handle("test-reminder", (event, notificationMode) => {
    return testReminder(notificationMode);
  });
  ipcMain.handle("get-reminder-status", () => {
    return getReminderStatus();
  });
  ipcMain.handle("get-notification-mode", () => {
    return getNotificationMode();
  });
  ipcMain.handle("get-current-interval", () => {
    return getCurrentReminderInterval();
  });

  ipcMain.on("close-reminder-popup", () => {
    closeAllReminderPopups();
  });

  ipcMain.handle("set-custom-message", (event, message) => {
    return setCustomMessage(message);
  });

  const getCustomMessage = () => {
    return customMessage;
  };

  ipcMain.handle("get-custom-message", () => {
    return getCustomMessage();
  });

  createWindow();

  try {
    createTray();
  } catch (error) {
    console.error("创建系统托盘失败:", error);
  }
});

// 应用退出时清除定时器
app.on("before-quit", () => {
  if (waterReminderTimer) {
    clearInterval(waterReminderTimer);
  }
});

// 处理所有窗口关闭的情况
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS 特有的激活事件处理
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// renderer.js
// 获取DOM元素
const intervalInput = document.getElementById("interval");
const setReminderBtn = document.getElementById("setReminder");
const stopReminderBtn = document.getElementById("stopReminder");
const testReminderBtn = document.getElementById("testReminder");
const statusDiv = document.getElementById("status");
let nextReminderInterval = null;
let nextReminderTime = null;

// 页面加载完成后获取当前状态和历史记录
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const status = await window.electronAPI.getReminderStatus();
    updateStatus(status);
  } catch (error) {
    console.error("获取状态失败:", error);
  }

  try {
    const savedMode = await window.electronAPI.getNotificationMode();
    const modeElement = document.querySelector(
      `input[name="notificationMode"][value="${savedMode}"]`
    );
    if (modeElement) {
      modeElement.checked = true;
    }
  } catch (error) {
    console.error("获取通知模式失败:", error);
  }
});

// 监听提醒触发事件
window.electronAPI.onReminderTriggered((event, intervalMs) => {
  nextReminderTime = Date.now() + intervalMs;
  
  if (nextReminderInterval) {
    clearInterval(nextReminderInterval);
  }
  nextReminderInterval = setInterval(updateNextReminderDisplay, 1000);
  
  updateNextReminderDisplay();
});

// 设置提醒按钮事件
setReminderBtn.addEventListener("click", async () => {
  const inputValue = intervalInput.value.trim();
  const notificationMode = getSelectedNotificationMode();

  if (inputValue.startsWith("text:")) {
    const customText = inputValue.substring(5);
    if (customText) {
      try {
        const result = await window.electronAPI.setCustomMessage(customText);
        showStatus(result, "success");
      } catch (error) {
        showStatus("设置自定义文本失败: " + error.message, "error");
      }
      return;
    }
  }

  const interval = parseInt(inputValue);

  if (isNaN(interval) || interval <= 0) {
    showStatus("请输入有效的分钟数", "error");
    return;
  }

  try {
    const result = await window.electronAPI.setWaterReminder(
      interval,
      notificationMode
    );
    showStatus(result, "success");

    nextReminderTime = Date.now() + interval * 60000;
    updateStatus({ isActive: true });
    
    if (nextReminderInterval) {
      clearInterval(nextReminderInterval);
    }
    nextReminderInterval = setInterval(updateNextReminderDisplay, 1000);
  } catch (error) {
    showStatus("设置失败: " + error.message, "error");
  }
});

// 停止提醒按钮事件
stopReminderBtn.addEventListener("click", async () => {
  try {
    const result = await window.electronAPI.stopWaterReminder();
    showStatus(result, "info");
    nextReminderTime = null;
    updateStatus({ isActive: false });
  } catch (error) {
    showStatus("停止失败: " + error.message, "error");
  }
});

// 测试提醒按钮事件
testReminderBtn.addEventListener("click", async () => {
  const notificationMode = getSelectedNotificationMode();

  try {
    const result = await window.electronAPI.testReminder(notificationMode);
    showStatus(result, "info");
  } catch (error) {
    showStatus("测试失败: " + error.message, "error");
  }
});

// 显示状态信息
function showStatus(message, type) {
  const statusContent = document.querySelector(".status-content");

  const existingMessage = statusContent.querySelector(".status-message");
  if (existingMessage) {
    existingMessage.remove();
  }

  const messageElement = document.createElement("div");
  messageElement.className = `status-message ${type}`;
  messageElement.textContent = message;

  statusContent.appendChild(messageElement);

  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.remove();
    }
  }, 3000);
}

// 更新状态指示器
function updateStatus(status) {
  const indicator = document.querySelector(".status-indicator");
  const statusText = document.getElementById("statusText");
  const nextReminderElement = document.getElementById("nextReminder");

  if (status.isActive) {
    indicator.className = "status-indicator status-active";
    statusText.textContent = "当前状态: 运行中";

    if (nextReminderTime) {
      nextReminderElement.style.display = "flex";
      updateNextReminderDisplay();

      if (nextReminderInterval) {
        clearInterval(nextReminderInterval);
      }
      nextReminderInterval = setInterval(updateNextReminderDisplay, 1000);
    }
  } else {
    indicator.className = "status-indicator status-inactive";
    statusText.textContent = "当前状态: 已暂停";
    nextReminderElement.style.display = "none";

    if (nextReminderInterval) {
      clearInterval(nextReminderInterval);
      nextReminderInterval = null;
    }
    nextReminderTime = null;
  }
}

function updateNextReminderDisplay() {
  const nextReminderElement = document.getElementById("nextReminder");
  const nextReminderText = document.getElementById("nextReminderText");

  if (!nextReminderTime) {
    nextReminderElement.style.display = "none";
    return;
  }

  const now = Date.now();
  const timeDiff = nextReminderTime - now;
  
  if (timeDiff <= 0) {
    nextReminderText.textContent = `距离下次提醒：即将提醒`;
    nextReminderElement.style.display = "flex";
    return;
  }
  
  const minutesLeft = Math.floor(timeDiff / 60000);
  const secondsLeft = Math.floor((timeDiff % 60000) / 1000);

  if (minutesLeft > 0) {
    nextReminderText.textContent = `距离下次提醒：${minutesLeft}分钟`;
  } else if (secondsLeft > 0) {
    nextReminderText.textContent = `距离下次提醒：${secondsLeft}秒`;
  } else {
    nextReminderText.textContent = `距离下次提醒：即将提醒`;
  }
  
  nextReminderElement.style.display = "flex";
}

// 获取选中的通知模式
function getSelectedNotificationMode() {
  const selectedElement = document.querySelector(
    'input[name="notificationMode"]:checked'
  );
  return selectedElement ? selectedElement.value : "custom";
}
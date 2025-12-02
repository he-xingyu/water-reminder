// renderer.js
// 获取DOM元素
const intervalInput = document.getElementById("interval");
const setReminderBtn = document.getElementById("setReminder");
const stopReminderBtn = document.getElementById("stopReminder");
const testReminderBtn = document.getElementById("testReminder");
const statusDiv = document.getElementById("status");
const historyList = document.getElementById("historyList");
let nextReminderInterval = null;
let nextReminderTime = null;

// 页面加载完成后获取当前状态和历史记录
document.addEventListener("DOMContentLoaded", async () => {
  // 获取初始状态
  try {
    const status = await window.electronAPI.getReminderStatus();
    updateStatus(status);
  } catch (error) {
    console.error("获取状态失败:", error);
  }

  // 获取历史记录
  try {
    const history = await window.electronAPI.getReminderHistory();
    updateHistoryDisplay(history);
  } catch (error) {
    console.error("获取历史记录失败:", error);
  }

  // 获取保存的通知模式设置
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

// 设置提醒按钮事件
setReminderBtn.addEventListener("click", async () => {
  const interval = parseInt(intervalInput.value);
  const notificationMode = getSelectedNotificationMode();

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

    // 设置下次提醒时间
    nextReminderTime = Date.now() + interval * 60000;
    updateStatus({ isActive: true });
  } catch (error) {
    showStatus("设置失败: " + error.message, "error");
  }
});

// 停止提醒按钮事件
stopReminderBtn.addEventListener("click", async () => {
  try {
    const result = await window.electronAPI.stopWaterReminder();
    showStatus(result, "info");
    nextReminderTime = null; // 清除下次提醒时间
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

// 监听历史记录更新
window.electronAPI.onReminderHistoryUpdated((event, history) => {
  updateHistoryDisplay(history);
});

// 显示状态信息
function showStatus(message, type) {
  const statusContent = document.querySelector('.status-content');
  
  // 移除之前的消息元素（如果有）
  const existingMessage = statusContent.querySelector('.status-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // 创建新的消息元素
  const messageElement = document.createElement('div');
  messageElement.className = `status-message ${type}`;
  messageElement.textContent = message;
  
  // 将消息添加到状态内容区域的末尾
  statusContent.appendChild(messageElement);
  
  // 3秒后自动清除消息
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

    // 如果有设置提醒时间，显示倒计时
    if (nextReminderTime) {
      nextReminderElement.style.display = "block";
      updateNextReminderDisplay();

      // 启动倒计时更新定时器
      if (nextReminderInterval) {
        clearInterval(nextReminderInterval);
      }
      nextReminderInterval = setInterval(updateNextReminderDisplay, 60000); // 每分钟更新一次
    }
  } else {
    indicator.className = "status-indicator status-inactive";
    statusText.textContent = "当前状态: 已暂停";
    nextReminderElement.style.display = "none";

    // 清除倒计时
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
    const minutesLeft = Math.ceil((nextReminderTime - now) / 60000);
  
    if (minutesLeft > 0) {
      nextReminderText.textContent = `距离下次提醒：${minutesLeft}分钟`;
      nextReminderElement.style.display = "flex";
    } else {
      nextReminderElement.style.display = "none";
    }
  }
// 更新历史记录显示
function updateHistoryDisplay(history) {
  if (!historyList) return;

  if (history.length === 0) {
    historyList.innerHTML = "<li>暂无提醒历史</li>";
    return;
  }

  historyList.innerHTML = history
    .map(
      (item) =>
        `<li>
            <div class="history-time">${item.time}</div>
            <div class="history-message">${item.message}</div>
        </li>`
    )
    .join("");
}

// 获取选中的通知模式
function getSelectedNotificationMode() {
  const selectedElement = document.querySelector(
    'input[name="notificationMode"]:checked'
  );
  return selectedElement ? selectedElement.value : "custom";
}

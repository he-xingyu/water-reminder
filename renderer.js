// renderer.js
// 获取DOM元素
const intervalInput = document.getElementById('interval');
const setReminderBtn = document.getElementById('setReminder');
const stopReminderBtn = document.getElementById('stopReminder');
const testReminderBtn = document.getElementById('testReminder');
const statusDiv = document.getElementById('status');
const historyList = document.getElementById('historyList');

// 页面加载完成后获取当前状态和历史记录
document.addEventListener('DOMContentLoaded', async () => {
    // 获取初始状态
    try {
        const status = await window.electronAPI.getReminderStatus();
        updateStatus(status);
    } catch (error) {
        console.error('获取状态失败:', error);
    }
    
    // 获取历史记录
    try {
        const history = await window.electronAPI.getReminderHistory();
        updateHistoryDisplay(history);
    } catch (error) {
        console.error('获取历史记录失败:', error);
    }
    
    // 获取保存的通知模式设置
    try {
        const savedMode = await window.electronAPI.getNotificationMode();
        const modeElement = document.querySelector(`input[name="notificationMode"][value="${savedMode}"]`);
        if (modeElement) {
            modeElement.checked = true;
        }
    } catch (error) {
        console.error('获取通知模式失败:', error);
    }
});

// 设置提醒按钮事件
setReminderBtn.addEventListener('click', async () => {
    const interval = parseInt(intervalInput.value);
    const notificationMode = getSelectedNotificationMode();
    
    if (isNaN(interval) || interval <= 0) {
        showStatus('请输入有效的分钟数', 'error');
        return;
    }
    
    try {
        const result = await window.electronAPI.setWaterReminder(interval, notificationMode);
        showStatus(result, 'success');
        updateStatus({isActive: true});
    } catch (error) {
        showStatus('设置失败: ' + error.message, 'error');
    }
});

// 停止提醒按钮事件
stopReminderBtn.addEventListener('click', async () => {
    try {
        const result = await window.electronAPI.stopWaterReminder();
        showStatus(result, 'info');
        updateStatus({isActive: false});
    } catch (error) {
        showStatus('停止失败: ' + error.message, 'error');
    }
});

// 测试提醒按钮事件
testReminderBtn.addEventListener('click', async () => {
    const notificationMode = getSelectedNotificationMode();
    
    try {
        const result = await window.electronAPI.testReminder(notificationMode);
        showStatus(result, 'info');
    } catch (error) {
        showStatus('测试失败: ' + error.message, 'error');
    }
});

// 监听历史记录更新
window.electronAPI.onReminderHistoryUpdated((event, history) => {
    updateHistoryDisplay(history);
});

// 显示状态信息
function showStatus(message, type) {
    // 清除之前的消息，只保留状态行
    const statusLines = statusDiv.innerHTML.split('<br>');
    if (statusLines.length > 0) {
        statusDiv.innerHTML = statusLines[0] + '<br>' + message;
    } else {
        statusDiv.innerHTML += '<br>' + message;
    }
    
    // 根据类型设置样式
    switch(type) {
        case 'success':
            statusDiv.style.backgroundColor = '#d4edda';
            statusDiv.style.color = '#155724';
            break;
        case 'error':
            statusDiv.style.backgroundColor = '#f8d7da';
            statusDiv.style.color = '#721c24';
            break;
        case 'info':
            statusDiv.style.backgroundColor = '#d1ecf1';
            statusDiv.style.color = '#0c5460';
            break;
        default:
            statusDiv.style.backgroundColor = '#e6f7ff';
            statusDiv.style.color = '#313131';
    }
    
    // 3秒后自动清除消息
    setTimeout(() => {
        const lines = statusDiv.innerHTML.split('<br>');
        if (lines.length > 1) {
            statusDiv.innerHTML = lines[0]; // 只保留状态行
        }
    }, 3000);
}

// 更新状态指示器
function updateStatus(status) {
    const indicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('#status span:nth-child(2)');
    
    if (status.isActive) {
        indicator.className = 'status-indicator status-active';
        statusText.textContent = '当前状态: 运行中';
    } else {
        indicator.className = 'status-indicator status-inactive';
        statusText.textContent = '当前状态: 已暂停';
    }
}

// 更新历史记录显示
function updateHistoryDisplay(history) {
    if (!historyList) return;
    
    if (history.length === 0) {
        historyList.innerHTML = '<li>暂无提醒历史</li>';
        return;
    }
    
    historyList.innerHTML = history.map(item => 
        `<li>
            <div class="history-time">${item.time}</div>
            <div class="history-message">${item.message}</div>
        </li>`
    ).join('');
}

// 获取选中的通知模式
function getSelectedNotificationMode() {
    const selectedElement = document.querySelector('input[name="notificationMode"]:checked');
    return selectedElement ? selectedElement.value : 'custom';
}
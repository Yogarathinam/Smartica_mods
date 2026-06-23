let ws = null;
let wsStatus = 'CLOSED';
let pendingRequests = new Map();
let pingInterval = null;
let reconnectTimer = null;
let currentWsUrl = 'ws://127.0.0.1:8765/ws';
let manualDisconnect = false;
let reconnectAttempt = 0;
let serviceReadyCache = { value: null, at: 0 };

const EXTENSION_VERSION = '1.0.1';
const REQUEST_TIMEOUT_MS = 120000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const SERVICE_STATUS_CACHE_MS = 5000;

const safeRuntimeSend = (msg) => {
  try { chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError); } catch (_) {}
};

const safeTabBroadcast = (msg) => {
  try {
    chrome.tabs.query({}, (tabs) => {
      if (!tabs) return;
      for (const tab of tabs) {
        if (!tab?.id) continue;
        chrome.tabs.sendMessage(tab.id, msg, () => void chrome.runtime.lastError);
      }
    });
  } catch (_) {}
};

const safeBroadcast = (type, data = {}) => {
  const msg = { type, ...data };
  safeRuntimeSend(msg);
  safeTabBroadcast(msg);
};

function makeError(code, error) {
  return { ok: false, code, error };
}

function broadcastEvent(type, data = {}) {
  safeBroadcast(type, data);
}

function broadcastStatus() {
  broadcastEvent('WS_STATUS', { status: wsStatus, url: currentWsUrl, version: EXTENSION_VERSION });
}

function setWsStatus(status) {
  wsStatus = status;
  broadcastStatus();
}

function startPingLoop() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'ping', request_id: 'ping-' + Date.now(), payload: {} }));
      } catch (e) {
        console.error('[AgentBridge] Ping failed:', e);
      }
    }
  }, 20000);
}

function stopPingLoop() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = null;
}

function clearRequest(reqId, response) {
  const item = pendingRequests.get(reqId);
  if (!item) return false;
  clearTimeout(item.timer);
  pendingRequests.delete(reqId);
  item.resolve(response);
  broadcastEvent('REQUEST_FINISHED', { request_id: reqId, ok: !!response?.ok, code: response?.code || null });
  return true;
}

function failAllPending(reason, code = 'WS_CLOSED') {
  for (const [reqId, item] of pendingRequests.entries()) {
    clearTimeout(item.timer);
    item.resolve(makeError(code, reason));
    broadcastEvent('REQUEST_FAILED', { request_id: reqId, code, error: reason });
  }
  pendingRequests.clear();
}

function scheduleReconnect() {
  if (manualDisconnect) return;
  if (reconnectTimer) return;
  setWsStatus('RECONNECTING');
  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt), RECONNECT_MAX_MS);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (currentWsUrl) connectWs(currentWsUrl);
  }, delay);
}

function connectWs(url) {
  manualDisconnect = false;
  serviceReadyCache = { value: null, at: 0 };
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; ws.close(); } catch (_) {}
    ws = null;
  }
  currentWsUrl = url || currentWsUrl;
  chrome.storage.local.set({ wsUrl: currentWsUrl });
  setWsStatus('CONNECTING');
  try {
    ws = new WebSocket(currentWsUrl);
  } catch (e) {
    console.error('[AgentBridge] Invalid WebSocket URL:', e);
    setWsStatus('ERROR');
    failAllPending('Invalid WebSocket URL or connection blocked.', 'WS_CONNECT_FAILED');
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempt = 0;
    setWsStatus('OPEN');
    broadcastEvent('WS_CONNECTED', { url: currentWsUrl, version: EXTENSION_VERSION });
    startPingLoop();
  };

  ws.onmessage = (e) => {
    let data;
    try {
      data = JSON.parse(e.data);
    } catch (err) {
      console.error('[AgentBridge] Failed to parse WS message:', err);
      return;
    }

    if (data?.request_id && pendingRequests.has(data.request_id)) {
      if (data?.type === 'service_status_result') serviceReadyCache = { value: data, at: Date.now() };
      clearRequest(data.request_id, data);
      return;
    }

    if (data?.type === 'event' && data.message) {
      broadcastEvent('ENGINE_LOG', { text: data.message, severity: data.severity || 'info' });
      return;
    }

    broadcastEvent('WS_MESSAGE', { url: currentWsUrl, version: EXTENSION_VERSION, data });
  };

  ws.onerror = () => {
    console.error('[AgentBridge] WebSocket error');
    setWsStatus('ERROR');
    broadcastEvent('WS_ERROR', { url: currentWsUrl, version: EXTENSION_VERSION });
  };

  ws.onclose = () => {
    stopPingLoop();
    ws = null;
    broadcastEvent('WS_DISCONNECTED', { url: currentWsUrl, version: EXTENSION_VERSION });
    setWsStatus('CLOSED');
    if (manualDisconnect) {
      manualDisconnect = false;
      return;
    }
    failAllPending('WebSocket connection closed abruptly.', 'WS_CLOSED');
    scheduleReconnect();
  };
}

function disconnectWs() {
  manualDisconnect = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  if (ws) {
    try { ws.close(); } catch (_) {}
    ws = null;
  }
  stopPingLoop();
  setWsStatus('CLOSED');
  failAllPending('Disconnected by user.', 'WS_CLOSED');
}

function askAgent(prompt) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const err = makeError('WS_NOT_READY', 'WebSocket is not connected or not ready.');
      broadcastEvent('REQUEST_FAILED', { request_id: 'pending', code: err.code, error: err.error });
      resolve(err);
      return;
    }
    const reqId = 'req-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    const timer = setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        const err = makeError('AGENT_TIMEOUT', 'AgentBridge timed out.');
        broadcastEvent('REQUEST_FAILED', { request_id: reqId, code: err.code, error: err.error });
        resolve(err);
      }
    }, REQUEST_TIMEOUT_MS);
    pendingRequests.set(reqId, { resolve, timer });
    broadcastEvent('REQUEST_STARTED', { request_id: reqId, kind: 'ask' });
    try {
      ws.send(JSON.stringify({ type: 'ask', request_id: reqId, payload: { prompt } }));
    } catch (e) {
      clearTimeout(timer);
      pendingRequests.delete(reqId);
      const err = makeError('WS_SEND_FAILED', 'Failed to send payload to WebSocket.');
      broadcastEvent('REQUEST_FAILED', { request_id: reqId, code: err.code, error: err.error });
      resolve(err);
    }
  });
}

function serviceStatus() {
  const cached = serviceReadyCache.value;
  if (cached && (Date.now() - serviceReadyCache.at) < SERVICE_STATUS_CACHE_MS) {
    return Promise.resolve(cached);
  }
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      resolve(makeError('WS_NOT_READY', 'WebSocket is not connected or not ready.'));
      return;
    }
    const reqId = 'status-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    const timer = setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        const err = makeError('AGENT_TIMEOUT', 'Service status timed out.');
        broadcastEvent('REQUEST_FAILED', { request_id: reqId, code: err.code, error: err.error });
        resolve(err);
      }
    }, 10000);
    pendingRequests.set(reqId, {
      resolve: (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      timer
    });
    broadcastEvent('REQUEST_STARTED', { request_id: reqId, kind: 'service_status' });
    try {
      ws.send(JSON.stringify({ type: 'service_status', request_id: reqId, payload: {} }));
    } catch (e) {
      clearTimeout(timer);
      pendingRequests.delete(reqId);
      const err = makeError('WS_SEND_FAILED', 'Failed to send service status request.');
      broadcastEvent('REQUEST_FAILED', { request_id: reqId, code: err.code, error: err.error });
      resolve(err);
    }
  });
}

function getStats() {
  return {
    ok: true,
    pending: pendingRequests.size,
    reconnectAttempt,
    wsStatus,
    version: EXTENSION_VERSION,
    url: currentWsUrl
  };
}

chrome.storage.local.get(['wsUrl'], (res) => {
  if (res?.wsUrl) currentWsUrl = res.wsUrl;
  broadcastStatus();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg?.command && !msg?.type) return;

  if (msg.command === 'CONNECT_WS') {
    connectWs(msg.url || currentWsUrl);
    sendResponse({ ok: true, status: 'CONNECTING', version: EXTENSION_VERSION, url: currentWsUrl });
    return true;
  }

  if (msg.command === 'DISCONNECT_WS') {
    disconnectWs();
    sendResponse({ ok: true, status: 'CLOSED', version: EXTENSION_VERSION, url: currentWsUrl });
    return true;
  }

  if (msg.command === 'GET_WS_STATUS') {
    sendResponse({ ok: true, status: wsStatus, url: currentWsUrl, version: EXTENSION_VERSION });
    return true;
  }

  if (msg.command === 'GET_VERSION') {
    sendResponse({ ok: true, version: EXTENSION_VERSION });
    return true;
  }

  if (msg.command === 'GET_STATS') {
    sendResponse(getStats());
    return true;
  }

  if (msg.command === 'SERVICE_STATUS') {
    serviceStatus().then((res) => {
      sendResponse(res?.ok === false ? res : { ok: true, payload: res, version: EXTENSION_VERSION });
    });
    return true;
  }

  if (msg.command === 'ASK_AGENT') {
    askAgent(msg.prompt).then((res) => {
      if (res?.ok === false) {
        sendResponse(res);
      } else if (res?.payload && typeof res.payload === 'object') {
        sendResponse({ ok: true, payload: res.payload, version: EXTENSION_VERSION });
      } else {
        sendResponse({ ok: true, payload: res, version: EXTENSION_VERSION });
      }
    });
    return true;
  }

  if (msg.type === 'SMARTAGENT_UI_EVENT') {
    if (msg.eventType === 'REQUEST_CONNECT') connectWs(msg.url || currentWsUrl);
    if (msg.eventType === 'REQUEST_DISCONNECT') disconnectWs();
    if (msg.eventType === 'PING_WS') {
      serviceStatus().then((res) => sendResponse(res?.ok === false ? res : { ok: true, payload: res, version: EXTENSION_VERSION }));
      return true;
    }
    sendResponse({ ok: true, version: EXTENSION_VERSION });
    return true;
  }

  if (msg.command === 'PING_WS') {
    serviceStatus().then((res) => sendResponse(res?.ok === false ? res : { ok: true, payload: res, version: EXTENSION_VERSION }));
    return true;
  }
});

broadcastStatus();
broadcastEvent('EXTENSION_READY', { version: EXTENSION_VERSION });
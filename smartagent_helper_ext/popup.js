document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('main-conn-btn');
    const orb = document.getElementById('conn-orb');
    const ping = document.getElementById('conn-ping');
    const text = document.getElementById('conn-text');
    const glow = document.getElementById('status-glow');
    const wsUrlInput = document.getElementById('ws-url');
    const pingBtn = document.getElementById('ping-btn');

    const togglePage = document.getElementById('toggle-page');
    const containerTogglePage = document.getElementById('container-toggle-page');
    const toggleFloating = document.getElementById('toggle-floating');
    const containerToggleFloating = document.getElementById('container-toggle-floating');

    let isConnected = false;
    let isConnecting = false;
    let lastStatus = 'CLOSED';
    let debounceTimer = null;

    function sendToBackground(msg, cb) {
        try {
            chrome.runtime.sendMessage(msg, (res) => {
                void chrome.runtime.lastError;
                if (cb) cb(res);
            });
        } catch (_) {}
    }

    function setButtonBusy(busy) {
        if (!btn) return;
        btn.disabled = busy;
        btn.classList.toggle('animate-pulse', busy);
    }

    function setPingPulse(on, color = 'rose') {
        if (!ping) return;
        if (!on) {
            ping.className = 'hidden';
            return;
        }
        if (color === 'emerald') ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
        else if (color === 'amber') ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75';
        else ping.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75';
    }

    function updateConnectionUI(status, url) {
        if (url && wsUrlInput) wsUrlInput.value = url;
        lastStatus = status || 'CLOSED';

        if (status === 'OPEN' || status === 'CONNECTED') {
            isConnected = true;
            isConnecting = false;
            setButtonBusy(false);
            if (btn) {
                btn.innerText = 'Disconnect';
                btn.className = 'w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-400 hover:border-rose-500/50 border border-slate-700';
            }
            if (text) {
                text.innerText = 'Connected';
                text.className = 'text-[10px] font-bold uppercase tracking-wider text-emerald-400';
            }
            if (orb) orb.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
            setPingPulse(false);
            if (glow) glow.className = 'absolute -top-4 -right-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl transition-colors duration-500';
            if (wsUrlInput) {
                wsUrlInput.disabled = true;
                wsUrlInput.classList.add('opacity-50');
            }
            return;
        }

        if (status === 'CONNECTING' || status === 'RECONNECTING') {
            isConnected = false;
            isConnecting = true;
            setButtonBusy(true);
            if (btn) {
                btn.innerText = status === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...';
                btn.className = 'w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 bg-slate-700 text-slate-300 cursor-wait border border-slate-600';
            }
            if (text) {
                text.innerText = status === 'RECONNECTING' ? 'Reconnecting' : 'Connecting';
                text.className = 'text-[10px] font-bold uppercase tracking-wider text-amber-400';
            }
            if (orb) orb.className = 'relative inline-flex rounded-full h-2 w-2 bg-amber-500';
            setPingPulse(true, 'amber');
            if (glow) glow.className = 'absolute -top-4 -right-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl transition-colors duration-500';
            if (wsUrlInput) wsUrlInput.disabled = true;
            return;
        }

        isConnected = false;
        isConnecting = false;
        setButtonBusy(false);
        if (btn) {
            btn.innerText = 'Connect to Server';
            btn.className = 'w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-500';
        }
        if (text) {
            text.innerText = 'Offline';
            text.className = 'text-[10px] font-bold uppercase tracking-wider text-slate-400';
        }
        if (orb) orb.className = 'relative inline-flex rounded-full h-2 w-2 bg-rose-500';
        setPingPulse(true, 'rose');
        if (glow) glow.className = 'absolute -top-4 -right-4 w-16 h-16 bg-rose-500/10 rounded-full blur-xl transition-colors duration-500';
        if (wsUrlInput) {
            wsUrlInput.disabled = false;
            wsUrlInput.classList.remove('opacity-50');
        }
    }

    function connectClicked() {
        if (isConnecting) return;
        const desiredUrl = wsUrlInput ? wsUrlInput.value.trim() : '';
        if (isConnected) {
            updateConnectionUI('CLOSED');
            sendToBackground({ command: 'DISCONNECT_WS' });
            return;
        }
        updateConnectionUI('CONNECTING', desiredUrl);
        sendToBackground({ command: 'CONNECT_WS', url: desiredUrl });
    }

    function pingClicked() {
        if (!isConnected) {
            if (btn) {
                btn.classList.add('animate-pulse');
                setTimeout(() => btn.classList.remove('animate-pulse'), 500);
            }
            return;
        }
        sendToBackground({ command: 'PING_WS' });
        if (orb) {
            orb.classList.add('bg-white', 'shadow-[0_0_10px_#fff]');
            setTimeout(() => orb.classList.remove('bg-white', 'shadow-[0_0_10px_#fff]'), 300);
        }
    }

    function bindToggle(container, checkbox) {
        if (!container || !checkbox) return;
        container.addEventListener('click', (e) => {
            if (e.target !== checkbox) checkbox.click();
        });
        checkbox.addEventListener('click', (e) => e.stopPropagation());
    }

    bindToggle(containerTogglePage, togglePage);
    bindToggle(containerToggleFloating, toggleFloating);

    if (togglePage) {
        togglePage.addEventListener('change', () => {
            chrome.storage.local.set({ enablePage: togglePage.checked });
            sendToBackground({ command: 'SET_ENABLE_PAGE', enabled: togglePage.checked });
        });
    }

    if (toggleFloating) {
        toggleFloating.addEventListener('change', () => {
            chrome.storage.local.set({ enableUI: toggleFloating.checked });
            sendToBackground({ command: 'SET_ENABLE_UI', enabled: toggleFloating.checked });
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { command: 'TOGGLE_BUBBLE_UI', show: toggleFloating.checked }, () => void chrome.runtime.lastError);
                }
            });
        });
    }

    if (btn) btn.addEventListener('click', connectClicked);
    if (pingBtn) pingBtn.addEventListener('click', pingClicked);

    chrome.runtime.onMessage.addListener((msg) => {
        if (!msg) return;
        if (msg.type === 'WS_STATUS' || msg.type === 'WS_CONNECTED' || msg.type === 'WS_DISCONNECTED' || msg.type === 'WS_RECONNECTING' || msg.type === 'WS_ERROR') {
            const status = msg.status || (msg.type === 'WS_CONNECTED' ? 'OPEN' : msg.type === 'WS_DISCONNECTED' ? 'CLOSED' : msg.type === 'WS_RECONNECTING' ? 'RECONNECTING' : msg.type === 'WS_ERROR' ? 'ERROR' : 'CLOSED');
            updateConnectionUI(status, msg.url);
            return;
        }
        if (msg.type === 'EXTENSION_READY' && msg.url) updateConnectionUI(lastStatus, msg.url);
    });

    sendToBackground({ command: 'GET_WS_STATUS' }, (res) => {
        if (res && res.status) updateConnectionUI(res.status, res.url);
        else updateConnectionUI('CLOSED');
    });

    chrome.storage.local.get(['enablePage', 'enableUI', 'wsUrl'], (res) => {
        if (togglePage && res.enablePage !== undefined) togglePage.checked = !!res.enablePage;
        if (toggleFloating && res.enableUI !== undefined) toggleFloating.checked = !!res.enableUI;
        if (res.wsUrl && wsUrlInput && !wsUrlInput.value) wsUrlInput.value = res.wsUrl;
    });

    updateConnectionUI('CLOSED');
// --- ALWAYS ACTIVE EXTENSION LOGIC ---
const toggleAlwaysActive = document.getElementById('toggle-always-active');
const containerToggleAlwaysActive = document.getElementById('container-toggle-always-active');
const hostnameLabel = document.getElementById('current-hostname-label');
let frameHostnames = [];
let topHostname = '';

bindToggle(containerToggleAlwaysActive, toggleAlwaysActive);

// 1. Grab ALL URLs (including hidden iframes) on the current tab
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs && tabs[0] && tabs[0].url && tabs[0].url.startsWith('http')) {
        topHostname = new URL(tabs[0].url).hostname;
        if(hostnameLabel) hostnameLabel.innerText = "Spoof " + topHostname;

        try {
            // MAGIC FIX: Scan the page for all hidden iframe domains just like the original extension!
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id, allFrames: true },
                func: () => location.hostname
            });
            
            // Collect all unique domains found on the page
            frameHostnames = results.map(r => r.result).filter((s, i, arr) => s && arr.indexOf(s) === i);
            if (frameHostnames.length === 0) frameHostnames = [topHostname];

            // Check if the top frame is already enabled
            chrome.storage.local.get({ hosts: [] }, (res) => {
                if (res.hosts && res.hosts.includes(topHostname)) {
                    toggleAlwaysActive.checked = true;
                }
            });
        } catch(e) {
            frameHostnames = [topHostname];
        }
    } else {
        if(hostnameLabel) hostnameLabel.innerText = "Unavailable on this page";
        toggleAlwaysActive.disabled = true;
    }
});

// 3. Save the setting when the user clicks the toggle
if (toggleAlwaysActive) {
    toggleAlwaysActive.addEventListener('change', () => {
        if (!frameHostnames.length) return;
        
        chrome.storage.local.get({ hosts: [] }, (res) => {
            let hosts = res.hosts || [];
            
            if (toggleAlwaysActive.checked) {
                // Add ALL found frames (main page + iframes) to the Always Active whitelist
                frameHostnames.forEach(host => {
                    if (!hosts.includes(host)) hosts.push(host);
                });
            } else {
                // Remove ALL found frames from the whitelist
                hosts = hosts.filter(h => !frameHostnames.includes(h));
            }
            
            chrome.storage.local.set({ hosts: hosts }, () => {
                // Refresh the tab so the scripts inject into every layer
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs && tabs[0]) chrome.tabs.reload(tabs[0].id);
                });
            });
        });
    });
}
});
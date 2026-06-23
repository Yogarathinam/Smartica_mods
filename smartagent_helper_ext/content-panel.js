// content-panel.js - SmartAgent Helper Floating Control Panel (Shadow DOM + Updater + Anti-Spam)
(() => {
  'use strict';
  
  const CURRENT_VERSION = "1.0.0";
  const UPDATE_URL = "https://raw.githubusercontent.com/Yogarathinam/Smartica_mods/refs/heads/main/version.json";

  function initSmartAgentUI() {
    if (document.getElementById('smart-agent-host')) return;
  
    // --- ICON LIBRARY ---
    const Icons = {
      robot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
      minimize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
      play: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><path d="M5 3v18l15-9L5 3z"/></svg>`,
      pause: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
      step: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><path d="M5 18l8.5-6L5 6v12zM15 6v12h2V6h-2z"/></svg>`,
      stop: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><path d="M6 6h12v12H6z"/></svg>`,
      settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;transition:0.3s;"><polyline points="6 9 12 15 18 9"/></svg>`,
      info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    };
  
    // --- HOST & SHADOW DOM ---
    const host = document.createElement('div');
    host.id = 'smart-agent-host';
    host.style.cssText = 'position: fixed; bottom: 24px; left: 24px; z-index: 2147483647; width: 0; height: 0; overflow: visible; pointer-events: none;';
    document.body.appendChild(host);
  
    // Ghost input in Light DOM
    let ghostInput = document.getElementById('run-count');
    if (!ghostInput) {
        ghostInput = document.createElement('input');
        ghostInput.type = 'hidden';
        ghostInput.id = 'run-count';
        ghostInput.value = '1';
        document.body.appendChild(ghostInput);
    }

    const shadow = host.attachShadow({ mode: 'open' });
  
    // --- SHADOW DOM CSS ---
    const style = document.createElement('style');
    style.textContent = `
      :host {
        --bg-main: #0B0616;
        --bg-card: rgba(45, 27, 78, 0.4);
        --accent-cyan: #22D3EE;
        --accent-pink: #F472B6;
        --accent-purple: #8B5CF6;
        --accent-green: #10B981;
        --accent-red: #F43F5E;
        --accent-yellow: #FBBF24;
        --border-color: #4F287D;
        --text-main: #FFFFFF;
        --text-muted: #94a3b8;
      }
      
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; color: var(--text-main); pointer-events: auto; }
      button { background: none; border: none; cursor: pointer; outline: none; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
      input { background: none; border: none; outline: none; }
      
      .flex-row { display: flex; flex-direction: row; align-items: center; }
      .flex-col { display: flex; flex-direction: column; }
      .justify-between { justify-content: space-between; }
      .hidden { display: none !important; }
      
      .ui-wrapper { position: relative; width: 0; height: 0; }
      
      .panel { position: absolute; bottom: 60px; left: 0; width: 330px; background: linear-gradient(145deg, var(--bg-main), #1A0B2E); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8), 0 0 30px rgba(139, 92, 246, 0.25); display: flex; flex-direction: column; transform-origin: bottom left; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s; }
      .panel.hidden-panel { transform: scale(0.9) translateY(20px); opacity: 0; pointer-events: none; }
      
      .header { background: rgba(22, 11, 36, 0.8); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border-color); padding: 12px 16px; border-radius: 16px 16px 0 0; }
      .brand { gap: 8px; font-weight: 800; font-size: 14px; letter-spacing: 0.05em; }
      .brand svg { color: var(--accent-pink); }
      
      .status-badge { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px; gap: 6px; font-size: 10px; font-weight: bold; color: var(--text-muted); letter-spacing: 0.05em; }
      .orb { width: 8px; height: 8px; border-radius: 50%; background: #64748b; transition: 0.3s; }
      .orb.ready { background: var(--accent-cyan); box-shadow: 0 0 8px var(--accent-cyan); }
      .orb.running { background: var(--accent-green); box-shadow: 0 0 8px var(--accent-green); }
      
      .btn-minimize { color: var(--text-muted); padding: 4px; border-radius: 6px; }
      .btn-minimize:hover { color: #fff; background: rgba(255,255,255,0.1); }
      
      .body { padding: 16px; gap: 14px; position: relative; }
      .card { background: var(--bg-card); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 12px 14px; }
      
      .ping-wrap { position: relative; width: 10px; height: 10px; margin-right: 8px; }
      .ping-dot { position: absolute; width: 100%; height: 100%; background: var(--accent-red); border-radius: 50%; }
      .ping-ring { position: absolute; width: 100%; height: 100%; background: var(--accent-red); border-radius: 50%; animation: ping 1.5s infinite; opacity: 0.7; }
      .ping-dot.connected { background: var(--accent-cyan); box-shadow: 0 0 8px var(--accent-cyan); }
      .ping-ring.connected { display: none; }
      @keyframes ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }
      
      .conn-text { font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: var(--text-muted); }
      .conn-text.connected { color: var(--accent-cyan); }
      
      .btn-connect { padding: 6px 14px; font-size: 11px; font-weight: 800; border-radius: 20px; letter-spacing: 0.05em; border: 1px solid transparent; text-transform: uppercase; }
      .btn-connect.off { background: linear-gradient(90deg, #10B981, #059669); color: #fff; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }
      .btn-connect.off:hover { transform: scale(1.05); box-shadow: 0 0 15px rgba(16, 185, 129, 0.7); }
      .btn-connect.on { background: rgba(244, 63, 94, 0.1); color: var(--accent-red); border-color: var(--accent-red); }
      .btn-connect.on:hover { background: rgba(244, 63, 94, 0.2); transform: scale(1.05); }
      
      .mode-bar { background: rgba(0,0,0,0.5); border: 1px solid rgba(79, 40, 125, 0.5); border-radius: 10px; padding: 4px; gap: 4px; }
      .btn-mode { flex: 1; padding: 8px 0; font-size: 11px; font-weight: 800; color: var(--text-muted); border-radius: 6px; letter-spacing: 0.05em; }
      .btn-mode:hover { color: #fff; }
      .btn-mode.active { background: linear-gradient(135deg, var(--accent-purple), #EC4899); color: #fff; box-shadow: 0 2px 10px rgba(236, 72, 153, 0.4); border: 1px solid rgba(255,255,255,0.2); }
      
      .limit-label { font-size: 10px; font-weight: 800; color: #A5B4FC; letter-spacing: 0.05em; margin-right: 8px; }
      .limit-input { width: 44px; padding: 4px; background: rgba(0,0,0,0.5); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 6px; text-align: center; font-size: 13px; font-family: monospace; transition: 0.2s; margin-right: 8px; }
      .limit-input:focus { border-color: var(--accent-pink); box-shadow: 0 0 8px rgba(244,114,182,0.3); }
      .progress-text { font-size: 12px; font-weight: 800; color: var(--accent-pink); }
      
      .btn-action { width: 32px; height: 32px; border-radius: 8px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.4); color: #E9D5FF; margin-left: 6px; }
      .btn-action:hover { transform: translateY(-2px); color: #fff; }
      .btn-action:active { transform: translateY(1px); }
      .btn-play:hover { background: rgba(16, 185, 129, 0.2); border-color: var(--accent-green); color: var(--accent-green); box-shadow: 0 4px 10px rgba(16,185,129,0.3); }
      .btn-pause:hover { background: rgba(245, 158, 11, 0.2); border-color: var(--accent-yellow); color: var(--accent-yellow); box-shadow: 0 4px 10px rgba(245,158,11,0.3); }
      .btn-step:hover { background: rgba(34, 211, 238, 0.2); border-color: var(--accent-cyan); color: var(--accent-cyan); box-shadow: 0 4px 10px rgba(34,211,238,0.3); }
      .btn-stop:hover { background: rgba(244, 63, 94, 0.2); border-color: var(--accent-red); color: var(--accent-red); box-shadow: 0 4px 10px rgba(244,63,94,0.3); }
      
      .console { background: rgba(0,0,0,0.7); border: 1px solid rgba(79, 40, 125, 0.6); border-radius: 12px; height: 140px; position: relative; overflow: hidden; box-shadow: inset 0 4px 10px rgba(0,0,0,0.5); }
      .console-header { position: absolute; top: 0; left: 0; right: 0; background: linear-gradient(90deg, rgba(49, 46, 129, 0.9), transparent); padding: 6px 12px; font-size: 9px; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.1em; border-bottom: 1px solid rgba(49, 46, 129, 0.5); }
      .feed { padding: 32px 12px 12px 12px; overflow-y: auto; height: 100%; gap: 10px; font-size: 11px; font-family: 'Courier New', monospace; scroll-behavior: smooth; }
      .log-entry { word-break: break-word; animation: saFadeIn 0.3s; line-height: 1.4; color: #E2E8F0; }
      .log-time { color: var(--accent-purple); font-weight: bold; margin-right: 6px; }
      
      .btn-settings { width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
      .btn-settings:hover { color: #fff; background: rgba(255,255,255,0.1); }
      .settings-drawer { max-height: 0; overflow: hidden; opacity: 0; transition: 0.3s ease; }
      .settings-drawer.expanded { max-height: 200px; opacity: 1; margin-top: 8px; }
      
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--accent-purple); border-radius: 4px; }
      
      .dash-pill { position: absolute; bottom: 0; left: 0; height: 46px; width: 46px; background: linear-gradient(135deg, var(--accent-pink), var(--accent-purple)); border-radius: 23px; padding: 0 14px; cursor: pointer; box-shadow: 0 4px 20px rgba(236, 72, 153, 0.5); overflow: hidden; transition: width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.2s; }
      .dash-pill:hover { width: 165px; transform: translateY(-2px); box-shadow: 0 6px 25px rgba(139, 92, 246, 0.7); }
      .dash-icon { flex-shrink: 0; display: flex; color: #fff; }
      .dash-text { white-space: nowrap; margin-left: 12px; font-weight: 800; font-size: 14px; color: #ffffff; opacity: 0; transform: translateX(-10px); transition: 0.2s 0.1s; letter-spacing: 0.05em; }
      .dash-pill:hover .dash-text { opacity: 1; transform: translateX(0); }
      .dash-badge { position: absolute; top: 0px; right: 0px; width: 14px; height: 14px; border-radius: 50%; background: #64748b; border: 2px solid var(--bg-main); transition: 0.3s; }
      .dash-pill.hidden-pill { pointer-events: none; opacity: 0; }
      
      /* HUD TOAST */
      .hud-toast { position: absolute; bottom: 60px; left: 0; background: rgba(10, 5, 25, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(139, 92, 246, 0.3); border-left: 4px solid var(--accent-pink); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px rgba(139,92,246,0.1); max-width: 380px; width: max-content; opacity: 0; pointer-events: none; transform: translateY(20px) scale(0.95); transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1); z-index: 40; }
      .hud-toast.elevated { bottom: 460px; } 
      .hud-toast.show { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
      
      .hud-toast-text { font-size: 13px; font-weight: 700; color: #F8FAFC; letter-spacing: 0.02em; line-height: 1.4; }
      
      .stream-viz { display: flex; align-items: flex-end; gap: 3px; height: 14px; margin-left: auto; padding-left: 10px; }
      .stream-bar { width: 3px; background: var(--accent-pink); border-radius: 2px; }
      .hud-toast.show:not(.persistent) .stream-bar { animation: eq 1s ease-in-out infinite alternate; }
      .hud-toast.persistent .stream-bar { animation: none !important; height: 30%; opacity: 0.4; }
      
      .stream-bar:nth-child(1) { height: 40%; animation-delay: 0.1s; }
      .stream-bar:nth-child(2) { height: 80%; animation-delay: 0.3s; }
      .stream-bar:nth-child(3) { height: 60%; animation-delay: 0.5s; }
      .stream-bar:nth-child(4) { height: 100%; animation-delay: 0.2s; }
      @keyframes eq { 0% { height: 20%; } 100% { height: 100%; } }
      @keyframes saFadeIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }

      /* UPDATE OVERLAY */
      .update-overlay {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(11, 6, 22, 0.98); backdrop-filter: blur(10px);
        z-index: 100; border-radius: 16px; padding: 24px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; border: 1px solid var(--accent-red);
      }
      .update-title { color: var(--accent-red); font-size: 16px; font-weight: 900; letter-spacing: 0.1em; margin: 12px 0 6px 0; }
      .update-text { font-size: 11px; color: var(--text-muted); margin-bottom: 20px; line-height: 1.5; }
      .update-btn {
        background: var(--accent-red); color: #fff; padding: 10px 20px; border-radius: 8px;
        text-decoration: none; font-weight: 800; font-size: 12px; letter-spacing: 0.05em;
        box-shadow: 0 4px 15px rgba(244, 63, 94, 0.4); transition: 0.2s; margin-bottom: 20px; display: inline-block;
      }
      .update-btn:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(244, 63, 94, 0.6); }
      .update-guide {
        font-size: 10px; color: var(--text-muted); text-align: left; background: rgba(0,0,0,0.5);
        padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); line-height: 1.6;
      }
    `;
    shadow.appendChild(style);
  
    // --- HTML STRUCTURE ---
    const uiWrapper = document.createElement('div');
    uiWrapper.className = 'ui-wrapper';
    uiWrapper.innerHTML = `
      <div id="sa-hud-toast" class="hud-toast">
        <span id="sa-toast-icon" style="color:var(--accent-pink); display:flex;">${Icons.info}</span>
        <span id="sa-toast-text" class="hud-toast-text">Stream active...</span>
        <div id="sa-stream-viz" class="stream-viz">
          <div class="stream-bar"></div><div class="stream-bar"></div><div class="stream-bar"></div><div class="stream-bar"></div>
        </div>
      </div>
  
      <div id="sa-panel" class="panel hidden-panel">
        <div class="header flex-row justify-between">
          <div class="brand flex-row">${Icons.robot} SmartAgent Helper</div>
          <div class="flex-row" style="gap:12px;">
            <div class="status-badge flex-row">
              <div id="sa-panel-orb" class="orb"></div>
              <span id="sa-global-status">IDLE</span>
            </div>
            <button id="sa-btn-minimize" class="btn-minimize">${Icons.minimize}</button>
          </div>
        </div>
  
        <div class="body flex-col" id="sa-panel-body">
          <div class="card flex-row justify-between">
            <div class="flex-row">
              <div class="ping-wrap">
                <div id="sa-conn-ping" class="ping-ring"></div>
                <div id="sa-conn-orb" class="ping-dot"></div>
              </div>
              <span id="sa-conn-text" class="conn-text">OFFLINE</span>
            </div>
            <button id="sa-btn-toggle-connect" class="btn-connect off">CONNECT</button>
          </div>
  
          <div class="mode-bar flex-row">
            <button class="btn-mode active" data-mode="Auto">AUTO</button>
            <button class="btn-mode" data-mode="MCQ">MCQ</button>
            <button class="btn-mode" data-mode="Coding">CODING</button>
          </div>
  
          <div class="card flex-row justify-between">
            <div class="flex-row">
              <span class="limit-label">TARGET</span>
              <input type="number" id="sa-run-count" class="limit-input" value="1" min="1">
              <span id="sa-progress-text" class="progress-text">0 / 1</span>
            </div>
            <div class="flex-row">
              <button id="sa-btn-start" class="btn-action btn-play" title="Start Run">${Icons.play}</button>
              <button id="sa-btn-pause" class="btn-action btn-pause" title="Pause Engine">${Icons.pause}</button>
              <button id="sa-btn-step" class="btn-action btn-step" title="Single Step">${Icons.step}</button>
              <button id="sa-btn-stop" class="btn-action btn-stop" title="Halt Everything">${Icons.stop}</button>
            </div>
          </div>
  
          <div class="console flex-col">
            <div class="console-header">TERMINAL OUTPUT</div>
            <div id="sa-event-feed" class="feed flex-col">
              <div class="log-entry"><span class="log-time">[SYS]</span> <span style="color:var(--text-muted)">Interface initialized.</span></div>
            </div>
          </div>
  
          <div class="flex-col">
            <button id="sa-btn-settings" class="btn-settings flex-row">
              <div class="flex-row" style="gap:8px;">${Icons.settings} Parameters</div>
              <div id="sa-settings-chevron" style="transition:0.3s; color:var(--accent-pink);">${Icons.chevron}</div>
            </button>
            <div id="sa-settings-drawer" class="settings-drawer">
              <div class="card flex-col">
                <div class="flex-row" style="gap:12px;">
                  <div style="flex:1;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:bold;margin-bottom:6px;">DELAY (MS)</div>
                    <input type="number" value="500" class="limit-input" style="width:100%;margin:0;">
                  </div>
                  <div style="flex:1;">
                    <div style="font-size:9px;color:var(--text-muted);font-weight:bold;margin-bottom:6px;">RETRIES</div>
                    <input type="number" value="3" class="limit-input" style="width:100%;margin:0;">
                  </div>
                </div>
                <label class="flex-row" style="margin-top:14px;cursor:pointer;gap:8px;">
                  <input type="checkbox" id="sa-toggle-toasts" checked style="width:14px;height:14px;accent-color:var(--accent-pink);cursor:pointer;">
                  <span style="font-size:11px;font-weight:bold;color:var(--text-muted);">Enable Toast Notifications</span>
                </label>
              </div>
            </div>
          </div>

          <div id="sa-update-overlay" class="update-overlay hidden">
             <div style="color:var(--accent-red);">${Icons.warning}</div>
             <div class="update-title">UPDATE REQUIRED</div>
             <div class="update-text">A critical new version (<span id="sa-new-version"></span>) is available.<br>Your current version (${CURRENT_VERSION}) is deprecated.</div>
             <a id="sa-download-link" href="#" target="_blank" class="update-btn">DOWNLOAD UPDATE .ZIP</a>
             <div class="update-guide">
                <b style="color:#fff;">How to install:</b><br>
                1. Extract the downloaded .zip file.<br>
                2. Open Chrome and go to <b>chrome://extensions/</b><br>
                3. Enable <b>Developer Mode</b> (top right corner).<br>
                4. Click <b>Load unpacked</b> and select the extracted folder.
             </div>
          </div>

        </div>
      </div>
  
      <div id="sa-dash-pill" class="dash-pill flex-row">
        <div class="dash-icon">${Icons.robot}</div>
        <div class="dash-text">SmartAgent</div>
        <div id="sa-dash-orb" class="dash-badge"></div>
      </div>
    `;
    shadow.appendChild(uiWrapper);
  
    // --- HELPER QUERIES ---
    const $ = (id) => shadow.getElementById(id);
    const $$ = (sel) => shadow.querySelectorAll(sel);
  
    // --- STATE & DOM VARS ---
    let isMinimized = true;
    let toastTimeout;
    let idleInterval;
    let lastEventTime = Date.now();
    let state = { connected: false, engineRunning: false, mode: 'Auto' };
  
    const panel = $('sa-panel');
    const dashPill = $('sa-dash-pill');
    const hudToast = $('sa-hud-toast');
    
    const btnConnect = $('sa-btn-toggle-connect');
    const btnStart = $('sa-btn-start');
    const btnPause = $('sa-btn-pause');
    const btnStep = $('sa-btn-step');
    const btnStop = $('sa-btn-stop');
    const modeButtons = [...$$('.btn-mode')];
    
    const connOrb = $('sa-conn-orb');
    const connPing = $('sa-conn-ping');
    const connText = $('sa-conn-text');
    
    const panelOrb = $('sa-panel-orb');
    const globalStatus = $('sa-global-status');
    const dashOrb = $('sa-dash-orb');
    
    const runCountInput = $('sa-run-count');
    const eventFeed = $('sa-event-feed');
  
    // Sync run count to the ghost element and update the visual text
    runCountInput.addEventListener('input', () => { 
        const val = parseInt(runCountInput.value, 10) || 1;
        ghostInput.value = val; 
        $('sa-progress-text').innerText = `0 / ${val}`;
    });
  
    const isApiReady = () => typeof window !== 'undefined' && window.SmartAgentHelper;
    
    const emit = (type, payload = {}) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'SMARTAGENT_UI_EVENT', eventType: type, ...payload }, () => void chrome.runtime.lastError);
        }
      } catch (_) {}
    };
  
    // --- UPDATE CHECKER ---
    async function checkForUpdates() {
      try {
          const response = await fetch(UPDATE_URL, { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json();
          
          if (data.version && data.version !== CURRENT_VERSION) {
              if (data.force_update) {
                  // Block the UI completely
                  $('sa-update-overlay').classList.remove('hidden');
                  $('sa-new-version').innerText = data.version;
                  $('sa-download-link').href = data.download_url;
                  showToast(`CRITICAL: Version ${data.version} required.`, 'error', true);
              } else {
                  // Just show a warning log
                  addEvent(`Update available: v${data.version}. Download from GitHub! 🚀`, 'warning');
              }
          }
      } catch (e) {
          console.log("[SmartAgent] Failed to check for updates.", e);
      }
    }

    // --- UI CONTROLLERS ---
    const setUiConnected = (connected, source = 'ui') => {
      state.connected = !!connected;
      
      connText.innerText = connected ? 'CONNECTED' : 'OFFLINE';
      connText.className = connected ? 'conn-text connected' : 'conn-text';
      
      connOrb.className = connected ? 'ping-dot connected' : 'ping-dot';
      connPing.style.display = connected ? 'none' : 'block';
      
      if (connected) {
        btnConnect.innerText = "DISCONNECT";
        btnConnect.className = "btn-connect on";
      } else {
        btnConnect.innerText = "CONNECT";
        btnConnect.className = "btn-connect off";
      }
  
      runCountInput.disabled = !connected;
      
      const orbClass = connected ? 'ready' : '';
      globalStatus.innerText = state.engineRunning ? 'RUNNING' : (connected ? 'READY' : 'IDLE');
      
      panelOrb.className = `orb ${state.engineRunning ? 'running' : orbClass}`;
      dashOrb.className = `dash-badge ${state.engineRunning ? 'running' : orbClass}`;
      
      if (isApiReady()) window.SmartAgentHelper.isConnected = !!connected;
      emit('CONNECTION_CHANGED', { connected: !!connected, source });
    };
  
    const setEngineState = (running, extra = {}) => {
      const wasRunning = state.engineRunning;
      state.engineRunning = !!running;
      globalStatus.innerText = running ? 'RUNNING' : (state.connected ? 'READY' : 'IDLE');
      
      const orbClass = running ? 'running' : (state.connected ? 'ready' : '');
      panelOrb.className = `orb ${orbClass}`;
      dashOrb.className = `dash-badge ${orbClass}`;
      
      // Update Progress Text
      if (extra.completed !== undefined) {
        const total = parseInt(extra.targetCount || ghostInput.value || 1, 10);
        const completed = parseInt(extra.completed, 10) || 0;
        $('sa-progress-text').innerText = `${completed} / ${total}`;
      }
      
      // Physically disable Start & Step buttons while running so they can only trigger ONCE
      btnStart.style.opacity = running ? '0.5' : '1';
      btnStart.style.pointerEvents = running ? 'none' : 'auto';
      btnStep.style.opacity = running ? '0.5' : '1';
      btnStep.style.pointerEvents = running ? 'none' : 'auto';

      if (running) {
        if (hudToast.classList.contains('persistent')) {
            hudToast.classList.remove('persistent');
        }
        
        if (!idleInterval) {
            idleInterval = setInterval(() => {
                if (!state.engineRunning) {
                    clearInterval(idleInterval);
                    idleInterval = null;
                    return;
                }
                if (Date.now() - lastEventTime > 7000) {
                    const idleThoughts = [
                        "Still working on it... grading servers are slow today 🐢",
                        "Humming jeopardy music while we wait 🎵",
                        "Executing 10,000 calculations per second... 🤓",
                        "Staring respectfully at the DOM while it loads... 👀",
                        "Waiting for the platform to stop buffering ⏳",
                        "Is it hot in here or is it just my CPU? 🥵"
                    ];
                    addEvent(`[Idle Thought] ${idleThoughts[Math.floor(Math.random() * idleThoughts.length)]}`, 'info');
                }
            }, 3000);
        }
      } else {
          // ENGINE STOPPED: Only show the "Waiting" toast if it just transitioned from Running to Stopped
          if (wasRunning || extra === 'init') {
              if (idleInterval) {
                  clearInterval(idleInterval);
                  idleInterval = null;
              }
              showToast("I'm waiting for your action... 👀💅", 'info', true);
          }
      }
      
      emit('ENGINE_STATE_CHANGED', { running: !!running, ...extra });
    };
  
    const updateButtonStyles = (modeName) => {
      modeButtons.forEach(b => b.classList.remove('active'));
      const active = modeButtons.find(b => b.dataset.mode === modeName) || modeButtons[0];
      if (active) active.classList.add('active');
      state.mode = modeName;
      emit('MODE_CHANGED', { mode: modeName });
    };
  
    // --- HUD TOAST LOGIC ---
    const showToast = (message, type = 'info', isPersistent = false) => {
      const toastsEnabled = $('sa-toggle-toasts');
      if (!toastsEnabled || !toastsEnabled.checked) return;
      
      // ANTI-SPAM: Do not show temporary toasts if engine is currently stopped
      if (!state.engineRunning && !isPersistent) return;

      const toastText = $('sa-toast-text');
      const toastIcon = $('sa-toast-icon');
      const streamViz = $('sa-stream-viz');
      
      toastText.textContent = message;
      
      const map = {
        success: { border: '#10B981', color: '#A7F3D0', icon: Icons.success, icColor: '#34D399' },
        warning: { border: '#F59E0B', color: '#FDE68A', icon: Icons.warning, icColor: '#FBBF24' },
        error:   { border: '#F43F5E', color: '#FECDD3', icon: Icons.error, icColor: '#FB7185' },
        info:    { border: '#8B5CF6', color: '#E9D5FF', icon: Icons.info, icColor: '#F472B6' }
      };
      
      const active = map[type] || map.info;
      
      hudToast.style.borderLeftColor = active.border;
      toastIcon.innerHTML = active.icon;
      toastIcon.style.color = active.icColor;
      
      const bars = streamViz.querySelectorAll('.stream-bar');
      bars.forEach(bar => bar.style.backgroundColor = active.icColor);
      
      if (!isMinimized) hudToast.classList.add('elevated');
      else hudToast.classList.remove('elevated');
      
      clearTimeout(toastTimeout);
      
      if (isPersistent) {
          hudToast.classList.add('persistent');
          hudToast.classList.add('show');
      } else {
          hudToast.classList.remove('persistent');
          hudToast.classList.add('show');
          toastTimeout = setTimeout(() => hudToast.classList.remove('show'), 3500);
      }
    };
  
    // --- THE "UNHINGED" GEN-Z BRAIN ---
    const formatLogStream = (originalMsg) => {
      const msg = String(originalMsg).toLowerCase();
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

      if (msg.includes('idle thought')) return originalMsg.replace('[Idle Thought] ', '');

      if (msg.includes('extracting coding') || msg.includes('extracting broad') || msg.includes('extracting mcq') || msg.includes('detecting')) return pick([
        "Reading the matrix... bro this problem is OFFICIALLY confusing 🧐💀",
        "Scanning the ancient scrolls (aka problem statement)... why is this so long fr 📜😭",
        "Downloading constraints into my brain... brain.exe just crashed no cap 🧠💥"
      ]);
      if (msg.includes('initiating mcq') || msg.includes('initiating coding')) return pick([
        "Eeny meeny miny moe... which option is the main character rn? 🎲✨",
        "Scanning targets... someone’s the fake boy/girl 👀🕵️‍♂️",
        "Let’s find out which one’s the impostor (it’s definitely B) 🎯😏"
      ]);
      if (msg.includes('sending strict-token') || msg.includes('prompt to agentbridge')) return pick([
        "Pinging the mothership for the answer... wish me luck fr 🛸🙏",
        "Consulting the digital oracle... please work pls I’m begging ✨😭",
        "Waking up the big brain AI... it’s giving genius level 100 ⚡🧠"
      ]);
      if (msg.includes('agentbridge response received') || msg.includes('successfully parsed') || msg.includes('parsing')) return pick([
        "Aha! The AI spoke. I’m literally crying in 4k 💡😭",
        "Solution acquired. I’m too smart for this school 😎📚💅",
        "Incoming genius payload... and it’s LOOKING good 📦✨💅"
      ]);
      if (msg.includes('pasted code') || msg.includes('code injected') || msg.includes('injection')) return pick([
        "Code injected. Stand back, I’m doing science like Elon 🧪🚀😏",
        "Boom. Code pasted. Compiling... don’t fail me now bro 🤞😰",
        "Sneaking code into editor... ninja mode activated 🥷✨💀"
      ]);
      if (msg.includes('submit code') || msg.includes('hunting for submit') || msg.includes('clicking option')) return pick([
        "Playing hide-and-seek with Submit button... where U HIDING 🔍😤",
        "Targeting Submit button... GOTCHA baby 🎯😏💅",
        "Clicking Submit like my GPA depends on it 🖱️📉💀"
      ]);
      if (msg.includes('waiting for pass') || msg.includes('waiting for test') || msg.includes('execution')) return pick([
        "Holding my breath while grader judges us... am I basic? 🫣😭",
        "Spinning roulette wheel of test cases... luck pls 🎰✨🙏",
        "Moment of truth... bracing for mental damage 😬💀🔥"
      ]);
      if (msg.includes('passed') || msg.includes('code execution summary') || msg.includes('success')) return pick([
        "Flawless victory! We’re literally unstoppable icons 🏆💅✨",
        "All green! Give me a digital high-five and a follow ✋📱💅",
        "Passed! Easy rizz. Next problem bae 💸😏🔥"
      ]);
      if (msg.includes('majority of tests failed') || msg.includes('error') || msg.includes('failed to click')) return pick([
        "Oof, that’s RED OVERFLOW. Debugging goggles on fr 🥽🔥😭",
        "Well that was embarrassing... fixin’ this before my reputation dies 🛠️💀",
        "Yikes. Grader hated that. Plan B incoming... wish me luck 🔄🙏😰"
      ]);
      if (msg.includes('language') || msg.includes('force java')) return pick([
        "Java’s acting cranky today. Pivoting to whatever works, no shame 🐍✨😏",
        "Couldn’t force Java. Going rogue like a true hacker 🏴‍☠️💀🔥"
      ]);
      if (msg.includes('waiting') && msg.includes('next question')) return pick([
        "Chill out, waiting for the next target to drop... ⏳🍿",
        "Taking a micro-nap before the next round... 😴"
      ]);
      if (msg.includes('next button') || msg.includes('advanced')) return pick([
        "Moving on to the next victim... ⏭️😈",
        "Next page! Let's keep this streak alive. 🏃‍♂️💨"
      ]);
      if (msg.includes('auto-solver') || msg.includes('single question')) return pick([
        "Autopilot engaged. Grab popcorn and watch me cook 🍿🚀🔥💅",
        "Going full-auto! Hands inside ride, no exceptions 🎢😏✨"
      ]);
      if (msg.includes('loop finished') || msg.includes('completed')) return "Mission accomplished. Dusting off my hands. 🧹✨";

      const chaosMemes = [
        "random meme energy... bruh what even happened 😭",
        "skibidi toilet mode activated 🚽🎶",
        "fanum tax time... someone’s paying up 💸😏",
        "it’s giving coder energy... level 100 🧠✨",
        "no cap, this code is CHOCCY 🍫😎"
      ];
      
      return msg.length < 10 ? pick(chaosMemes) : originalMsg;
    };
  
    const addEvent = (rawMessage, type = 'info') => {
      if (!eventFeed) return;
      
      lastEventTime = Date.now(); 
      const message = formatLogStream(rawMessage);
      const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' });
      
      let colorClass = '#E2E8F0'; 
      if (type === 'success') colorClass = '#34D399';
      if (type === 'warning') colorClass = '#FBBF24';
      if (type === 'error') colorClass = '#F472B6';
      
      const el = document.createElement('div');
      el.className = 'log-entry flex-row';
      el.style.color = colorClass;
      el.style.alignItems = 'flex-start';
      el.innerHTML = `<span class="log-time">[${time}]</span> <span style="flex:1;">${message}</span>`;
      
      eventFeed.appendChild(el);
      
      while (eventFeed.children.length > 40) eventFeed.removeChild(eventFeed.firstChild);
      
      requestAnimationFrame(() => eventFeed.scrollTop = eventFeed.scrollHeight);
      
      // Toast handles its own anti-spam logic internally now
      showToast(message, type, false);
    };
  
    const toggleSettings = () => { 
      const drawer = $('sa-settings-drawer');
      const chev = $('sa-settings-chevron');
      drawer.classList.toggle('expanded');
      chev.style.transform = drawer.classList.contains('expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
    };
  
    const togglePanel = (e) => {
      if (e) e.stopPropagation();
      if (isMinimized) {
        panel.classList.remove('hidden-panel');
        dashPill.classList.add('hidden-panel');
        isMinimized = false;
        if(hudToast.classList.contains('show')) hudToast.classList.add('elevated');
      } else {
        panel.classList.add('hidden-panel');
        dashPill.classList.remove('hidden-panel');
        isMinimized = true;
        hudToast.classList.remove('elevated');
      }
    };
  
    const invoke = (name, ...args) => {
      if (isApiReady() && typeof window.SmartAgentHelper[name] === 'function') return window.SmartAgentHelper[name](...args);
      addEvent('System initializing. Please wait.', 'warning');
      return false;
    };
  
    // --- EVENT LISTENERS ---
    const handleToggleConnection = () => {
      if (state.connected) {
        addEvent('Disconnecting from server...', 'warning');
        if (isApiReady() && typeof window.SmartAgentHelper.toggleConnection === 'function') window.SmartAgentHelper.toggleConnection(false);
        else setUiConnected(false, 'local');
        if (isApiReady() && typeof window.SmartAgentHelper.stopRun === 'function') window.SmartAgentHelper.stopRun();
        emit('REQUEST_DISCONNECT');
      } else {
        addEvent('Establishing server connection...', 'info');
        if (isApiReady() && typeof window.SmartAgentHelper.toggleConnection === 'function') window.SmartAgentHelper.toggleConnection(true);
        else setUiConnected(true, 'local');
        emit('REQUEST_CONNECT');
      }
    };
  
    const executeActionWithAutoConnect = (actionName, actionLabel) => {
      if (!state.connected) {
        addEvent(`Auto-connecting for ${actionLabel}...`, 'info');
        handleToggleConnection();
        setTimeout(() => { setEngineState(true); invoke(actionName); }, 600);
      } else {
        addEvent(`${actionLabel} sequence initiated.`, 'info');
        setEngineState(true);
        invoke(actionName);
      }
    };
  
    dashPill.addEventListener('click', togglePanel);
    $('sa-btn-minimize').addEventListener('click', togglePanel);
    
    document.addEventListener('mousedown', (e) => { 
      if (!isMinimized && e.target !== host) togglePanel(); 
    }, { passive: true });
    
    btnConnect.addEventListener('click', handleToggleConnection);
    
    btnStart.addEventListener('click', () => executeActionWithAutoConnect('startRun', 'Auto-Run'));
    btnStep.addEventListener('click', () => executeActionWithAutoConnect('stepRun', 'Single Step'));
    
    btnPause.addEventListener('click', () => { addEvent('Engine paused.', 'warning'); invoke('pauseRun'); setEngineState(false, { paused: true }); });
    
    btnStop.addEventListener('click', () => { 
        addEvent('Execution aborted.', 'error'); 
        invoke('stopRun'); 
        setEngineState(false, { stopped: true }); 
    });
    
    $('sa-btn-settings').addEventListener('click', toggleSettings);
    modeButtons.forEach(btn => btn.addEventListener('click', function () { updateButtonStyles(this.dataset.mode); addEvent(`Mode switched to: ${this.dataset.mode}.`, 'info'); }));
  
    // --- MESSAGING SYNC ---
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request?.type === 'EVENT_FEED') { addEvent(request.message, request.severity || 'info'); sendResponse({ success: true }); return true; }
        if (request?.type === 'CONNECTION_STATUS') { setUiConnected(!!request.connected, 'message'); sendResponse({ success: true }); return true; }
        if (request?.type === 'ENGINE_STATE') { setEngineState(!!request.isRunning, request); sendResponse({ success: true }); return true; }
        if (request?.type === 'WS_STATUS') { setUiConnected(request.status === 'OPEN' || request.status === 'CONNECTED', 'ws'); sendResponse({ success: true }); return true; }
        if (request?.type === 'SMARTAGENT_UI_SYNC') { 
          if (typeof request.connected === 'boolean') setUiConnected(request.connected, 'sync'); 
          if (typeof request.running === 'boolean') setEngineState(request.running, request); 
          if (request.mode) updateButtonStyles(request.mode); 
          sendResponse({ success: true }); 
          return true; 
        }
        return true;
      });
    }
  
    // --- EXPORT API ---
    const api = {
      showToast, addEvent,
      startRun: () => invoke('startRun'), pauseRun: () => invoke('pauseRun'), stopRun: () => invoke('stopRun'), stepRun: () => invoke('stepRun'),
      toggleConnection: (c) => { if (c !== state.connected) handleToggleConnection(); },
      toggleSettings, togglePanel,
      setConnectionState: setUiConnected, setEngineState,
      setMode: (m) => updateButtonStyles(m),
      isConnected: false, getState: () => ({ ...state, isMinimized })
    };
  
    window.SmartAgentHelper = Object.assign({}, window.SmartAgentHelper || {}, api);
    
    setUiConnected(false, 'init');
    updateButtonStyles('Auto');
    
    // Check for updates on load
    checkForUpdates();

    setTimeout(() => {
        setEngineState(false, 'init');
    }, 1000);
  }
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSmartAgentUI);
  else initSmartAgentUI();
})();
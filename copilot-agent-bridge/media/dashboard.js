const vscode = acquireVsCodeApi();

let state = {
  status: "stopped",
  requests: 0,
  errors: 0,
  uptime: 0,
  port: 8765,
  model: "gpt-4o",
  history: [],
  models: [],
  agents: [],
  logs: [],
  envBlock: "",
};

const $ = (id) => document.getElementById(id);
const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };

window.addEventListener("message", ({ data: msg }) => {
  console.log("[Dashboard] Received message:", msg.type);
  switch (msg.type) {
    case "init":
    case "update":
      Object.assign(state, msg.data);
      console.log("[Dashboard] State updated, models:", state.models?.length);
      renderAll();
      break;
    case "log":
      state.logs = [...state.logs.slice(-199), msg.entry];
      renderLogs();
      break;
    case "record":
      state.history = [msg.record, ...state.history].slice(0, 50);
      renderHistory();
      renderStats();
      break;
    case "testResult":
      renderTestResult(msg.result, msg.error);
      break;
    case "toast":
      showToast(msg.message, msg.variant ?? "info");
      break;
  }
});

function renderAll() {
  renderStatus();
  renderStats();
  renderConnection();
  renderHistory();
  renderModels();
  renderAgents();
  renderEnv();
  renderLogs();
  updateButtons();
}

function renderStatus() {
  const badge = $("statusBadge");
  if (!badge) return;
  badge.className = `status-badge status-${state.status}`;
  badge.innerHTML = `<span class="status-dot"></span> ${state.status.toUpperCase()}`;
}

function renderStats() {
  setText("statRequests", state.requests);
  setText("statErrors",   state.errors);
  setText("statUptime",   state.uptime > 0 ? `${state.uptime}s` : "—");
  
  // Populate model selector dropdown with ALL available models
  const selector = $("modelSelector");
  if (selector && state.models && state.models.length > 0) {
    // Only rebuild if models changed
    const currentOptions = selector.options.length;
    if (currentOptions !== state.models.length || selector.options[0]?.value === "") {
      selector.innerHTML = state.models.map(m => {
        const modelId = m.id || m.name;
        const modelName = m.name || m.id;
        const isSelected = modelId === state.model;
        return `<option value="${modelId}" ${isSelected ? 'selected' : ''}>${modelName}</option>`;
      }).join("");
    }
    selector.value = state.model;
  }

  const rate = state.requests > 0
    ? ((state.errors / state.requests) * 100).toFixed(1) + "%"
    : "—";
  setText("statErrorRate", rate);

  const lats = state.history.map((r) => r.latency_ms).filter(Boolean);
  const avg = lats.length
    ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) + "ms"
    : "—";
  setText("statAvgLatency", avg);
}

function renderConnection() {
  const url = `http://127.0.0.1:${state.port}`;
  const el = $("connectionUrl");
  if (el) el.textContent = url;
}

function renderHistory() {
  const tbody = $("historyBody");
  if (!tbody) return;

  if (state.history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--vscode-descriptionForeground)">No requests yet</td></tr>`;
    return;
  }

  tbody.innerHTML = state.history.map((r) => {
    const statusClass = r.status < 300 ? "status-ok" : r.status < 500 ? "status-warn" : "status-fail";
    const time = new Date(r.timestamp).toLocaleTimeString();
    return `<tr><td><span class="method-badge method-${r.method}">${r.method}</span></td><td><code>${r.path}</code></td><td class="${statusClass}">${r.status}</td><td>${r.latency_ms}ms</td><td>${r.tokens ?? "—"}</td><td>${r.model ? r.model.split("-").slice(-2).join("-") : "—"}</td><td style="color:var(--vscode-descriptionForeground)">${time}</td></tr>`;
  }).join("");
}

function renderModels() {
  const list = $("modelList");
  if (!list) return;

  console.log("[Dashboard] Rendering models, count:", state.models?.length);
  
  if (!state.models || state.models.length === 0) {
    list.innerHTML = `<div style="color:var(--vscode-descriptionForeground);padding:12px;text-align:center;font-size:0.85rem">
      <div>⏳ Loading models...</div>
      <div style="font-size:0.75rem;margin-top:8px">Make sure Copilot extension is installed and you're signed in</div>
    </div>`;
    return;
  }

  // Show ALL models (no limit)
  list.innerHTML = state.models.map((m, index) => {
    const isDefault = m.id === state.model;
    const modelId = m.id || m.name || `model-${index}`;
    return `<div class="model-item" style="padding:10px 12px;border-bottom:1px solid var(--vscode-input-border);${isDefault ? 'background:var(--vscode-list-activeSelectionBackground);' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--vscode-foreground);font-size:0.9rem">${m.name || m.id}</div>
          <div style="font-size:0.75rem;color:var(--vscode-descriptionForeground);margin-top:2px">
            ${m.vendor || 'copilot'} • ${m.maxTokens ? m.maxTokens.toLocaleString() + ' tokens' : 'unknown tokens'}
          </div>
        </div>
        <div style="flex-shrink:0">
          ${isDefault 
            ? '<span style="background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:4px 10px;border-radius:3px;font-size:0.75rem;font-weight:600">✓ ACTIVE</span>' 
            : `<button class="btn btn-ghost model-select-btn" data-model="${modelId}" style="padding:4px 10px;font-size:0.75rem;border:1px solid var(--vscode-button-border,var(--vscode-input-border))">Select</button>`
          }
        </div>
      </div>
    </div>`;
  }).join("");
  
  // Add total count header
  const header = document.createElement('div');
  header.style.cssText = 'padding:8px 12px;background:var(--vscode-sideBar-background);font-size:0.8rem;color:var(--vscode-descriptionForeground);border-bottom:1px solid var(--vscode-input-border)';
  header.textContent = `${state.models.length} models available`;
  list.insertBefore(header, list.firstChild);
  
  // Attach click handlers to all Select buttons
  list.querySelectorAll('.model-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const model = e.target.getAttribute('data-model');
      console.log("[Dashboard] Select button clicked for model:", model);
      changeModel(model);
    });
  });
}

function renderAgents() {
  const list = $("agentList");
  if (!list) return;

  if (state.agents.length === 0) {
    list.innerHTML = `<div style="color:var(--vscode-descriptionForeground);font-size:0.82rem;padding:8px">No agents connected</div>`;
    return;
  }

  list.innerHTML = state.agents.map((dir) => `<div class="agent-item"><span>📁</span><span class="agent-path" title="${dir}">${dir}</span><button class="btn btn-ghost" onclick="removeAgent('${dir.replace(/'/g, "\\'")}')" style="padding:3px 8px;font-size:0.75rem">✕</button></div>`).join("");
}

function renderEnv() {
  const el = $("envBlock");
  if (el) el.textContent = state.envBlock;
}

function renderLogs() {
  const feed = $("logFeed");
  if (!feed) return;

  const wasBottom = feed.scrollHeight - feed.scrollTop <= feed.clientHeight + 30;

  feed.innerHTML = state.logs.map((e) => {
    const ts = new Date(e.timestamp).toLocaleTimeString();
    return `<div class="log-line"><span class="log-ts">${ts}</span><span class="log-level log-${e.level}">${e.level.toUpperCase()}</span><span class="log-msg">[${e.source}] ${e.message}</span></div>`;
  }).join("");

  if (wasBottom) feed.scrollTop = feed.scrollHeight;
}

function renderTestResult(result, error) {
  const el = $("testResponse");
  if (!el) return;
  $("testBtn").disabled = false;
  $("testBtn").textContent = "▶ Send Test";

  if (error) {
    el.style.color = "var(--vscode-errorForeground)";
    el.textContent = `❌ Error: ${error}`;
  } else {
    el.style.color = "";
    el.textContent = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
    showToast("Test request succeeded!", "success");
  }
}

function updateButtons() {
  const running = state.status === "running";
  const btn = (id, disabled) => { const el = $(id); if (el) el.disabled = disabled; };
  btn("btnStart",   running);
  btn("btnStop",    !running);
  btn("btnRestart", !running);
  btn("testBtn",    !running);
}

function post(command, data = {}) {
  console.log("[Dashboard] Posting command:", command, data);
  vscode.postMessage({ command, ...data });
}

function startServer() {
  console.log("[Dashboard] Start server clicked");
  post("startServer");
  setTimeout(() => post("ready"), 1000);
}

function stopServer() {
  console.log("[Dashboard] Stop server clicked");
  post("stopServer");
  setTimeout(() => post("ready"), 1000);
}

function restartServer() {
  console.log("[Dashboard] Restart server clicked");
  post("restartServer");
  setTimeout(() => post("ready"), 1000);
}

function connectAgent()  {
  console.log("[Dashboard] Connect agent clicked");
  post("connectAgent");
  setTimeout(() => post("ready"), 1000);
}

function removeAgent(dir) {
  console.log("[Dashboard] Remove agent:", dir);
  post("removeAgent", { dir });
  setTimeout(() => post("ready"), 1000);
}

function viewLogs() {
  console.log("[Dashboard] View logs clicked");
  post("viewLogs");
}

function refreshUI() {
  console.log("[Dashboard] Refresh UI clicked");
  post("ready");
}

function changeModel(model) {
  console.log("[Dashboard] Model changed to:", model);
  post("changeModel", { model: model });
}


function copyEnv() {
  const el = $("envBlock");
  if (el) {
    navigator.clipboard.writeText(el.textContent ?? "")
      .then(() => showToast("Copied!", "success"))
      .catch(() => post("copyToClipboard", { text: el.textContent }));
  }
}

function copyUrl() {
  const el = $("connectionUrl");
  if (el) {
    navigator.clipboard.writeText(el.textContent ?? "")
      .then(() => showToast("URL copied!", "success"))
      .catch(() => {});
  }
}

function sendTest() {
  const prompt = $("testPrompt")?.value?.trim();
  if (!prompt) { showToast("Enter a test message", "info"); return; }
  console.log("[Dashboard] Sending test request:", prompt);
  const btn = $("testBtn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Sending…"; }
  const el = $("testResponse");
  if (el) { el.textContent = "Waiting…"; el.style.color = ""; }
  post("sendTestRequest", { prompt });
}

document.addEventListener("keydown", (e) => {
  if (e.target?.id === "testPrompt" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    sendTest();
  }
});

function showToast(message, variant = "info") {
  const area = $("toastArea");
  if (!area) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${variant}`;
  toast.textContent = message;
  area.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

console.log("[Dashboard] Loading, posting ready message");
post("ready");
console.log("[Dashboard] Dashboard initialized");

// ====== ATTACH EVENT LISTENERS TO BUTTONS ======
// This is needed because CSP blocks inline onclick handlers
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Dashboard] DOMContentLoaded - attaching button handlers");
  
  // Server control buttons
  const btnStart = $("btnStart");
  const btnStop = $("btnStop");
  const btnRestart = $("btnRestart");
  const btnRefresh = $("btnRefresh");
  const testBtn = $("testBtn");
  const modelSelector = $("modelSelector");
  const connectAgentBtn = $("connectAgentBtn");
  const viewLogsBtn = $("viewLogsBtn");
  const btnCopyUrl = $("btnCopyUrl");
  const btnCopyEnv = $("btnCopyEnv");
  
  if (btnStart) {
    console.log("[Dashboard] Found btnStart, attaching listener");
    btnStart.addEventListener("click", () => {
      console.log("[Dashboard] btnStart clicked");
      startServer();
    });
  } else {
    console.log("[Dashboard] WARNING: btnStart not found!");
  }
  
  if (btnStop) {
    console.log("[Dashboard] Found btnStop, attaching listener");
    btnStop.addEventListener("click", () => {
      console.log("[Dashboard] btnStop clicked");
      stopServer();
    });
  } else {
    console.log("[Dashboard] WARNING: btnStop not found!");
  }
  
  if (btnRestart) {
    console.log("[Dashboard] Found btnRestart, attaching listener");
    btnRestart.addEventListener("click", () => {
      console.log("[Dashboard] btnRestart clicked");
      restartServer();
    });
  } else {
    console.log("[Dashboard] WARNING: btnRestart not found!");
  }
  
  if (btnRefresh) {
    console.log("[Dashboard] Found btnRefresh, attaching listener");
    btnRefresh.addEventListener("click", () => {
      console.log("[Dashboard] btnRefresh clicked");
      refreshUI();
    });
  } else {
    console.log("[Dashboard] WARNING: btnRefresh not found!");
  }
  
  if (testBtn) {
    console.log("[Dashboard] Found testBtn, attaching listener");
    testBtn.addEventListener("click", () => {
      console.log("[Dashboard] testBtn clicked");
      sendTest();
    });
  } else {
    console.log("[Dashboard] WARNING: testBtn not found!");
  }
  
  if (modelSelector) {
    console.log("[Dashboard] Found modelSelector, attaching listener");
    modelSelector.addEventListener("change", (e) => {
      console.log("[Dashboard] modelSelector changed to:", e.target.value);
      changeModel(e.target.value);
    });
  } else {
    console.log("[Dashboard] WARNING: modelSelector not found!");
  }
  
  if (connectAgentBtn) {
    console.log("[Dashboard] Found connectAgentBtn, attaching listener");
    connectAgentBtn.addEventListener("click", () => {
      console.log("[Dashboard] connectAgentBtn clicked");
      connectAgent();
    });
  } else {
    console.log("[Dashboard] WARNING: connectAgentBtn not found!");
  }
  
  if (viewLogsBtn) {
    console.log("[Dashboard] Found viewLogsBtn, attaching listener");
    viewLogsBtn.addEventListener("click", () => {
      console.log("[Dashboard] viewLogsBtn clicked");
      viewLogs();
    });
  } else {
    console.log("[Dashboard] WARNING: viewLogsBtn not found!");
  }
  
  if (btnCopyUrl) {
    console.log("[Dashboard] Found btnCopyUrl, attaching listener");
    btnCopyUrl.addEventListener("click", () => {
      console.log("[Dashboard] btnCopyUrl clicked");
      copyUrl();
    });
  } else {
    console.log("[Dashboard] WARNING: btnCopyUrl not found!");
  }
  
  if (btnCopyEnv) {
    console.log("[Dashboard] Found btnCopyEnv, attaching listener");
    btnCopyEnv.addEventListener("click", () => {
      console.log("[Dashboard] btnCopyEnv clicked");
      copyEnv();
    });
  } else {
    console.log("[Dashboard] WARNING: btnCopyEnv not found!");
  }
  
  console.log("[Dashboard] All button handlers attached successfully!");
});

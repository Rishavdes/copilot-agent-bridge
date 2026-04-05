import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { BridgeServer } from "../server/bridgeServer";
import { logger, LogEntry } from "../utils/logger";
import { config } from "../utils/config";
import { RequestRecord } from "../server/requestHandler";

export class DashboardPanel {
  private static instance: DashboardPanel | null = null;
  private panel: vscode.WebviewPanel | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor(
    private server: BridgeServer,
    private context: vscode.ExtensionContext
  ) {
    logger.onEntry((e) => this.postMessage({ type: "log", entry: this.serializeLog(e) }));
    server.handler.onRecord((r) => this.postMessage({ type: "record", record: this.serializeRecord(r) }));
  }

  static show(server: BridgeServer, context: vscode.ExtensionContext): void {
    if (!DashboardPanel.instance) {
      DashboardPanel.instance = new DashboardPanel(server, context);
    }
    DashboardPanel.instance.open();
  }

  private open(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "copilot-bridge-dashboard",
      "Copilot Bridge Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "media"),
        ],
        retainContextWhenHidden: true,
      }
    );

    this.panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri, "assets", "icon.png"
    );

    this.panel.webview.html = this.buildHTML();
    this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.panel.onDidDispose(() => { 
      this.panel = null;
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    });

    this.push();
    
    // Update dashboard every 500ms for live stats
    this.updateInterval = setInterval(() => {
      if (this.panel) {
        this.push();
      }
    }, 500);
  }

  push(): void {
    const info = this.server.getInfo();
    const models = this.server.registry.getAll();
    
    this.postMessage({
      type: "update",
      data: {
        status:   info.status,
        requests: this.server.handler.getTotalRequests(),
        errors:   this.server.handler.getTotalErrors(),
        uptime:   info.uptime,
        port:     config.port,
        model:    config.defaultModel,
        history:  this.server.handler.getHistory()
          .slice(-50).reverse().map(this.serializeRecord),
        models:   models,
        agents:   config.agentDirs,
        logs:     logger.getEntries(80).map(this.serializeLog),
        envBlock: config.generateEnvBlock(),
      },
    });
  }

  private postMessage(msg: object): void {
    this.panel?.webview.postMessage(msg);
  }

  private async handleMessage(msg: { command: string; [k: string]: any }): Promise<void> {
    try {
      switch (msg.command) {
        case "ready":
          this.push();
          break;

        case "startServer":
          await vscode.commands.executeCommand("copilot-bridge.startServer");
          setTimeout(() => this.push(), 500);
          break;

        case "stopServer":
          await vscode.commands.executeCommand("copilot-bridge.stopServer");
          setTimeout(() => this.push(), 500);
          break;

        case "restartServer":
          await vscode.commands.executeCommand("copilot-bridge.restartServer");
          setTimeout(() => this.push(), 500);
          break;

        case "connectAgent":
          await vscode.commands.executeCommand("copilot-bridge.connectAgent");
          setTimeout(() => this.push(), 500);
          break;

        case "removeAgent":
          await config.removeAgentDir(msg.dir);
          this.push();
          this.postMessage({ type: "toast", message: "Agent removed", variant: "info" });
          break;

        case "viewLogs":
          await vscode.commands.executeCommand("copilot-bridge.viewLogs");
          break;

        case "copyToClipboard":
          await vscode.env.clipboard.writeText(msg.text ?? "");
          this.postMessage({ type: "toast", message: "Copied!", variant: "success" });
          break;

        case "changeModel":
          await config.setDefaultModel(msg.model);
          logger.info("DashboardPanel", `Model changed to: ${msg.model}`);
          this.postMessage({ type: "toast", message: `Model changed to ${msg.model}`, variant: "success" });
          setTimeout(() => this.push(), 200);
          break;

        case "sendTestRequest":
          await this.handleTestRequest(msg.prompt);
          break;
      }
    } catch (err: any) {
      logger.error("DashboardPanel", `Message handler error: ${err?.message}`);
    }
  }

  private async handleTestRequest(prompt: string): Promise<void> {
    try {
      const { CopilotClient } = await import("../copilot/copilotClient");
      const { ModelRegistry } = await import("../copilot/modelRegistry");
      const reg = new ModelRegistry();
      await reg.refresh(config.defaultModel);
      const client = new CopilotClient(reg);
      const res = await client.chat({ message: prompt });
      this.postMessage({ type: "testResult", result: res });
    } catch (err: any) {
      this.postMessage({ type: "testResult", result: null, error: err?.message ?? String(err) });
    }
  }

  private buildHTML(): string {
    const webview = this.panel!.webview;
    const mediaUri = (file: string) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, "media", file)
      );

    const cssUri = mediaUri("dashboard.css");
    const jsUri  = mediaUri("dashboard.js");
    const nonce  = crypto.randomUUID().replace(/-/g, "");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${cssUri}">
  <title>Copilot Bridge Dashboard</title>
</head>
<body>
<div class="header">
  <span class="header-icon">🤖</span>
  <div>
    <h1>Copilot Agent Bridge</h1>
    <p>Local HTTP bridge connecting your Python agent to GitHub Copilot</p>
  </div>
  <div class="header-actions">
    <span id="statusBadge" class="status-badge status-stopped"><span class="status-dot"></span> STOPPED</span>
    <button class="btn btn-primary" id="btnStart">▶ Start</button>
    <button class="btn btn-secondary" id="btnStop" disabled>■ Stop</button>
    <button class="btn btn-ghost" id="btnRestart" disabled>↺ Restart</button>
    <button class="btn btn-ghost" id="btnRefresh">🔄 Refresh</button>
  </div>
</div>

<div class="grid" style="grid-template-columns:repeat(6,1fr)">
  <div class="card stat-card">
    <div class="card-title">📨 Requests</div>
    <div class="stat-value" id="statRequests">0</div>
    <div class="stat-sub">total</div>
  </div>
  <div class="card stat-card">
    <div class="card-title">❌ Errors</div>
    <div class="stat-value" id="statErrors">0</div>
    <div class="stat-sub" id="statErrorRate">—</div>
  </div>
  <div class="card stat-card">
    <div class="card-title">⏱ Avg Latency</div>
    <div class="stat-value" id="statAvgLatency">—</div>
    <div class="stat-sub">per request</div>
  </div>
  <div class="card stat-card">
    <div class="card-title">⏰ Uptime</div>
    <div class="stat-value" id="statUptime">—</div>
    <div class="stat-sub">seconds</div>
  </div>
  <div class="card stat-card" style="grid-column:span 2">
    <div class="card-title">✦ Active Model</div>
    <select id="modelSelector" style="width:100%;padding:8px;background:var(--vscode-input-background);color:var(--vscode-foreground);border:1px solid var(--vscode-input-border);border-radius:4px;font-size:0.9rem">
      <option value="">Loading models...</option>
    </select>
    <div class="stat-sub">select to change active model</div>
  </div>
</div>

<div class="grid grid-2">
  <div>
    <div class="section">
      <div class="section-header"><span>🔗</span><span class="section-title">Bridge Connection</span></div>
      <div class="card">
        <div class="card-title">ENDPOINT URL</div>
        <div class="connection-url">
          <code id="connectionUrl">http://127.0.0.1:8765</code>
          <button class="btn btn-ghost" id="btnCopyUrl" style="padding:3px 8px">Copy</button>
        </div>
        <div class="card-title" style="margin-top:12px">PYTHON .env CONFIG</div>
        <div class="env-block">
          <button class="btn btn-ghost copy-btn" id="btnCopyEnv">📋 Copy</button>
          <pre id="envBlock"># loading…</pre>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><span>🧪</span><span class="section-title">Test Console</span><div class="section-actions"><span style="font-size:0.72rem;color:var(--vscode-descriptionForeground)">Ctrl+Enter to send</span></div></div>
      <div class="card test-area">
        <textarea id="testPrompt" placeholder="Type a test message…" rows="3"></textarea>
        <button class="btn btn-primary" id="testBtn" style="margin-top:8px" disabled>▶ Send Test</button>
        <div class="test-response" id="testResponse" style="color:var(--vscode-descriptionForeground)">Start the bridge, then send a test message…</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><span>🐍</span><span class="section-title">Connected Python Agents</span><div class="section-actions"><button class="btn btn-secondary" id="connectAgentBtn" style="font-size:0.78rem">+ Connect Directory</button></div></div>
      <div class="card">
        <div id="agentList"></div>
      </div>
    </div>
  </div>

  <div>
    <div class="section">
      <div class="section-header"><span>📊</span><span class="section-title">Request History</span></div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Tokens</th>
              <th>Model</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody id="historyBody">
            <tr><td colspan="7" style="text-align:center;padding:20px;color:var(--vscode-descriptionForeground)">No requests yet</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><span>✨</span><span class="section-title">Available Copilot Models</span></div>
      <div class="card">
        <div class="model-list" id="modelList">
          <div style="color:var(--vscode-descriptionForeground);font-size:0.82rem">Loading models…</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header"><span>📜</span><span class="section-title">Live Log Feed</span><div class="section-actions"><button class="btn btn-ghost" id="viewLogsBtn" style="font-size:0.75rem">Open Full Logs</button></div></div>
      <div class="log-feed" id="logFeed">
        <div style="color:#666;font-size:0.75rem">Waiting for log entries…</div>
      </div>
    </div>
  </div>
</div>

<div class="toast-area" id="toastArea"></div>

<script nonce="${nonce}" src="${jsUri}"><\/script>
</body>
</html>`;
  }

  private serializeLog(e: LogEntry): object {
    return { ...e, timestamp: e.timestamp.toISOString() };
  }

  private serializeRecord(r: RequestRecord): object {
    return { ...r, timestamp: r.timestamp.toISOString() };
  }
}

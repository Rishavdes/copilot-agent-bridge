import * as vscode from "vscode";
import { BridgeServer } from "./server/bridgeServer";
import { StatusBarManager } from "./ui/statusBar";
import { ServerViewProvider, AgentViewProvider, StatsViewProvider, ModelsViewProvider } from "./ui/sidebarProvider";
import { DashboardPanel } from "./ui/dashboardPanel";
import { logger } from "./utils/logger";
import { config } from "./utils/config";

let server: BridgeServer;
let statusBar: StatusBarManager;
let serverView: ServerViewProvider;
let agentView: AgentViewProvider;
let statsView: StatsViewProvider;
let modelsView: ModelsViewProvider;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const channel = vscode.window.createOutputChannel("Copilot Bridge", { log: true });
  context.subscriptions.push(channel);
  logger.init(channel as any);
  logger.info("Extension", "Copilot Agent Bridge activating…");

  server    = new BridgeServer();
  statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  serverView = new ServerViewProvider(server);
  agentView  = new AgentViewProvider();
  statsView  = new StatsViewProvider(server);
  modelsView = new ModelsViewProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("copilot-bridge.serverView", serverView),
    vscode.window.registerTreeDataProvider("copilot-bridge.agentView",  agentView),
    vscode.window.registerTreeDataProvider("copilot-bridge.statsView",  statsView),
    vscode.window.registerTreeDataProvider("copilot-bridge.modelsView", modelsView)
  );

  server.onStatusChange((s: any) => {
    statusBar.update(s, server.handler.getTotalRequests());
    serverView.refresh();
    statsView.refresh();
  });

  const register = (id: string, fn: () => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  register("copilot-bridge.startServer", async () => {
    try {
      await server.start();
      vscode.window.showInformationMessage(`✅ Copilot Bridge running at ${config.baseUrl}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`❌ Bridge start failed: ${err.message}`);
    }
  });

  register("copilot-bridge.stopServer", async () => {
    await server.stop();
    vscode.window.showInformationMessage("Copilot Bridge stopped");
  });

  register("copilot-bridge.restartServer", async () => {
    vscode.window.showInformationMessage("Restarting Copilot Bridge…");
    await server.restart();
    vscode.window.showInformationMessage(`✅ Copilot Bridge restarted at ${config.baseUrl}`);
  });

  register("copilot-bridge.openDashboard", () => {
    DashboardPanel.show(server, context);
  });

  register("copilot-bridge.connectAgent", async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "Select Agent Directory",
      title: "Connect Python Agent Directory",
    });
    if (!uris?.length) return;

    const dir = uris[0].fsPath;
    await config.addAgentDir(dir);
    agentView.refresh();
    serverView.refresh();

    const action = await vscode.window.showInformationMessage(
      `✅ Agent directory connected: ${dir}`,
      "Copy .env Config",
      "Open Dashboard"
    );
    if (action === "Copy .env Config") {
      await vscode.env.clipboard.writeText(config.generateEnvBlock());
      vscode.window.showInformationMessage("Config copied to clipboard! Paste into your .env file.");
    }
    if (action === "Open Dashboard") {
      DashboardPanel.show(server, context);
    }
  });

  register("copilot-bridge.testConnection", async () => {
    if (!server.isRunning()) {
      vscode.window.showWarningMessage("Start the bridge first.");
      return;
    }
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Testing Copilot Bridge…" },
      async () => {
        try {
          const { CopilotClient } = await import("./copilot/copilotClient");
          const { ModelRegistry } = await import("./copilot/modelRegistry");
          const reg = new ModelRegistry();
          await reg.refresh(config.defaultModel);
          const client = new CopilotClient(reg);
          const res = await client.chat({ message: "Reply with exactly: BRIDGE_OK" });
          return { ok: true, content: res.content, model: res.model };
        } catch (err: any) {
          return { ok: false, error: err.message };
        }
      }
    );

    if (result.ok) {
      vscode.window.showInformationMessage(
        `✅ Bridge OK! Model: ${result.model} | Response: "${result.content?.slice(0, 60) ?? '(no response)'}"`
      );
    } else {
      vscode.window.showErrorMessage(`❌ Bridge test failed: ${result.error}`);
    }
  });

  register("copilot-bridge.copyEnvConfig", async () => {
    await vscode.env.clipboard.writeText(config.generateEnvBlock());
    vscode.window.showInformationMessage("✅ .env config copied! Paste it into your Python agent's .env file.");
  });

  register("copilot-bridge.viewLogs", () => {
    channel.show(true);
  });

  register("copilot-bridge.clearLogs", () => {
    logger.clear();
    vscode.window.showInformationMessage("Logs cleared");
  });

  register("copilot-bridge.refreshSidebar", () => {
    serverView.refresh();
    agentView.refresh();
    statsView.refresh();
  });

  if (config.autoStart) {
    try {
      await server.start();
      logger.info("Extension", "Auto-started successfully");
    } catch (err: any) {
      logger.error("Extension", `Auto-start failed: ${err.message}`);
      vscode.window.showWarningMessage(
        `Copilot Bridge auto-start failed: ${err.message}`,
        "Retry"
      ).then((choice) => {
        if (choice === "Retry") {
          vscode.commands.executeCommand("copilot-bridge.startServer");
        }
      });
    }
  }

  logger.info("Extension", "Copilot Agent Bridge activated ✅");
}

export async function deactivate(): Promise<void> {
  logger.info("Extension", "Deactivating…");
  await server?.stop();
}

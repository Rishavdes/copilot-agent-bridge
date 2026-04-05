import * as vscode from "vscode";
import { ServerStatus } from "../server/bridgeServer";
import { config } from "../utils/config";

// ─────────────────────────────────────────────────────────────
// Animated status bar item (bottom-left)
// ─────────────────────────────────────────────────────────────
export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private spinTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      1000
    );
    this.item.command = "copilot-bridge.openDashboard";
    this.item.show();
    this.render("stopped");
  }

  update(status: ServerStatus, requestCount = 0): void {
    this.stopSpin();
    this.render(status, requestCount);
  }

  private render(status: ServerStatus, requests = 0): void {
    const map: Record<ServerStatus, { icon: string; color: string; tooltip: string }> = {
      stopped:  { icon: "$(circle-slash)",      color: "statusBarItem.warningBackground", tooltip: "Bridge stopped — click to open dashboard" },
      starting: { icon: "$(loading~spin)",       color: "statusBarItem.prominentBackground", tooltip: "Bridge starting…" },
      running:  { icon: "$(radio-tower)",        color: "statusBarItem.prominentBackground", tooltip: `Bridge running on :${config.port} | ${requests} requests` },
      error:    { icon: "$(error)",              color: "statusBarItem.errorBackground",    tooltip: "Bridge error — click to open dashboard" },
    };

    const m = map[status];
    this.item.text = `${m.icon} Copilot Bridge${status === "running" ? ` :${config.port}` : ""}`;
    this.item.backgroundColor = new vscode.ThemeColor(m.color);
    this.item.tooltip = m.tooltip;
  }

  private stopSpin(): void {
    if (this.spinTimer) { clearInterval(this.spinTimer); this.spinTimer = null; }
  }

  dispose(): void {
    this.stopSpin();
    this.item.dispose();
  }
}

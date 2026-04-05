import * as vscode from "vscode";
import * as path from "path";
import { BridgeServer } from "../server/bridgeServer";
import { ModelRegistry } from "../copilot/modelRegistry";
import { config } from "../utils/config";

// ─────────────────────────────────────────────────────────────
// Tree data provider — fills the activity-bar sidebar views
// ─────────────────────────────────────────────────────────────

class TreeNode extends vscode.TreeItem {
  constructor(
    label: string,
    collapsible: vscode.TreeItemCollapsibleState,
    opts: Partial<vscode.TreeItem> = {}
  ) {
    super(label, collapsible);
    Object.assign(this, opts);
  }
}

// ── Server view ──────────────────────────────────────────────
export class ServerViewProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private server: BridgeServer) {
    server.onStatusChange(() => this._onDidChange.fire());
  }

  refresh(): void { this._onDidChange.fire(); }

  getTreeItem(el: TreeNode): TreeNode { return el; }

  getChildren(): TreeNode[] {
    const info = this.server.getInfo();
    const statusIcon: Record<string, string> = {
      running: "$(pass-filled)",
      stopped: "$(circle-slash)",
      starting: "$(sync~spin)",
      error: "$(error)",
    };

    return [
      new TreeNode("Status", vscode.TreeItemCollapsibleState.None, {
        description: info.status.toUpperCase(),
        iconPath: new vscode.ThemeIcon(statusIcon[info.status]?.slice(2, -1) ?? "question"),
      }),
      new TreeNode("URL", vscode.TreeItemCollapsibleState.None, {
        description: info.status === "running" ? config.baseUrl : "—",
        iconPath: new vscode.ThemeIcon("link"),
        command: info.status === "running" ? {
          command: "copilot-bridge.copyEnvConfig",
          title: "Copy URL",
          arguments: [],
        } : undefined,
      }),
      new TreeNode("Model", vscode.TreeItemCollapsibleState.None, {
        description: config.defaultModel,
        iconPath: new vscode.ThemeIcon("sparkle"),
      }),
      new TreeNode("Requests", vscode.TreeItemCollapsibleState.None, {
        description: String(this.server.handler.getTotalRequests()),
        iconPath: new vscode.ThemeIcon("graph"),
      }),
      new TreeNode("Errors", vscode.TreeItemCollapsibleState.None, {
        description: String(this.server.handler.getTotalErrors()),
        iconPath: new vscode.ThemeIcon("warning"),
      }),
      new TreeNode("Uptime", vscode.TreeItemCollapsibleState.None, {
        description: info.uptime > 0 ? `${info.uptime}s` : "—",
        iconPath: new vscode.ThemeIcon("clock"),
      }),
      ...(info.lastError
        ? [new TreeNode("Last Error", vscode.TreeItemCollapsibleState.None, {
            description: info.lastError.slice(0, 60),
            iconPath: new vscode.ThemeIcon("error"),
            tooltip: info.lastError,
          })]
        : []),
    ];
  }
}

// ── Agent view ───────────────────────────────────────────────
export class AgentViewProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void { this._onDidChange.fire(); }
  getTreeItem(el: TreeNode): TreeNode { return el; }

  getChildren(): TreeNode[] {
    const dirs = config.agentDirs;
    if (dirs.length === 0) {
      return [
        new TreeNode(
          "No agents connected",
          vscode.TreeItemCollapsibleState.None,
          {
            description: "Click + to add agent directory",
            iconPath: new vscode.ThemeIcon("info"),
            command: {
              command: "copilot-bridge.connectAgent",
              title: "Connect Agent",
            },
          }
        ),
      ];
    }

    return dirs.map(
      (d) =>
        new TreeNode(
          path.basename(d),
          vscode.TreeItemCollapsibleState.None,
          {
            description: d,
            iconPath: new vscode.ThemeIcon("folder"),
            tooltip: d,
            contextValue: "agentDir",
            command: {
              command: "vscode.openFolder",
              title: "Open Folder",
              arguments: [vscode.Uri.file(d), { forceNewWindow: false }],
            },
          }
        )
    );
  }
}

// ── Stats view ───────────────────────────────────────────────
export class StatsViewProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private server: BridgeServer) {
    setInterval(() => this._onDidChange.fire(), 5000);
  }

  refresh(): void { this._onDidChange.fire(); }
  getTreeItem(el: TreeNode): TreeNode { return el; }

  getChildren(): TreeNode[] {
    const hist = this.server.handler.getHistory().slice(-10).reverse();
    if (hist.length === 0) {
      return [new TreeNode("No requests yet", vscode.TreeItemCollapsibleState.None, {
        iconPath: new vscode.ThemeIcon("history"),
      })];
    }

    return hist.map((r) => {
      const statusIcon = r.status < 300 ? "pass" : r.status < 500 ? "warning" : "error";
      return new TreeNode(
        `${r.method} ${r.path}`,
        vscode.TreeItemCollapsibleState.None,
        {
          description: `${r.status} · ${r.latency_ms}ms${r.tokens ? ` · ~${r.tokens}t` : ""}`,
          iconPath: new vscode.ThemeIcon(statusIcon),
          tooltip: [
            `ID: ${r.id}`,
            `Time: ${r.timestamp.toLocaleTimeString()}`,
            `Status: ${r.status}`,
            `Latency: ${r.latency_ms}ms`,
            r.model ? `Model: ${r.model}` : "",
            r.tokens ? `Tokens: ${r.tokens}` : "",
            r.error ? `Error: ${r.error}` : "",
          ].filter(Boolean).join("\n"),
        }
      );
    });
  }
}

// ── Models view ──────────────────────────────────────────────
export class ModelsViewProvider
  implements vscode.TreeDataProvider<TreeNode>
{
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private registry: ModelRegistry;
  private initialized = false;

  constructor() {
    this.registry = new ModelRegistry();
    this.initialize();
  }

  private initialize(): void {
    if (!this.initialized) {
      this.initialized = true;
      this.registry.refresh(config.defaultModel).then(() => {
        this._onDidChange.fire();
      });
    }
  }

  refresh(): void {
    this.registry.refresh(config.defaultModel).then(() => {
      this._onDidChange.fire();
    });
  }

  getTreeItem(el: TreeNode): TreeNode { return el; }

  getChildren(): TreeNode[] {
    const models = this.registry.getAll();
    
    // If no models loaded yet, try to load them
    if (models.length === 0 && !this.initialized) {
      this.initialize();
      return [
        new TreeNode(
          "Loading models…",
          vscode.TreeItemCollapsibleState.None,
          {
            iconPath: new vscode.ThemeIcon("loading~spin"),
          }
        ),
      ];
    }

    if (models.length === 0) {
      return [
        new TreeNode(
          "No models available",
          vscode.TreeItemCollapsibleState.None,
          {
            description: "Sign in to GitHub Copilot",
            iconPath: new vscode.ThemeIcon("warning"),
          }
        ),
      ];
    }

    return models.map(
      (m: any) =>
        new TreeNode(
          m.name,
          vscode.TreeItemCollapsibleState.None,
          {
            description: m.isDefault ? "● Default" : m.family,
            iconPath: new vscode.ThemeIcon("sparkle"),
            tooltip: [
              `ID: ${m.id}`,
              `Vendor: ${m.vendor}`,
              `Family: ${m.family}`,
              m.maxTokens ? `Max tokens: ${m.maxTokens}` : "Max tokens: unknown",
            ].join("\n"),
          }
        )
    );
  }
}


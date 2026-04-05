import * as vscode from "vscode";

// ─────────────────────────────────────────────────────────────
// Typed config accessor — reads VS Code workspace settings
// ─────────────────────────────────────────────────────────────
export class BridgeConfig {
  private get cfg() {
    return vscode.workspace.getConfiguration("copilotBridge");
  }

  get port(): number           { return this.cfg.get<number>("port", 8765); }
  get host(): string           { return this.cfg.get<string>("host", "127.0.0.1"); }
  get autoStart(): boolean     { return this.cfg.get<boolean>("autoStart", true); }
  get authToken(): string      { return this.cfg.get<string>("authToken", ""); }
  get defaultModel(): string   { return this.cfg.get<string>("defaultModel", "gpt-4o"); }
  get logLevel(): string       { return this.cfg.get<string>("logLevel", "info"); }
  get maxHistory(): number     { return this.cfg.get<number>("maxRequestHistory", 100); }
  get timeout(): number        { return this.cfg.get<number>("requestTimeout", 90); }
  get agentDirs(): string[]    { return this.cfg.get<string[]>("agentDirectories", []); }

  get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  async addAgentDir(dir: string): Promise<void> {
    const dirs = [...new Set([...this.agentDirs, dir])];
    await this.cfg.update(
      "agentDirectories",
      dirs,
      vscode.ConfigurationTarget.Global
    );
  }

  async removeAgentDir(dir: string): Promise<void> {
    const dirs = this.agentDirs.filter((d) => d !== dir);
    await this.cfg.update(
      "agentDirectories",
      dirs,
      vscode.ConfigurationTarget.Global
    );
  }

  async setDefaultModel(model: string): Promise<void> {
    await this.cfg.update(
      "defaultModel",
      model,
      vscode.ConfigurationTarget.Global
    );
  }

  generateEnvBlock(): string {
    const token = this.authToken
      ? this.authToken
      : "# no token configured";
    return [
      "# ── Copilot Agent Bridge ────────────────────────────────",
      `DEFAULT_LLM_PROVIDER=copilot`,
      `COPILOT_BRIDGE_URL=http://${this.host}:${this.port}`,
      `COPILOT_BRIDGE_TOKEN=${token}`,
      `COPILOT_DEFAULT_MODEL=${this.defaultModel}`,
      `COPILOT_TIMEOUT=${this.timeout}`,
      `COPILOT_MAX_RETRIES=3`,
      `COPILOT_RETRY_DELAY=1.0`,
    ].join("\n");
  }
}

export const config = new BridgeConfig();

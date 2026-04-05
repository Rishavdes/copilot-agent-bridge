import * as vscode from "vscode";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Singleton logger with VS Code output channel + in-memory ring
// ─────────────────────────────────────────────────────────────
class Logger {
  private channel: vscode.OutputChannel | null = null;
  private entries: LogEntry[] = [];
  private readonly maxEntries = 500;
  private onEntryCallbacks: Array<(e: LogEntry) => void> = [];

  init(channel: vscode.OutputChannel): void {
    this.channel = channel;
  }

  onEntry(cb: (e: LogEntry) => void): void {
    this.onEntryCallbacks.push(cb);
  }

  private getConfigLevel(): LogLevel {
    return (
      vscode.workspace
        .getConfiguration("copilotBridge")
        .get<LogLevel>("logLevel") ?? "info"
    );
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ["debug", "info", "warn", "error"];
    return order.indexOf(level) >= order.indexOf(this.getConfigLevel());
  }

  private write(level: LogLevel, source: string, message: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = { timestamp: new Date(), level, source, message };

    // Ring buffer
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // VS Code output channel
    const prefix = `[${entry.timestamp.toISOString()}] [${level.toUpperCase().padEnd(5)}] [${source}]`;
    this.channel?.appendLine(`${prefix} ${message}`);

    // Notify listeners (dashboard live feed)
    this.onEntryCallbacks.forEach((cb) => cb(entry));
  }

  debug(source: string, msg: string): void { this.write("debug", source, msg); }
  info(source: string, msg: string): void  { this.write("info", source, msg); }
  warn(source: string, msg: string): void  { this.write("warn", source, msg); }
  error(source: string, msg: string): void { this.write("error", source, msg); }

  getEntries(limit = 100): LogEntry[] {
    return this.entries.slice(-limit);
  }

  clear(): void {
    this.entries = [];
    this.channel?.clear();
  }
}

export const logger = new Logger();

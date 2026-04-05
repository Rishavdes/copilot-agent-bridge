import * as http from "http";
import { RequestHandler } from "./requestHandler";
import { ModelRegistry } from "../copilot/modelRegistry";
import { config } from "../utils/config";
import { logger } from "../utils/logger";

export type ServerStatus = "stopped" | "starting" | "running" | "error";

export interface ServerInfo {
  status: ServerStatus;
  port: number;
  host: string;
  startedAt: Date | null;
  uptime: number;
  lastError: string | null;
}

// ─────────────────────────────────────────────────────────────
// HTTP server lifecycle manager
// ─────────────────────────────────────────────────────────────
export class BridgeServer {
  private server: http.Server | null = null;
  private status: ServerStatus = "stopped";
  private startedAt: Date | null = null;
  private lastError: string | null = null;
  private statusCallbacks: Array<(s: ServerStatus) => void> = [];

  readonly handler: RequestHandler;
  readonly registry: ModelRegistry;

  constructor() {
    this.registry = new ModelRegistry();
    this.handler = new RequestHandler(this.registry);
  }

  onStatusChange(cb: (s: ServerStatus) => void): void {
    this.statusCallbacks.push(cb);
  }

  private emit(s: ServerStatus): void {
    this.status = s;
    this.statusCallbacks.forEach((cb) => cb(s));
  }

  getInfo(): ServerInfo {
    return {
      status: this.status,
      port: config.port,
      host: config.host,
      startedAt: this.startedAt,
      uptime: this.startedAt
        ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
        : 0,
      lastError: this.lastError,
    };
  }

  async start(): Promise<void> {
    if (this.server) {
      logger.warn("BridgeServer", "Already running");
      return;
    }

    this.emit("starting");
    logger.info("BridgeServer", `Starting on ${config.host}:${config.port}`);

    // Warm up model registry
    await this.registry.refresh(config.defaultModel);

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handler.handle(req, res).catch((err) => {
          logger.error("BridgeServer", `Unhandled: ${err}`);
        });
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        this.lastError = err.message;
        this.emit("error");
        logger.error("BridgeServer", `Server error: ${err.message}`);

        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `Port ${config.port} is already in use. ` +
              `Change copilotBridge.port in settings.`
            )
          );
        } else {
          reject(err);
        }
      });

      this.server.listen(config.port, config.host, () => {
        this.startedAt = new Date();
        this.lastError = null;
        this.emit("running");
        logger.info(
          "BridgeServer",
          `✅ Bridge running at http://${config.host}:${config.port}`
        );
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) { resolve(); return; }
      this.server.close(() => {
        this.server = null;
        this.startedAt = null;
        this.emit("stopped");
        logger.info("BridgeServer", "Server stopped");
        resolve();
      });
    });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  isRunning(): boolean { return this.status === "running"; }
}

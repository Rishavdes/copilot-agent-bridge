import * as http from "http";
import { CopilotClient, ChatRequest } from "../copilot/copilotClient";
import { ModelRegistry } from "../copilot/modelRegistry";
import { config } from "../utils/config";
import { logger } from "../utils/logger";

export interface RequestRecord {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  status: number;
  latency_ms: number;
  model?: string;
  tokens?: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Route handler — pure HTTP logic, no Express needed
// ─────────────────────────────────────────────────────────────
export class RequestHandler {
  private client: CopilotClient;
  private history: RequestRecord[] = [];
  private totalRequests = 0;
  private totalErrors = 0;
  private onRecordCallbacks: Array<(r: RequestRecord) => void> = [];

  constructor(private registry: ModelRegistry) {
    this.client = new CopilotClient(registry);
  }

  onRecord(cb: (r: RequestRecord) => void): void {
    this.onRecordCallbacks.push(cb);
  }

  getHistory(): RequestRecord[] { return [...this.history]; }
  getTotalRequests(): number    { return this.totalRequests; }
  getTotalErrors(): number      { return this.totalErrors; }

  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const t0 = Date.now();
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const path = url.pathname;

    // ── CORS ───────────────────────────────────────────────
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (method === "OPTIONS") {
      res.writeHead(204); res.end(); return;
    }

    // ── Auth ───────────────────────────────────────────────
    if (!this.checkAuth(req)) {
      this.respond(res, 401, { error: "Unauthorized", code: "UNAUTHORIZED" });
      this.record({ method, path, status: 401, latency_ms: Date.now() - t0 });
      return;
    }

    this.totalRequests++;
    let status = 200;
    let record: Partial<RequestRecord> = { method, path };

    try {
      // ── Root route - Welcome page ────────────────────────
      if (method === "GET" && (path === "/" || path === "")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(200);
        res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Copilot Agent Bridge</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
    h1 { color: #4fc3f7; }
    .status { background: #2d2d2d; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .ok { color: #4caf50; }
    .endpoint { background: #3d3d3d; padding: 10px; margin: 5px 0; border-radius: 4px; font-family: monospace; }
    a { color: #4fc3f7; }
    code { background: #3d3d3d; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>🤖 Copilot Agent Bridge</h1>
  <div class="status">
    <p><strong>Status:</strong> <span class="ok">✅ Running</span></p>
    <p><strong>Port:</strong> ${config.port}</p>
    <p><strong>Model:</strong> ${config.defaultModel}</p>
    <p><strong>Requests:</strong> ${this.totalRequests}</p>
  </div>
  <h2>📡 Available Endpoints</h2>
  <div class="endpoint">GET <a href="/health">/health</a> - Health check</div>
  <div class="endpoint">GET <a href="/status">/status</a> - Server status</div>
  <div class="endpoint">GET <a href="/models">/models</a> - List available models</div>
  <div class="endpoint">POST /chat - Send chat request</div>
  <h2>🧪 Quick Test</h2>
  <p>Send a chat request:</p>
  <pre style="background:#3d3d3d;padding:15px;border-radius:4px;overflow-x:auto">curl -X POST http://127.0.0.1:${config.port}/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!"}'</pre>
  <h2>📚 Python Usage</h2>
  <pre style="background:#3d3d3d;padding:15px;border-radius:4px;overflow-x:auto">import requests

response = requests.post(
    "http://127.0.0.1:${config.port}/chat",
    json={"message": "Hello from Python!"}
)
print(response.json())</pre>
</body>
</html>`);
        return;
      }

      if (method === "GET" && path === "/health") {
        this.respond(res, 200, {
          status: "ok",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        });

      } else if (method === "GET" && path === "/status") {
        this.respond(res, 200, {
          bridge: "running",
          requests: this.totalRequests,
          errors: this.totalErrors,
          model: config.defaultModel,
          baseUrl: config.baseUrl,
        });

      } else if (method === "GET" && path === "/models") {
        const models = await this.registry.refresh(config.defaultModel);
        this.respond(res, 200, { models });

      } else if (method === "POST" && path === "/chat") {
        const body = await this.readBody<ChatRequest>(req);
        const err = this.validateChat(body);
        if (err) {
          status = 400;
          this.respond(res, 400, { error: err, code: "VALIDATION_ERROR" });
        } else {
          const chatRes = await this.client.chat(body);
          record.model = chatRes.model;
          record.tokens = chatRes.usage.total_tokens;
          this.respond(res, 200, chatRes);
        }

      } else {
        status = 404;
        this.respond(res, 404, { error: `Not found: ${method} ${path}`, code: "NOT_FOUND" });
      }
    } catch (err: any) {
      this.totalErrors++;
      status = this.mapErrorStatus(err);
      const errMsg = err?.message ?? String(err);
      record.error = errMsg;
      logger.error("RequestHandler", `${method} ${path} → ${status}: ${errMsg}`);
      this.respond(res, status, { error: errMsg, code: "INTERNAL_ERROR" });
    }

    const latency = Date.now() - t0;
    record.status = status;
    record.latency_ms = latency;
    this.record(record as RequestRecord);
    logger.debug("RequestHandler", `${method} ${path} → ${status} (${latency}ms)`);
  }

  // ── Helpers ──────────────────────────────────────────────

  private checkAuth(req: http.IncomingMessage): boolean {
    const token = config.authToken;
    if (!token) return true;
    const header = req.headers["authorization"] ?? "";
    return header.replace(/^Bearer\s+/i, "") === token;
  }

  private respond(
    res: http.ServerResponse,
    status: number,
    data: unknown
  ): void {
    const body = JSON.stringify(data, null, 2);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
  }

  private readBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T); }
        catch { reject(new Error("Invalid JSON body")); }
      });
      req.on("error", reject);
    });
  }

  private validateChat(body: ChatRequest): string | null {
    if (!body?.message && !body?.messages?.length) {
      return "Provide 'message' string or 'messages' array";
    }
    return null;
  }

  private mapErrorStatus(err: any): number {
    const msg = err?.message ?? "";
    if (msg.includes("No Copilot model")) return 503;
    if (msg.includes("Unauthorized"))    return 401;
    if (msg.includes("timeout"))         return 408;
    if (msg.includes("rate"))            return 429;
    return 500;
  }

  private record(partial: Partial<RequestRecord>): void {
    const r: RequestRecord = {
      id: crypto.randomUUID().slice(0, 8),
      timestamp: new Date(),
      method: "GET",
      path: "/",
      status: 200,
      latency_ms: 0,
      ...partial,
    };
    this.history.push(r);
    if (this.history.length > config.maxHistory) this.history.shift();
    this.onRecordCallbacks.forEach((cb) => cb(r));
  }
}

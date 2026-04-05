/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const bridgeServer_1 = __webpack_require__(2);
const statusBar_1 = __webpack_require__(9);
const sidebarProvider_1 = __webpack_require__(10);
const dashboardPanel_1 = __webpack_require__(12);
const logger_1 = __webpack_require__(6);
const config_1 = __webpack_require__(7);
let server;
let statusBar;
let serverView;
let agentView;
let statsView;
let modelsView;
async function activate(context) {
    const channel = vscode.window.createOutputChannel("Copilot Bridge", { log: true });
    context.subscriptions.push(channel);
    logger_1.logger.init(channel);
    logger_1.logger.info("Extension", "Copilot Agent Bridge activating…");
    server = new bridgeServer_1.BridgeServer();
    statusBar = new statusBar_1.StatusBarManager();
    context.subscriptions.push(statusBar);
    serverView = new sidebarProvider_1.ServerViewProvider(server);
    agentView = new sidebarProvider_1.AgentViewProvider();
    statsView = new sidebarProvider_1.StatsViewProvider(server);
    modelsView = new sidebarProvider_1.ModelsViewProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider("copilot-bridge.serverView", serverView), vscode.window.registerTreeDataProvider("copilot-bridge.agentView", agentView), vscode.window.registerTreeDataProvider("copilot-bridge.statsView", statsView), vscode.window.registerTreeDataProvider("copilot-bridge.modelsView", modelsView));
    server.onStatusChange((s) => {
        statusBar.update(s, server.handler.getTotalRequests());
        serverView.refresh();
        statsView.refresh();
    });
    const register = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));
    register("copilot-bridge.startServer", async () => {
        try {
            await server.start();
            vscode.window.showInformationMessage(`✅ Copilot Bridge running at ${config_1.config.baseUrl}`);
        }
        catch (err) {
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
        vscode.window.showInformationMessage(`✅ Copilot Bridge restarted at ${config_1.config.baseUrl}`);
    });
    register("copilot-bridge.openDashboard", () => {
        dashboardPanel_1.DashboardPanel.show(server, context);
    });
    register("copilot-bridge.connectAgent", async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: "Select Agent Directory",
            title: "Connect Python Agent Directory",
        });
        if (!uris?.length)
            return;
        const dir = uris[0].fsPath;
        await config_1.config.addAgentDir(dir);
        agentView.refresh();
        serverView.refresh();
        const action = await vscode.window.showInformationMessage(`✅ Agent directory connected: ${dir}`, "Copy .env Config", "Open Dashboard");
        if (action === "Copy .env Config") {
            await vscode.env.clipboard.writeText(config_1.config.generateEnvBlock());
            vscode.window.showInformationMessage("Config copied to clipboard! Paste into your .env file.");
        }
        if (action === "Open Dashboard") {
            dashboardPanel_1.DashboardPanel.show(server, context);
        }
    });
    register("copilot-bridge.testConnection", async () => {
        if (!server.isRunning()) {
            vscode.window.showWarningMessage("Start the bridge first.");
            return;
        }
        const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Testing Copilot Bridge…" }, async () => {
            try {
                const { CopilotClient } = await Promise.resolve().then(() => __importStar(__webpack_require__(5)));
                const { ModelRegistry } = await Promise.resolve().then(() => __importStar(__webpack_require__(8)));
                const reg = new ModelRegistry();
                await reg.refresh(config_1.config.defaultModel);
                const client = new CopilotClient(reg);
                const res = await client.chat({ message: "Reply with exactly: BRIDGE_OK" });
                return { ok: true, content: res.content, model: res.model };
            }
            catch (err) {
                return { ok: false, error: err.message };
            }
        });
        if (result.ok) {
            vscode.window.showInformationMessage(`✅ Bridge OK! Model: ${result.model} | Response: "${result.content?.slice(0, 60) ?? '(no response)'}"`);
        }
        else {
            vscode.window.showErrorMessage(`❌ Bridge test failed: ${result.error}`);
        }
    });
    register("copilot-bridge.copyEnvConfig", async () => {
        await vscode.env.clipboard.writeText(config_1.config.generateEnvBlock());
        vscode.window.showInformationMessage("✅ .env config copied! Paste it into your Python agent's .env file.");
    });
    register("copilot-bridge.viewLogs", () => {
        channel.show(true);
    });
    register("copilot-bridge.clearLogs", () => {
        logger_1.logger.clear();
        vscode.window.showInformationMessage("Logs cleared");
    });
    register("copilot-bridge.refreshSidebar", () => {
        serverView.refresh();
        agentView.refresh();
        statsView.refresh();
    });
    if (config_1.config.autoStart) {
        try {
            await server.start();
            logger_1.logger.info("Extension", "Auto-started successfully");
        }
        catch (err) {
            logger_1.logger.error("Extension", `Auto-start failed: ${err.message}`);
            vscode.window.showWarningMessage(`Copilot Bridge auto-start failed: ${err.message}`, "Retry").then((choice) => {
                if (choice === "Retry") {
                    vscode.commands.executeCommand("copilot-bridge.startServer");
                }
            });
        }
    }
    logger_1.logger.info("Extension", "Copilot Agent Bridge activated ✅");
}
async function deactivate() {
    logger_1.logger.info("Extension", "Deactivating…");
    await server?.stop();
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BridgeServer = void 0;
const http = __importStar(__webpack_require__(3));
const requestHandler_1 = __webpack_require__(4);
const modelRegistry_1 = __webpack_require__(8);
const config_1 = __webpack_require__(7);
const logger_1 = __webpack_require__(6);
// ─────────────────────────────────────────────────────────────
// HTTP server lifecycle manager
// ─────────────────────────────────────────────────────────────
class BridgeServer {
    server = null;
    status = "stopped";
    startedAt = null;
    lastError = null;
    statusCallbacks = [];
    handler;
    registry;
    constructor() {
        this.registry = new modelRegistry_1.ModelRegistry();
        this.handler = new requestHandler_1.RequestHandler(this.registry);
    }
    onStatusChange(cb) {
        this.statusCallbacks.push(cb);
    }
    emit(s) {
        this.status = s;
        this.statusCallbacks.forEach((cb) => cb(s));
    }
    getInfo() {
        return {
            status: this.status,
            port: config_1.config.port,
            host: config_1.config.host,
            startedAt: this.startedAt,
            uptime: this.startedAt
                ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
                : 0,
            lastError: this.lastError,
        };
    }
    async start() {
        if (this.server) {
            logger_1.logger.warn("BridgeServer", "Already running");
            return;
        }
        this.emit("starting");
        logger_1.logger.info("BridgeServer", `Starting on ${config_1.config.host}:${config_1.config.port}`);
        // Warm up model registry
        await this.registry.refresh(config_1.config.defaultModel);
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handler.handle(req, res).catch((err) => {
                    logger_1.logger.error("BridgeServer", `Unhandled: ${err}`);
                });
            });
            this.server.on("error", (err) => {
                this.lastError = err.message;
                this.emit("error");
                logger_1.logger.error("BridgeServer", `Server error: ${err.message}`);
                if (err.code === "EADDRINUSE") {
                    reject(new Error(`Port ${config_1.config.port} is already in use. ` +
                        `Change copilotBridge.port in settings.`));
                }
                else {
                    reject(err);
                }
            });
            this.server.listen(config_1.config.port, config_1.config.host, () => {
                this.startedAt = new Date();
                this.lastError = null;
                this.emit("running");
                logger_1.logger.info("BridgeServer", `✅ Bridge running at http://${config_1.config.host}:${config_1.config.port}`);
                resolve();
            });
        });
    }
    async stop() {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.close(() => {
                this.server = null;
                this.startedAt = null;
                this.emit("stopped");
                logger_1.logger.info("BridgeServer", "Server stopped");
                resolve();
            });
        });
    }
    async restart() {
        await this.stop();
        await this.start();
    }
    isRunning() { return this.status === "running"; }
}
exports.BridgeServer = BridgeServer;


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("http");

/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RequestHandler = void 0;
const copilotClient_1 = __webpack_require__(5);
const config_1 = __webpack_require__(7);
const logger_1 = __webpack_require__(6);
// ─────────────────────────────────────────────────────────────
// Route handler — pure HTTP logic, no Express needed
// ─────────────────────────────────────────────────────────────
class RequestHandler {
    registry;
    client;
    history = [];
    totalRequests = 0;
    totalErrors = 0;
    onRecordCallbacks = [];
    constructor(registry) {
        this.registry = registry;
        this.client = new copilotClient_1.CopilotClient(registry);
    }
    onRecord(cb) {
        this.onRecordCallbacks.push(cb);
    }
    getHistory() { return [...this.history]; }
    getTotalRequests() { return this.totalRequests; }
    getTotalErrors() { return this.totalErrors; }
    async handle(req, res) {
        const t0 = Date.now();
        const method = req.method ?? "GET";
        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
        const path = url.pathname;
        // ── CORS ───────────────────────────────────────────────
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }
        // ── Auth ───────────────────────────────────────────────
        if (!this.checkAuth(req)) {
            this.respond(res, 401, { error: "Unauthorized", code: "UNAUTHORIZED" });
            this.record({ method, path, status: 401, latency_ms: Date.now() - t0 });
            return;
        }
        this.totalRequests++;
        let status = 200;
        let record = { method, path };
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
    <p><strong>Port:</strong> ${config_1.config.port}</p>
    <p><strong>Model:</strong> ${config_1.config.defaultModel}</p>
    <p><strong>Requests:</strong> ${this.totalRequests}</p>
  </div>
  <h2>📡 Available Endpoints</h2>
  <div class="endpoint">GET <a href="/health">/health</a> - Health check</div>
  <div class="endpoint">GET <a href="/status">/status</a> - Server status</div>
  <div class="endpoint">GET <a href="/models">/models</a> - List available models</div>
  <div class="endpoint">POST /chat - Send chat request</div>
  <h2>🧪 Quick Test</h2>
  <p>Send a chat request:</p>
  <pre style="background:#3d3d3d;padding:15px;border-radius:4px;overflow-x:auto">curl -X POST http://127.0.0.1:${config_1.config.port}/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!"}'</pre>
  <h2>📚 Python Usage</h2>
  <pre style="background:#3d3d3d;padding:15px;border-radius:4px;overflow-x:auto">import requests

response = requests.post(
    "http://127.0.0.1:${config_1.config.port}/chat",
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
            }
            else if (method === "GET" && path === "/status") {
                this.respond(res, 200, {
                    bridge: "running",
                    requests: this.totalRequests,
                    errors: this.totalErrors,
                    model: config_1.config.defaultModel,
                    baseUrl: config_1.config.baseUrl,
                });
            }
            else if (method === "GET" && path === "/models") {
                const models = await this.registry.refresh(config_1.config.defaultModel);
                this.respond(res, 200, { models });
            }
            else if (method === "POST" && path === "/chat") {
                const body = await this.readBody(req);
                const err = this.validateChat(body);
                if (err) {
                    status = 400;
                    this.respond(res, 400, { error: err, code: "VALIDATION_ERROR" });
                }
                else {
                    const chatRes = await this.client.chat(body);
                    record.model = chatRes.model;
                    record.tokens = chatRes.usage.total_tokens;
                    this.respond(res, 200, chatRes);
                }
            }
            else {
                status = 404;
                this.respond(res, 404, { error: `Not found: ${method} ${path}`, code: "NOT_FOUND" });
            }
        }
        catch (err) {
            this.totalErrors++;
            status = this.mapErrorStatus(err);
            const errMsg = err?.message ?? String(err);
            record.error = errMsg;
            logger_1.logger.error("RequestHandler", `${method} ${path} → ${status}: ${errMsg}`);
            this.respond(res, status, { error: errMsg, code: "INTERNAL_ERROR" });
        }
        const latency = Date.now() - t0;
        record.status = status;
        record.latency_ms = latency;
        this.record(record);
        logger_1.logger.debug("RequestHandler", `${method} ${path} → ${status} (${latency}ms)`);
    }
    // ── Helpers ──────────────────────────────────────────────
    checkAuth(req) {
        const token = config_1.config.authToken;
        if (!token)
            return true;
        const header = req.headers["authorization"] ?? "";
        return header.replace(/^Bearer\s+/i, "") === token;
    }
    respond(res, status, data) {
        const body = JSON.stringify(data, null, 2);
        res.writeHead(status, {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);
    }
    readBody(req) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
                }
                catch {
                    reject(new Error("Invalid JSON body"));
                }
            });
            req.on("error", reject);
        });
    }
    validateChat(body) {
        if (!body?.message && !body?.messages?.length) {
            return "Provide 'message' string or 'messages' array";
        }
        return null;
    }
    mapErrorStatus(err) {
        const msg = err?.message ?? "";
        if (msg.includes("No Copilot model"))
            return 503;
        if (msg.includes("Unauthorized"))
            return 401;
        if (msg.includes("timeout"))
            return 408;
        if (msg.includes("rate"))
            return 429;
        return 500;
    }
    record(partial) {
        const r = {
            id: crypto.randomUUID().slice(0, 8),
            timestamp: new Date(),
            method: "GET",
            path: "/",
            status: 200,
            latency_ms: 0,
            ...partial,
        };
        this.history.push(r);
        if (this.history.length > config_1.config.maxHistory)
            this.history.shift();
        this.onRecordCallbacks.forEach((cb) => cb(r));
    }
}
exports.RequestHandler = RequestHandler;


/***/ }),
/* 5 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CopilotClient = void 0;
const vscode = __importStar(__webpack_require__(1));
const logger_1 = __webpack_require__(6);
const config_1 = __webpack_require__(7);
// ─────────────────────────────────────────────────────────────
// Core Copilot LLM API client
// ─────────────────────────────────────────────────────────────
class CopilotClient {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    async chat(req) {
        const t0 = Date.now();
        const rid = req.request_id ?? crypto.randomUUID().slice(0, 8);
        const modelKey = req.model ?? config_1.config.defaultModel;
        logger_1.logger.info("CopilotClient", `[${rid}] chat start | model=${modelKey}`);
        // ── 1. Resolve model ────────────────────────────────────
        const model = await this.registry.selectModel(modelKey);
        if (!model) {
            throw new Error(`No Copilot model matching '${modelKey}'. ` +
                `Ensure GitHub Copilot is installed and you are signed in.`);
        }
        // ── 2. Build messages ───────────────────────────────────
        const vsMessages = this.buildVSMessages(req);
        logger_1.logger.debug("CopilotClient", `[${rid}] ${vsMessages.length} messages`);
        // ── 3. Send with timeout ────────────────────────────────
        const cts = new vscode.CancellationTokenSource();
        const timer = setTimeout(() => cts.cancel(), config_1.config.timeout * 1000);
        try {
            const response = await model.sendRequest(vsMessages, { justification: `Copilot Bridge request [${rid}]` }, cts.token);
            let content = "";
            for await (const chunk of response.text) {
                content += chunk;
            }
            if (req.json_mode) {
                content = this.extractJSON(content);
            }
            const latency = Date.now() - t0;
            const promptEst = this.estimateTokens(vsMessages.map((m) => m.content ?? "").join(" "));
            const completionEst = this.estimateTokens(content);
            logger_1.logger.info("CopilotClient", `[${rid}] done | ${latency}ms | ~${promptEst + completionEst} tokens`);
            return {
                content,
                model: model.id,
                usage: {
                    prompt_tokens: promptEst,
                    completion_tokens: completionEst,
                    total_tokens: promptEst + completionEst,
                },
                finish_reason: "stop",
                latency_ms: latency,
                request_id: rid,
            };
        }
        finally {
            clearTimeout(timer);
            cts.dispose();
        }
    }
    // ── Helpers ──────────────────────────────────────────────
    buildVSMessages(req) {
        const raw = req.messages
            ? req.messages
            : [
                {
                    role: "system",
                    content: (req.system ?? "You are a helpful coding assistant.") +
                        (req.json_mode
                            ? "\n\nRespond with valid JSON only. No markdown, no code fences."
                            : ""),
                },
                ...(req.message
                    ? [{ role: "user", content: req.message }]
                    : []),
            ];
        return raw.map((m) => m.role === "assistant"
            ? vscode.LanguageModelChatMessage.Assistant(m.content)
            : vscode.LanguageModelChatMessage.User(m.content));
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    extractJSON(text) {
        const t = text.trim();
        if ((t.startsWith("{") && t.endsWith("}")) ||
            (t.startsWith("[") && t.endsWith("]")))
            return t;
        const fence = t.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (fence)
            return fence[1].trim();
        const s = Math.min(t.indexOf("{") < 0 ? Infinity : t.indexOf("{"), t.indexOf("[") < 0 ? Infinity : t.indexOf("["));
        const e = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
        return s !== Infinity && e > s ? t.slice(s, e + 1) : t;
    }
}
exports.CopilotClient = CopilotClient;


/***/ }),
/* 6 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.logger = void 0;
const vscode = __importStar(__webpack_require__(1));
// ─────────────────────────────────────────────────────────────
// Singleton logger with VS Code output channel + in-memory ring
// ─────────────────────────────────────────────────────────────
class Logger {
    channel = null;
    entries = [];
    maxEntries = 500;
    onEntryCallbacks = [];
    init(channel) {
        this.channel = channel;
    }
    onEntry(cb) {
        this.onEntryCallbacks.push(cb);
    }
    getConfigLevel() {
        return (vscode.workspace
            .getConfiguration("copilotBridge")
            .get("logLevel") ?? "info");
    }
    shouldLog(level) {
        const order = ["debug", "info", "warn", "error"];
        return order.indexOf(level) >= order.indexOf(this.getConfigLevel());
    }
    write(level, source, message) {
        if (!this.shouldLog(level))
            return;
        const entry = { timestamp: new Date(), level, source, message };
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
    debug(source, msg) { this.write("debug", source, msg); }
    info(source, msg) { this.write("info", source, msg); }
    warn(source, msg) { this.write("warn", source, msg); }
    error(source, msg) { this.write("error", source, msg); }
    getEntries(limit = 100) {
        return this.entries.slice(-limit);
    }
    clear() {
        this.entries = [];
        this.channel?.clear();
    }
}
exports.logger = new Logger();


/***/ }),
/* 7 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.config = exports.BridgeConfig = void 0;
const vscode = __importStar(__webpack_require__(1));
// ─────────────────────────────────────────────────────────────
// Typed config accessor — reads VS Code workspace settings
// ─────────────────────────────────────────────────────────────
class BridgeConfig {
    get cfg() {
        return vscode.workspace.getConfiguration("copilotBridge");
    }
    get port() { return this.cfg.get("port", 8765); }
    get host() { return this.cfg.get("host", "127.0.0.1"); }
    get autoStart() { return this.cfg.get("autoStart", true); }
    get authToken() { return this.cfg.get("authToken", ""); }
    get defaultModel() { return this.cfg.get("defaultModel", "gpt-4o"); }
    get logLevel() { return this.cfg.get("logLevel", "info"); }
    get maxHistory() { return this.cfg.get("maxRequestHistory", 100); }
    get timeout() { return this.cfg.get("requestTimeout", 90); }
    get agentDirs() { return this.cfg.get("agentDirectories", []); }
    get baseUrl() {
        return `http://${this.host}:${this.port}`;
    }
    async addAgentDir(dir) {
        const dirs = [...new Set([...this.agentDirs, dir])];
        await this.cfg.update("agentDirectories", dirs, vscode.ConfigurationTarget.Global);
    }
    async removeAgentDir(dir) {
        const dirs = this.agentDirs.filter((d) => d !== dir);
        await this.cfg.update("agentDirectories", dirs, vscode.ConfigurationTarget.Global);
    }
    async setDefaultModel(model) {
        await this.cfg.update("defaultModel", model, vscode.ConfigurationTarget.Global);
    }
    generateEnvBlock() {
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
exports.BridgeConfig = BridgeConfig;
exports.config = new BridgeConfig();


/***/ }),
/* 8 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ModelRegistry = void 0;
const vscode = __importStar(__webpack_require__(1));
const logger_1 = __webpack_require__(6);
// ─────────────────────────────────────────────────────────────
// Discovers and caches available Copilot models
// ─────────────────────────────────────────────────────────────
class ModelRegistry {
    models = [];
    lastRefresh = null;
    FAMILY_MAP = {
        "gpt-4o": "gpt-4o",
        "gpt-4": "gpt-4",
        "gpt-3.5-turbo": "gpt-3.5-turbo",
        "claude-3.5-sonnet": "claude-3.5-sonnet",
        "o1": "o1",
        "o3-mini": "o3-mini",
    };
    async refresh(defaultModel) {
        try {
            const raw = await vscode.lm.selectChatModels({ vendor: "copilot" });
            this.models = raw.map((m) => ({
                id: m.id,
                name: m.name,
                vendor: m.vendor,
                family: m.family ?? m.id,
                maxTokens: m.maxInputTokens,
                isDefault: m.family === defaultModel || m.id === defaultModel,
            }));
            this.lastRefresh = new Date();
            logger_1.logger.info("ModelRegistry", `Found ${this.models.length} Copilot models`);
        }
        catch (err) {
            logger_1.logger.error("ModelRegistry", `Refresh failed: ${err}`);
        }
        return this.models;
    }
    getAll() { return this.models; }
    getLastRefresh() { return this.lastRefresh; }
    resolveFamily(modelKey) {
        return this.FAMILY_MAP[modelKey] ?? modelKey;
    }
    async selectModel(modelKey) {
        const family = this.resolveFamily(modelKey);
        const [model] = await vscode.lm.selectChatModels({
            vendor: "copilot",
            family,
        });
        return model ?? null;
    }
}
exports.ModelRegistry = ModelRegistry;


/***/ }),
/* 9 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StatusBarManager = void 0;
const vscode = __importStar(__webpack_require__(1));
const config_1 = __webpack_require__(7);
// ─────────────────────────────────────────────────────────────
// Animated status bar item (bottom-left)
// ─────────────────────────────────────────────────────────────
class StatusBarManager {
    item;
    spinTimer = null;
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
        this.item.command = "copilot-bridge.openDashboard";
        this.item.show();
        this.render("stopped");
    }
    update(status, requestCount = 0) {
        this.stopSpin();
        this.render(status, requestCount);
    }
    render(status, requests = 0) {
        const map = {
            stopped: { icon: "$(circle-slash)", color: "statusBarItem.warningBackground", tooltip: "Bridge stopped — click to open dashboard" },
            starting: { icon: "$(loading~spin)", color: "statusBarItem.prominentBackground", tooltip: "Bridge starting…" },
            running: { icon: "$(radio-tower)", color: "statusBarItem.prominentBackground", tooltip: `Bridge running on :${config_1.config.port} | ${requests} requests` },
            error: { icon: "$(error)", color: "statusBarItem.errorBackground", tooltip: "Bridge error — click to open dashboard" },
        };
        const m = map[status];
        this.item.text = `${m.icon} Copilot Bridge${status === "running" ? ` :${config_1.config.port}` : ""}`;
        this.item.backgroundColor = new vscode.ThemeColor(m.color);
        this.item.tooltip = m.tooltip;
    }
    stopSpin() {
        if (this.spinTimer) {
            clearInterval(this.spinTimer);
            this.spinTimer = null;
        }
    }
    dispose() {
        this.stopSpin();
        this.item.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;


/***/ }),
/* 10 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ModelsViewProvider = exports.StatsViewProvider = exports.AgentViewProvider = exports.ServerViewProvider = void 0;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(11));
const modelRegistry_1 = __webpack_require__(8);
const config_1 = __webpack_require__(7);
// ─────────────────────────────────────────────────────────────
// Tree data provider — fills the activity-bar sidebar views
// ─────────────────────────────────────────────────────────────
class TreeNode extends vscode.TreeItem {
    constructor(label, collapsible, opts = {}) {
        super(label, collapsible);
        Object.assign(this, opts);
    }
}
// ── Server view ──────────────────────────────────────────────
class ServerViewProvider {
    server;
    _onDidChange = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChange.event;
    constructor(server) {
        this.server = server;
        server.onStatusChange(() => this._onDidChange.fire());
    }
    refresh() { this._onDidChange.fire(); }
    getTreeItem(el) { return el; }
    getChildren() {
        const info = this.server.getInfo();
        const statusIcon = {
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
                description: info.status === "running" ? config_1.config.baseUrl : "—",
                iconPath: new vscode.ThemeIcon("link"),
                command: info.status === "running" ? {
                    command: "copilot-bridge.copyEnvConfig",
                    title: "Copy URL",
                    arguments: [],
                } : undefined,
            }),
            new TreeNode("Model", vscode.TreeItemCollapsibleState.None, {
                description: config_1.config.defaultModel,
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
exports.ServerViewProvider = ServerViewProvider;
// ── Agent view ───────────────────────────────────────────────
class AgentViewProvider {
    _onDidChange = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChange.event;
    refresh() { this._onDidChange.fire(); }
    getTreeItem(el) { return el; }
    getChildren() {
        const dirs = config_1.config.agentDirs;
        if (dirs.length === 0) {
            return [
                new TreeNode("No agents connected", vscode.TreeItemCollapsibleState.None, {
                    description: "Click + to add agent directory",
                    iconPath: new vscode.ThemeIcon("info"),
                    command: {
                        command: "copilot-bridge.connectAgent",
                        title: "Connect Agent",
                    },
                }),
            ];
        }
        return dirs.map((d) => new TreeNode(path.basename(d), vscode.TreeItemCollapsibleState.None, {
            description: d,
            iconPath: new vscode.ThemeIcon("folder"),
            tooltip: d,
            contextValue: "agentDir",
            command: {
                command: "vscode.openFolder",
                title: "Open Folder",
                arguments: [vscode.Uri.file(d), { forceNewWindow: false }],
            },
        }));
    }
}
exports.AgentViewProvider = AgentViewProvider;
// ── Stats view ───────────────────────────────────────────────
class StatsViewProvider {
    server;
    _onDidChange = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChange.event;
    constructor(server) {
        this.server = server;
        setInterval(() => this._onDidChange.fire(), 5000);
    }
    refresh() { this._onDidChange.fire(); }
    getTreeItem(el) { return el; }
    getChildren() {
        const hist = this.server.handler.getHistory().slice(-10).reverse();
        if (hist.length === 0) {
            return [new TreeNode("No requests yet", vscode.TreeItemCollapsibleState.None, {
                    iconPath: new vscode.ThemeIcon("history"),
                })];
        }
        return hist.map((r) => {
            const statusIcon = r.status < 300 ? "pass" : r.status < 500 ? "warning" : "error";
            return new TreeNode(`${r.method} ${r.path}`, vscode.TreeItemCollapsibleState.None, {
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
            });
        });
    }
}
exports.StatsViewProvider = StatsViewProvider;
// ── Models view ──────────────────────────────────────────────
class ModelsViewProvider {
    _onDidChange = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChange.event;
    registry;
    initialized = false;
    constructor() {
        this.registry = new modelRegistry_1.ModelRegistry();
        this.initialize();
    }
    initialize() {
        if (!this.initialized) {
            this.initialized = true;
            this.registry.refresh(config_1.config.defaultModel).then(() => {
                this._onDidChange.fire();
            });
        }
    }
    refresh() {
        this.registry.refresh(config_1.config.defaultModel).then(() => {
            this._onDidChange.fire();
        });
    }
    getTreeItem(el) { return el; }
    getChildren() {
        const models = this.registry.getAll();
        // If no models loaded yet, try to load them
        if (models.length === 0 && !this.initialized) {
            this.initialize();
            return [
                new TreeNode("Loading models…", vscode.TreeItemCollapsibleState.None, {
                    iconPath: new vscode.ThemeIcon("loading~spin"),
                }),
            ];
        }
        if (models.length === 0) {
            return [
                new TreeNode("No models available", vscode.TreeItemCollapsibleState.None, {
                    description: "Sign in to GitHub Copilot",
                    iconPath: new vscode.ThemeIcon("warning"),
                }),
            ];
        }
        return models.map((m) => new TreeNode(m.name, vscode.TreeItemCollapsibleState.None, {
            description: m.isDefault ? "● Default" : m.family,
            iconPath: new vscode.ThemeIcon("sparkle"),
            tooltip: [
                `ID: ${m.id}`,
                `Vendor: ${m.vendor}`,
                `Family: ${m.family}`,
                m.maxTokens ? `Max tokens: ${m.maxTokens}` : "Max tokens: unknown",
            ].join("\n"),
        }));
    }
}
exports.ModelsViewProvider = ModelsViewProvider;


/***/ }),
/* 11 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 12 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DashboardPanel = void 0;
const vscode = __importStar(__webpack_require__(1));
const logger_1 = __webpack_require__(6);
const config_1 = __webpack_require__(7);
class DashboardPanel {
    server;
    context;
    static instance = null;
    panel = null;
    updateInterval = null;
    constructor(server, context) {
        this.server = server;
        this.context = context;
        logger_1.logger.onEntry((e) => this.postMessage({ type: "log", entry: this.serializeLog(e) }));
        server.handler.onRecord((r) => this.postMessage({ type: "record", record: this.serializeRecord(r) }));
    }
    static show(server, context) {
        if (!DashboardPanel.instance) {
            DashboardPanel.instance = new DashboardPanel(server, context);
        }
        DashboardPanel.instance.open();
    }
    open() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }
        this.panel = vscode.window.createWebviewPanel("copilot-bridge-dashboard", "Copilot Bridge Dashboard", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, "media"),
            ],
            retainContextWhenHidden: true,
        });
        this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, "assets", "icon.png");
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
    push() {
        const info = this.server.getInfo();
        const models = this.server.registry.getAll();
        this.postMessage({
            type: "update",
            data: {
                status: info.status,
                requests: this.server.handler.getTotalRequests(),
                errors: this.server.handler.getTotalErrors(),
                uptime: info.uptime,
                port: config_1.config.port,
                model: config_1.config.defaultModel,
                history: this.server.handler.getHistory()
                    .slice(-50).reverse().map(this.serializeRecord),
                models: models,
                agents: config_1.config.agentDirs,
                logs: logger_1.logger.getEntries(80).map(this.serializeLog),
                envBlock: config_1.config.generateEnvBlock(),
            },
        });
    }
    postMessage(msg) {
        this.panel?.webview.postMessage(msg);
    }
    async handleMessage(msg) {
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
                    await config_1.config.removeAgentDir(msg.dir);
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
                    await config_1.config.setDefaultModel(msg.model);
                    logger_1.logger.info("DashboardPanel", `Model changed to: ${msg.model}`);
                    this.postMessage({ type: "toast", message: `Model changed to ${msg.model}`, variant: "success" });
                    setTimeout(() => this.push(), 200);
                    break;
                case "sendTestRequest":
                    await this.handleTestRequest(msg.prompt);
                    break;
            }
        }
        catch (err) {
            logger_1.logger.error("DashboardPanel", `Message handler error: ${err?.message}`);
        }
    }
    async handleTestRequest(prompt) {
        try {
            const { CopilotClient } = await Promise.resolve().then(() => __importStar(__webpack_require__(5)));
            const { ModelRegistry } = await Promise.resolve().then(() => __importStar(__webpack_require__(8)));
            const reg = new ModelRegistry();
            await reg.refresh(config_1.config.defaultModel);
            const client = new CopilotClient(reg);
            const res = await client.chat({ message: prompt });
            this.postMessage({ type: "testResult", result: res });
        }
        catch (err) {
            this.postMessage({ type: "testResult", result: null, error: err?.message ?? String(err) });
        }
    }
    buildHTML() {
        const webview = this.panel.webview;
        const mediaUri = (file) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", file));
        const cssUri = mediaUri("dashboard.css");
        const jsUri = mediaUri("dashboard.js");
        const nonce = crypto.randomUUID().replace(/-/g, "");
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
    serializeLog(e) {
        return { ...e, timestamp: e.timestamp.toISOString() };
    }
    serializeRecord(r) {
        return { ...r, timestamp: r.timestamp.toISOString() };
    }
}
exports.DashboardPanel = DashboardPanel;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map
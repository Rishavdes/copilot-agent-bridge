import * as vscode from "vscode";
import { logger } from "../utils/logger";
import { ModelRegistry } from "./modelRegistry";
import { config } from "../utils/config";

export interface ChatRequest {
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  system?: string;
  message?: string;
  json_mode?: boolean;
  max_tokens?: number;
  temperature?: number;
  model?: string;
  request_id?: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  finish_reason: "stop" | "length" | "error";
  latency_ms: number;
  request_id: string;
}

// ─────────────────────────────────────────────────────────────
// Core Copilot LLM API client
// ─────────────────────────────────────────────────────────────
export class CopilotClient {
  constructor(private registry: ModelRegistry) {}

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const t0 = Date.now();
    const rid = req.request_id ?? crypto.randomUUID().slice(0, 8);
    const modelKey = req.model ?? config.defaultModel;

    logger.info("CopilotClient", `[${rid}] chat start | model=${modelKey}`);

    // ── 1. Resolve model ────────────────────────────────────
    const model = await this.registry.selectModel(modelKey);
    if (!model) {
      throw new Error(
        `No Copilot model matching '${modelKey}'. ` +
        `Ensure GitHub Copilot is installed and you are signed in.`
      );
    }

    // ── 2. Build messages ───────────────────────────────────
    const vsMessages = this.buildVSMessages(req);
    logger.debug("CopilotClient", `[${rid}] ${vsMessages.length} messages`);

    // ── 3. Send with timeout ────────────────────────────────
    const cts = new vscode.CancellationTokenSource();
    const timer = setTimeout(() => cts.cancel(), config.timeout * 1000);

    try {
      const response = await model.sendRequest(
        vsMessages,
        { justification: `Copilot Bridge request [${rid}]` },
        cts.token
      );

      let content = "";
      for await (const chunk of response.text) {
        content += chunk;
      }

      if (req.json_mode) {
        content = this.extractJSON(content);
      }

      const latency = Date.now() - t0;
      const promptEst = this.estimateTokens(vsMessages.map((m: any) => m.content ?? "").join(" "));
      const completionEst = this.estimateTokens(content);

      logger.info("CopilotClient", `[${rid}] done | ${latency}ms | ~${promptEst + completionEst} tokens`);

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
    } finally {
      clearTimeout(timer);
      cts.dispose();
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  private buildVSMessages(req: ChatRequest): vscode.LanguageModelChatMessage[] {
    const raw = req.messages
      ? req.messages
      : [
          {
            role: "system" as const,
            content:
              (req.system ?? "You are a helpful coding assistant.") +
              (req.json_mode
                ? "\n\nRespond with valid JSON only. No markdown, no code fences."
                : ""),
          },
          ...(req.message
            ? [{ role: "user" as const, content: req.message }]
            : []),
        ];

    return raw.map((m) =>
      m.role === "assistant"
        ? vscode.LanguageModelChatMessage.Assistant(m.content)
        : vscode.LanguageModelChatMessage.User(m.content)
    );
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private extractJSON(text: string): string {
    const t = text.trim();
    if ((t.startsWith("{") && t.endsWith("}")) ||
        (t.startsWith("[") && t.endsWith("]"))) return t;

    const fence = t.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fence) return fence[1].trim();

    const s = Math.min(
      t.indexOf("{") < 0 ? Infinity : t.indexOf("{"),
      t.indexOf("[") < 0 ? Infinity : t.indexOf("[")
    );
    const e = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    return s !== Infinity && e > s ? t.slice(s, e + 1) : t;
  }
}

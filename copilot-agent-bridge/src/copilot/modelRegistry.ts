import * as vscode from "vscode";
import { logger } from "../utils/logger";

export interface ModelInfo {
  id: string;
  name: string;
  vendor: string;
  family: string;
  maxTokens?: number;
  isDefault: boolean;
}

// ─────────────────────────────────────────────────────────────
// Discovers and caches available Copilot models
// ─────────────────────────────────────────────────────────────
export class ModelRegistry {
  private models: ModelInfo[] = [];
  private lastRefresh: Date | null = null;

  private readonly FAMILY_MAP: Record<string, string> = {
    "gpt-4o":           "gpt-4o",
    "gpt-4":            "gpt-4",
    "gpt-3.5-turbo":    "gpt-3.5-turbo",
    "claude-3.5-sonnet":"claude-3.5-sonnet",
    "o1":               "o1",
    "o3-mini":          "o3-mini",
  };

  async refresh(defaultModel: string): Promise<ModelInfo[]> {
    try {
      const raw = await vscode.lm.selectChatModels({ vendor: "copilot" });
      this.models = raw.map((m) => ({
        id: m.id,
        name: m.name,
        vendor: m.vendor,
        family: m.family ?? m.id,
        maxTokens: (m as any).maxInputTokens,
        isDefault: m.family === defaultModel || m.id === defaultModel,
      }));
      this.lastRefresh = new Date();
      logger.info("ModelRegistry", `Found ${this.models.length} Copilot models`);
    } catch (err) {
      logger.error("ModelRegistry", `Refresh failed: ${err}`);
    }
    return this.models;
  }

  getAll(): ModelInfo[] { return this.models; }
  getLastRefresh(): Date | null { return this.lastRefresh; }

  resolveFamily(modelKey: string): string {
    return this.FAMILY_MAP[modelKey] ?? modelKey;
  }

  async selectModel(
    modelKey: string
  ): Promise<vscode.LanguageModelChat | null> {
    const family = this.resolveFamily(modelKey);
    const [model] = await vscode.lm.selectChatModels({
      vendor: "copilot",
      family,
    });
    return model ?? null;
  }
}

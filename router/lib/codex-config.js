import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exists, writeTextAtomic } from "./fs-utils.js";
import { configDir } from "./paths.js";
import { loadModels } from "./config.js";

export const codexConfigPath = path.join(os.homedir(), ".codex", "config.toml");

export async function readCodexTopLevel() {
  const text = await fs.readFile(codexConfigPath, "utf8");
  const output = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trimStart().startsWith("[")) break;
    if (/^\s*(model|model_provider|model_context_window|model_max_output_tokens|model_reasoning_effort)\s*=/.test(line)) {
      output.push(line);
    }
  }
  return output.join("\n");
}

export async function switchCodexPreset(preset) {
  const models = await loadModels();
  const spec = presetLines(preset, models);
  const original = await fs.readFile(codexConfigPath, "utf8");
  const backupPath = `${codexConfigPath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await fs.writeFile(backupPath, original, "utf8");

  const lines = original.split(/\r?\n/);
  const firstTableIndex = lines.findIndex((line) => line.trimStart().startsWith("["));
  const head = firstTableIndex === -1 ? lines : lines.slice(0, firstTableIndex);
  const tail = firstTableIndex === -1 ? [] : lines.slice(firstTableIndex);
  const preservedHead = head.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return !/^(model|model_provider|model_context_window|model_max_output_tokens|model_reasoning_effort)\s*=/.test(trimmed);
  });

  let next = [
    ...spec.lines,
    ...preservedHead,
    "",
    ...tail
  ].join("\n").replace(/\n{3,}/g, "\n\n");

  next = ensureProviderBlock(next, spec);
  await writeTextAtomic(codexConfigPath, next.endsWith("\n") ? next : `${next}\n`);
  return { label: spec.label, configPath: codexConfigPath, backupPath };
}

export async function listCodexPresets() {
  const models = await loadModels();
  const builtins = [
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    { id: "deepseek-chat", label: "DeepSeek Chat" },
    { id: "gpt", label: "GPT-5.5" },
    { id: "qwen", label: "Qwen 3.6 Plus" },
    { id: "gemini", label: "Gemini 2.5 Flash" }
  ];
  const custom = Object.entries(models)
    .filter(([, cfg]) => cfg.provider === "openai-compatible")
    .filter(([id]) => !["gpt", "deepseek", "qwen", "claude_api", "claude_code", "local"].includes(id))
    .map(([id, cfg]) => ({ id: `custom:${id}`, label: cfg.label || id }));
  return [...builtins, ...custom];
}

export async function saveCustomModel({ id, label, baseUrl, model, apiKeyEnv, apiKey, contextWindow = 128000 }) {
  validateId(id);
  if (!baseUrl || !model || !apiKeyEnv) throw new Error("baseUrl, model, and apiKeyEnv are required");

  const modelsPath = path.join(configDir(), "models.yaml");
  let modelsText = await fs.readFile(modelsPath, "utf8");
  if (!modelsText.endsWith("\n")) modelsText += "\n";
  if (new RegExp(`^\\s{2}${escapeRegExp(id)}:\\s*$`, "m").test(modelsText)) {
    throw new Error(`Model id already exists: ${id}`);
  }
  modelsText += [
    `  ${id}:`,
    `    label: ${quoteYaml(label || id)}`,
    "    provider: openai-compatible",
    `    model: ${quoteYaml(model)}`,
    `    base_url: ${quoteYaml(baseUrl.replace(/\/$/, ""))}`,
    `    api_key_env: ${quoteYaml(apiKeyEnv)}`,
    ""
  ].join("\n");
  await writeTextAtomic(modelsPath, modelsText);

  if (apiKey) {
    await upsertSecret(apiKeyEnv, apiKey);
  }

  const providerId = `youlin-${id}`;
  await ensureCodexProvider(providerId, baseUrl.replace(/\/$/, ""), Number(contextWindow) || 128000, apiKeyEnv);
  return { id, providerId };
}

function presetLines(preset, models) {
  if (preset === "deepseek-v4-pro") {
    return {
      label: "DeepSeek V4 Pro",
      providerId: "mimo2codex",
      providerName: "DeepSeek V4 Pro",
      baseUrl: "http://127.0.0.1:8788/v1",
      contextWindow: 1000000,
      lines: [
        'model = "deepseek-v4-pro"',
        'model_provider = "mimo2codex"',
        "model_context_window = 1000000",
        "model_max_output_tokens = 393216",
        'model_reasoning_effort = "medium"'
      ]
    };
  }
  if (preset === "deepseek-chat") {
    return {
      label: "DeepSeek Chat",
      providerId: "mimo2codex",
      providerName: "DeepSeek V4 Pro",
      baseUrl: "http://127.0.0.1:8788/v1",
      contextWindow: 1000000,
      lines: [
        'model = "deepseek-chat"',
        'model_provider = "mimo2codex"',
        "model_context_window = 1000000",
        "model_max_output_tokens = 393216",
        'model_reasoning_effort = "medium"'
      ]
    };
  }
  if (preset === "qwen") {
    return {
      label: "Qwen 3.6 Plus",
      providerId: "mimo2codex-qwen",
      providerName: "Qwen3.6 Plus",
      baseUrl: "http://127.0.0.1:8789/v1",
      contextWindow: 128000,
      lines: [
        'model = "qwen3.6-plus"',
        'model_provider = "mimo2codex-qwen"',
        "model_context_window = 128000",
        'model_reasoning_effort = "medium"'
      ]
    };
  }
  if (preset === "gemini") {
    return {
      label: "Gemini 2.5 Flash",
      providerId: "mimo2codex-gemini",
      providerName: "Gemini 2.5 Flash",
      baseUrl: "http://127.0.0.1:8790/v1",
      contextWindow: 1000000,
      lines: [
        'model = "gemini-2.5-flash"',
        'model_provider = "mimo2codex-gemini"',
        "model_context_window = 1000000",
        'model_reasoning_effort = "medium"'
      ]
    };
  }
  if (preset === "gpt") {
    return {
      label: "GPT-5.5",
      lines: [
        'model = "gpt-5.5"',
        'model_reasoning_effort = "medium"'
      ]
    };
  }
  if (preset.startsWith("custom:")) {
    const id = preset.slice("custom:".length);
    const cfg = models[id];
    if (!cfg) throw new Error(`Unknown custom model: ${id}`);
    const providerId = `youlin-${id}`;
    const contextWindow = Number(cfg.context_window || 128000);
    return {
      label: cfg.label || id,
      providerId,
      providerName: cfg.label || id,
      baseUrl: String(cfg.base_url || "").replace(/\/$/, ""),
      contextWindow,
      apiKeyEnv: cfg.api_key_env,
      lines: [
        `model = ${JSON.stringify(cfg.model)}`,
        `model_provider = ${JSON.stringify(providerId)}`,
        `model_context_window = ${contextWindow}`,
        'model_reasoning_effort = "medium"'
      ]
    };
  }
  throw new Error(`Unknown preset: ${preset}`);
}

function ensureProviderBlock(text, spec) {
  if (!spec.providerId) return text;
  const providerHeader = `[model_providers.${spec.providerId}]`;
  const block = [
    providerHeader,
    `name = ${JSON.stringify(spec.providerName || spec.label)}`,
    `base_url = ${JSON.stringify(spec.baseUrl)}`,
    ...(spec.apiKeyEnv ? [`api_key_env = ${JSON.stringify(spec.apiKeyEnv)}`] : []),
    'wire_api = "responses"',
    "requires_openai_auth = true",
    "request_max_retries = 1",
    ""
  ].join("\n");

  if (text.includes(providerHeader)) return text;
  return `${text.replace(/\s*$/, "\n\n")}${block}`;
}

async function ensureCodexProvider(providerId, baseUrl, contextWindow, apiKeyEnv) {
  const text = await fs.readFile(codexConfigPath, "utf8");
  if (text.includes(`[model_providers.${providerId}]`)) return;
  const providerBlock = [
    `[model_providers.${providerId}]`,
    `name = ${JSON.stringify(providerId)}`,
    `base_url = ${JSON.stringify(baseUrl)}`,
  ];
  if (apiKeyEnv) {
    providerBlock.push(`api_key_env = ${JSON.stringify(apiKeyEnv)}`);
  }
  providerBlock.push(
    'wire_api = "responses"',
    "requires_openai_auth = true",
    "request_max_retries = 1",
    `# model_context_window = ${contextWindow}`,
    ""
  );
  const next = `${text.replace(/\s*$/, "\n\n")}${providerBlock.join("\n")}`;
  await writeTextAtomic(codexConfigPath, next);
}

async function upsertSecret(key, value) {
  const file = path.join(configDir(), "secrets.env");
  const text = (await exists(file)) ? await fs.readFile(file, "utf8") : "";
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const nextLine = `${key}=${value}`;
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return nextLine;
    }
    return line;
  });
  if (!found) next.push(nextLine);
  await writeTextAtomic(file, `${next.join("\n")}\n`);
}

function validateId(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id || "")) {
    throw new Error("id may only contain letters, numbers, underscore, and dash");
  }
}

function quoteYaml(value) {
  return JSON.stringify(String(value));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

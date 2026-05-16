import { spawn } from "node:child_process";

export async function callModel(modelName, modelConfig, messages, options = {}) {
  if (!modelConfig) throw new Error(`Unknown model: ${modelName}`);
  const provider = modelConfig.provider;

  if (provider === "openai-compatible") {
    return callOpenAICompatible(modelName, modelConfig, messages, options);
  }
  if (provider === "anthropic") {
    return callAnthropic(modelName, modelConfig, messages, options);
  }
  if (provider === "ollama") {
    return callOllama(modelName, modelConfig, messages, options);
  }
  if (provider === "cli") {
    return callCli(modelName, modelConfig, messages, options);
  }

  throw new Error(`Unsupported provider for ${modelName}: ${provider}`);
}

async function callOpenAICompatible(modelName, config, messages, options) {
  const key = process.env[config.api_key_env || ""];
  if (!key) throw new Error(`${modelName}: missing API key env ${config.api_key_env}`);
  const url = `${String(config.base_url).replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.2,
      stream: false
    })
  });
  const json = await readJsonResponse(res, modelName);
  return json.choices?.[0]?.message?.content || "";
}

async function callAnthropic(modelName, config, messages, options) {
  const key = process.env[config.api_key_env || ""];
  if (!key) throw new Error(`${modelName}: missing API key env ${config.api_key_env}`);
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature ?? 0.2,
      system,
      messages: anthropicMessages
    })
  });
  const json = await readJsonResponse(res, modelName);
  return (json.content || []).map((block) => block.text || "").join("");
}

async function callOllama(modelName, config, messages, options) {
  const url = `${String(config.base_url || "http://localhost:11434").replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
      options: { temperature: options.temperature ?? 0.2 }
    })
  });
  const json = await readJsonResponse(res, modelName);
  return json.message?.content || "";
}

async function callCli(modelName, config, messages, options) {
  const prompt = renderPrompt(messages);
  const command = config.command;
  if (!command) throw new Error(`${modelName}: cli model is missing command`);
  const args = (config.args || []).map((arg) => String(arg).replaceAll("{{prompt}}", prompt));
  const timeoutMs = Number(options.timeout_ms || config.timeout_ms || 600000);
  return runCommand(command, args, { timeoutMs, input: config.stdin ? prompt : "" });
}

function renderPrompt(messages) {
  return messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n");
}

async function runCommand(command, args, { timeoutMs, input }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`CLI command timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`CLI command failed (${code}): ${stderr || stdout}`));
    });

    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function readJsonResponse(res, modelName) {
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${modelName}: non-JSON response ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`${modelName}: HTTP ${res.status}: ${JSON.stringify(json).slice(0, 1000)}`);
  }
  return json;
}

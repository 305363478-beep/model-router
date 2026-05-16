import { loadModels, loadPolicy, savePolicy } from "./config.js";
import { packContext, makeHandoffContext } from "./context.js";
import { callModel } from "./providers.js";
import { recordEvent, writeHandoff } from "./session.js";

const DEFAULT_SYSTEM = "You are a precise coding assistant. Follow the user request, preserve existing context, and return concise actionable output.";

export async function getStatus() {
  const models = await loadModels();
  const policy = await loadPolicy();
  return {
    mode: policy.default_mode || "auto",
    sticky_model: policy.sticky_model || null,
    models: Object.keys(models),
    aliases: policy.manual_aliases || {},
    fallback: policy.fallback || []
  };
}

export async function setModel(model, { sticky = true } = {}) {
  const models = await loadModels();
  const policy = await loadPolicy();
  const resolved = resolveAlias(model, policy);
  if (model !== "auto" && !models[resolved]) throw new Error(`Unknown model: ${model}`);
  policy.default_mode = model === "auto" ? "auto" : "manual";
  policy.sticky_model = model === "auto" ? null : resolved;
  await savePolicy(policy);
  return { mode: policy.default_mode, sticky_model: sticky ? policy.sticky_model : resolved };
}

export async function ask({ prompt, model, cwd = process.cwd(), files = [], includeDiff = true, includeSummary = true, taskType, temperature }) {
  if (!prompt) throw new Error("Missing prompt");
  const models = await loadModels();
  const policy = await loadPolicy();
  const selected = selectModel({ model, taskType, policy, models });
  const context = await packContext({ cwd, files, includeDiff, includeSummary });
  const messages = [
    { role: "system", content: DEFAULT_SYSTEM },
    { role: "user", content: context ? `${context}\n\n## User task\n\n${prompt}` : prompt }
  ];

  const tried = [];
  for (const candidate of candidateModels(selected, policy, models)) {
    tried.push(candidate);
    try {
      const output = await callModel(candidate, models[candidate], messages, { temperature });
      await recordEvent(cwd, {
        type: "ask",
        model: candidate,
        taskType: taskType || null,
        prompt_summary: prompt.slice(0, 240),
        output_summary: output.slice(0, 500)
      });
      return { model: candidate, tried, output };
    } catch (err) {
      if (candidate === candidateModels(selected, policy, models).at(-1)) throw err;
    }
  }
  throw new Error(`No model succeeded. Tried: ${tried.join(", ")}`);
}

export async function auto({ prompt, taskType, cwd, files, includeDiff, includeSummary, temperature }) {
  return ask({ prompt, taskType, cwd, files, includeDiff, includeSummary, temperature });
}

export async function handoff({ cwd = process.cwd() } = {}) {
  const content = await makeHandoffContext(cwd);
  const file = await writeHandoff(cwd, content);
  await recordEvent(cwd, { type: "handoff", file });
  return { file, content };
}

export async function packedContext(args = {}) {
  return { context: await packContext(args) };
}

function selectModel({ model, taskType, policy, models }) {
  if (model) return resolveAlias(model, policy);
  if (policy.sticky_model && models[policy.sticky_model]) return policy.sticky_model;
  const autoRule = taskType ? policy.auto?.[taskType] : null;
  if (autoRule?.model) return resolveAlias(autoRule.model, policy);
  const defaultTask = policy.auto?.implementation?.model;
  return resolveAlias(defaultTask || Object.keys(models)[0], policy);
}

function resolveAlias(name, policy) {
  return policy.manual_aliases?.[name] || name;
}

function candidateModels(primary, policy, models) {
  const list = [primary, ...(policy.fallback || [])].filter(Boolean);
  return [...new Set(list.map((m) => resolveAlias(m, policy)).filter((m) => models[m]))];
}

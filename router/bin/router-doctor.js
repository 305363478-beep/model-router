#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ensureDefaultConfig, loadModels, loadPolicy } from "../lib/config.js";
import { configDir, projectRouterDir, routerHome } from "../lib/paths.js";
import { exists } from "../lib/fs-utils.js";

const execFileAsync = promisify(execFile);
await ensureDefaultConfig(process.cwd());

const checks = [];
await check("Node.js >= 20", async () => Number(process.versions.node.split(".")[0]) >= 20);
await check("Router home", async () => exists(routerHome()));
await check("Config directory", async () => exists(configDir()));
await check("Project state", async () => exists(projectRouterDir(process.cwd())));
await check("Policy loads", async () => Boolean(await loadPolicy()));
await check("Models load", async () => Object.keys(await loadModels()).length > 0);

const models = await loadModels();
for (const [name, model] of Object.entries(models)) {
  if (model.provider === "cli") {
    await check(`CLI model ${name}: ${model.command}`, async () => commandExists(model.command));
  } else if (model.provider === "ollama") {
    await check(`Ollama model ${name}`, async () => canFetch(`${model.base_url || "http://localhost:11434"}/api/tags`), "optional");
  } else {
    await check(`API key ${name}`, async () => Boolean(process.env[model.api_key_env]), "optional");
  }
}

console.log("\nModel Router Doctor\n");
for (const item of checks) {
  const marker = item.ok ? "ok" : item.level === "optional" ? "skip" : "fail";
  console.log(`${marker.padEnd(4)} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (checks.some((item) => !item.ok && item.level !== "optional")) process.exitCode = 1;

async function check(name, fn, level = "required") {
  try {
    const ok = await fn();
    checks.push({ name, ok: Boolean(ok), level });
  } catch (err) {
    checks.push({ name, ok: false, level, detail: err.message || String(err) });
  }
}

async function commandExists(command) {
  if (!command) return false;
  const probe = process.platform === "win32" ? "where" : "which";
  await execFileAsync(probe, [command]);
  return true;
}

async function canFetch(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

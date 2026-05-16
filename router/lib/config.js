import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDir } from "./paths.js";
import { exists, ensureDir, readTextIfExists, writeTextAtomic } from "./fs-utils.js";
import { parseYaml, dumpYaml } from "./simple-yaml.js";

export async function loadEnvFile(file = path.join(configDir(), "secrets.env")) {
  const text = await readTextIfExists(file, "");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
}

export async function loadModels() {
  await loadEnvFile();
  const file = path.join(configDir(), "models.yaml");
  const text = await fs.readFile(file, "utf8");
  return parseYaml(text).models || {};
}

export async function loadPolicy() {
  const file = path.join(configDir(), "policy.yaml");
  const text = await fs.readFile(file, "utf8");
  return parseYaml(text);
}

export async function savePolicy(policy) {
  await writeTextAtomic(path.join(configDir(), "policy.yaml"), `${dumpYaml(policy)}\n`);
}

export async function ensureDefaultConfig(projectRoot) {
  await ensureDir(configDir());
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const modelsSrc = path.join(root, "examples", "models.yaml");
  const policySrc = path.join(root, "examples", "policy.yaml");
  const secretsSrc = path.join(root, "examples", "secrets.env.example");

  const targets = [
    [modelsSrc, path.join(configDir(), "models.yaml")],
    [policySrc, path.join(configDir(), "policy.yaml")],
    [secretsSrc, path.join(configDir(), "secrets.env")]
  ];

  for (const [src, dest] of targets) {
    if (!(await exists(dest))) {
      await fs.copyFile(src, dest);
    }
  }

  if (projectRoot) {
    const { ensureProjectState } = await import("./session.js");
    await ensureProjectState(projectRoot);
  }
}

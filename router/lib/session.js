import path from "node:path";
import { appendJsonl, ensureDir, readTextIfExists, writeTextAtomic } from "./fs-utils.js";
import { projectRouterDir } from "./paths.js";

export async function ensureProjectState(cwd = process.cwd()) {
  const dir = projectRouterDir(cwd);
  await ensureDir(dir);
  await writeIfMissing(path.join(dir, "summary.md"), "# Router Summary\n\nNo summary yet.\n");
  await writeIfMissing(path.join(dir, "handoff.md"), "# Router Handoff\n\nNo handoff generated yet.\n");
  await writeIfMissing(path.join(dir, "session.jsonl"), "");
  return dir;
}

async function writeIfMissing(file, content) {
  const existing = await readTextIfExists(file, null);
  if (existing === null) await writeTextAtomic(file, content);
}

export async function recordEvent(cwd, event) {
  const dir = await ensureProjectState(cwd);
  await appendJsonl(path.join(dir, "session.jsonl"), {
    time: new Date().toISOString(),
    ...event
  });
}

export async function readProjectSummary(cwd = process.cwd()) {
  return readTextIfExists(path.join(projectRouterDir(cwd), "summary.md"), "");
}

export async function writeHandoff(cwd, content) {
  const dir = await ensureProjectState(cwd);
  const file = path.join(dir, "handoff.md");
  await writeTextAtomic(file, content);
  return file;
}

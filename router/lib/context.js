import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { readProjectSummary } from "./session.js";

const execFileAsync = promisify(execFile);

export async function packContext({ cwd = process.cwd(), files = [], includeDiff = true, includeSummary = true, maxFileChars = 60000 } = {}) {
  const parts = [];
  if (includeSummary) {
    const summary = await readProjectSummary(cwd);
    if (summary.trim()) parts.push(section("Project summary", summary));
  }

  if (includeDiff) {
    const diff = await git(["diff", "--", "."], cwd);
    if (diff.trim()) parts.push(section("Current git diff", diff.slice(0, 120000)));
  }

  for (const file of files) {
    const abs = path.resolve(cwd, file);
    const text = await fs.readFile(abs, "utf8");
    parts.push(section(`File: ${file}`, text.slice(0, maxFileChars)));
  }

  return parts.join("\n\n");
}

export async function makeHandoffContext(cwd = process.cwd()) {
  const summary = await readProjectSummary(cwd);
  const status = await git(["status", "--short"], cwd);
  const diff = await git(["diff", "--", "."], cwd);
  return [
    "# Router Handoff",
    "",
    "## Current Summary",
    summary.trim() || "No summary yet.",
    "",
    "## Git Status",
    fenced(status.trim() || "Clean"),
    "",
    "## Git Diff",
    fenced(diff.trim() || "No diff")
  ].join("\n");
}

async function git(args, cwd) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  } catch {
    return "";
  }
}

function section(title, body) {
  return `## ${title}\n\n${body}`;
}

function fenced(text) {
  return `\`\`\`\n${text}\n\`\`\``;
}

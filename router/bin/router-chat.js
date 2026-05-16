#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { ensureDefaultConfig } from "../lib/config.js";
import { ask, getStatus, setModel, handoff } from "../lib/router.js";

const args = parseArgs(process.argv.slice(2));
const cwd = path.resolve(args.project || process.cwd());
await ensureDefaultConfig(cwd);
if (args.model) await setModel(args.model);

console.log("router-chat ready. Commands: /model <name|auto>, /status, /handoff, /exit");
const rl = readline.createInterface({ input, output });

while (true) {
  let answer;
  try {
    answer = await rl.question("> ");
  } catch (err) {
    if (err.code === "ERR_USE_AFTER_CLOSE") break;
    throw err;
  }
  const line = answer.trim();
  if (!line) continue;
  if (line === "/exit" || line === "/quit") break;

  try {
    if (line.startsWith("/model ")) {
      const model = line.split(/\s+/)[1];
      const result = await setModel(model);
      console.log(JSON.stringify(result, null, 2));
      continue;
    }
    if (line === "/status") {
      console.log(JSON.stringify(await getStatus(), null, 2));
      continue;
    }
    if (line === "/handoff") {
      const result = await handoff({ cwd });
      console.log(`handoff written: ${result.file}`);
      continue;
    }

    const tagged = line.match(/^@([A-Za-z0-9_-]+)\s+([\s\S]+)/);
    const result = await ask({
      prompt: tagged ? tagged[2] : line,
      model: tagged ? tagged[1] : args.model,
      cwd,
      includeDiff: !args.noDiff,
      includeSummary: true
    });
    console.log(`\n[${result.model}]\n${result.output}\n`);
  } catch (err) {
    console.error(`error: ${err.message || err}`);
  }
}

rl.close();

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--model") out.model = argv[++i];
    else if (arg === "--project") out.project = argv[++i];
    else if (arg === "--no-diff") out.noDiff = true;
  }
  return out;
}

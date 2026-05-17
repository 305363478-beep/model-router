#!/usr/bin/env node
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { execSync } from "node:child_process";
import { ensureDefaultConfig } from "../lib/config.js";
import { ask, getStatus, setModel, handoff } from "../lib/router.js";
import { codexConfigPath, listCodexPresets, readCodexTopLevel, saveCustomModel, switchCodexPreset } from "../lib/codex-config.js";

const args = parseArgs(process.argv.slice(2));
const cwd = path.resolve(args.project || process.cwd());
const port = Number(args.port || process.env.ROUTER_UI_PORT || 8787);
const DB_PATH = path.join(os.homedir(), ".codex", "state_5.sqlite");
const SESSIONS_DIR = path.join(os.homedir(), ".codex", "sessions");
await ensureDefaultConfig(cwd);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/") return html(res, req.method === "HEAD");
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/settings") return settingsHtml(res, req.method === "HEAD");
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/migrate") {
      regenerateMigrateHtml();
      return serveMigrateHtml(res, req.method === "HEAD");
    }
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/desktop") return desktopHtml(res, req.method === "HEAD");
    if (req.method === "GET" && url.pathname === "/api/status") return json(res, await getStatus());
    if (req.method === "GET" && url.pathname === "/api/codex/status") {
      return json(res, { current: await readCodexTopLevel(), presets: await listCodexPresets() });
    }
    if (req.method === "POST" && url.pathname === "/api/codex/switch") {
      const body = await readJson(req);
      return json(res, await switchCodexPreset(body.preset));
    }
    if (req.method === "POST" && url.pathname === "/api/codex/custom-model") {
      const body = await readJson(req);
      return json(res, await saveCustomModel(body));
    }
    if (req.method === "POST" && url.pathname === "/api/set-model") {
      const body = await readJson(req);
      return json(res, await setModel(body.model));
    }
    if (req.method === "POST" && url.pathname === "/api/ask") {
      const body = await readJson(req);
      return json(res, await ask({ ...body, cwd }));
    }
    if (req.method === "POST" && url.pathname === "/api/handoff") {
      return json(res, await handoff({ cwd }));
    }
    if (req.method === "GET" && url.pathname === "/api/threads/list") {
      return json(res, await listThreads());
    }
    if (req.method === "GET" && url.pathname === "/api/threads") {
      return json(res, await listThreads());
    }
    if (req.method === "POST" && url.pathname === "/api/threads/migrate") {
      const body = await readJson(req);
      return json(res, await migrateThread(body.threadId, body.targetProvider));
    }
    if (req.method === "POST" && url.pathname === "/api/migrate-thread") {
      const body = await readJson(req);
      return json(res, await migrateThread(body.threadId, body.targetProvider));
    }
    if (req.method === "POST" && url.pathname === "/api/quick-switch") {
      const body = await readJson(req);
      return json(res, await quickSwitchDesktop(body.target));
    }
    if (req.method === "POST" && url.pathname === "/api/restart-codex") {
      return json(res, await restartCodexDesktop());
    }
    if (req.method === "POST" && url.pathname === "/api/add-provider") {
      const body = await readJson(req);
      return json(res, await addProviderDesktop(body));
    }
    if (req.method === "POST" && url.pathname === "/api/fetch-models") {
      const body = await readJson(req);
      return json(res, await fetchModelsFromProvider(body.baseURL, body.apiKey));
    }
    if (req.method === "GET" && url.pathname === "/api/open-config") {
      try {
        const configText = fs.readFileSync(codexConfigPath, "utf8");
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        return res.end(configText);
      } catch (e) {
        return json(res, { error: e.message }, 500);
      }
    }
    res.writeHead(404).end("not found");
  } catch (err) {
    if (!res.headersSent) {
      json(res, { error: err.message || String(err) }, 500);
    } else {
      console.error("Error after response sent:", err.message || String(err));
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`router-ui listening: http://127.0.0.1:${port}`);
});

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port") out.port = argv[++i];
    else if (argv[i] === "--project") out.project = argv[++i];
  }
  return out;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function json(res, value, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

// --- Thread migration helpers ---

function listThreads() {
  const db = new DatabaseSync(DB_PATH, { open: true, readOnly: true });
  try {
    const rows = db.prepare(
      "select id, title, model_provider, model, updated_at from threads order by updated_at desc limit 100"
    ).all();
    const grouped = {};
    for (const row of rows) {
      const p = row.model_provider || "unknown";
      if (!grouped[p]) grouped[p] = [];
      grouped[p].push({
        id: row.id,
        title: row.title,
        model: row.model,
        updated_at: row.updated_at
      });
    }
    const threadProviders = Object.keys(grouped);
    // Read provider display names from config.toml
    const providerNames = { "openai": "GPT / OpenAI" };
    try {
      const configPath = os.homedir() + "/.codex/config.toml";
      const configText = fs.readFileSync(configPath, "utf8");
      const sectionRe = /^\[model_providers\.([^\]]+)\]/gm;
      const nameRe = /^name\s*=\s*"([^"]+)"/m;
      let m;
      while ((m = sectionRe.exec(configText)) !== null) {
        const id = m[1];
        const sectionStart = m.index;
        const nextSection = configText.indexOf("\n[", sectionStart + 1);
        const sectionEnd = nextSection === -1 ? configText.length : nextSection;
        const section = configText.slice(sectionStart, sectionEnd);
        const nameMatch = nameRe.exec(section);
        providerNames[id] = nameMatch ? nameMatch[1] : id;
      }
    } catch {}
    // Build providers list: all from config + threads
    const allProviderIds = new Set(["openai", ...Object.keys(providerNames), ...threadProviders]);
    const providers = [...allProviderIds].sort().map(id => ({
      id,
      name: providerNames[id] || id
    }));
    // Ensure all providers have an entry in grouped
    for (const p of providers) {
      if (!grouped[p.id]) grouped[p.id] = [];
    }
    return { providers, threads: grouped };
  } finally {
    db.close();
  }
}

function migrateThread(threadId, targetProvider) {
  if (!threadId || !targetProvider) throw new Error("threadId and targetProvider are required");

  // 1. Read current thread info
  const db = new DatabaseSync(DB_PATH, { open: true });
  try {
    const thread = db.prepare("select id, model, model_provider from threads where id = ?").get(threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);
    const fromProvider = thread.model_provider;

    // 2. Update SQLite
    const now = Math.floor(Date.now() / 1000);
    db.prepare("update threads set model_provider = ?, updated_at = ? where id = ?").run(targetProvider, now, threadId);

    const updated = db.prepare("select id, title, model_provider, model from threads where id = ?").get(threadId);

    // 3. Update session JSONL file
    let sessionUpdated = false;
    if (fs.existsSync(SESSIONS_DIR)) {
      const walk = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            walk(full);
          } else if (e.name.includes(threadId) && e.name.endsWith(".jsonl")) {
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const bak = full + `.bak-migrate-${stamp}`;
            fs.copyFileSync(full, bak);
            const text = fs.readFileSync(full, "utf8");
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              try {
                const item = JSON.parse(lines[i]);
                if (item.type === "session_meta" && item.payload) {
                  item.payload.model_provider = targetProvider;
                  lines[i] = JSON.stringify(item);
                  break;
                }
              } catch {}
            }
            fs.writeFileSync(full, lines.join("\n"));
            sessionUpdated = full;
          }
        }
      };
      walk(SESSIONS_DIR);
    }

    return {
      threadId,
      title: updated.title,
      from: fromProvider,
      to: targetProvider,
      model: updated.model,
      sessionUpdated
    };
  } finally {
    db.close();
  }
}

// --- HTML pages ---

function html(res, headOnly = false) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (headOnly) return res.end();
  res.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Model Router</title>
<style>
:root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
body { margin: 0; background: #f7f7f5; color: #1f2428; }
main { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 100vh; }
aside { border-right: 1px solid #deded8; padding: 18px; background: #fbfbf8; }
section { display: grid; grid-template-rows: auto 1fr auto; min-width: 0; }
h1 { font-size: 18px; margin: 0 0 16px; }
label { display: block; font-size: 12px; color: #5d646b; margin: 14px 0 6px; }
select, textarea, button { font: inherit; }
select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfcfca; border-radius: 6px; background: white; color: #1f2428; }
select { height: 36px; padding: 0 8px; }
textarea { min-height: 110px; resize: vertical; padding: 10px; line-height: 1.45; }
button { height: 36px; border: 1px solid #252a2f; background: #252a2f; color: white; border-radius: 6px; padding: 0 12px; cursor: pointer; }
button.secondary { background: transparent; color: #252a2f; }
.topbar { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #deded8; padding: 12px 16px; }
.log { overflow: auto; padding: 18px; }
.msg { max-width: 980px; white-space: pre-wrap; border-bottom: 1px solid #e5e5df; padding: 14px 0; line-height: 1.5; }
.msg b { display: block; font-size: 12px; color: #5d646b; margin-bottom: 6px; }
.composer { border-top: 1px solid #deded8; padding: 14px 16px; background: #fbfbf8; }
.row { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
.row button { flex: 0 0 auto; }
.status { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; white-space: pre-wrap; color: #3f464d; }
.nav { font-size: 13px; margin-top: 24px; border-top: 1px solid #deded8; padding-top: 14px; }
.nav a { color: #3f5f8f; text-decoration: none; }
.nav a:hover { text-decoration: underline; }
@media (max-width: 760px) { main { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid #deded8; } }
</style>
</head>
<body>
<main>
<aside>
  <h1>Model Router</h1>
  <label for="model">Model</label>
  <select id="model"></select>
  <div class="row">
    <button id="set">Set</button>
    <button class="secondary" id="handoff">Handoff</button>
  </div>
  <label>Status</label>
  <div class="status" id="status">loading</div>
  <div class="nav">
    <a href="/settings">Settings</a> &middot; <a href="/migrate">Migrate</a>
  </div>
</aside>
<section>
  <div class="topbar"><strong>Router Chat</strong><span id="active"></span></div>
  <div class="log" id="log"></div>
  <div class="composer">
    <textarea id="prompt" placeholder="Ask the router..."></textarea>
    <div class="row">
      <button id="send">Send</button>
      <select id="task">
        <option value="">auto/default</option>
        <option value="architecture">architecture</option>
        <option value="complex_debug">complex debug</option>
        <option value="code_review">code review</option>
        <option value="implementation">implementation</option>
        <option value="tests">tests</option>
        <option value="summarization">summarization</option>
      </select>
    </div>
  </div>
</section>
</main>
<script>
const statusEl = document.querySelector("#status");
const modelEl = document.querySelector("#model");
const activeEl = document.querySelector("#active");
const logEl = document.querySelector("#log");
async function api(path, body) {
  const res = await fetch(path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "request failed");
  return json;
}
async function refresh() {
  const status = await api("/api/status");
  modelEl.innerHTML = ["auto", ...status.models].map(m => '<option value="'+m+'">'+m+'</option>').join("");
  modelEl.value = status.sticky_model || "auto";
  activeEl.textContent = status.sticky_model || "auto";
  statusEl.textContent = JSON.stringify(status, null, 2);
}
function add(role, text) {
  const el = document.createElement("div");
  el.className = "msg";
  el.innerHTML = "<b></b><span></span>";
  el.querySelector("b").textContent = role;
  el.querySelector("span").textContent = text;
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
}
document.querySelector("#set").onclick = async () => { await api("/api/set-model", { model: modelEl.value }); await refresh(); };
document.querySelector("#handoff").onclick = async () => { const r = await api("/api/handoff", {}); add("handoff", "written: " + r.file); };
document.querySelector("#send").onclick = async () => {
  const prompt = document.querySelector("#prompt").value.trim();
  if (!prompt) return;
  document.querySelector("#prompt").value = "";
  add("you", prompt);
  add("router", "thinking...");
  const pending = logEl.lastChild.querySelector("span");
  try {
    const result = await api("/api/ask", { prompt, taskType: document.querySelector("#task").value || undefined });
    pending.textContent = "[" + result.model + "]\\n" + result.output;
  } catch (err) {
    pending.textContent = "error: " + err.message;
  }
};
refresh().catch(err => { statusEl.textContent = err.message; });
</script>
</body>
</html>`);
}

function settingsHtml(res, headOnly = false) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (headOnly) return res.end();
  res.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Youlin Settings</title>
<style>
:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
body { margin: 0; background: #f7f7f5; color: #202428; }
main { max-width: 980px; margin: 0 auto; padding: 28px 18px 48px; }
h1 { font-size: 28px; margin: 0 0 8px; }
h2 { font-size: 18px; margin: 26px 0 12px; }
p { color: #555f68; line-height: 1.5; }
.panel { border: 1px solid #d8d8d2; border-radius: 8px; background: #fff; padding: 18px; margin-top: 16px; }
label { display: block; font-size: 12px; color: #5d646b; margin: 14px 0 6px; }
input, select, button { font: inherit; }
input, select { width: 100%; box-sizing: border-box; height: 38px; border: 1px solid #cfcfca; border-radius: 6px; padding: 0 10px; background: #fff; color: #202428; }
button { height: 38px; border: 1px solid #252a2f; background: #252a2f; color: #fff; border-radius: 6px; padding: 0 14px; cursor: pointer; }
button.secondary { background: transparent; color: #252a2f; }
.row { display: flex; gap: 10px; align-items: end; }
.row > * { flex: 1; }
.row button { flex: 0 0 auto; }
.status { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; background: #f2f2ee; border-radius: 6px; padding: 12px; }
.msg { margin-top: 12px; white-space: pre-wrap; color: #2f5f3b; }
.warn { color: #8a5a00; }
.nav { margin-top: 32px; }
.nav a { color: #3f5f8f; text-decoration: none; }
.nav a:hover { text-decoration: underline; }
@media (max-width: 720px) { .row { display: block; } .row button { margin-top: 10px; width: 100%; } }
</style>
</head>
<body>
<main>
  <h1>Youlin Settings</h1>
  <p>这里切换的是 Codex 主对话框模型。切换或新增后，需要完全退出并重新打开 Codex。</p>

  <div class="panel">
    <h2>Current Codex Model</h2>
    <div class="status" id="current">loading</div>
    <div class="row">
      <div>
        <label for="preset">Preset</label>
        <select id="preset"></select>
      </div>
      <button id="switch">Use in Codex</button>
    </div>
    <div class="msg" id="switch-msg"></div>
  </div>

  <div class="panel">
    <h2>Add OpenAI-Compatible Model</h2>
    <p class="warn">API key 只保存到本机 secrets.env，不会显示完整内容。Base URL 必须是 OpenAI-compatible /v1 接口。</p>
    <label for="id">Local ID</label>
    <input id="id" placeholder="kimi, glm, qwen_custom">
    <label for="label">Display Name</label>
    <input id="label" placeholder="Kimi K2">
    <label for="baseUrl">Base URL</label>
    <input id="baseUrl" placeholder="https://api.example.com/v1">
    <label for="model">Model ID</label>
    <input id="model" placeholder="model-name">
    <label for="apiKeyEnv">API Key Env Name</label>
    <input id="apiKeyEnv" placeholder="KIMI_API_KEY">
    <label for="apiKey">API Key</label>
    <input id="apiKey" type="password" placeholder="sk-...">
    <label for="contextWindow">Context Window</label>
    <input id="contextWindow" value="128000">
    <div class="row">
      <button id="save">Save Model</button>
      <button class="secondary" id="open-router">Open Router Chat</button>
    </div>
    <div class="msg" id="save-msg"></div>
  </div>

  <div class="nav">
    <a href="/">Router Chat</a> &middot; <a href="/migrate">Migrate Threads</a>
  </div>
</main>
<script>
async function api(path, body) {
  const res = await fetch(path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "request failed");
  return json;
}
async function refresh() {
  const data = await api("/api/codex/status");
  document.querySelector("#current").textContent = data.current || "No model config found.";
  document.querySelector("#preset").innerHTML = data.presets.map(p => '<option value="'+p.id+'">'+p.label+' ('+p.id+')</option>').join("");
}
document.querySelector("#switch").onclick = async () => {
  const msg = document.querySelector("#switch-msg");
  msg.textContent = "switching...";
  try {
    const result = await api("/api/codex/switch", { preset: document.querySelector("#preset").value });
    msg.textContent = "Switched to " + result.label + "\\nConfig: " + result.configPath + "\\nRestart Codex to apply.";
    await refresh();
  } catch (err) {
    msg.textContent = "error: " + err.message;
  }
};
document.querySelector("#save").onclick = async () => {
  const msg = document.querySelector("#save-msg");
  msg.textContent = "saving...";
  const body = {};
  for (const id of ["id","label","baseUrl","model","apiKeyEnv","apiKey","contextWindow"]) body[id] = document.querySelector("#"+id).value.trim();
  try {
    const result = await api("/api/codex/custom-model", body);
    msg.textContent = "Saved model " + result.id + ". It is now available as custom:" + result.id;
    await refresh();
  } catch (err) {
    msg.textContent = "error: " + err.message;
  }
};
document.querySelector("#open-router").onclick = () => { location.href = "/"; };
refresh().catch(err => { document.querySelector("#current").textContent = err.message; });
</script>
</body>
</html>`);
}


// --- Migrate page helpers ---

const MIGRATE_HTML_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrate.html");

function regenerateMigrateHtml() {
  const script = [
    'const fs = require("fs");',
    'const os = require("os");',
    'const { DatabaseSync } = require("node:sqlite");',
    'const DB_PATH = os.homedir() + "/.codex/state_5.sqlite";',
    'const db = new DatabaseSync(DB_PATH, { open: true, readOnly: true });',
    'const rows = db.prepare("select id, title, model_provider, model, updated_at from threads order by updated_at desc limit 100").all();',
    'db.close();',
    'const grouped = {};',
    'for (const row of rows) {',
    '  const p = row.model_provider || "unknown";',
    '  if (!grouped[p]) grouped[p] = [];',
    '  grouped[p].push({ id: row.id, title: row.title, model: row.model, updated_at: row.updated_at });',
    '}',
    'const providers = Object.keys(grouped).sort();',
    'const dataJson = JSON.stringify({ providers, threads: grouped });',
    'const template = fs.readFileSync("' + MIGRATE_HTML_PATH + '.template", "utf8");',
    'const html = template.replace("__THREAD_DATA_PLACEHOLDER__", dataJson);',
    'fs.writeFileSync("' + MIGRATE_HTML_PATH + '", html);',
  ].join("\n");
  try {
    execSync("node -e " + JSON.stringify(script), { timeout: 3000, stdio: "pipe" });
  } catch (e) {
    console.error("regenerate migrate html failed:", e.message);
  }
}

function serveMigrateHtml(res, headOnly) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (headOnly) return res.end();
  try {
    const html = fs.readFileSync(MIGRATE_HTML_PATH, "utf8");
    res.end(html);
  } catch {
    res.end("migrate page not ready, please refresh");
  }
}


// --- Desktop app handlers ---

function desktopHtml(res, headOnly = false) {
  const filePath = fileURLToPath(new URL("./youlin-desktop.html", import.meta.url));
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate", "pragma": "no-cache" });
  if (headOnly) return res.end();
  const html = fs.readFileSync(filePath, "utf8");
  res.end(html);
}

async function quickSwitchDesktop(target) {
  const presetMap = {
    deepseek: "deepseek-v4-pro",
    gpt: "gpt",
    qwen: "qwen",
  };
  const preset = presetMap[target] || target;
  return switchCodexPreset(preset);
}

async function restartCodexDesktop() {
  try {
    if (process.platform === "darwin") {
      execSync(`(/usr/bin/osascript -e 'tell application "Codex" to quit' >/dev/null 2>&1; sleep 1; /usr/bin/open -a Codex >/dev/null 2>&1) &`, {
        stdio: "ignore",
        shell: "/bin/bash",
      });
      return { success: true, message: "已发送重启 Codex 指令。" };
    }

    if (process.platform === "win32") {
      const script = [
        "$p = Get-Process | Where-Object { $_.ProcessName -like 'Codex*' } | Select-Object -First 1",
        "$path = if ($p) { $p.Path } else { $null }",
        "if ($p) { Stop-Process -Id $p.Id -Force }",
        "Start-Sleep -Seconds 1",
        "if ($path) { Start-Process -FilePath $path } else { Start-Process 'Codex' }",
      ].join("; ");
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command ${JSON.stringify(script)}`, { stdio: "ignore" });
      return { success: true, message: "已发送重启 Codex 指令。" };
    }

    return { success: false, message: "当前系统暂不支持一键重启 Codex。" };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}

async function addProviderDesktop(body) {
  const {
    providerName, note, website, apiKey, baseURL, modelName, contextWindow, useCompleteURL
  } = body;

  if (!providerName || !baseURL || !modelName) {
    return { success: false, message: "供应商名称、API地址、模型名称为必填" };
  }

  const id = "youlin-" + slug(providerName);
  const envKey = slug(providerName).toUpperCase().replace(/-/g, "_") + "_API_KEY";
  const label = providerName;

  try {
    const result = await saveCustomModel({ id, label, baseUrl: baseURL, model: modelName, apiKeyEnv: envKey, apiKey, contextWindow: contextWindow || 128000 });
    return { success: true, message: `已切换到 ${label}。完全退出并重新打开 Codex。\nResult: ${result}` };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}

async function fetchModelsFromProvider(baseURL, apiKey) {
  const modelsURL = baseURL.replace(/\/+$/, "") + "/models";
  try {
    const headers = { "Accept": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const resp = await fetch(modelsURL, { headers, signal: AbortSignal.timeout(10000) });
    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      if (data.data && Array.isArray(data.data)) {
        return { models: data.data.map(m => m.id || JSON.stringify(m)).slice(0, 50).join("\n") };
      }
      return { models: text.slice(0, 5000) };
    } catch {
      return { models: text.slice(0, 5000) };
    }
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

function slug(value) {
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

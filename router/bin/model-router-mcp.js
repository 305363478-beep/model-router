#!/usr/bin/env node
import { ensureDefaultConfig } from "../lib/config.js";
import { getStatus, setModel, ask, auto, handoff, packedContext } from "../lib/router.js";

await ensureDefaultConfig(process.cwd());

const tools = [
  {
    name: "router_status",
    description: "Show model router mode, sticky model, aliases, fallback order, and configured models.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "router_set_model",
    description: "Set sticky model. Use model=auto to return to policy routing.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" }
      },
      required: ["model"]
    }
  },
  {
    name: "router_ask",
    description: "Ask a specific model, including optional project context.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        model: { type: "string" },
        cwd: { type: "string" },
        files: { type: "array", items: { type: "string" } },
        includeDiff: { type: "boolean" },
        includeSummary: { type: "boolean" },
        taskType: { type: "string" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "router_auto",
    description: "Route a task by policy. taskType can be architecture, complex_debug, code_review, implementation, tests, summarization, long_context_scan, cheap_task.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        taskType: { type: "string" },
        cwd: { type: "string" },
        files: { type: "array", items: { type: "string" } },
        includeDiff: { type: "boolean" },
        includeSummary: { type: "boolean" }
      },
      required: ["prompt"]
    }
  },
  {
    name: "router_pack_context",
    description: "Pack current project summary, git diff, and selected files into a context block.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" },
        files: { type: "array", items: { type: "string" } },
        includeDiff: { type: "boolean" },
        includeSummary: { type: "boolean" }
      }
    }
  },
  {
    name: "router_handoff",
    description: "Generate .codex-router/handoff.md for continuing outside Codex.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string" }
      }
    }
  }
];

async function handle(method, params = {}) {
  if (method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "model-router", version: "0.1.0" }
    };
  }
  if (method === "tools/list") return { tools };
  if (method === "tools/call") return callTool(params.name, params.arguments || {});
  if (method === "ping") return {};
  return {};
}

async function callTool(name, args) {
  let result;
  if (name === "router_status") result = await getStatus();
  else if (name === "router_set_model") result = await setModel(args.model);
  else if (name === "router_ask") result = await ask(args);
  else if (name === "router_auto") result = await auto(args);
  else if (name === "router_pack_context") result = await packedContext(args);
  else if (name === "router_handoff") result = await handoff(args);
  else throw new Error(`Unknown tool: ${name}`);

  return {
    content: [
      {
        type: "text",
        text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
      }
    ]
  };
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const parsed = readMessage(buffer);
    if (!parsed) break;
    buffer = parsed.rest;
    await dispatch(parsed.message);
  }
});

async function dispatch(message) {
  if (!message.id && message.method?.startsWith("notifications/")) return;
  try {
    const result = await handle(message.method, message.params);
    writeMessage({ jsonrpc: "2.0", id: message.id, result });
  } catch (err) {
    writeMessage({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32000, message: err.message || String(err) }
    });
  }
}

function readMessage(input) {
  const sep = input.indexOf("\r\n\r\n");
  if (sep === -1) return null;
  const header = input.slice(0, sep).toString("utf8");
  const match = header.match(/content-length:\s*(\d+)/i);
  if (!match) throw new Error("Missing Content-Length header");
  const length = Number(match[1]);
  const start = sep + 4;
  const end = start + length;
  if (input.length < end) return null;
  const body = input.slice(start, end).toString("utf8");
  return { message: JSON.parse(body), rest: input.slice(end) };
}

function writeMessage(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

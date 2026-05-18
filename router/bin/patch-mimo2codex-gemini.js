#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DUMMY_SIGNATURE = "skip_thought_signature_validator";

function npmRootGlobal() {
  return execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
}

function patchReqToChat(root) {
  const file = path.join(root, "dist", "translate", "reqToChat.js");
  let text = fs.readFileSync(file, "utf8");
  let changed = false;

  if (!text.includes("GEMINI_DUMMY_THOUGHT_SIGNATURE")) {
    text = text.replace(
      "function inputItemsToMessages(items, ctx) {",
      `const GEMINI_DUMMY_THOUGHT_SIGNATURE = "${DUMMY_SIGNATURE}";
function normalizeGoogleExtraContent(item, isFirstToolCallInStep) {
    const source = item.extra_content ?? item.extraContent;
    const google = source?.google ?? {};
    const thoughtSignature = google.thought_signature ??
        google.thoughtSignature ??
        item.thought_signature ??
        item.thoughtSignature;
    if (!thoughtSignature && !isFirstToolCallInStep)
        return source;
    return {
        ...(source ?? {}),
        google: {
            ...google,
            thought_signature: thoughtSignature ?? GEMINI_DUMMY_THOUGHT_SIGNATURE,
        },
    };
}
function inputItemsToMessages(items, ctx) {`
    );
    changed = true;
  }

  const oldBlock = `            case "function_call": {
                state.pendingToolCalls.push({
                    id: item.call_id,
                    type: "function",
                    function: { name: item.name, arguments: item.arguments },
                });
                break;
            }`;
  const newBlock = `            case "function_call": {
                const isFirstToolCallInStep = state.pendingToolCalls.length === 0;
                const toolCall = {
                    id: item.call_id,
                    type: "function",
                    function: { name: item.name, arguments: item.arguments },
                };
                const extraContent = normalizeGoogleExtraContent(item, isFirstToolCallInStep);
                if (extraContent)
                    toolCall.extra_content = extraContent;
                state.pendingToolCalls.push(toolCall);
                break;
            }`;
  if (text.includes(oldBlock)) {
    text = text.replace(oldBlock, newBlock);
    changed = true;
  }

  if (changed) fs.writeFileSync(file, text, "utf8");
  return changed;
}

function patchRespToResponses(root) {
  const file = path.join(root, "dist", "translate", "respToResponses.js");
  let text = fs.readFileSync(file, "utf8");
  const oldBlock = `    if (message?.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
            output.push({
                type: "function_call",
                id: newFunctionCallId(),
                call_id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
                status: "completed",
            });
        }
    }`;
  const newBlock = `    if (message?.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
            const item = {
                type: "function_call",
                id: newFunctionCallId(),
                call_id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
                status: "completed",
            };
            if (tc.extra_content)
                item.extra_content = tc.extra_content;
            output.push(item);
        }
    }`;
  if (!text.includes(oldBlock)) return false;
  text = text.replace(oldBlock, newBlock);
  fs.writeFileSync(file, text, "utf8");
  return true;
}

function patchStreamToSse(root) {
  const file = path.join(root, "dist", "translate", "streamToSse.js");
  let text = fs.readFileSync(file, "utf8");
  let changed = false;

  if (!text.includes("extraContent: null")) {
    text = text.replace(
      `        argsBuffer: "",
        argsEmitted: false,`,
      `        argsBuffer: "",
        argsEmitted: false,
        extraContent: null,`
    );
    changed = true;
  }

  if (!text.includes("...(tc.extraContent ? { extra_content: tc.extraContent } : {})")) {
    text = text.replace(
      `            name: tc.name,
            arguments: "",
            status: "in_progress",`,
      `            name: tc.name,
            arguments: "",
            status: "in_progress",
            ...(tc.extraContent ? { extra_content: tc.extraContent } : {}),`
    );
    text = text.replace(
      `            name: tc.name,
            arguments: tc.argsBuffer,
            status: "completed",`,
      `            name: tc.name,
            arguments: tc.argsBuffer,
            status: "completed",
            ...(tc.extraContent ? { extra_content: tc.extraContent } : {}),`
    );
    changed = true;
  }

  if (!text.includes("tc.extraContent = tcDelta.extra_content")) {
    text = text.replace(
      `            else if (tcDelta.function?.name && !tc.name) {
                tc.name = tcDelta.function.name;
            }
            if (tcDelta.function?.arguments) {`,
      `            else if (tcDelta.function?.name && !tc.name) {
                tc.name = tcDelta.function.name;
            }
            if (tcDelta.extra_content) {
                tc.extraContent = tcDelta.extra_content;
            }
            if (tcDelta.function?.arguments) {`
    );
    changed = true;
  }

  if (changed) fs.writeFileSync(file, text, "utf8");
  return changed;
}

const root = path.join(npmRootGlobal(), "mimo2codex");
if (!fs.existsSync(root)) {
  console.error(`mimo2codex not found at ${root}`);
  process.exit(1);
}

const changes = [
  patchReqToChat(root),
  patchRespToResponses(root),
  patchStreamToSse(root),
];

for (const rel of [
  "dist/translate/reqToChat.js",
  "dist/translate/respToResponses.js",
  "dist/translate/streamToSse.js",
]) {
  execFileSync(process.execPath, ["--check", path.join(root, rel)], { stdio: "inherit" });
}

console.log(
  changes.some(Boolean)
    ? "Patched mimo2codex Gemini thought signature compatibility."
    : "mimo2codex Gemini thought signature compatibility already patched."
);

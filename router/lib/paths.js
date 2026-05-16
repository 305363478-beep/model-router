import os from "node:os";
import path from "node:path";

export function routerHome() {
  return process.env.MODEL_ROUTER_HOME || path.join(os.homedir(), ".model-router");
}

export function projectRouterDir(cwd = process.cwd()) {
  return path.join(cwd, ".codex-router");
}

export function configDir() {
  return path.join(routerHome(), "config");
}

export function sessionsDir() {
  return path.join(routerHome(), "sessions");
}

export function logsDir() {
  return path.join(routerHome(), "logs");
}

export function resolveHome(file) {
  return path.join(routerHome(), file);
}

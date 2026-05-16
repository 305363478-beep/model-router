#!/usr/bin/env node
import { ensureDefaultConfig } from "../lib/config.js";
import { routerHome, configDir, projectRouterDir } from "../lib/paths.js";

await ensureDefaultConfig(process.cwd());
console.log(`model-router initialized
home: ${routerHome()}
config: ${configDir()}
project state: ${projectRouterDir(process.cwd())}

Next:
1. Edit config/secrets.env with API keys.
2. Run router-doctor.
3. Register bin/model-router-mcp.js in Codex MCP config, or use the install script.`);

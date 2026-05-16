import fs from "node:fs/promises";
import path from "node:path";

export async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readTextIfExists(file, fallback = "") {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return fallback;
  }
}

export async function writeTextAtomic(file, text) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, file);
}

export async function appendJsonl(file, obj) {
  await ensureDir(path.dirname(file));
  await fs.appendFile(file, `${JSON.stringify(obj)}\n`, "utf8");
}

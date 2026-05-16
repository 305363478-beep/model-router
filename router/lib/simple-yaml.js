export function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = text.split(/\r?\n/);

  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const raw = lines[lineNo];
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();

    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).value;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) throw new Error(`YAML list item has no list parent: ${raw}`);
      const item = line.slice(2).trim();
      if (!item) {
        const obj = {};
        parent.push(obj);
        stack.push({ indent, value: obj });
      } else {
        parent.push(parseScalar(item));
      }
      continue;
    }

    const idx = line.indexOf(":");
    if (idx === -1) throw new Error(`Invalid YAML line: ${raw}`);
    const key = line.slice(0, idx).trim();
    const rest = line.slice(idx + 1).trim();

    if (rest) {
      parent[key] = parseScalar(rest);
      continue;
    }

    const nextLine = lines.slice(lineNo + 1).find((candidate) => candidate.trim() && !candidate.trimStart().startsWith("#"));
    const nextIsList = nextLine && nextLine.match(/^\s*/)[0].length > indent && nextLine.trim().startsWith("- ");
    parent[key] = nextIsList ? [] : {};
    stack.push({ indent, value: parent[key] });
  }

  return root;
}

export function dumpYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object") return `${pad}-\n${dumpYaml(item, indent + 2)}`;
      return `${pad}- ${formatScalar(item)}`;
    }).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === "object") return `${pad}${key}:\n${dumpYaml(item, indent + 2)}`;
      return `${pad}${key}: ${formatScalar(item)}`;
    }).join("\n");
  }
  return `${pad}${formatScalar(value)}`;
}

function formatScalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (/^[A-Za-z0-9_.:/@{}-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

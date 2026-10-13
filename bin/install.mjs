#!/usr/bin/env node
// Installs this package's skill into a skills folder.
//
//   npx <package>                 ./.claude/skills/<skill>   (this project)
//   npx <package> --global        ~/.claude/skills/<skill>   (every project)
//   npx <package> --dir <path>    <path>/<skill>             (other agents, e.g. .agents/skills)
//
// Re-running replaces the installed copy, which is how you update.

import { cp, readFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("usage: npx <package> [--global | --dir <skills folder>]");
  process.exit(0);
}

const skill = (await readFile(join(root, "SKILL.md"), "utf8")).match(/^name:\s*(.+)$/m)?.[1].trim();
if (!skill) {
  console.error("SKILL.md has no name: field");
  process.exit(1);
}

const dirFlag = args.indexOf("--dir");
const base = dirFlag >= 0 && args[dirFlag + 1]
  ? resolve(args[dirFlag + 1])
  : args.includes("--global")
    ? join(homedir(), ".claude", "skills")
    : join(process.cwd(), ".claude", "skills");
const target = join(base, skill);

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const entry of ["SKILL.md", "references", "scripts"]) {
  if (existsSync(join(root, entry))) await cp(join(root, entry), join(target, entry), { recursive: true });
}

console.log(`Installed the ${skill} skill to ${target}`);
console.log(`Ask your agent for it by task, or run /${skill} in Claude Code.`);

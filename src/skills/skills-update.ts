import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const explicitOnly = /^disable-model-invocation:\s*true\s*$/m;

function alignOpenAiPolicy(yaml: string): string {
  if (/^ {2}allow_implicit_invocation:\s*false\s*$/m.test(yaml)) return yaml;
  if (/^ {2}allow_implicit_invocation:/m.test(yaml)) {
    return yaml.replace(
      /^ {2}allow_implicit_invocation:.*$/m,
      "  allow_implicit_invocation: false",
    );
  }
  if (/^policy:\s*$/m.test(yaml)) {
    return yaml.replace(
      /^policy:\s*$/m,
      "policy:\n  allow_implicit_invocation: false",
    );
  }
  return `${yaml.trimEnd()}${yaml.trim() ? "\n" : ""}policy:\n  allow_implicit_invocation: false\n`;
}

export async function normalizeSkills(skillsDir: string): Promise<number> {
  let changed = 0;

  for (const entry of await fs.readdir(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skill = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8");
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    if (!explicitOnly.test(frontmatter)) continue;

    const openAiPath = path.join(skillDir, "agents", "openai.yaml");
    const current = await fs.readFile(openAiPath, "utf8").catch(() => "");
    const aligned = alignOpenAiPolicy(current);
    if (aligned === current) continue;

    await fs.mkdir(path.dirname(openAiPath), { recursive: true });
    await fs.writeFile(openAiPath, aligned);
    changed++;
  }

  return changed;
}

async function main(): Promise<void> {
  const update = spawnSync("npx", ["-y", "skills", "update", "-g", "-y"], {
    stdio: "inherit",
  });
  if (update.status !== 0) process.exit(update.status ?? 1);

  const changed = await normalizeSkills(path.resolve("dotfiles/agents/skills"));
  console.log(
    `Aligned ${changed} skill${changed === 1 ? "" : "s"} with OpenAI.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();

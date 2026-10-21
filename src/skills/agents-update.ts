import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const explicitOnly = /^disable-model-invocation:\s*true\s*$/m;
const autoinvokeEntry = /^ {2}["']?opencode\/autoinvoke["']?:.*$/m;

function alignOpenCodeAutoinvoke(yaml: string): string {
  if (/^ {2}["']?opencode\/autoinvoke["']?:\s*false\s*$/m.test(yaml))
    return yaml;
  if (autoinvokeEntry.test(yaml)) {
    return yaml.replace(autoinvokeEntry, "  opencode/autoinvoke: false");
  }
  if (/^metadata:\s*$/m.test(yaml)) {
    return yaml.replace(
      /^metadata:\s*$/m,
      "metadata:\n  opencode/autoinvoke: false",
    );
  }
  return `${yaml.trimEnd()}${yaml.trim() ? "\n" : ""}metadata:\n  opencode/autoinvoke: false\n`;
}

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
    const skillPath = path.join(skillDir, "SKILL.md");
    const skill = await fs.readFile(skillPath, "utf8");
    const match = skill.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = match?.[1] ?? "";
    if (!explicitOnly.test(frontmatter)) continue;

    let skillChanged = false;

    const alignedFrontmatter = alignOpenCodeAutoinvoke(frontmatter);
    if (match && alignedFrontmatter !== frontmatter) {
      await fs.writeFile(
        skillPath,
        skill.replace(match[0], `---\n${alignedFrontmatter}\n---`),
      );
      skillChanged = true;
    }

    const openAiPath = path.join(skillDir, "agents", "openai.yaml");
    const current = await fs.readFile(openAiPath, "utf8").catch(() => "");
    const aligned = alignOpenAiPolicy(current);
    if (aligned !== current) {
      await fs.mkdir(path.dirname(openAiPath), { recursive: true });
      await fs.writeFile(openAiPath, aligned);
      skillChanged = true;
    }

    if (skillChanged) changed++;
  }

  return changed;
}

// Playwriter serves its skill docs.
const managedTools = ["playwriter@latest"];

function updateManagedTools(): void {
  const install = spawnSync("npm", ["install", "-g", ...managedTools], {
    stdio: "inherit",
  });
  if (install.error) throw install.error;
  if (install.status !== 0) {
    throw new Error(`Tool update failed with status ${install.status}.`);
  }
}

async function main(): Promise<void> {
  const update = spawnSync("npx", ["-y", "skills", "update", "-g", "-y"], {
    stdio: "inherit",
  });
  if (update.status !== 0) process.exit(update.status ?? 1);

  updateManagedTools();

  const changed = await normalizeSkills(path.resolve("dotfiles/agents/skills"));
  console.log(
    `Aligned ${changed} skill${changed === 1 ? "" : "s"} with OpenAI and OpenCode.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();

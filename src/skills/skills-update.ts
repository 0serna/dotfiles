import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
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

export async function syncSkillDirectories(
  generatedDir: string,
  skillsDir: string,
): Promise<number> {
  const generated = (await fs.readdir(generatedDir, { withFileTypes: true }))
    .filter(
      (entry) => entry.isDirectory() && entry.name.startsWith("openspec-"),
    )
    .map((entry) => entry.name);

  if (generated.length === 0) {
    throw new Error("OpenSpec did not generate any skills.");
  }

  await fs.mkdir(skillsDir, { recursive: true });
  const existing = await fs.readdir(skillsDir, { withFileTypes: true });

  for (const entry of existing) {
    if (
      entry.isDirectory() &&
      entry.name.startsWith("openspec-") &&
      !generated.includes(entry.name)
    ) {
      await fs.rm(path.join(skillsDir, entry.name), {
        recursive: true,
        force: true,
      });
    }
  }

  for (const name of generated) {
    const destination = path.join(skillsDir, name);
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(path.join(generatedDir, name), destination, {
      recursive: true,
    });
  }

  return generated.length;
}

export async function syncOpenSpecSkills(skillsDir: string): Promise<number> {
  const install = spawnSync(
    "npm",
    ["install", "-g", "@fission-ai/openspec@latest"],
    { stdio: "inherit" },
  );
  if (install.error) throw install.error;
  if (install.status !== 0) {
    throw new Error(`OpenSpec install failed with status ${install.status}.`);
  }

  const temporaryDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "openspec-skills-"),
  );
  const projectDir = path.join(temporaryDir, "project");

  try {
    await fs.mkdir(projectDir);
    const result = spawnSync(
      "openspec",
      ["init", projectDir, "--tools", "codex"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          OPENSPEC_NO_ANIMATION: "1",
          OPENSPEC_NO_UPDATE_CHECK: "1",
          OPENSPEC_TELEMETRY: "0",
          XDG_CONFIG_HOME: path.join(temporaryDir, "config"),
          XDG_DATA_HOME: path.join(temporaryDir, "data"),
        },
      },
    );

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`OpenSpec init failed with status ${result.status}.`);
    }

    return await syncSkillDirectories(
      path.join(projectDir, ".agents", "skills"),
      skillsDir,
    );
  } finally {
    await fs.rm(temporaryDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const update = spawnSync("npx", ["-y", "skills", "update", "-g", "-y"], {
    stdio: "inherit",
  });
  if (update.status !== 0) process.exit(update.status ?? 1);

  const skillsDir = path.resolve("dotfiles/agents/skills");
  const synced = await syncOpenSpecSkills(skillsDir);
  console.log(`Synced ${synced} OpenSpec skills.`);

  const changed = await normalizeSkills(skillsDir);
  console.log(
    `Aligned ${changed} skill${changed === 1 ? "" : "s"} with OpenAI.`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();

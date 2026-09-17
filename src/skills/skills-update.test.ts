import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeSkills, syncSkillDirectories } from "./skills-update.ts";

let tmpDir: string;

async function addSkill(name: string, openAiYaml?: string) {
  const skillDir = path.join(tmpDir, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: Test\ndisable-model-invocation: true\n---\n`,
  );
  if (openAiYaml !== undefined) {
    await fs.mkdir(path.join(skillDir, "agents"));
    await fs.writeFile(
      path.join(skillDir, "agents", "openai.yaml"),
      openAiYaml,
    );
  }
}

describe("normalizeSkills", () => {
  afterEach(async () => fs.rm(tmpDir, { recursive: true, force: true }));

  it("aligns explicit-only skills and preserves existing metadata", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-"));
    await addSkill("missing");
    await addSkill("metadata", 'interface:\n  display_name: "Test"\n');
    await addSkill("conflict", "policy:\n  allow_implicit_invocation: true\n");

    expect(await normalizeSkills(tmpDir)).toBe(3);
    expect(await normalizeSkills(tmpDir)).toBe(0);
    expect(
      await fs.readFile(
        path.join(tmpDir, "metadata", "agents", "openai.yaml"),
        "utf8",
      ),
    ).toBe(
      'interface:\n  display_name: "Test"\npolicy:\n  allow_implicit_invocation: false\n',
    );
  });
});

describe("syncSkillDirectories", () => {
  afterEach(async () => fs.rm(tmpDir, { recursive: true, force: true }));

  it("replaces OpenSpec skills and preserves unrelated skills", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-"));
    const generated = path.join(tmpDir, "generated");
    const installed = path.join(tmpDir, "installed");

    await fs.mkdir(path.join(generated, "openspec-propose"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(generated, "openspec-propose", "SKILL.md"),
      "new",
    );
    await fs.mkdir(path.join(installed, "openspec-old"), { recursive: true });
    await fs.mkdir(path.join(installed, "custom"), { recursive: true });

    expect(await syncSkillDirectories(generated, installed)).toBe(1);
    expect(
      await fs.readFile(
        path.join(installed, "openspec-propose", "SKILL.md"),
        "utf8",
      ),
    ).toBe("new");
    await expect(
      fs.access(path.join(installed, "custom")),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(installed, "openspec-old")),
    ).rejects.toThrow();
  });
});

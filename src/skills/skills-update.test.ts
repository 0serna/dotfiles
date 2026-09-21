import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeSkills, syncSkillDirectories } from "./skills-update.ts";

let tmpDir: string;

async function addSkillWithFrontmatter(
  name: string,
  frontmatter: string,
  openAiYaml?: string,
) {
  const skillDir = path.join(tmpDir, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\n${frontmatter}\n---\n`,
  );
  if (openAiYaml !== undefined) {
    await fs.mkdir(path.join(skillDir, "agents"));
    await fs.writeFile(
      path.join(skillDir, "agents", "openai.yaml"),
      openAiYaml,
    );
  }
}

async function readSkill(name: string): Promise<string> {
  return fs.readFile(path.join(tmpDir, name, "SKILL.md"), "utf8");
}

async function addSkill(name: string, openAiYaml?: string) {
  await addSkillWithFrontmatter(
    name,
    `name: ${name}\ndescription: Test\ndisable-model-invocation: true`,
    openAiYaml,
  );
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

  it("derives opencode autoinvoke and preserves description and slash visibility", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-"));
    await addSkill("plain");

    expect(await normalizeSkills(tmpDir)).toBe(1);

    const skill = await readSkill("plain");
    expect(skill).toContain("description: Test");
    expect(skill).toContain("metadata:\n  opencode/autoinvoke: false");
    expect(skill).not.toContain("slash");
  });

  it("merges autoinvoke with foreign metadata keys", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-"));
    await addSkillWithFrontmatter(
      "generated",
      'name: generated\ndescription: Test\ndisable-model-invocation: true\nmetadata:\n  author: openspec\n  version: "1.0"\n  generatedBy: "1.13.1"',
    );

    expect(await normalizeSkills(tmpDir)).toBe(1);

    expect(await readSkill("generated")).toBe(
      '---\nname: generated\ndescription: Test\ndisable-model-invocation: true\nmetadata:\n  opencode/autoinvoke: false\n  author: openspec\n  version: "1.0"\n  generatedBy: "1.13.1"\n---\n',
    );
  });

  it("corrects truthy autoinvoke values to boolean false", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-"));
    await addSkillWithFrontmatter(
      "truthy",
      "name: truthy\ndescription: Test\ndisable-model-invocation: true\nmetadata:\n  opencode/autoinvoke: true",
    );
    await addSkillWithFrontmatter(
      "quoted",
      'name: quoted\ndescription: Test\ndisable-model-invocation: true\nmetadata:\n  opencode/autoinvoke: "true"',
    );

    expect(await normalizeSkills(tmpDir)).toBe(2);
    expect(await readSkill("truthy")).toContain("  opencode/autoinvoke: false");
    expect(await readSkill("quoted")).toContain("  opencode/autoinvoke: false");
  });

  it("leaves skills without the flag untouched", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-"));
    await addSkillWithFrontmatter(
      "model-invoked",
      "name: model-invoked\ndescription: Test\nmetadata:\n  author: openspec",
    );
    const before = await readSkill("model-invoked");

    expect(await normalizeSkills(tmpDir)).toBe(0);
    expect(await readSkill("model-invoked")).toBe(before);
    await expect(
      fs.access(path.join(tmpDir, "model-invoked", "agents", "openai.yaml")),
    ).rejects.toThrow();
  });

  it("is idempotent across both providers", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-"));
    await addSkill("plain");
    await addSkillWithFrontmatter(
      "generated",
      'name: generated\ndescription: Test\ndisable-model-invocation: true\nmetadata:\n  author: openspec\n  version: "1.0"',
    );

    expect(await normalizeSkills(tmpDir)).toBe(2);
    const plainAfterFirst = await readSkill("plain");
    const generatedAfterFirst = await readSkill("generated");

    expect(await normalizeSkills(tmpDir)).toBe(0);
    expect(await readSkill("plain")).toBe(plainAfterFirst);
    expect(await readSkill("generated")).toBe(generatedAfterFirst);
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

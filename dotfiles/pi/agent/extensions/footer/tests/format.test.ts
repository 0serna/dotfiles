import { describe, expect, it } from "vitest";
import { formatDirectorySegment, parseGitMetadata } from "../format.ts";

describe("parseGitMetadata", () => {
  it("parses Git rev-parse output", () => {
    expect(
      parseGitMetadata(
        "/workspace/tautog\n/repositories/dotfiles/.git/worktrees/tautog\n/repositories/dotfiles/.git\n",
      ),
    ).toEqual({
      topLevel: "/workspace/tautog",
      gitDir: "/repositories/dotfiles/.git/worktrees/tautog",
      commonDir: "/repositories/dotfiles/.git",
    });
  });
});

describe("formatDirectorySegment", () => {
  it("uses the common repository name for a linked worktree", () => {
    expect(
      formatDirectorySegment({
        cwd: "/home/oscar/orca/workspaces/dotfiles/tautog",
        home: "/home/oscar",
        branch: "0serna/tautog",
        git: {
          topLevel: "/home/oscar/orca/workspaces/dotfiles/tautog",
          gitDir: "/home/oscar/repositories/dotfiles/.git/worktrees/tautog",
          commonDir: "/home/oscar/repositories/dotfiles/.git",
        },
      }),
    ).toBe("dotfiles@0serna/tautog");
  });

  it("uses the checkout root name for a regular repository", () => {
    expect(
      formatDirectorySegment({
        cwd: "/home/oscar/projects/dotfiles",
        home: "/home/oscar",
        branch: "main",
        git: {
          topLevel: "/home/oscar/projects/dotfiles",
          gitDir: "/home/oscar/git-metadata/dotfiles.git",
          commonDir: "/home/oscar/git-metadata/dotfiles.git",
        },
      }),
    ).toBe("dotfiles@main");
  });

  it("uses a tilde for the home directory outside Git", () => {
    expect(
      formatDirectorySegment({
        cwd: "/home/oscar",
        home: "/home/oscar",
        branch: null,
        git: null,
      }),
    ).toBe("~");
  });

  it("falls back to the current directory outside a Git repository", () => {
    expect(
      formatDirectorySegment({
        cwd: "/home/oscar/projects/notes",
        home: "/home/oscar",
        branch: null,
        git: null,
      }),
    ).toBe("notes");
  });
});

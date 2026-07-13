import { describe, expect, it } from "vitest";
import {
  CONTEXT_USAGE_WARNING_TOKENS,
  formatCurrentUsage,
  formatDirectorySegment,
  formatK,
  parseGitMetadata,
} from "../format.ts";

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

describe("formatK", () => {
  it("returns zero in integer k-format", () => {
    expect(formatK(0)).toBe("0k");
  });

  it("rounds values below 1000 to integer k-format", () => {
    expect(formatK(900)).toBe("1k");
  });

  it("rounds values above 999 to integer k-format", () => {
    expect(formatK(1234)).toBe("1k");
  });

  it("rounds decimal thousands to integer k-format", () => {
    expect(formatK(41_900)).toBe("42k");
  });
});

describe("formatCurrentUsage", () => {
  it("returns zero tokens when usage is undefined", () => {
    expect(formatCurrentUsage(undefined)).toBe("0k");
  });

  it("returns zero tokens when tokens are null", () => {
    expect(
      formatCurrentUsage({
        tokens: null,
        contextWindow: 200_000,
        percent: null,
      }),
    ).toBe("0k");
  });

  it("formats provided token value", () => {
    expect(
      formatCurrentUsage({
        tokens: 12_345,
        contextWindow: 200_000,
        percent: 6.2,
      }),
    ).toBe("12k");
  });
});

describe("CONTEXT_USAGE_WARNING_TOKENS", () => {
  it("is 150k", () => {
    expect(CONTEXT_USAGE_WARNING_TOKENS).toBe(150_000);
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
    ).toBe("dotfiles/0serna/tautog");
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
    ).toBe("dotfiles/main");
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

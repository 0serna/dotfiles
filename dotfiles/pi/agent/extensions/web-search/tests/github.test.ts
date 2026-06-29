import { describe, expect, it } from "vitest";
import type { GitHubIssue, GitHubPullRequest, GitHubRepo } from "../github.ts";
import {
  blobToRawUrl,
  classifyGitHubUrl,
  renderIssue,
  renderPullRequest,
  renderRepo,
} from "../github.ts";

describe("classifyGitHubUrl", () => {
  it("classifies blob URLs", () => {
    const result = classifyGitHubUrl(
      "https://github.com/owner/repo/blob/main/src/index.ts",
    );
    expect(result.type).toBe("blob");
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
    expect(result.ref).toBe("main");
    expect(result.path).toBe("src/index.ts");
  });

  it("classifies repository URLs", () => {
    const result = classifyGitHubUrl("https://github.com/owner/repo");
    expect(result.type).toBe("repository");
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
  });

  it("classifies repository URLs with trailing slash", () => {
    const result = classifyGitHubUrl("https://github.com/owner/repo/");
    expect(result.type).toBe("repository");
  });

  it("classifies issue URLs", () => {
    const result = classifyGitHubUrl("https://github.com/owner/repo/issues/42");
    expect(result.type).toBe("issue");
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
    expect(result.number).toBe(42);
  });

  it("classifies pull request URLs", () => {
    const result = classifyGitHubUrl("https://github.com/owner/repo/pull/7");
    expect(result.type).toBe("pull");
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
    expect(result.number).toBe(7);
  });

  it("classifies releases URLs", () => {
    const result = classifyGitHubUrl("https://github.com/owner/repo/releases");
    expect(result.type).toBe("releases");
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
  });

  it("classifies release tag URLs", () => {
    const result = classifyGitHubUrl(
      "https://github.com/owner/repo/releases/tag/v1.0",
    );
    expect(result.type).toBe("release-tag");
    expect(result.owner).toBe("owner");
    expect(result.repo).toBe("repo");
    expect(result.tag).toBe("v1.0");
  });

  it("returns unsupported for unrecognized GitHub URL shapes", () => {
    expect(
      classifyGitHubUrl("https://github.com/owner/repo/commits/main").type,
    ).toBe("unsupported");
    expect(classifyGitHubUrl("https://github.com/owner/repo/wiki").type).toBe(
      "unsupported",
    );
  });

  it("returns unsupported for non-GitHub URLs", () => {
    const urls = [
      "https://gitlab.com/owner/repo",
      "https://example.com",
      "https://api.github.com/repos/owner/repo",
    ];
    for (const url of urls) {
      expect(classifyGitHubUrl(url).type).toBe("unsupported");
    }
  });
});

describe("blobToRawUrl", () => {
  it("converts a blob URL to a raw URL", () => {
    const parsed = classifyGitHubUrl(
      "https://github.com/owner/repo/blob/main/README.md",
    );
    const raw = blobToRawUrl(parsed);
    expect(raw).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/README.md",
    );
  });

  it("handles nested paths", () => {
    const parsed = classifyGitHubUrl(
      "https://github.com/owner/repo/blob/v2.0/src/lib/util.ts",
    );
    const raw = blobToRawUrl(parsed);
    expect(raw).toBe(
      "https://raw.githubusercontent.com/owner/repo/v2.0/src/lib/util.ts",
    );
  });
});

describe("renderRepo", () => {
  it("renders repository metadata as compact markdown", () => {
    const data: GitHubRepo = {
      full_name: "owner/repo",
      description: "An example repository",
      default_branch: "main",
      visibility: "public",
      stargazers_count: 100,
      forks_count: 20,
      open_issues_count: 5,
      language: "TypeScript",
      pushed_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      homepage: "https://example.com",
      topics: ["typescript", "cli"],
      html_url: "https://github.com/owner/repo",
    };

    const result = renderRepo(data);

    expect(result).toContain("# owner/repo");
    expect(result).toContain("An example repository");
    expect(result).toContain("**Default Branch:** main");
    expect(result).toContain("**Visibility:** public");
    expect(result).toContain("**Stars:** 100");
    expect(result).toContain("**Forks:** 20");
    expect(result).toContain("**Open Issues:** 5");
    expect(result).toContain("**Language:** TypeScript");
    expect(result).toContain("**Topics:** typescript, cli");
    expect(result).toContain("**Homepage:** https://example.com");
    expect(result).toContain("**URL:** https://github.com/owner/repo");
  });

  it("omits optional fields when absent", () => {
    const data: GitHubRepo = {
      full_name: "owner/repo",
      description: null,
      default_branch: "main",
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      language: null,
      pushed_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      homepage: null,
      topics: [],
      html_url: "https://github.com/owner/repo",
    };

    const result = renderRepo(data);

    expect(result).not.toContain("**Visibility:**");
    expect(result).not.toContain("**Language:**");
    expect(result).not.toContain("**Topics:**");
    expect(result).not.toContain("**Homepage:**");
  });
});

describe("renderIssue", () => {
  it("renders issue metadata as compact markdown", () => {
    const data: GitHubIssue = {
      title: "Fix login bug",
      number: 42,
      state: "open",
      user: { login: "devuser" },
      labels: [{ name: "bug" }, { name: "high-priority" }],
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      body: "The login form fails when...",
      html_url: "https://github.com/owner/repo/issues/42",
    };

    const result = renderIssue(data);

    expect(result).toContain("# Fix login bug (#42)");
    expect(result).toContain("**State:** open");
    expect(result).toContain("**Author:** devuser");
    expect(result).toContain("**Labels:** bug, high-priority");
    expect(result).toContain(
      "**URL:** https://github.com/owner/repo/issues/42",
    );
    expect(result).toContain("The login form fails when...");
  });

  it("handles missing user gracefully", () => {
    const data: GitHubIssue = {
      title: "Ghost issue",
      number: 1,
      state: "closed",
      user: null,
      labels: [],
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      body: null,
      html_url: "https://github.com/owner/repo/issues/1",
    };

    const result = renderIssue(data);

    expect(result).not.toContain("**Author:**");
    expect(result).not.toContain("**Labels:**");
  });
});

describe("renderPullRequest", () => {
  it("renders pull request metadata as compact markdown", () => {
    const data: GitHubPullRequest = {
      title: "Add new feature",
      number: 7,
      state: "open",
      user: { login: "devuser" },
      base: { ref: "main" },
      head: { ref: "feature-branch" },
      additions: 150,
      deletions: 30,
      changed_files: 12,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      body: "This PR adds...",
      html_url: "https://github.com/owner/repo/pull/7",
    };

    const result = renderPullRequest(data);

    expect(result).toContain("# Add new feature (#7)");
    expect(result).toContain("**State:** open");
    expect(result).toContain("**Author:** devuser");
    expect(result).toContain("**Base:** main");
    expect(result).toContain("**Head:** feature-branch");
    expect(result).toContain("**Changes:** +150 | -30 | 12 files");
    expect(result).toContain("**URL:** https://github.com/owner/repo/pull/7");
    expect(result).toContain("This PR adds...");
  });

  it("omits change stats section when absent", () => {
    const data: GitHubPullRequest = {
      title: "Simple PR",
      number: 1,
      state: "merged",
      user: null,
      base: { ref: "main" },
      head: { ref: "fix" },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      body: null,
      html_url: "https://github.com/owner/repo/pull/1",
    };

    const result = renderPullRequest(data);

    expect(result).not.toContain("**Changes:**");
    expect(result).not.toContain("**Author:**");
  });
});

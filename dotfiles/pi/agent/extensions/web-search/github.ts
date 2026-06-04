import {
  getResponseDetails,
  HttpResponseError,
  responseDetails,
  serializeError,
} from "./diagnostics.ts";
import { logWebToolEvent } from "./logger.ts";

type GitHubUrlType = "blob" | "repository" | "issue" | "pull" | "unsupported";

export interface ParsedGitHubUrl {
  type: GitHubUrlType;
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
  number?: number;
}

const BLOB_RE =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/;
const ISSUE_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)$/;
const PULL_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/;
const REPO_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/;

export function classifyGitHubUrl(url: string): ParsedGitHubUrl {
  let m: RegExpMatchArray | null;

  m = url.match(BLOB_RE);
  if (m) {
    return {
      type: "blob",
      owner: m[1]!,
      repo: m[2]!,
      ref: m[3]!,
      path: m[4]!,
    };
  }

  m = url.match(ISSUE_RE);
  if (m) {
    return {
      type: "issue",
      owner: m[1]!,
      repo: m[2]!,
      number: Number(m[3]),
    };
  }

  m = url.match(PULL_RE);
  if (m) {
    return {
      type: "pull",
      owner: m[1]!,
      repo: m[2]!,
      number: Number(m[3]),
    };
  }

  m = url.match(REPO_RE);
  if (m) {
    return {
      type: "repository",
      owner: m[1]!,
      repo: m[2]!,
    };
  }

  return { type: "unsupported", owner: "", repo: "" };
}

export function blobToRawUrl(parsed: ParsedGitHubUrl): string {
  return `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.ref}/${parsed.path}`;
}

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_TIMEOUT_MS = 10_000;

async function fetchGitHubApi(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT_MS);
  try {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "pi-coding-agent",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new HttpResponseError(
        `GitHub API ${response.status} for ${path}`,
        await responseDetails(response),
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return (
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("javascript") ||
    contentType.includes("yaml") ||
    contentType.includes("csv")
  );
}

async function fetchRawContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "pi-coding-agent",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new HttpResponseError(
        `Raw fetch ${response.status} for ${url}`,
        await responseDetails(response),
      );
    }
    const contentType = response.headers.get("content-type");
    if (!isTextContentType(contentType)) {
      throw new Error(
        `Unsupported content type "${contentType ?? "unknown"}" for ${url}`,
      );
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface GitHubRepo {
  full_name: string;
  description: string | null;
  default_branch: string;
  visibility?: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  pushed_at: string;
  updated_at: string;
  homepage: string | null;
  topics?: string[];
  html_url: string;
}

export function renderRepo(data: GitHubRepo): string {
  const lines: string[] = [];
  lines.push(`# ${data.full_name}`);

  if (data.description) {
    lines.push("");
    lines.push(data.description);
  }

  lines.push("");
  const meta: string[] = [];
  meta.push(`**Default Branch:** ${data.default_branch}`);
  if (data.visibility) {
    meta.push(`**Visibility:** ${data.visibility}`);
  }
  lines.push(meta.join(" | "));

  lines.push(
    `**Stars:** ${data.stargazers_count} | **Forks:** ${data.forks_count} | **Open Issues:** ${data.open_issues_count}`,
  );

  if (data.language) {
    lines.push(`**Language:** ${data.language}`);
  }

  lines.push(
    `**Last Push:** ${data.pushed_at} | **Updated:** ${data.updated_at}`,
  );

  if (data.homepage) {
    lines.push(`**Homepage:** ${data.homepage}`);
  }

  if (data.topics?.length) {
    lines.push(`**Topics:** ${data.topics.join(", ")}`);
  }

  lines.push("");
  lines.push(`**URL:** ${data.html_url}`);

  return lines.join("\n");
}

interface GitHubLabel {
  name: string;
}

interface GitHubUser {
  login: string;
}

export interface GitHubIssue {
  title: string;
  number: number;
  state: string;
  user: GitHubUser | null;
  labels: GitHubLabel[];
  created_at: string;
  updated_at: string;
  body: string | null;
  html_url: string;
}

export function renderIssue(data: GitHubIssue): string {
  const lines: string[] = [];
  lines.push(`# ${data.title} (#${data.number})`);
  lines.push("");

  const meta: string[] = [];
  meta.push(`**State:** ${data.state}`);
  if (data.user) {
    meta.push(`**Author:** ${data.user.login}`);
  }
  if (data.labels.length > 0) {
    meta.push(`**Labels:** ${data.labels.map((l) => l.name).join(", ")}`);
  }
  meta.push(
    `**Created:** ${data.created_at} | **Updated:** ${data.updated_at}`,
  );
  lines.push(meta.join(" | "));

  lines.push("");
  lines.push(`**URL:** ${data.html_url}`);

  if (data.body) {
    lines.push("");
    lines.push(data.body);
  }

  return lines.join("\n");
}

interface GitHubPullRef {
  ref: string;
}

export interface GitHubPullRequest {
  title: string;
  number: number;
  state: string;
  user: GitHubUser | null;
  base: GitHubPullRef;
  head: GitHubPullRef;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  created_at: string;
  updated_at: string;
  body: string | null;
  html_url: string;
}

export function renderPullRequest(data: GitHubPullRequest): string {
  const lines: string[] = [];
  lines.push(`# ${data.title} (#${data.number})`);
  lines.push("");

  const meta: string[] = [];
  meta.push(`**State:** ${data.state}`);
  if (data.user) {
    meta.push(`**Author:** ${data.user.login}`);
  }
  meta.push(`**Base:** ${data.base.ref} \u2190 **Head:** ${data.head.ref}`);
  lines.push(meta.join(" | "));

  const stats: string[] = [];
  if (data.additions !== undefined) stats.push(`+${data.additions}`);
  if (data.deletions !== undefined) stats.push(`-${data.deletions}`);
  if (data.changed_files !== undefined)
    stats.push(`${data.changed_files} files`);
  if (stats.length > 0) {
    lines.push(`**Changes:** ${stats.join(" | ")}`);
  }

  lines.push(
    `**Created:** ${data.created_at} | **Updated:** ${data.updated_at}`,
  );

  lines.push("");
  lines.push(`**URL:** ${data.html_url}`);

  if (data.body) {
    lines.push("");
    lines.push(data.body);
  }

  return lines.join("\n");
}

export interface GitHubFetchResult {
  content: string;
  source: "github-raw" | "github-api";
}

export async function tryGitHubFetch(
  url: string,
  toolCallId?: string,
): Promise<GitHubFetchResult | null> {
  const parsed = classifyGitHubUrl(url);

  if (parsed.type === "unsupported") {
    return null;
  }

  const startedAt = Date.now();
  try {
    if (parsed.type === "blob") {
      const rawUrl = blobToRawUrl(parsed);
      const content = await fetchRawContent(rawUrl);
      logWebToolEvent("github_fetch_success", {
        toolCallId,
        url,
        type: "blob",
        source: "github-raw",
        elapsedMs: Date.now() - startedAt,
        contentLength: content.length,
      });
      return { content, source: "github-raw" };
    }

    let apiPath: string;
    if (parsed.type === "repository") {
      apiPath = `/repos/${parsed.owner}/${parsed.repo}`;
    } else if (parsed.type === "issue") {
      apiPath = `/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`;
    } else {
      apiPath = `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`;
    }

    const data = await fetchGitHubApi(apiPath);

    let content: string;
    if (parsed.type === "repository") {
      content = renderRepo(data as GitHubRepo);
    } else if (parsed.type === "issue") {
      content = renderIssue(data as GitHubIssue);
    } else {
      content = renderPullRequest(data as GitHubPullRequest);
    }

    logWebToolEvent("github_fetch_success", {
      toolCallId,
      url,
      type: parsed.type,
      source: "github-api",
      elapsedMs: Date.now() - startedAt,
      contentLength: content.length,
    });

    return { content, source: "github-api" };
  } catch (err: unknown) {
    const response = getResponseDetails(err);
    logWebToolEvent("github_fetch_failure", {
      toolCallId,
      url,
      type: parsed.type,
      elapsedMs: Date.now() - startedAt,
      error: serializeError(err),
      ...(response ? { response } : {}),
    });
    return null;
  }
}

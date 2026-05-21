import { HTTP_FETCH_TIMEOUT_MS } from "./config.ts";

async function doHttpFetch(
  url: string,
): Promise<{ html: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} for ${url}`,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    const html = await response.text();
    return { html, contentType };
  } finally {
    clearTimeout(timer);
  }
}

function assertHtmlContent(contentType: string, url: string): void {
  const isHtml =
    contentType.startsWith("text/html") ||
    contentType.startsWith("application/xhtml+xml") ||
    contentType.startsWith("text/plain");
  if (!isHtml) {
    throw new Error(
      `Unsupported content type "${contentType}" for ${url}. Only HTML pages are supported.`,
    );
  }
}

function stripTags(html: string, tags: string[]): string {
  const pattern = new RegExp(
    `<(${tags.join("|")})[^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi",
  );
  return html.replace(pattern, "");
}

function replaceBlockElements(html: string): string {
  return html.replace(
    /<\/?(?:h[1-6]|p|div|section|article|blockquote|li|tr|dt|dd|br|hr)[^>]*>/gi,
    "\n",
  );
}

function replaceLinks(html: string): string {
  return html.replace(
    /<a[^>]*href=(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
    (
      _match,
      dqHref: string | undefined,
      sqHref: string | undefined,
      text: string,
    ) => {
      const href = dqHref ?? sqHref;
      const t = text.replace(/<[^>]*>/g, "").trim();
      return t ? `${t} (${href})` : (href ?? "");
    },
  );
}

function replaceImages(html: string): string {
  return html.replace(
    /<img[^>]*alt=(?:"([^"]*)"|'([^']*)')[^>]*\/?>/gi,
    (_match, dqAlt: string | undefined, sqAlt: string | undefined) => {
      const alt = dqAlt ?? sqAlt;
      return alt ? `[Image: ${alt}]` : "";
    },
  );
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function collapseLines(html: string): string {
  return html
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function htmlToMarkdown(html: string): string {
  let cleaned = html;
  cleaned = stripTags(cleaned, [
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "footer",
    "header",
  ]);
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  cleaned = replaceBlockElements(cleaned);
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");
  cleaned = replaceLinks(cleaned);
  cleaned = replaceImages(cleaned);
  cleaned = cleaned.replace(/<[^>]*>/g, "");
  cleaned = decodeEntities(cleaned);
  cleaned = collapseLines(cleaned);
  return cleaned.trim();
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

export async function extractViaHttp(url: string): Promise<string> {
  const { html, contentType } = await doHttpFetch(url);
  assertHtmlContent(contentType, url);
  const title = extractTitle(html);
  const body = htmlToMarkdown(html);
  if (!body) {
    throw new Error("Could not extract readable content from the page");
  }
  return title ? `# ${title}\n\n${body}` : body;
}

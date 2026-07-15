export type TextToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
  isError?: boolean;
};

export type ExaSearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    highlights?: string[];
    text?: string;
  }>;
};

export type ExaContentsStatus = {
  status?: string;
  tag?: string;
  httpStatusCode?: number;
};

export type ExaContentsResponse = {
  results?: Array<{ text?: string }>;
  statuses?: ExaContentsStatus[];
};

export type TavilySearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
  usage?: { credits?: number };
  response_time?: number;
};

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  provider: "exa" | "tavily" | "firecrawl";
};

export type FirecrawlSearchResponse = {
  data?: {
    web?: Array<{
      title?: string;
      url?: string;
      description?: string;
      markdown?: string;
    }>;
  };
};

export type FirecrawlScrapeResponse = {
  data?: {
    markdown?: string;
  };
};

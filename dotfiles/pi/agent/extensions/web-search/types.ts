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

function formatted(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1");
}

function inline(text: string): string {
  let result = "";
  let cursor = 0;

  while (cursor < text.length) {
    const open = text.indexOf("`", cursor);
    if (open === -1) break;
    const fence = text.slice(open).match(/^`+/)?.[0] ?? "";
    const codeStart = open + fence.length;
    const closing = /`+/g;
    closing.lastIndex = codeStart;
    let match: RegExpExecArray | null;
    do {
      match = closing.exec(text);
    } while (match && match[0].length !== fence.length);
    if (!match) break;

    result +=
      formatted(text.slice(cursor, open)) + text.slice(codeStart, match.index);
    cursor = match.index + fence.length;
  }

  return result + formatted(text.slice(cursor));
}

export function plainText(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let fence: string | undefined;

  for (const line of lines) {
    const delimiter = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (
        delimiter?.[1]?.startsWith(fence[0] ?? "") &&
        delimiter[1].length >= fence.length
      ) {
        fence = undefined;
      } else {
        output.push(line);
      }
      continue;
    }
    if (delimiter) {
      fence = delimiter[1];
      continue;
    }

    const structural = line
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s{0,3}>\s?/, "")
      .replace(/^(\s*)[-*+]\s+/, "$1• ");
    output.push(inline(structural));
  }

  return output.join("\n").replace(/^\n+|\n+$/g, "");
}

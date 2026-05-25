import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { execute } from "./interaction.ts";
import { renderCall, renderResult } from "./rendering.ts";
import { QuestionParams } from "./schema.ts";

export default function question(pi: ExtensionAPI) {
  pi.registerTool({
    name: "question",
    label: "Question",
    description:
      "Ask the user a question with customizable options and let them pick from the list.",
    promptSnippet:
      "Ask the user a question with options when a decision is needed",
    promptGuidelines: [
      "Use question when you need the user to make a decision or choose between options before proceeding.",
      "When calling question, always put your recommended option first in the options array — it will be visually marked as the recommendation.",
      'Do not include an "Other" option when calling question. The tool appends one automatically.',
    ],
    parameters: QuestionParams,
    execute,
    renderCall,
    renderResult,
  });
}

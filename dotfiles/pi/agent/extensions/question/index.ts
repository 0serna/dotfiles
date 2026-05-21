import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { execute } from "./interaction.ts";
import { renderCall, renderResult } from "./rendering.ts";
import { QuestionParams } from "./schema.ts";

export default function question(pi: ExtensionAPI) {
  pi.registerTool({
    name: "question",
    label: "Question",
    description:
      'Ask the user a question with customizable options and let them pick from the list. The first option is treated as your recommendation and is visually marked. The extension automatically adds an "Other" option for free-form input. Use when you need user input to proceed.',
    parameters: QuestionParams,
    execute,
    renderCall,
    renderResult,
  });
}

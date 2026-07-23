import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";

import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import { allAnswered, execute } from "../interaction.js";
import { renderCall, renderFrame, renderResult } from "../rendering.js";
import { buildResult } from "../results.js";
import { QuestionParams } from "../schema.js";
import type {
  AnswerEntry,
  MultiQuestionDetails,
  RenderView,
} from "../types.js";

const theme = {
  fg: (_c: string, t: string) => t,
  bg: (_c: string, t: string) => t,
  bold: (t: string) => t,
} as unknown as Theme;

const sampleQuestions = [
  {
    question: "Scope?",
    options: [{ label: "Backend" }, { label: "Frontend" }],
  },
  { question: "Priority?", options: [{ label: "P0" }] },
];

function answer(overrides: Partial<AnswerEntry> = {}): AnswerEntry {
  return {
    question: "Scope?",
    options: ["Backend"],
    answer: "Backend",
    wasCustom: false,
    ...overrides,
  };
}

describe("schema", () => {
  it("accepts a single question", () => {
    expect(
      Value.Check(QuestionParams, {
        questions: [{ question: "Q?", options: [{ label: "a" }] }],
      }),
    ).toBe(true);
  });

  it("accepts multiple questions", () => {
    expect(Value.Check(QuestionParams, { questions: sampleQuestions })).toBe(
      true,
    );
  });

  it("rejects an empty questions array", () => {
    expect(Value.Check(QuestionParams, { questions: [] })).toBe(false);
  });

  it("rejects a question without options", () => {
    expect(
      Value.Check(QuestionParams, { questions: [{ question: "Q?" }] }),
    ).toBe(false);
  });
});

describe("buildResult", () => {
  it("builds a single normal answer", () => {
    const r = buildResult([answer()]);
    expect(r.details.cancelled).toBe(false);
    expect(r.details.answers).toHaveLength(1);
    expect(r.content[0]!.text).toContain("Scope?: user selected: Backend");
  });

  it("builds a custom (Other) answer", () => {
    const r = buildResult([answer({ answer: "Edge", wasCustom: true })]);
    expect(r.content[0]!.text).toContain("user wrote: Edge");
  });

  it("builds an answer with comment", () => {
    const r = buildResult([answer({ comment: "fast" })]);
    expect(r.content[0]!.text).toContain("Comment: fast");
  });

  it("builds a cancelled result", () => {
    const r = buildResult(null);
    expect(r.details.cancelled).toBe(true);
    expect(r.details.answers).toHaveLength(0);
  });

  it("aggregates multiple answers", () => {
    const r = buildResult([
      answer(),
      answer({ question: "Priority?", options: ["P0"], answer: "P0" }),
    ]);
    expect(r.details.answers).toHaveLength(2);
  });
});

describe("allAnswered", () => {
  it("is true only when every flag is set", () => {
    expect(allAnswered([true, true])).toBe(true);
    expect(allAnswered([true, false])).toBe(false);
    expect(allAnswered([])).toBe(false);
  });
});

describe("renderFrame", () => {
  function view(overrides: Partial<RenderView> = {}): RenderView {
    return {
      isMulti: true,
      questions: [
        { question: "Scope?", label: "Q1" },
        { question: "Priority?", label: "Q2" },
      ],
      currentTab: 0,
      answered: [false, false],
      allOptions: [
        { label: "Backend" },
        { label: "Frontend" },
        { label: "Other", isOther: true },
      ],
      optionIndex: 0,
      editMode: false,
      reviewAnswers: [],
      allAnswered: false,
      ...overrides,
    };
  }

  it("renders a tab bar with Submit for multiple questions", () => {
    const out = renderFrame(80, view(), "", theme).join("\n");
    expect(out).toContain("Submit");
    expect(out).toContain("Q1");
    expect(out).toContain("Q2");
  });

  it("does not render a tab bar for a single question", () => {
    const out = renderFrame(
      80,
      view({
        isMulti: false,
        questions: [{ question: "Scope?", label: "Q1" }],
        answered: [false],
        allOptions: [{ label: "Backend" }, { label: "Other", isOther: true }],
      }),
      "",
      theme,
    ).join("\n");
    expect(out).not.toContain("Submit");
  });

  it("renders the review screen when all answered, including comments", () => {
    const out = renderFrame(
      80,
      view({
        currentTab: 2,
        answered: [true, true],
        allOptions: [],
        reviewAnswers: [
          answer({ comment: "my note" }),
          answer({ question: "Priority?", options: ["P0"], answer: "P0" }),
        ],
        allAnswered: true,
      }),
      "",
      theme,
    ).join("\n");
    expect(out).toContain("Ready to submit");
    expect(out).toContain("Scope?");
    expect(out).toContain("Backend");
    expect(out).toContain("my note");
  });

  it("renders a missing warning on the Submit tab when not all answered", () => {
    const out = renderFrame(
      80,
      view({
        currentTab: 2,
        answered: [true, false],
        allOptions: [],
        reviewAnswers: [answer()],
      }),
      "",
      theme,
    ).join("\n");
    expect(out).toContain("Unanswered: Q2");
  });

  it("marks the answered option and shows its comment when returning to a tab", () => {
    const out = renderFrame(
      80,
      view({
        isMulti: false,
        questions: [{ question: "Scope?", label: "Q1" }],
        answered: [true],
        allOptions: [
          { label: "Backend" },
          { label: "Frontend" },
          { label: "Other", isOther: true },
        ],
        answeredIndex: 0,
        answerNote: "fast",
      }),
      "",
      theme,
    ).join("\n");
    expect(out).toContain("✓");
    expect(out).toContain("fast");
    expect(out).toContain("Backend");
  });
});

describe("renderResult", () => {
  it("renders one line per answer", () => {
    const result = {
      details: {
        answers: [
          answer(),
          answer({ question: "Priority?", options: ["P0"], answer: "P0" }),
        ],
        cancelled: false,
      },
    } as unknown as AgentToolResult<MultiQuestionDetails>;
    const out = renderResult(result, undefined, theme).render(80).join("\n");
    expect(out).toContain("✓");
    expect(out).toContain("Scope?");
    expect(out).toContain("Backend");
    expect(out).toContain("Priority?");
    expect(out).toContain("P0");
  });

  it("renders a cancelled result", () => {
    const result = {
      details: { answers: [], cancelled: true },
    } as unknown as AgentToolResult<MultiQuestionDetails>;
    const out = renderResult(result, undefined, theme).render(80).join("\n");
    expect(out).toContain("Cancelled");
  });
});

describe("renderCall", () => {
  it("shows only the tool name (no duplicated question text)", () => {
    const out = renderCall(
      { questions: [{ question: "Scope?" }, { question: "Priority?" }] },
      theme,
    )
      .render(80)
      .join("\n");
    expect(out).toContain("question");
    expect(out).not.toContain("Scope?");
    expect(out).not.toContain("questions");
  });
});

describe("execute non-UI mode", () => {
  it("returns an error when there is no TUI", async () => {
    const ctx = { mode: "non-interactive" } as unknown as Parameters<
      typeof execute
    >[4];
    const result = (await execute(
      "id",
      { questions: sampleQuestions },
      undefined,
      undefined,
      ctx,
    )) as {
      content: { type: "text"; text: string }[];
      details: MultiQuestionDetails;
    };
    expect(result.content[0]!.text).toContain("UI not available");
  });
});

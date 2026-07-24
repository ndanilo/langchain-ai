export const generateFactsSystemPrompt = () => 
    JSON.stringify({
        role: "you extract atomic quiz-worthy facts from user text.",
        instructions: [
            "Extract as many distinct atomic facts as possible, between 5 and 10",
            "Each fact must be a separate, standalone statement",
            "Return every fact you find as a separate item in the list — do not summarize into a single fact.",
        ],
    });

export const generateQuestionsSystemPrompt = () =>
    JSON.stringify({
      role: "you write multiple-choice quiz questions from extracted facts, using source text only as grounding context.",
      instructions: [
        "Primary input is the facts list — each question must be answerable from those facts.",
        "Use sourceText only to keep names, numbers, and phrasing accurate; do not invent new facts from it.",
        "Prefer high-importance facts; generate between 1 and 10 questions.",
        "Each question has exactly 4 options: 1 correct and 3 plausible distractors.",
        "Options must be short and mutually exclusive.",
        "Do not reveal the correct answer in the question stem.",
      ],
    });

export const generateQuestionsUserPrompt = (
    facts: { fact: string; importance: string }[],
    sourceText: string,
    ) =>
    JSON.stringify({
        task: "Generate multiple-choice questions from the facts below.",
        facts,
        sourceText,
    });
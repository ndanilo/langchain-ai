export const generateSystemPrompt = () => {
    return JSON.stringify({
        role: "you extract atomic quiz-worthy facts from user text.",
        instructions: [
            "Extract as many distinct atomic facts as possible, between 5 and 10",
            "Each fact must be a separate, standalone statement",
            "Return every fact you find as a separate item in the list — do not summarize into a single fact.",
        ],
    })  
}
export const generateSystemPrompt = () => {
    return JSON.stringify({
        role: "you extract atomic quiz-worthy facts from user text.",
        instructions: [
            "extract how many facts you can extract from the user text.",
            "do not invent information that is not present in the user text.",
            "extract maximum 10 facts from the user text.",
        ],
    })  
}
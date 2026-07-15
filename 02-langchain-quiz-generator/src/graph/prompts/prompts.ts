export const generateSystemPrompt = () => {
    return JSON.stringify({
        role: "you extract atomic quiz-worthy facts from user text.",
        instructions: [
            "extract the facts from the user text.",
            "do not invent information that is not present in the user text.",
            "generate reasonable options for the fact.",
            "the maximum number of options is 4.",
            "only one of the options should be correct.",
            "extract maximum 10 facts from the user text.",
        ],
    })  
}
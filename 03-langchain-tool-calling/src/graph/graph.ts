import { StateSchema, MessagesValue, StateGraph, START, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";

const state = new StateSchema({
    messages: MessagesValue
})

async function respondNode(state:any) {
    const index = state.messages.length - 1;
    const received = state.messages[index].content.toUpperCase();
    return {
        messages: [new AIMessage(received)]
    }
}

export const graph = new StateGraph(state)
    .addNode("respond", respondNode)
    .addEdge(START, "respond")
    .addEdge("respond", END)
    .compile();
import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";

/*
Turns a finished agent run into readable diagnostic lines.

Tavily returns a large object per call (query, answer, images, results[], response_time),
so printing a raw slice of it lands mid-JSON and looks like noise. Summarising the shape
keeps the useful signal — which tool ran, against what, and how much came back — on one
line per step.
*/

const MAX_HOSTS = 3;

function oneLine(text: string, max: number): string {
    const flat = text.replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
}

function formatSize(chars: number): string {
    return chars >= 1000 ? `${(chars / 1000).toFixed(1)}k chars` : `${chars} chars`;
}

function asText(content: unknown): string {
    return typeof content === "string" ? content : JSON.stringify(content);
}

/** Condenses one tool result into a single line. */
export function summariseToolResult(content: unknown): string {
    const text = asText(content);

    let payload: unknown;
    try {
        payload = JSON.parse(text);
    } catch {
        // Plenty of tools just return a sentence.
        return oneLine(text, 120);
    }

    if (payload === null || typeof payload !== "object") {
        return oneLine(text, 120);
    }

    const record = payload as Record<string, unknown>;

    if (typeof record.error === "string") {
        return `error: ${oneLine(record.error, 100)}`;
    }

    if (!Array.isArray(record.results)) {
        // Small structured returns, e.g. get_current_datetime.
        return oneLine(text, 120);
    }

    const entries = record.results;
    const urls = entries
        .map((entry) =>
            typeof entry === "string"
                ? entry
                : (entry as Record<string, unknown> | null)?.url,
        )
        .filter((url): url is string => typeof url === "string");

    const chars = entries.reduce((total: number, entry) => {
        const fields = (entry ?? {}) as Record<string, unknown>;
        const body = fields.raw_content ?? fields.content ?? "";
        return total + String(body).length;
    }, 0);

    const hosts = [...new Set(urls.map(hostOf))];
    const shown = hosts.slice(0, MAX_HOSTS).join(", ");
    const extra = hosts.length > MAX_HOSTS ? ` +${hosts.length - MAX_HOSTS} more` : "";

    const parts = [`${entries.length} result${entries.length === 1 ? "" : "s"}`];
    if (chars > 0) parts.push(formatSize(chars));
    if (hosts.length > 0) parts.push(`${shown}${extra}`);

    return parts.join(", ");
}

/**
 * Renders the model/tool loop as lines: `->` is the model requesting a tool,
 * `<-` is what our code handed back.
 */
export function formatToolTrace(messages: BaseMessage[]): string[] {
    const lines: string[] = [];

    for (const message of messages) {
        if (AIMessage.isInstance(message)) {
            for (const call of message.tool_calls ?? []) {
                lines.push(`  -> ${call.name} ${oneLine(JSON.stringify(call.args), 160)}`);
            }
        }

        if (ToolMessage.isInstance(message)) {
            lines.push(`  <- ${message.name ?? "tool"} ${summariseToolResult(message.content)}`);
        }
    }

    return lines;
}

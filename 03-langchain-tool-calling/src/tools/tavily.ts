import { TavilyCrawl, TavilyExtract, TavilyMap, TavilySearch } from "@langchain/tavily";
import { TavilyConfig } from "../config/config.js";

/*
Tavily's four web tools, wrapped as factories so nothing hits the network at import
time and tests can build them on demand.

The `description` of each tool is the only thing the model reads when deciding what to
call, so these are written to spell out the intended chain: search to find URLs,
extract to read them, crawl/map only when a whole site is in play.
*/

/** Ranked web results with snippets. The agent's entry point for anything time-sensitive. */
export function createWebSearchTool(): TavilySearch {
    return new TavilySearch({
        tavilyApiKey: TavilyConfig.apiKey,
        maxResults: TavilyConfig.maxResults,
        searchDepth: TavilyConfig.searchDepth,
        topic: "general",
        // Tavily can pre-summarise, but then our model never reasons over the sources.
        includeAnswer: false,
        // Snippets only: full page text is what web_extract is for.
        includeRawContent: false,
        name: "web_search",
        description:
            "Search the web and return ranked results with title, URL and a short snippet. Use this FIRST for current facts, prices, news or anything after your training cutoff. If a snippet answers the question, stop here; if you need the full article, pass the URL to web_extract.",
    });
}

/** Clean, parsed text for URLs you already know. The read step after a search. */
export function createWebExtractTool(): TavilyExtract {
    return new TavilyExtract({
        tavilyApiKey: TavilyConfig.apiKey,
        extractDepth: TavilyConfig.extractDepth,
        format: TavilyConfig.format,
        name: "web_extract",
        description:
            "Read one or more known URLs and return their cleaned main content. Use after web_search when a snippet is too short to answer. Do not guess URLs: only pass URLs that came from a search result or from the user.",
    });
}

/** Follows links from a starting URL. For "read the docs for X" style questions. */
export function createWebCrawlTool(): TavilyCrawl {
    return new TavilyCrawl({
        tavilyApiKey: TavilyConfig.apiKey,
        extractDepth: TavilyConfig.extractDepth,
        format: TavilyConfig.format,
        maxDepth: TavilyConfig.maxDepth,
        limit: TavilyConfig.crawlLimit,
        name: "web_crawl",
        description:
            "Crawl a website starting from one URL, following links and returning the content of each page. Expensive and slow: only use when the answer is spread across several pages of one site, such as a documentation set. Prefer web_search plus web_extract for single facts.",
    });
}

/** URL inventory for a site, without downloading page content. */
export function createWebMapTool(): TavilyMap {
    return new TavilyMap({
        tavilyApiKey: TavilyConfig.apiKey,
        maxDepth: TavilyConfig.maxDepth,
        limit: TavilyConfig.crawlLimit,
        name: "web_map",
        description:
            "List the URLs of a website without downloading their content. Use to discover the structure of a site before choosing which pages to read with web_extract.",
    });
}

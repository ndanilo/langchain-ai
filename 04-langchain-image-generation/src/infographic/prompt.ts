import type { InfographicBrief } from "./schema.js";

/*
Composes the image prompt from a finished brief.

This is plain string building rather than another model call. The copy has already been
decided; handing it to a model to "write a prompt" would only give it a chance to
paraphrase the numbers, and every paraphrase is a wrong figure rendered in large type.

The prompt is in two halves, and the split is the whole idea. The art half is loose and
suggestive, because that is where the image model is good and where a tight specification
just produces a corporate slide. The text half is rigid and repetitive, because that is the
only way an image model spells a string correctly.

The first version of this had it backwards: it pinned "flat design", "generous margins and
white space", "simple flat icons" and one fixed navy palette for every subject. Those are
instructions for a 2015 slide deck, and that is exactly what came back.
*/

export type ImagePromptOptions = {
    /** BCP-47 tag, e.g. `pt-BR`. Resolved to an English language name for the prompt. */
    language: string;
    aspectRatio: string;
    /** Overrides the palette the model chose. Empty means let the model decide. */
    paletteOverride?: string;
};

/** `pt-BR` -> `Brazilian Portuguese`, so the prompt names the language the model knows. */
export function languageName(tag: string): string {
    try {
        return new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag;
    } catch {
        return tag;
    }
}

function quote(value: string): string {
    return `"${value.replace(/"/g, "'")}"`;
}

export function renderImagePrompt(
    brief: InfographicBrief,
    options: ImagePromptOptions,
): string {
    const language = languageName(options.language);
    const palette = options.paletteOverride?.trim() || brief.art.palette;

    const panels = brief.panels.map(
        (panel, index) =>
            `Panel ${index + 1} — label ${quote(panel.label)}, large figure ${quote(
                panel.figure,
            )}, caption ${quote(panel.note)}. Illustration for this panel: ${panel.icon}.`,
    );

    return [
        `A striking, modern editorial infographic poster in ${options.aspectRatio} portrait format. Vivid, beautiful and contemporary — the kind of data visualisation that wins design awards and stops someone mid-scroll.`,
        "",
        `Visual mood: ${brief.art.mood}.`,
        `Colour palette: ${palette}. Use it boldly: saturated colour blocking, rich gradients, duotone treatments, a deep confident background rather than plain white, and high contrast between background and type.`,
        "",
        "Illustration: custom icons and spot illustrations drawn for this specific subject, all in one consistent style, integrated into the layout rather than parked in grey boxes. Give them personality and detail. Never generic business clip art — no stock trophies, scales, lightbulbs, briefcases, clipboards or human silhouettes.",
        "",
        "Typography: contemporary geometric sans-serif with dramatic scale contrast. The large figures are enormous and dominate the poster; the labels above them are small and quiet.",
        "",
        // No "oversized numerals bleeding off an edge" here, tempting as it is: asking for
        // decorative type contradicts the no-extra-text rule below, and the model resolved
        // that by stamping a huge stray "2 6" down the side of the poster.
        "Composition: editorial and asymmetric, like a magazine spread or a poster. Vary how the sections are treated — colour blocks, overlapping cards, bands, full-bleed illustration — instead of identical stacked rectangles. Layer shapes for depth. Subtle grain, texture, glow and shadow are all welcome.",
        "",
        "--- TEXT TO RENDER ---",
        `All text is in ${language}. Render every string below exactly as written, character for character, including accents and punctuation. Do not translate, rephrase, abbreviate or correct any of it.`,
        "",
        `Headline: ${quote(brief.title)}`,
        `Subheading: ${quote(brief.subtitle)}`,
        "",
        `${brief.panels.length} panels, each with its own illustration:`,
        ...panels,
        "",
        `Footer band across the bottom: ${quote(brief.takeaway)}`,
        "",
        "Each string above appears exactly once on the poster. Do not repeat a label, and do not add any text beyond these strings: no decorative or background lettering, no placeholder or filler text, no lorem ipsum, no watermark, no signature, no logo, no URLs.",
    ].join("\n");
}

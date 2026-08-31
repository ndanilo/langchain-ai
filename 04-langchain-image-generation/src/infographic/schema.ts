import { z } from "zod/v3";

/*
The contract between the writing model and the image model.

Deliberately not "let the model write an image prompt": the copy has to survive to the
poster unchanged. Making the model fill a schema means the strings drawn on the poster are
ours to validate and quote verbatim, instead of being buried inside a paragraph of prose
that the image model then paraphrases.

Art direction is the opposite case, and used to be pinned in config. One fixed palette for
every subject produces a corporate slide whatever the question is, and a generic "simple
flat icon" instruction produces stock trophies and clipboards on a poster about a card game.
So the model now picks the palette, the mood and a per-panel illustration. Those live in
`art` and `icon`, well away from the copy fields — an earlier attempt put a bare `palette`
string alongside the copy and the model filled it with the subtitle.
*/

/*
Length limits are advisory here, not schema constraints.

`.max()` becomes `maxLength` in the JSON schema, and providers enforce that during
constrained decoding by cutting the string off at the limit — mid-word, mid-number. A brief
came back reading "13.75% by end of 2", which is worse than a long string: it is a wrong
figure, rendered in large type. So the limits are stated in the descriptions for the model
to aim at, and enforced afterwards by normaliseBrief, which cuts on a word boundary.
*/
/*
Sized against the rendered poster, with headroom: a string that fits is always better than a
well-trimmed one, and trimming a single-clause sentence has no clause boundary to fall back
to, so it ends on a dangling word. The prose fields are generous for that reason — Portuguese
runs noticeably longer than the English these numbers first came from.
*/
export const BRIEF_LIMITS = {
    title: 60,
    subtitle: 100,
    label: 28,
    figure: 18,
    note: 80,
    takeaway: 110,
    icon: 80,
    palette: 140,
    mood: 70,
} as const;

export const MAX_PANELS = 4;

/*
Field names are `label` / `figure` / `note` rather than the obvious `heading` / `value` /
`detail`: given a field called "heading" a model puts the biggest thing it has in it, so
briefs came back with the number in `heading` and the bare unit in `value`. Naming the
fields after their content instead of their position fixes that at the source.
*/
export const infographicPanelSchema = z.object({
    label: z
        .string()
        .min(1)
        .describe(
            `What this figure measures, in the requested output language, e.g. "Taxa atual". 1-4 words, at most ${BRIEF_LIMITS.label} characters, no trailing punctuation. Never the number itself.`,
        ),
    figure: z
        .string()
        .min(1)
        .describe(
            `The number this panel is about, with its unit attached, e.g. "14,00% a.a." or "R$ 5,18". At most ${BRIEF_LIMITS.figure} characters. Never split the number from its unit, and never write a sentence here.`,
        ),
    note: z
        .string()
        .min(1)
        .describe(
            `One supporting line about this figure, in the requested output language, e.g. "Definida pelo Copom em agosto". A complete phrase that stands on its own, at most 10 words and ${BRIEF_LIMITS.note} characters. No source URLs.`,
        ),
    icon: z
        .string()
        .min(1)
        .describe(
            `In ENGLISH, regardless of the output language: the illustration to draw for this panel, specific to this subject. 3-10 words, at most ${BRIEF_LIMITS.icon} characters. Be concrete and evocative, e.g. "a glowing spellbook trailing arcane runes" or "a downward arrow cutting through a bank facade". Never generic business clip art: no trophies, scales, lightbulbs, briefcases, clipboards, charts or human silhouettes.`,
        ),
});

export const artDirectionSchema = z.object({
    palette: z
        .string()
        .min(1)
        .describe(
            `In ENGLISH: four or five vivid, saturated colours chosen for THIS subject, as evocative names or hex codes, e.g. "deep arcane violet #4C1D95, molten gold, ember orange, midnight indigo, parchment cream". Bold and high contrast. Never corporate navy-and-grey, and never the same palette you would pick for an unrelated topic.`,
        ),
    mood: z
        .string()
        .min(1)
        .describe(
            `In ENGLISH: two to four words for the visual mood of this specific subject, e.g. "arcane, mystical, high fantasy" or "precise, editorial, financial". At most ${BRIEF_LIMITS.mood} characters.`,
        ),
});

export const infographicBriefSchema = z.object({
    art: artDirectionSchema.describe(
        "Visual direction for this poster. Not text: none of it is printed. Choose boldly and specifically for the subject.",
    ),
    title: z
        .string()
        .min(1)
        .describe(
            `Headline in the requested output language answering the question directly. At most 8 words and ${BRIEF_LIMITS.title} characters.`,
        ),
    subtitle: z
        .string()
        .min(1)
        .describe(
            `One line of context under the headline, in the requested output language. A complete sentence, at most 14 words and ${BRIEF_LIMITS.subtitle} characters.`,
        ),
    panels: z
        .array(infographicPanelSchema)
        .min(3)
        .max(MAX_PANELS)
        .describe(
            `The three or four figures worth drawing, most important first. Never more than ${MAX_PANELS}.`,
        ),
    takeaway: z
        .string()
        .min(1)
        .describe(
            `Closing line at the foot of the poster, in the requested output language. A complete sentence that stands on its own, at most 16 words and ${BRIEF_LIMITS.takeaway} characters.`,
        ),
});

export type InfographicPanel = z.infer<typeof infographicPanelSchema>;
export type ArtDirection = z.infer<typeof artDirectionSchema>;
export type InfographicBrief = z.infer<typeof infographicBriefSchema>;

const CLAUSE_SEPARATORS = [". ", "; ", ": ", ", ", " \u2014 ", " \u2013 ", " - "];

/*
After a word-boundary cut, a trailing word this short is almost always a stranded connector
("...a febre de Universos Beyond e", "após 10 meses de"). Two rather than three characters
deliberately: three would also swallow "fim", "ano" and "mês", which carry meaning.
*/
const STRANDED_WORD_LENGTH = 2;

/** Anything earlier than this fraction of the limit throws away too much of the string. */
const MIN_CLAUSE_RATIO = 0.5;

function trimTail(value: string): string {
    return value.replace(/[\s,;:.\u2013\u2014-]+$/, "");
}

/**
 * Trims a string to `max`, preferring a clause boundary over a word boundary.
 *
 * Cutting purely on whitespace strands a dangling connector — a real brief produced
 * "após 10 meses de", which then gets drawn on the poster in full size. Ending one clause
 * earlier reads as a deliberate short caption instead of a truncated one.
 *
 * Falls back to a hard cut only when the first word is itself longer than the limit,
 * which in practice means the model ignored the instruction entirely.
 */
export function shorten(value: string, max: number): string {
    const flat = value.replace(/\s+/g, " ").trim();
    if (flat.length <= max) return flat;

    const cut = flat.slice(0, max);

    const clause = Math.max(...CLAUSE_SEPARATORS.map((sep) => cut.lastIndexOf(sep)));
    if (clause >= max * MIN_CLAUSE_RATIO) return trimTail(cut.slice(0, clause));

    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace <= 0) return trimTail(cut);

    const words = cut.slice(0, lastSpace).split(" ");
    if (words.length > 1 && words.at(-1)!.length <= STRANDED_WORD_LENGTH) words.pop();

    return trimTail(words.join(" "));
}

/** Brings a model's brief inside the limits the poster layout can actually render. */
export function normaliseBrief(brief: InfographicBrief): InfographicBrief {
    return {
        art: {
            palette: shorten(brief.art.palette, BRIEF_LIMITS.palette),
            mood: shorten(brief.art.mood, BRIEF_LIMITS.mood),
        },
        title: shorten(brief.title, BRIEF_LIMITS.title),
        subtitle: shorten(brief.subtitle, BRIEF_LIMITS.subtitle),
        panels: brief.panels.slice(0, MAX_PANELS).map((panel) => ({
            label: shorten(panel.label, BRIEF_LIMITS.label),
            figure: shorten(panel.figure, BRIEF_LIMITS.figure),
            note: shorten(panel.note, BRIEF_LIMITS.note),
            icon: shorten(panel.icon, BRIEF_LIMITS.icon),
        })),
        takeaway: shorten(brief.takeaway, BRIEF_LIMITS.takeaway),
    };
}

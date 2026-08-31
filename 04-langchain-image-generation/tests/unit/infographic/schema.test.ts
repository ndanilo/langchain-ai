import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRIEF_LIMITS,
  MAX_PANELS,
  artDirectionSchema,
  infographicBriefSchema,
  infographicPanelSchema,
  normaliseBrief,
  shorten,
} from "../../../src/infographic/schema.js";
import { createBrief } from "../../helpers/fixtures.js";

describe("shorten", () => {
  it("leaves a string that already fits untouched", () => {
    assert.equal(shorten("Inflação em queda", 60), "Inflação em queda");
  });

  it("cuts on a word boundary rather than mid-word", () => {
    assert.equal(shorten("13,75% até o fim de 2026", 18), "13,75% até o fim");
  });

  it("drops the punctuation left dangling by the cut", () => {
    assert.equal(shorten("quatro cortes seguidos, desde março", 24), "quatro cortes seguidos");
  });

  /*
  Observed on a real poster: a word-boundary cut ended two captions on "de", which the
  image model then drew at full size. Ending a clause earlier reads as a short caption
  rather than a broken one.
  */
  it("prefers a clause boundary so the text does not end on a dangling preposition", () => {
    assert.equal(
      shorten("Definida pelo Copom em 5 de agosto de 2026 — 4º corte consecutivo de 0,25 p.p.", 70),
      "Definida pelo Copom em 5 de agosto de 2026",
    );

    assert.equal(
      shorten("De 15,00% (jan/2026) para 14,00% (ago/2026), após 10 meses de estabilidade", 70),
      "De 15,00% (jan/2026) para 14,00% (ago/2026)",
    );
  });

  it("drops a connector left stranded at the end of a word-boundary cut", () => {
    // Seen on a real poster: the footer ended on a lone "e".
    assert.equal(
      shorten("clássicos resilientes convivem com a febre de Universos Beyond e mais", 66),
      "clássicos resilientes convivem com a febre de Universos Beyond",
    );
  });

  it("keeps a short word that carries meaning", () => {
    assert.equal(shorten("13,75% até o fim de 2026", 18), "13,75% até o fim");
  });

  it("ignores a clause boundary that would throw away most of the string", () => {
    // The comma sits too early to cut on, so this falls back to the word boundary.
    assert.equal(shorten("Sim, um comentário bastante longo aqui", 30), "Sim, um comentário bastante");
  });

  it("collapses newlines and repeated spaces", () => {
    assert.equal(shorten("  taxa\n\n  Selic  ", 40), "taxa Selic");
  });

  it("falls back to a hard cut when the first word is longer than the limit", () => {
    assert.equal(shorten("supercalifragilistic", 10), "supercalif");
  });
});

describe("normaliseBrief", () => {
  it("leaves a brief that is already within the limits alone", () => {
    const brief = createBrief();

    assert.deepEqual(normaliseBrief(brief), brief);
  });

  /*
  The failure this exists for: providers enforce a JSON-schema maxLength by truncating the
  decoded string, so an over-long field arrives cut mid-number. Trimming on our side, on a
  word boundary, is what keeps a wrong figure off the poster.
  */
  it("brings every over-long field inside its limit", () => {
    const normalised = normaliseBrief(
      createBrief({
        title: "uma manchete ".repeat(20),
        subtitle: "um subtítulo bastante longo ".repeat(10),
        takeaway: "uma conclusão bastante longa ".repeat(10),
        panels: [
          {
            label: "um rótulo muito longo para caber",
            figure: "14,00% ao ano exatamente",
            note: "d".repeat(200),
            icon: "an extremely elaborate illustration ".repeat(10),
          },
          { label: "ok", figure: "4,2%", note: "curto", icon: "a coin" },
          { label: "ok", figure: "3,0%", note: "curto", icon: "a target" },
        ],
      }),
    );

    assert.ok(normalised.title.length <= BRIEF_LIMITS.title);
    assert.ok(normalised.subtitle.length <= BRIEF_LIMITS.subtitle);
    assert.ok(normalised.takeaway.length <= BRIEF_LIMITS.takeaway);

    for (const panel of normalised.panels) {
      assert.ok(panel.label.length <= BRIEF_LIMITS.label, panel.label);
      assert.ok(panel.figure.length <= BRIEF_LIMITS.figure, panel.figure);
      assert.ok(panel.note.length <= BRIEF_LIMITS.note, panel.note);
      assert.ok(panel.icon.length <= BRIEF_LIMITS.icon, panel.icon);
    }
  });

  it("keeps the art direction, since none of it is printed", () => {
    const brief = createBrief();

    assert.deepEqual(normaliseBrief(brief).art, brief.art);
  });

  it("drops panels beyond what the layout can render", () => {
    const panel = { label: "ok", figure: "1", note: "curto", icon: "a coin" };
    const normalised = normaliseBrief(createBrief({ panels: Array(8).fill(panel) }));

    assert.equal(normalised.panels.length, MAX_PANELS);
  });
});

describe("infographicBriefSchema", () => {
  /*
  Length limits are deliberately absent from the schema: as maxLength they make the
  provider truncate mid-word during decoding. They belong in the descriptions, where the
  model reads them, and in normaliseBrief, which applies them safely.
  */
  it("states length limits in descriptions instead of as constraints", () => {
    const json = JSON.stringify(infographicBriefSchema.shape.title._def);

    assert.doesNotMatch(json, /"maxLength"/);
    assert.match(
      infographicBriefSchema.shape.title.description ?? "",
      new RegExp(`${BRIEF_LIMITS.title} characters`),
    );
  });

  it("keeps art direction in its own object, away from the printed copy", () => {
    const parsed = infographicBriefSchema.safeParse(createBrief());

    assert.equal(parsed.success, true);
    assert.equal(typeof parsed.data?.art.palette, "string");
    // A bare `palette` beside the copy fields is what the model once filled with the
    // subtitle, so it must not reappear at the top level.
    assert.equal("palette" in (parsed.data ?? {}), false);
  });

  it("tells the model to write art direction in English, whatever the output language", () => {
    assert.match(artDirectionSchema.shape.palette.description ?? "", /In ENGLISH/);
    assert.match(infographicPanelSchema.shape.icon.description ?? "", /In ENGLISH/);
  });
});

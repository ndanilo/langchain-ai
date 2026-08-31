import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { languageName, renderImagePrompt } from "../../../src/infographic/prompt.js";
import { createBrief } from "../../helpers/fixtures.js";

describe("languageName", () => {
  it("resolves a BCP-47 tag to a name the image model understands", () => {
    assert.equal(languageName("pt-BR"), "Brazilian Portuguese");
    assert.equal(languageName("en"), "English");
  });

  it("falls back to the raw tag when it cannot be resolved", () => {
    assert.equal(languageName("not-a-language-tag-at-all"), "not-a-language-tag-at-all");
  });
});

describe("renderImagePrompt", () => {
  const options = { language: "pt-BR", aspectRatio: "9:16" };

  it("names the language so the model does not default to English", () => {
    const prompt = renderImagePrompt(createBrief(), options);

    assert.match(prompt, /All text is in Brazilian Portuguese/);
  });

  it("quotes every string from the brief verbatim, accents included", () => {
    const brief = createBrief();
    const prompt = renderImagePrompt(brief, options);

    assert.ok(prompt.includes(`"${brief.title}"`), "title is quoted");
    assert.ok(prompt.includes(`"${brief.subtitle}"`), "subtitle is quoted");
    assert.ok(prompt.includes(`"${brief.takeaway}"`), "takeaway is quoted");

    for (const panel of brief.panels) {
      assert.ok(prompt.includes(`"${panel.label}"`), `${panel.label} is quoted`);
      assert.ok(prompt.includes(`"${panel.figure}"`), `${panel.figure} is quoted`);
      assert.ok(prompt.includes(`"${panel.note}"`), `${panel.note} is quoted`);
    }
  });

  it("puts the figure in the large slot and the label beside it", () => {
    const prompt = renderImagePrompt(
      createBrief({
        panels: [
          { label: "Taxa atual", figure: "14,00% a.a.", note: "Copom", icon: "a bronze coin" },
        ],
      }),
      options,
    );

    assert.match(prompt, /label "Taxa atual", large figure "14,00% a\.a\."/);
  });

  it("numbers one panel per brief entry and states the count", () => {
    const prompt = renderImagePrompt(createBrief(), options);

    assert.match(prompt, /3 panels, each with its own illustration/);
    assert.match(prompt, /Panel 1 —/);
    assert.match(prompt, /Panel 3 —/);
    assert.doesNotMatch(prompt, /Panel 4 —/);
  });

  it("uses the palette and mood the model chose for this subject", () => {
    const prompt = renderImagePrompt(createBrief(), options);

    assert.match(prompt, /9:16 portrait format/);
    assert.match(prompt, /Colour palette: ember orange, deep indigo/);
    assert.match(prompt, /Visual mood: precise, editorial, financial/);
  });

  it("lets config override the palette without touching the rest of the art direction", () => {
    const prompt = renderImagePrompt(createBrief(), {
      ...options,
      paletteOverride: "brand teal, brand coral",
    });

    assert.match(prompt, /Colour palette: brand teal, brand coral/);
    assert.doesNotMatch(prompt, /ember orange/);
    assert.match(prompt, /Visual mood: precise, editorial, financial/);
  });

  it("ignores a blank override rather than sending an empty palette", () => {
    const prompt = renderImagePrompt(createBrief(), { ...options, paletteOverride: "   " });

    assert.match(prompt, /Colour palette: ember orange/);
  });

  it("gives each panel its own subject-specific illustration", () => {
    const prompt = renderImagePrompt(createBrief(), options);

    assert.match(prompt, /Illustration for this panel: a shopping basket shrinking/);
    assert.match(prompt, /Illustration for this panel: an arrow landing inside/);
  });

  /*
  The first version of this prompt pinned flat design, white space and "simple flat icons",
  and produced stock trophies and clipboards on a poster about a card game.
  */
  it("asks for vivid editorial design rather than a corporate slide", () => {
    const prompt = renderImagePrompt(createBrief(), options);

    assert.match(prompt, /saturated colour blocking/);
    assert.match(prompt, /Never generic business clip art/);
    assert.doesNotMatch(prompt, /flat design/);
    assert.doesNotMatch(prompt, /white space/);
    assert.doesNotMatch(prompt, /no drop shadows/);
  });

  it("forbids the filler text image models like to invent", () => {
    const prompt = renderImagePrompt(createBrief(), options);

    assert.match(prompt, /lorem ipsum/);
    assert.match(prompt, /do not add any text beyond these strings/);
    // A poster came back with a label drawn twice and a stray decorative "2 6" down
    // the side, so both are ruled out explicitly.
    assert.match(prompt, /Each string above appears exactly once/);
    assert.match(prompt, /no decorative or background lettering/);
  });

  it("replaces inner double quotes so they cannot break out of a quoted string", () => {
    const prompt = renderImagePrompt(createBrief({ title: 'A "grande" queda' }), options);

    assert.match(prompt, /"A 'grande' queda"/);
  });
});

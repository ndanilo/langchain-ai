import type { InfographicBrief } from "../../src/infographic/schema.js";

/**
 * A brief in the project's default output language, with an accent in the title so slug
 * and prompt handling get exercised the way they will be in practice.
 */
export function createBrief(overrides: Partial<InfographicBrief> = {}): InfographicBrief {
  return {
    art: {
      palette: "ember orange, deep indigo, mint green, parchment cream",
      mood: "precise, editorial, financial",
    },
    title: "Inflação em queda",
    subtitle: "Índice acumulado nos últimos doze meses",
    panels: [
      {
        label: "Acumulado",
        figure: "4,2%",
        note: "Doze meses até agosto",
        icon: "a shopping basket shrinking on a downward slope",
      },
      {
        label: "No mês",
        figure: "0,3%",
        note: "Menor valor do semestre",
        icon: "a single coin resting on a calendar page",
      },
      {
        label: "Meta",
        figure: "3,0%",
        note: "Centro da meta oficial",
        icon: "an arrow landing inside a narrow target band",
      },
    ],
    takeaway: "A tendência de queda continua, mas ainda acima da meta",
    ...overrides,
  };
}

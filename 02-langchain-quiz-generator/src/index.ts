import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph/graph.js";

console.log(`Running quiz generator (fact extraction)...`);

const sourceText = `
The 2026 FIFA World Cup is the 23rd FIFA World Cup and the current edition of the quadrennial international men's soccer championship contested by the national teams of the member associations of FIFA. The tournament began on June 11, 2026, and will conclude on July 19. It is jointly hosted by 16 cities—11 in the United States, 3 in Mexico, and 2 in Canada. The tournament is the first FIFA World Cup to be hosted by three countries and the first to include 48 teams, an expansion from the previous 32-team format.

The 2026 tournament is the first World Cup since 2002 to be hosted by multiple nations. Mexico became the first country to host the World Cup three times, having hosted the 1970 and 1986 tournaments. The United States previously hosted the World Cup in 1994, while it is Canada's first time hosting the tournament. As host nations, Canada, Mexico, and the United States all automatically qualified. Argentina is the defending champion, having won its third World Cup in 2022.

Starting with the 2026 edition, the World Cup expanded to 48 teams. Teams were split into 12 groups of 4, with the top 2 in each group and the 8 best third-place teams progressing to a round of 32. The total number of matches increased from 64 to 104. The United States hosts 78 matches, including the final at MetLife Stadium on July 19. Canada and Mexico each host 13 matches.
`.trim();

const result = await graph.invoke({
  messages: [new HumanMessage(sourceText)],
});

const last = result.messages.at(-1);
console.log(last?.content ?? result);

import { LLMService } from "./services/LLMService.js";
import { z } from "zod/v3";
import { generateSystemPrompt } from "./graph/prompts/prompts.js";

import {
    factsSchema,
    type Fact,
    type GraphAnnotation,
} from "./graph/schemas.js";

const systemPrompt = generateSystemPrompt();

type FactsSchema = z.infer<typeof factsSchema>;

console.log(`Running LLM Project...`);

const llmService = new LLMService();

const userPrompt = `
The 2026 FIFA World Cup[A] is the 23rd FIFA World Cup and the current edition of the quadrennial international men's soccer championship contested by the national teams of the member associations of FIFA. The tournament began on June 11, 2026, and will conclude on July 19.[3] It is jointly hosted by 16 cities—11 in the United States, 3 in Mexico, and 2 in Canada. The tournament is the first FIFA World Cup to be hosted by three countries and the first to include 48 teams, an expansion from the previous 32-team format.[4]

The 2026 tournament is the first World Cup since 2002 to be hosted by multiple nations. Mexico became the first country to host the World Cup three times, having hosted the 1970 and 1986 tournaments.[5] The United States previously hosted the World Cup in 1994, while it is Canada's first time hosting the tournament.[5] The event returned to its traditional June–July schedule after the 2022 World Cup in Qatar, which was uniquely held in November and December to avoid Qatar's extreme summer heat.[6]

As host nations, Canada, Mexico, and the United States all automatically qualified for the tournament. Cape Verde, Curaçao, Jordan, and Uzbekistan all made their World Cup debuts.[5] Argentina is the defending champion, having won its third World Cup in 2022. On June 25, 2026, total attendance reached 3,605,357 spectators, setting the record for the highest attendance in World Cup history and surpassing the previous record held by the American-hosted 1994 edition.[7]

Format
Expansion
The idea of expanding the tournament had been suggested as early as 2013 by then-UEFA president Michel Platini,[8][9] and also in 2016 by current FIFA president Gianni Infantino.[10] Opponents of the proposal argued that the number of matches played was already at an unacceptable level, that the expansion would dilute the quality of the matches,[11][12] and that the decision was driven by political rather than sporting concerns, specifically that Infantino was trying to win his election by promising to bring more countries to the World Cup.[13]

Starting with the 2026 edition, the World Cup expanded to 48 teams, an increase of 16 teams compared to the previous seven tournaments.[14] As approved by the FIFA Council on March 14, 2023, the teams were split into 12 groups of 4 teams, with the top 2 teams in each group and the 8 best third-place teams progressing to a new round of 32.[15] It is the first expansion and format change since 1998.[16]

The total number of matches played increased from 64 to 104, and the number of matches played by teams reaching the semifinals increased from 7 to 8. The tournament lasts 39 days, an increase from the 32 days of the 2014 and 2018 tournaments, and from the 29 days of the 2022 tournament.[17][18] Each team still plays three group matches.[19][20] The final matchday at club level for players named in the final squads was May 24, 2026; clubs had to release their players by May 25, with exceptions granted to players participating in continental club competition finals up until May 30. The 56 days of the combined rest, release, and tournament periods remain identical to the 2010, 2014, and 2018 tournaments.[15]

Other expansion formats explored
The expansion to 48 teams had already been approved on January 10, 2017, when it was initially decided that the tournament would include 16 groups of 3 teams, and 80 matches in total, with the top two teams of each group progressing to a round of 32.[14][21] Under this later-superseded format, the maximum number of matches per team would have remained at seven, but each team would have played one fewer group match than before. The tournament would still have been completed within 32 days.[22] This format was initially chosen over three other proposals, ranging from 40 to 48 teams, from 76 to 88 matches, and from a minimum of 1 to 4 matches per team.[23][24][25]

Critics of this format argued that the use of three-team groups with two teams progressing significantly increased the risk of collusion between teams.[26] This prompted FIFA to suggest that penalty shootouts may be used to prevent draws in the group stage,[27] although even then some risk of collusion would remain, and a possibility would emerge of teams deliberately losing shootouts to eliminate a rival.[26] To address these concerns, FIFA continued considering alternative formats[28]—a process that ended with the 2023 announcement that the format would be 12 groups of 4 teams.[29]

New rules
The 2026 FIFA World Cup introduces several rule changes. In accordance with IFAB, these are primarily designed to reduce time-wasting. The new rules for the tournament include:[30]

10-second substitutions: Players being substituted have ten seconds to exit the field; otherwise, the substitute must wait for one minute before entering the match.
5-second restarts: A visual 5-second countdown can be shown by the referee for throw-ins and goal kicks in situations of time-wasting. If the ball is not put into play in time, a restart is awarded to the opposing team; a corner kick is awarded if the infraction occurs pending a goal kick.
Medical treatment: Any outfield player who receives medical attention on the field must leave the field and wait for 1 minute before returning to play.
Expanded video assistant referee (VAR): VAR can now review and overturn clear mistakes on red cards given from a second yellow card, wrongly awarded corner kicks, and certain attacking fouls.
Mouth-covering red cards: To stop confrontational or insulting behavior hidden from lip-reading, any player who covers his mouth with his hand, arm, or shirt while confronting an opponent is to be sent off.
Player leaving the field in protest: Players or officials who leave the field in protest are to be sent off.
The tiebreakers for when teams finish the group stage equal on points also changed. The first tiebreaker is now the number of points earned in head-to-head matches between the tied teams, not goal difference among all matches.[31][32][33]

Breaks
Cooling or hydration breaks were introduced at the 2014 World Cup in Brazil. For the 2026 World Cup, FIFA introduced mandatory three-minute hydration breaks in every half for all matches. Broadcasters are permitted to run commercials during these pauses.[34]

Match schedule
The match schedule, without group assignments, was announced on February 4, 2024.[3][35][36] On June 13, 2024, FIFA released an updated schedule, with specific pairings assigned to venues for the knockout stage.[37] In addition, group stage matches were assigned to specific groups (though pairings for non-host groups were not assigned to specific matches until after the final draw; thus the group venues were known, but not for which specific pairing each matchday). The full schedule was unveiled in a live broadcast on December 6, 2025, the day after the draw. Group stage pairings were allocated to specific matches, and the kickoff times were confirmed for all fixtures.[38]

The opening match was announced to include Mexico; it took place on June 11, 2026, at the Estadio Azteca in Mexico City.[39] The opening match involving Canada took place on June 12 at BMO Field in Toronto, while the United States' opening match took place on the same day at SoFi Stadium in Inglewood. Each host nation played each of its three matches in the group stage within its own country.[35]

AT&T Stadium in Arlington hosts the most matches of any venue at the tournament, with nine. The United States hosts 78 matches, including all quarterfinals, semifinals, and the final to be played at MetLife Stadium in East Rutherford on July 19. Canada and Mexico each host 13 matches. Each tournament venue, except for the Estadio Akron, host at least one knockout stage fixture.[40] The match schedule overlaps with the 2026 CFL season, resulting in scheduling conflicts and loss of home games for the Toronto Argonauts and BC Lions.[41][42] The match schedule also affects the 2026 Major League Baseball season schedules of the Kansas City Royals, Philadelphia Phillies, Seattle Mariners, and Texas Rangers, whose home stadiums are located near World Cup venues.[43]

Host cities were geographically grouped into three regions:[3]

Western Region (Vancouver, Seattle, San Francisco Bay Area, Los Angeles)
Central Region (Guadalajara, Mexico City, Monterrey, Houston, Dallas, Kansas City)
Eastern Region (Atlanta, Miami, Toronto, Boston, Philadelphia, New York/New Jersey)
`;

const result = await llmService.generateStructuredOutputAsync<FactsSchema>(
    systemPrompt,
    userPrompt,
    factsSchema,
);

if (!result.success) {
    console.error(result.error);
    process.exit(1);
}

console.log(result.data);
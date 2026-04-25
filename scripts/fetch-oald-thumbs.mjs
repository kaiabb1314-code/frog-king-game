/**
 * One-off: curl OALD definition pages, print first /media/english/thumb/...png URL.
 * Run: node scripts/fetch-oald-thumbs.mjs
 */
import { execSync } from "node:child_process";

const slugs = {
  run: ["run_1", "run_2", "running_1", "jog_1", "sprint_1"],
  best: ["best_1", "best_2", "the-best_1", "top_1"],
  rule: ["rule_1", "rule_2", "ruler_1", "ruler_2"],
  turn: ["turn_1", "turn_2", "in-turn_1", "turn-noun_1", "it-s-your-turn_1", "chance_1"],
  speak: ["speak_1", "speaker_1", "public-speaking_1", "speaking_1"],
  give: ["give_1", "give_2", "hand_1", "hand_2", "pass_1", "pass_2"],
  away: ["away_1", "put-away_1", "throw-away_1", "get-away_1", "put-away_2"],
  must: ["must_1", "have-to_1", "must-auxiliary-verb_1", "necessary_1", "necessary_2"],
  need: ["need_1", "need_2", "need_3", "necessary_1", "necessary_2"],
  top: ["top_1", "top_2", "on-top_1", "topping_1", "highest_1", "highest_2"],
  talk: ["talk_1", "talk_2", "conversation_1", "chat_1", "discuss_1", "discuss_2", "discuss_3", "discuss_4"],
  exercise: ["exercise_1", "exercise_2", "gym_1", "gym_2"],
  clean: ["clean_1", "clean_2", "clean_3", "washing_1", "mop_1", "mop_2"],
  arrive: ["arrive_1", "arrive_2", "arrival_1", "arrival_2", "get-here_1", "get-there_1", "get-there_2"],
};

function firstThumb(url) {
  const html = execSync(
    `curl -sL -A 'Mozilla/5.0' ${JSON.stringify(url)}`,
    { maxBuffer: 2_000_000, encoding: "utf8" }
  );
  const m = html.match(/https:\/\/www\.oxfordlearnersdictionaries\.com\/media\/english\/thumb[^"'<> ]+\.png/);
  return m ? m[0] : null;
}

for (const [word, trySlugs] of Object.entries(slugs)) {
  let found = null;
  let from = "";
  for (const slug of trySlugs) {
    const u = `https://www.oxfordlearnersdictionaries.com/definition/english/${slug}`;
    try {
      const t = firstThumb(u);
      if (t) {
        found = t;
        from = slug;
        break;
      }
    } catch {
      // continue
    }
  }
  console.log(word + "\t" + (found || "NONE") + "\t" + from);
}

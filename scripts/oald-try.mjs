import { execSync } from "node:child_process";

const slugs = [
  "best_1", "best_2", "prize_1", "medal_1", "gold_1", "winner_1", "trophy_1", "excellent_1", "top_1", "turn_1", "turn_2", "turn_3", "your-turn_1", "chance_1", "opportunity_1", "round_1", "in-turn_1",
  "speak_1", "speaker_1", "speech_1", "public-speaking_1", "microphone_1", "say_1", "tell_1",
  "give_1", "give_2", "hand_1", "pass_1", "present_1", "donate_1", "charity_1", "help_1", "lend_1", "hold-hands_1", "hug_1", "kissing_1",
  "away_1", "away_2", "put-away_1", "put-away_2", "throw-away_1", "get-away_1", "right-away_1", "go-away_1", "out_1", "out_2",
  "must_1", "must_2", "need_1", "need_2", "need_3", "have-to_1", "necessary_1", "necessary_2", "important_1", "vital_1", "ought-to_1", "should_1", "if-you-must_1", "i-must-say_1", "a-must_1", "must_3",
  "top_1", "top_2", "on-top_1", "topping_1", "highest_1", "at-the-top_1", "the-top_1", "upstairs_1", "ceiling_1", "head_1", "bottle_1", "bottle_2", "jacket_1", "jacket_2",
  "talk_1", "talk_2", "discuss_1", "discuss_2", "discuss_3", "chat_1", "chat_2", "conversation_1", "meeting_1", "conference_1", "lecture_1", "argue_1", "quarrel_1",
  "exercise_1", "exercise_2", "exercising_1", "gym_1", "yoga_1", "aerobics_1", "jog_1", "fitness_1", "gym_2",
  "clean_1", "clean_2", "clean_3", "washing_1", "mop_1", "broom_1", "duster_1", "dishwasher_1", "soap_1", "sweep_1", "scrub_1", "tidy_1", "clean-up_1", "wipe_1", "dirt_1", "dirty_1", "dirty_2", "dirt_2",
  "arrive_1", "arrive_2", "arrival_1", "get-to_1", "get-there_1", "reach_1", "come_1", "come_2", "come_3", "enter_1", "leave_1", "return_1", "get-here_1", "at-last_1", "turn-up_1", "turn-up_2", "turn-up_3", "show-up_1", "get-in_1", "get-in_2", "get-on_1", "get-on_2", "arrive_3",
  "ruler_1", "ruler_2", "rule_1", "rule_2", "classroom_1", "school_1", "class_1", "class_2", "teach_1", "teach_2",
  "run_1", "running_1", "jog_1", "sprint_1", "race_1", "race_2", "marathon_1", "hurry_1", "hurry_2", "rush_1", "hurry_3",
  "butterfly",
];

const seen = new Set();
const rows = [];
for (const slug of slugs) {
  const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${slug}`;
  let html;
  try {
    html = execSync(`curl -sL -A 'Mozilla/5.0' ${JSON.stringify(url)}`, {
      maxBuffer: 2_000_000,
      encoding: "utf8",
    });
  } catch {
    continue;
  }
  const m = html.match(/https:\/\/www\.oxfordlearnersdictionaries\.com\/media\/english\/fullsize\/[^"<> ]+\.png/);
  if (m) {
    const u = m[0];
    if (seen.has(u)) continue;
    seen.add(u);
    rows.push([slug, u]);
  }
}
rows.forEach((r) => console.log(r.join("\t")));

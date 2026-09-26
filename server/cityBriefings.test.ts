import assert from "node:assert/strict";
import { test } from "node:test";
import { extractiveBriefing, uniqueSentences } from "./services/cityBriefings.ts";
import type { CityArticle } from "./services/nyt.ts";

const article: CityArticle = {
  id: "20260926-queens-subway",
  headline: "A new subway stop in Queens",
  dek: "Riders will get a new station next year.",
  lead: "The MTA said the Queens stop will open in 2027 and serve Long Island City.",
  keywords: ["MTA", "New York City", "Long Island City"],
  url: "https://www.nytimes.com/2026/09/26/nyregion/queens-subway.html",
  date: "2026-09-26",
  section: "N.Y. / Region",
  topic: "transit",
  source: "nyt-rss",
};

test("uniqueSentences keeps distinct facts and drops repeats", () => {
  assert.deepEqual(uniqueSentences("Riders will get a new station next year.", "Riders will get a new station next year. The MTA named a 2027 opening."), [
    "Riders will get a new station next year.",
    "The MTA named a 2027 opening.",
  ]);
});

test("extractive briefing turns the Times lead and blurb into a short article plus points", () => {
  const brief = extractiveBriefing(article);
  assert.match(brief.summary_en, /subway stop/);
  assert.match(brief.summary_en, /MTA/);
  assert.match(brief.summary_en, /next year/);
  assert.equal(brief.points.length, 2);
  assert.equal(brief.article.lead, null);
  assert.deepEqual(brief.article.keywords, []);
  assert.equal(brief.facts.where, "New York City");
  assert.equal(brief.facts.what, article.headline);
});

test("extractive briefing takes key points from the article body, not the blurb", () => {
  const brief = extractiveBriefing(article, [
    "The MTA board voted to add a station at Jackson Avenue after years of community requests.",
    "Weekend trains would start in 2028 if the capital plan stays on schedule.",
    "Riders will get a new station next year.",
  ]);
  assert.equal(brief.points[0], "The MTA board voted to add a station at Jackson Avenue after years of community requests.");
  assert.ok(brief.points.some((point) => /2028/.test(point)));
  assert.ok(!brief.points.every((point) => point === article.dek));
});

test("extractive briefing does not invent a second fact from the headline alone", () => {
  const brief = extractiveBriefing({ ...article, dek: null, lead: null, keywords: [] });
  assert.equal(brief.summary_en, `${article.headline}.`);
  assert.deepEqual(brief.points, [article.headline]);
  assert.equal(brief.facts.who, null);
});

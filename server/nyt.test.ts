import assert from "node:assert/strict";
import { test } from "node:test";
import { articleId, extractArticleBody, mergeArticles, parseRss, parseSearchDocs, topicOfArticle } from "./services/nyt.ts";

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>NYT &gt; New York</title>
    <item>
      <title>A new subway stop in Queens</title>
      <link>https://www.nytimes.com/2026/09/26/nyregion/queens-subway.html</link>
      <guid>https://www.nytimes.com/2026/09/26/nyregion/queens-subway.html</guid>
      <description>&lt;p&gt;Riders will get a new station next year.&lt;/p&gt;</description>
      <pubDate>Sat, 26 Sep 2026 12:00:00 +0000</pubDate>
      <category>Adams, Eric</category>
      <category>N.Y. / Region</category>
    </item>
    <item>
      <title></title>
      <link>https://www.nytimes.com/empty</link>
    </item>
  </channel>
</rss>`;

test("parseRss keeps titled items and strips html", () => {
  const items = parseRss(rss);
  assert.equal(items.length, 1);
  assert.equal(items[0].headline, "A new subway stop in Queens");
  assert.equal(items[0].dek, "Riders will get a new station next year.");
  assert.equal(items[0].date, "2026-09-26");
  assert.equal(items[0].section, "N.Y. / Region");
  assert.equal(items[0].topic, "transit");
  assert.equal(items[0].source, "nyt-rss");
});

test("parseSearchDocs maps Article Search docs", () => {
  const items = parseSearchDocs([
    {
      _id: "nyt://article/1",
      web_url: "https://www.nytimes.com/2026/09/25/realestate/astoria-rents.html",
      headline: { main: "Rents rise in Astoria" },
      abstract: "A look at new leases.",
      lead_paragraph: "New leases in Astoria are higher than last year.",
      keywords: [{ name: "glocations", value: "Astoria (Queens, NY)" }],
      pub_date: "2026-09-25T15:04:00+0000",
      section_name: "Real Estate",
    },
    { headline: { main: "No url" } },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].topic, "housing");
  assert.equal(items[0].source, "nyt-search");
  assert.equal(items[0].lead, "New leases in Astoria are higher than last year.");
  assert.deepEqual(items[0].keywords, ["Astoria (Queens, NY)"]);
});

test("mergeArticles drops duplicate urls and prefers search first", () => {
  const merged = mergeArticles([
    parseSearchDocs([
      {
        web_url: "https://www.nytimes.com/2026/09/26/nyregion/queens-subway.html?smid=rss",
        headline: { main: "Search title" },
        pub_date: "2026-09-26T12:00:00+0000",
        section_name: "New York",
      },
    ]),
    parseRss(rss),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].headline, "Search title");
});

test("topicOfArticle uses the Times desk and the headline", () => {
  assert.equal(topicOfArticle({ url: "https://www.nytimes.com/2026/09/25/weather/noreaster.html", headline: "A storm" }), "weather");
  assert.equal(topicOfArticle({ url: "https://www.nytimes.com/2026/09/26/nyregion/mamdani-un.html", headline: "Mamdani at the United Nations" }), "politics");
  assert.equal(topicOfArticle({ url: "https://www.nytimes.com/2026/09/26/business/candy.html", headline: "A candy is gone" }), "business");
  assert.equal(topicOfArticle({ url: "https://www.nytimes.com/2026/09/26/nyregion/little-italy-feast.html", headline: "The Feast of San Gennaro" }), "arts");
  assert.equal(topicOfArticle({ url: "https://www.nytimes.com/2026/09/26/nyregion/woodside-fair.html", headline: "A street fair in Woodside" }), "newyork");
  assert.equal(topicOfArticle({ url: "https://www.nytimes.com/live/2026/09/26/nyregion/noreaster-storm-rain/heres-the-latest", headline: "Here’s the latest." }), "weather");
});

test("extractArticleBody reads Times story paragraphs and skips the challenge page", () => {
  const html = `<html><body>
    <script type="application/ld+json">{"@type":"NewsArticle","articleBody":"Too short"}</script>
    <section name="articleBody">
      <p data-testid="paragraph">The MTA said the Queens stop will open in 2027 and serve Long Island City riders.</p>
      <p data-testid="paragraph">Advertisement</p>
      <p data-testid="paragraph">Local officials want the station built near Jackson Avenue, with an entrance on 23rd Street.</p>
      <p data-testid="paragraph">The project is funded in the next capital plan and would add weekend service later.</p>
    </section>
  </body></html>`;
  assert.deepEqual(extractArticleBody(html), [
    "The MTA said the Queens stop will open in 2027 and serve Long Island City riders.",
    "Local officials want the station built near Jackson Avenue, with an entrance on 23rd Street.",
    "The project is funded in the next capital plan and would add weekend service later.",
  ]);
  assert.deepEqual(extractArticleBody('<html><head><title>nytimes.com</title></head><body><p id="cmsg">wait</p></body></html>'), []);
});

test("articleId keeps same-day slugs unique by date", () => {
  const a = articleId("https://www.nytimes.com/2026/09/26/nyregion/heres-the-latest.html", "heres", "2026-09-26");
  const b = articleId("https://www.nytimes.com/2026/09/25/nyregion/heres-the-latest.html", "heres", "2026-09-25");
  assert.equal(a, "20260926-heres-the-latest");
  assert.equal(b, "20260925-heres-the-latest");
  assert.notEqual(a, b);
});

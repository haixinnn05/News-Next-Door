import { useLang } from "../lib/i18n";
import { useMeta } from "../lib/meta";
import { Link } from "../lib/router";

export function About() {
  const { lang } = useLang();
  const meta = useMeta();
  if (lang === "zh")
    return (
      <div className="container page prose">
        <h1>关于 Before the Vote</h1>
        <p>社区委员会的文件通常很长、很专业，而且只有英文。Before the Vote 把皇后区第二社区委员会（长岛市、阳光园、伍德赛德、马斯佩斯）的官方文件，整理成通俗易懂的提案卡片、英文和中文语音简报，以及 iMessage 提醒。</p>
        <h2>我们的原则</h2>
        <ul>
          <li>每项事实都链接到原始文件的具体页面；来源中未列出的信息会标注“来源中未列出”。</li>
          <li>社区委员会的讨论不等于最终投票。我们保留文件中实际的机构、会议类型和决策阶段。</li>
          <li>中文内容为机器翻译，除非标注已审核。</li>
          <li>只有在您主动发送代码后，我们才会发送消息。回复 STOP 立即退订。</li>
        </ul>
        <p>这是一个独立的黑客松原型，与社区委员会或纽约市政府无关。</p>
      </div>
    );
  return (
    <div className="container page prose">
      <h1>About Before the Vote</h1>
      <p>
        Community board documents are long, technical, and usually English-only. Before the Vote turns official documents from {meta?.board.name ?? "Queens Community Board 2"} (Long Island City, Sunnyside, Woodside, Maspeth) into plain-language proposal cards, short English and Chinese audio briefings, and iMessage reminders, so residents can take part before decisions are made.
      </p>
      <h2>Principles</h2>
      <ul>
        <li>Every fact links to the page of the official document it came from. If the source doesn't say, we show “Not listed in source.”</li>
        <li>A community board discussion is not a final vote. We keep the actual body, meeting type, and decision stage from each source.</li>
        <li>Chinese text and audio are generated translations unless marked as reviewed.</li>
        <li>We only message people who text us a follow code first. Reply STOP to unsubscribe instantly.</li>
        <li>Sample proposals and DEMO events are labelled everywhere they appear. Demo dates never replace real government dates.</li>
      </ul>
      <h2>Built with</h2>
      <ul>
        <li><strong>Grok (xAI)</strong> reads each official document and extracts a structured draft with verbatim evidence, which a teammate reviews before anything is published.</li>
        <li><strong>ElevenLabs</strong> narrates the reviewed English briefing and dubs it into Chinese.</li>
        <li><strong>Photon</strong> delivers follow confirmations and reminders over iMessage.</li>
      </ul>
      <p>
        This is an independent hackathon prototype, not affiliated with the community board or the City of New York. Official documents:{" "}
        <a className="link" href={meta?.board.documentsPage ?? "https://www.nyc.gov/site/queenscb2/meetings/committee-agendas-minutes.page"} target="_blank" rel="noreferrer">
          Queens CB2 committee agendas &amp; minutes
        </a>
        .
      </p>
    </div>
  );
}

export function HowItWorks() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const steps = zh
    ? [
        ["1. 导入官方文件", "团队上传社区委员会的 PDF 或网页，并填写官方链接和发布日期。系统保留每一页的文字。"],
        ["2. Grok 提取，人工审核", "Grok 按固定结构提取标题、位置、阶段、日期和参与方式，每项都必须附上原文摘录。系统会自动核对摘录是否真的出现在原文中；团队审核后才发布。"],
        ["3. ElevenLabs 语音", "根据审核后的卡片生成 60–90 秒的英文简报，再用 ElevenLabs 配音翻译成中文。语音按提案版本缓存。"],
        ["4. Photon iMessage 提醒", "在提案页点击“关注”，将代码发送到我们的 iMessage 线路。会议前 24 小时收到提醒；会议改期或取消时，旧提醒会自动作废。"],
      ]
    : [
        ["1. Import an official document", "A teammate uploads a community board PDF or web page with its official URL and publication date. Text is kept page by page."],
        ["2. Grok extracts, a person reviews", "Grok returns a structured draft — title, location, stage, dates, how to participate — and must quote the page each fact came from. Every quote is checked against the document automatically, and a teammate reviews before publishing."],
        ["3. ElevenLabs audio", "A 60–90 second English briefing is narrated from the approved card, then dubbed into Chinese with ElevenLabs. Audio is cached per proposal version."],
        ["4. Photon iMessage reminders", "Tap Follow, text the short code to our iMessage line, and get a reminder 24 hours before the meeting. If a meeting is rescheduled or cancelled, the old reminder is withdrawn."],
      ];
  return (
    <div className="container page prose">
      <h1>{zh ? "使用说明" : "How it works"}</h1>
      {steps.map(([h, p]) => (
        <div key={h}>
          <h2>{h}</h2>
          <p>{p}</p>
        </div>
      ))}
      <p style={{ marginTop: 28 }}>
        <Link to="/discover" className="btn primary">
          {zh ? "开始探索" : "Explore proposals"}
        </Link>
      </p>
    </div>
  );
}

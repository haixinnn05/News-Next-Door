import { useAccount } from "../lib/account";
import { useLang } from "../lib/i18n";
import { Link } from "../lib/router";

export function HowItWorks() {
  const { lang } = useLang();
  const { user, zoneId } = useAccount();
  const zh = lang === "zh";
  const exploreTo = user && zoneId ? "/" : "/?scope=city";
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
      <p className="how-cta">
        <Link to={exploreTo} className="news-cta">
          {zh ? "开始探索" : "Explore proposals"}
        </Link>
      </p>
    </div>
  );
}

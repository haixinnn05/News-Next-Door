import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

const dict = {
  discover: ["Discover", "探索"],
  about: ["About", "关于"],
  howItWorks: ["How it works", "使用说明"],
  heroTitle: ["Understand local proposals before you can take action.", "在采取行动之前，先了解身边的提案。"],
  heroLede: ["Plain-language explanations, multilingual audio, and timely updates for your neighborhood.", "通俗易懂的解释、多语言语音，以及及时的社区更新。"],
  searchPlaceholder: ["Search an address or proposal…", "搜索地址或提案…"],
  search: ["Search", "搜索"],
  recentProposals: ["Recent proposals", "最新提案"],
  viewAll: ["View all", "查看全部"],
  coverage: ["Covering Queens Community Board 2: Long Island City, Sunnyside, Woodside, Maspeth.", "覆盖皇后区第二社区委员会：长岛市、阳光园、伍德赛德、马斯佩斯。"],
  findNearYou: ["Find proposals near you", "查找您附近的提案"],
  findSub: ["Search an address or explore the map to see what's happening in your neighborhood.", "搜索地址或浏览地图，了解您社区正在发生的事情。"],
  all: ["All", "全部"],
  land_use: ["Land Use", "土地使用"],
  transportation: ["Transportation", "交通"],
  parks_environment: ["Parks & Environment", "公园与环境"],
  other: ["Other", "其他"],
  coveredArea: ["Covered area: Queens CB 2", "覆盖范围：皇后区第二社区委员会"],
  backToResults: ["Back to results", "返回结果"],
  share: ["Share", "分享"],
  follow: ["Follow", "关注"],
  following: ["Following", "已关注"],
  overview: ["Overview", "概览"],
  audio: ["Audio", "语音"],
  source: ["Source", "来源"],
  participate: ["How to participate", "如何参与"],
  timeline: ["Timeline", "时间线"],
  whatIsProposed: ["What is proposed?", "提案内容是什么？"],
  statedPurpose: ["Stated purpose", "申报目的"],
  atAGlance: ["At a glance", "概要"],
  stage: ["Stage", "阶段"],
  nextDate: ["Next date", "下一个日期"],
  hearingDate: ["Hearing date", "听证日期"],
  location: ["Location", "位置"],
  category: ["Category", "类别"],
  address: ["Address", "地址"],
  proposedBy: ["Proposed by", "提案方"],
  notListed: ["Not listed in source", "来源中未列出"],
  nextNotAnnounced: ["Next meeting not announced", "下一次会议尚未公布"],
  lastChecked: ["Last checked", "最后核对"],
  listenTitle: ["Listen to a short briefing", "收听简短介绍"],
  listenSub: ["A 60–90 second overview of this proposal.", "60–90 秒的提案概述。"],
  english: ["English", "English"],
  chinese: ["中文", "中文"],
  enTranscript: ["English transcript (source-backed)", "英文文字稿（有来源依据）"],
  zhTranscript: ["中文语音及文字（由 AI 翻译）", "中文语音及文字（由 AI 翻译）"],
  showRefs: ["Show source references", "显示来源引用"],
  hideRefs: ["Hide source references", "隐藏来源引用"],
  generatedTranslation: ["This is a generated translation.", "这是机器生成的翻译。"],
  reviewedTranslation: ["Generated translation, reviewed by a Chinese-speaking volunteer.", "机器翻译，已由中文志愿者审核。"],
  audioPending: ["Audio is being prepared. The written explanation is available below.", "语音正在准备中。下方提供文字说明。"],
  audioNone: ["Audio hasn't been generated for this version yet. The written explanation is available.", "此版本的语音尚未生成。可阅读文字说明。"],
  audioFailed: ["Audio is temporarily unavailable. The written explanation is available.", "语音暂时不可用。可阅读文字说明。"],
  zhPending: ["Chinese audio is being prepared. English audio and text are available now.", "中文语音正在准备中。现在可收听英文语音并阅读文字。"],
  howToParticipate: ["How to participate", "如何参与"],
  participateSub: ["Make your voice heard. Here are the next steps for this proposal.", "表达您的意见。以下是此提案的后续步骤。"],
  submitComment: ["Submit a comment", "提交意见"],
  stayUpdated: ["Stay updated", "获取更新"],
  stayUpdatedText: ["Follow this proposal to receive updates via iMessage.", "关注此提案，通过 iMessage 接收更新。"],
  followThis: ["Follow this proposal", "关注此提案"],
  followIntro: ["Get updates about hearing dates, changes, and opportunities to participate.", "获取关于听证日期、变更和参与机会的更新。"],
  openImessage: ["Open in iMessage", "在 iMessage 中打开"],
  openSimulator: ["Open simulated phone", "打开模拟手机"],
  sendCodeTo: ["Send the code to", "将代码发送至"],
  youllGetConfirm: ["You'll get a confirmation message. Reply STOP anytime to unsubscribe.", "您会收到确认信息。随时回复 STOP 即可取消订阅。"],
  waitingForMessage: ["Waiting for your message…", "等待您的信息…"],
  codeExpires: ["Code expires in", "代码有效期"],
  codeExpired: ["This code expired.", "此代码已过期。"],
  newCode: ["Get a new code", "获取新代码"],
  confirmedTitle: ["You're following this proposal", "您已关注此提案"],
  confirmedText: ["Check your messages for the confirmation. Reply STOP anytime to unsubscribe.", "请查看确认信息。随时回复 STOP 取消订阅。"],
  copied: ["Copied", "已复制"],
  keyDates: ["Key dates and milestones from the official documents.", "来自官方文件的关键日期和里程碑。"],
  tbd: ["TBD", "待定"],
  past: ["Past", "已过"],
  cancelled: ["Cancelled", "已取消"],
  sampleBanner: ["Sample proposal for demonstration — not an official proposal. Dates and events on this page are DEMO data.", "示例提案，仅供演示——并非官方提案。本页日期和事件均为演示数据。"],
  sample: ["Sample", "示例"],
  demo: ["DEMO", "演示"],
  officialDocs: ["Official documents", "官方文件"],
  evidenceTitle: ["Where each fact comes from", "每项信息的出处"],
  field: ["Field", "字段"],
  excerpt: ["Excerpt", "摘录"],
  page: ["Page", "页"],
  openOriginal: ["Open original", "打开原件"],
  viewOnSite: ["Official site", "官方网站"],
  noResults: ["No proposals match your search.", "没有符合搜索条件的提案。"],
  unsupported: ["We don't cover this address yet", "我们暂未覆盖此地址"],
  unsupportedText: ["This demo covers indexed addresses in Queens Community Board 2 only. We won't show unrelated \"nearby\" results.", "此演示仅覆盖皇后区第二社区委员会已收录的地址，不会显示无关的“附近”结果。"],
  noAtAddress: ["No proposals at this address", "此地址暂无提案"],
  noAtAddressText: ["We checked the documents we've indexed and found nothing for this address.", "我们检查了已收录的文件，未找到此地址的提案。"],
  translationNote: ["Chinese text is a generated translation.", "中文内容为机器翻译。"],
  pastEvent: ["This date has passed.", "此日期已过。"],
  instructions: ["Instructions", "参与方式"],
  readMore: ["Read the official document", "阅读官方文件"],
  liveTitle: ["Live applications in Queens CB 2", "皇后区第二社区委员会的现行申请"],
  liveLede: [
    "Pulled from NYC Planning’s Zoning Application Portal. These are the city’s own records — name, status, applicant, and description — not the reviewed briefings below.",
    "数据来自纽约市城市规划局的分区申请门户。这些是市政府公布的记录（名称、状态、申请人和说明），与下方经过核对的简报不同。",
  ],
  openRecord: ["Open official record", "打开官方记录"],
  applicant: ["Applicant", "申请人"],
  latestMilestone: ["Latest milestone", "最新进展"],
  statusFiled: ["Filed", "已提交"],
  statusReview: ["In public review", "公众审议中"],
  statusNoticed: ["Noticed", "已通知"],
  liveEmpty: ["NYC Planning lists no active Queens CB 2 applications right now.", "纽约市城市规划局目前没有列出皇后区第二社区委员会的进行中申请。"],
  liveSource: ["Source: NYC Open Data, Zoning Application Portal project data. Map pins are the project's tax lots. Text is in English, as published.", "来源：纽约市开放数据，分区申请门户项目数据。地图标记为项目地块。正文为市政府发布的英文。"],
  livePins: ["Live applications", "现行申请"],
} as const;

export type Key = keyof typeof dict;

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({ lang: "en", setLang: () => {}, t: (k) => dict[k][0] });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("btv-lang") as Lang) || (navigator.language.startsWith("zh") ? "zh" : "en"));
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  }, [lang]);
  const setLang = (l: Lang) => {
    localStorage.setItem("btv-lang", l);
    setLangState(l);
  };
  const t = (k: Key) => dict[k][lang === "zh" ? 1 : 0];
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

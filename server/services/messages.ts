import { config } from "../config.ts";
import { formatDateOnly, formatNycDateTime } from "../lib/util.ts";
import type { EventRow, ProposalRow } from "./proposals.ts";

/** Languages residents can get texts in: the site's 8 languages. */
export const TEXT_LANGS = ["en", "zh", "es", "fr", "ja", "hi", "ar", "ru"] as const;
export type TextLang = (typeof TEXT_LANGS)[number];
export const LANG_NAMES: Record<TextLang, string> = { en: "English", zh: "中文", es: "Español", fr: "Français", ja: "日本語", hi: "हिन्दी", ar: "العربية", ru: "Русский" };
export const textLang = (x: unknown): TextLang => (TEXT_LANGS.includes(x as TextLang) ? (x as TextLang) : "en");

export const proposalUrl = (id: string, tab?: string) => `${config.publicBaseUrl}/p/${id}${tab ? `/${tab}` : ""}`;
export const applicationUrl = (id: string) => `${config.publicBaseUrl}/a/${encodeURIComponent(id)}`;

/** The first sentence of a description (two if short), for a text message. */
export function shortAbout(text: string | null | undefined, max = 200): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const sentences = t.match(/[^.!?。！？]+[.!?。！？]+/g) ?? [t];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > max && out) break;
    out += s;
  }
  return out.length > max ? `${out.slice(0, max - 1).trim()}…` : out.trim();
}

/**
 * Every fixed text, in plain words. Names, places and city wording stay as the source has them
 * (Chinese titles and descriptions are used when the page has them).
 */
interface Pack {
  following: string;
  whatItIs: string;
  askWhat: string;
  status: string;
  next: string;
  noMeeting: string;
  remindBefore: (hours: number) => string;
  soon: string;
  textIfChanges: string;
  textWhenCity: string;
  more: string;
  official: string;
  tips: string;
  reminder: (event: string, title: string, when: string, where: string | null) => string;
  howTo: string;
  update: (title: string) => string;
  statusChange: (from: string, to: string) => string;
  newStep: (step: string) => string;
  stopHint: string;
  stop: string;
  help: string;
  expired: string;
  listHead: string;
  listEmpty: string;
  listTail: string;
  unsure: string;
  limit: string;
  langMenu: string;
  langSet: string;
  demo: string;
  /** A sample next step shown only in DEMO updates. */
  demoStep: string;
  demoUpdate: string;
  dateTbd: string;
  statuses: Record<string, string>;
}

const PACKS: Record<TextLang, Pack> = {
  en: {
    following: "🎉 You're in! You're now following:",
    whatItIs: "💡 The short version:",
    askWhat: "👀 Curious what it is? Text me “What is it?”",
    status: "📍 Where it stands:",
    next: "📅 Next meeting:",
    noMeeting: "📅 No meeting date yet. I'll keep an eye out.",
    remindBefore: (h) => `⏰ I'll nudge you ${h} hours before.`,
    soon: "⏰ It's coming up soon, so here are the details now!",
    textIfChanges: "🔔 I'll text you if anything changes.",
    textWhenCity: "🔔 I'll text you as soon as the city updates it.",
    more: "🔗 More info + audio:",
    official: "📄 Official record:",
    tips: "💬 Got questions? Just text me!\nLIST = what you follow\nLANGUAGE = switch language\nSTOP = no more texts",
    reminder: (ev, t, w, where) => `⏰ Heads up! ${ev} for “${t}” is ${w}${where ? ` at ${where}` : ""}.`,
    howTo: "🙋 How to jump in:",
    update: (t) => `📢 News on “${t}”!`,
    statusChange: (a, b) => `Status: ${a} → ${b}`,
    newStep: (m) => `New step: ${m}`,
    stopHint: "(Text STOP anytime to stop.)",
    stop: "👋 You're unsubscribed. No more texts from me. Want back in? Tap Follow on any page.",
    help: "👋 I'm News Next Door! I text you news about proposals in your neighborhood. To follow one, tap Follow on its page and text me the code. Then ask me anything!\nLIST = what you follow\nLANGUAGE = switch language\nSTOP = no more texts",
    expired: "🤔 Hmm, that code didn't work or has expired. Tap Follow on the page for a fresh one.",
    listHead: "📋 Here's what you're following:",
    listEmpty: "📋 You're not following anything yet. Tap Follow on any page to start!",
    listTail: "💬 Ask me anything about them!",
    unsure: "🤔 I can't tell that for sure from the official record. Here's where to check:",
    limit: "😅 Whoa, that's a lot of questions this hour! Try again in a bit.",
    langMenu: "🌍 Pick your language. Reply with a number:",
    langSet: "👍 Got it! I'll text you in English from now on.",
    demo: "🧪 [DEMO – sample, not real] ",
    demoStep: "City Planning Commission public hearing",
    demoUpdate: "🧪 Just a demo: nothing has really changed yet.",
    dateTbd: "date not announced",
    statuses: { Filed: "Filed", "In Public Review": "In public review", Noticed: "Noticed", gone: "No longer listed as active" },
  },
  zh: {
    following: "🎉 关注成功！您正在关注：",
    whatItIs: "💡 一句话简介：",
    askWhat: "👀 想知道这是什么？发短信问我“这是什么？”",
    status: "📍 目前进展：",
    next: "📅 下次会议：",
    noMeeting: "📅 还没有会议日期，我会帮您盯着。",
    remindBefore: (h) => `⏰ 会议前 ${h} 小时我会提醒您。`,
    soon: "⏰ 会议马上就要开始了，先把信息发给您！",
    textIfChanges: "🔔 有任何变化我都会通知您。",
    textWhenCity: "🔔 市政府一更新，我就发短信告诉您。",
    more: "🔗 详情和语音：",
    official: "📄 官方记录：",
    tips: "💬 有问题直接发短信问我！\nLIST = 查看关注\nLANGUAGE = 更换语言\nSTOP = 停止短信",
    reminder: (ev, t, w, where) => `⏰ 提醒一下！「${t}」的${ev}在 ${w}${where ? `，地点：${where}` : ""}。`,
    howTo: "🙋 怎么参与：",
    update: (t) => `📢 「${t}」有新消息！`,
    statusChange: (a, b) => `状态：${a} → ${b}`,
    newStep: (m) => `新进展：${m}`,
    stopHint: "（随时回复 STOP 停止短信。）",
    stop: "👋 已取消订阅，我不会再给您发短信了。想回来？在任何页面点“关注”就行。",
    help: "👋 我是 News Next Door！我会把您社区里提案的最新消息发给您。要关注一项提案，在页面上点“关注”，然后把代码发给我。之后随便问我问题！\nLIST = 查看关注\nLANGUAGE = 更换语言\nSTOP = 停止短信",
    expired: "🤔 这个代码好像无效或过期了。在页面上点“关注”再拿一个新的吧。",
    listHead: "📋 您正在关注：",
    listEmpty: "📋 您还没有关注任何内容。在任何页面点“关注”就能开始！",
    listTail: "💬 关于它们的问题都可以问我！",
    unsure: "🤔 根据官方记录，我无法确定答案。可以在这里查看：",
    limit: "😅 这一小时问的问题有点多啦！稍后再来吧。",
    langMenu: "🌍 请选择语言，回复数字：",
    langSet: "👍 好的！以后我会用中文给您发短信。",
    demo: "🧪【演示：示例，并非真实消息】",
    demoStep: "城市规划委员会公开听证会",
    demoUpdate: "🧪 这只是演示，实际还没有任何变化。",
    dateTbd: "日期待定",
    statuses: { Filed: "已提交", "In Public Review": "公众审议中", Noticed: "已通知", gone: "已不再列为进行中" },
  },
  es: {
    following: "🎉 ¡Listo! Ahora sigues:",
    whatItIs: "💡 En pocas palabras:",
    askWhat: "👀 ¿Qué es? Escríbeme “¿Qué es?” y te cuento.",
    status: "📍 Cómo va:",
    next: "📅 Próxima reunión:",
    noMeeting: "📅 Todavía no hay fecha de reunión. Yo estaré pendiente.",
    remindBefore: (h) => `⏰ Te aviso ${h} horas antes.`,
    soon: "⏰ ¡Es muy pronto, así que aquí tienes los detalles!",
    textIfChanges: "🔔 Te escribo si algo cambia.",
    textWhenCity: "🔔 Te escribo en cuanto la ciudad lo actualice.",
    more: "🔗 Más info y audio:",
    official: "📄 Registro oficial:",
    tips: "💬 ¿Preguntas? ¡Escríbeme!\nLIST = lo que sigues\nLANGUAGE = cambiar idioma\nSTOP = no más mensajes",
    reminder: (ev, t, w, where) => `⏰ ¡Atención! ${ev} de “${t}” es ${w}${where ? ` en ${where}` : ""}.`,
    howTo: "🙋 Cómo participar:",
    update: (t) => `📢 ¡Novedades sobre “${t}”!`,
    statusChange: (a, b) => `Estado: ${a} → ${b}`,
    newStep: (m) => `Nuevo paso: ${m}`,
    stopHint: "(Envía STOP cuando quieras para dejar de recibir mensajes.)",
    stop: "👋 Te diste de baja. No te escribiré más. ¿Quieres volver? Toca Seguir en cualquier página.",
    help: "👋 ¡Soy News Next Door! Te escribo con novedades de las propuestas de tu barrio. Para seguir una, toca Seguir en su página y envíame el código. ¡Luego pregúntame lo que quieras!\nLIST = lo que sigues\nLANGUAGE = cambiar idioma\nSTOP = no más mensajes",
    expired: "🤔 Mmm, ese código no funciona o ya venció. Toca Seguir en la página para obtener uno nuevo.",
    listHead: "📋 Esto es lo que sigues:",
    listEmpty: "📋 Todavía no sigues nada. ¡Toca Seguir en cualquier página para empezar!",
    listTail: "💬 ¡Pregúntame lo que quieras sobre esto!",
    unsure: "🤔 No puedo confirmarlo con el registro oficial. Puedes verlo aquí:",
    limit: "😅 ¡Uf, muchas preguntas en esta hora! Inténtalo un poco más tarde.",
    langMenu: "🌍 Elige tu idioma. Responde con un número:",
    langSet: "👍 ¡Listo! Desde ahora te escribiré en español.",
    demo: "🧪 [DEMO – ejemplo, no es real] ",
    demoStep: "audiencia pública de la Comisión de Planificación Urbana",
    demoUpdate: "🧪 Es solo una demo: en realidad no ha cambiado nada.",
    dateTbd: "fecha por anunciar",
    statuses: { Filed: "Presentada", "In Public Review": "En revisión pública", Noticed: "Notificada", gone: "Ya no figura como activa" },
  },
  fr: {
    following: "🎉 C'est parti ! Vous suivez maintenant :",
    whatItIs: "💡 En bref :",
    askWhat: "👀 Curieux ? Écrivez-moi « C'est quoi ? »",
    status: "📍 Où ça en est :",
    next: "📅 Prochaine réunion :",
    noMeeting: "📅 Pas encore de date de réunion. Je surveille pour vous.",
    remindBefore: (h) => `⏰ Je vous préviens ${h} heures avant.`,
    soon: "⏰ C'est très bientôt, voici déjà les détails !",
    textIfChanges: "🔔 Je vous écris si quelque chose change.",
    textWhenCity: "🔔 Je vous écris dès que la ville le met à jour.",
    more: "🔗 Plus d'infos et audio :",
    official: "📄 Dossier officiel :",
    tips: "💬 Une question ? Écrivez-moi !\nLIST = vos suivis\nLANGUAGE = changer de langue\nSTOP = plus de messages",
    reminder: (ev, t, w, where) => `⏰ Petit rappel ! ${ev} pour « ${t} » a lieu ${w}${where ? ` à ${where}` : ""}.`,
    howTo: "🙋 Comment participer :",
    update: (t) => `📢 Du nouveau pour « ${t} » !`,
    statusChange: (a, b) => `Statut : ${a} → ${b}`,
    newStep: (m) => `Nouvelle étape : ${m}`,
    stopHint: "(Envoyez STOP à tout moment pour arrêter.)",
    stop: "👋 Vous êtes désabonné, plus de messages de ma part. Envie de revenir ? Touchez Suivre sur n'importe quelle page.",
    help: "👋 Je suis News Next Door ! Je vous envoie des nouvelles des projets de votre quartier. Pour en suivre un, touchez Suivre sur sa page et envoyez-moi le code. Ensuite, posez-moi toutes vos questions !\nLIST = vos suivis\nLANGUAGE = changer de langue\nSTOP = plus de messages",
    expired: "🤔 Oups, ce code ne marche pas ou a expiré. Touchez Suivre sur la page pour en avoir un nouveau.",
    listHead: "📋 Voici ce que vous suivez :",
    listEmpty: "📋 Vous ne suivez encore rien. Touchez Suivre sur n'importe quelle page pour commencer !",
    listTail: "💬 Posez-moi toutes vos questions à ce sujet !",
    unsure: "🤔 Je ne peux pas l'affirmer d'après le dossier officiel. Vous pouvez vérifier ici :",
    limit: "😅 Ça fait beaucoup de questions cette heure-ci ! Réessayez un peu plus tard.",
    langMenu: "🌍 Choisissez votre langue. Répondez avec un numéro :",
    langSet: "👍 C'est noté ! Je vous écrirai désormais en français.",
    demo: "🧪 [DÉMO – exemple, pas réel] ",
    demoStep: "audience publique de la Commission d'urbanisme",
    demoUpdate: "🧪 Ce n'est qu'une démo : rien n'a vraiment changé.",
    dateTbd: "date non annoncée",
    statuses: { Filed: "Déposée", "In Public Review": "En consultation publique", Noticed: "Notifiée", gone: "N'est plus listée comme active" },
  },
  ja: {
    following: "🎉 フォロー完了！フォロー中：",
    whatItIs: "💡 ひとことで言うと：",
    askWhat: "👀 どんな計画か気になる？「これは何？」と送ってください。",
    status: "📍 いまの状況：",
    next: "📅 次の会議：",
    noMeeting: "📅 会議の日程はまだです。こちらで見張っておきます。",
    remindBefore: (h) => `⏰ 会議の${h}時間前にお知らせします。`,
    soon: "⏰ もうすぐなので、先に詳細をお送りします！",
    textIfChanges: "🔔 何か変わったらお知らせします。",
    textWhenCity: "🔔 市が更新したらすぐにお知らせします。",
    more: "🔗 詳細と音声：",
    official: "📄 公式記録：",
    tips: "💬 質問があれば気軽に送ってください！\nLIST = フォロー一覧\nLANGUAGE = 言語の変更\nSTOP = 配信停止",
    reminder: (ev, t, w, where) => `⏰ お知らせ！「${t}」の${ev}は ${w}${where ? `、場所：${where}` : ""}です。`,
    howTo: "🙋 参加するには：",
    update: (t) => `📢 「${t}」に新しい動きがありました！`,
    statusChange: (a, b) => `状況：${a} → ${b}`,
    newStep: (m) => `新しい段階：${m}`,
    stopHint: "（いつでも STOP で配信停止できます。）",
    stop: "👋 配信を停止しました。もう送りません。また受け取りたいときは、ページで「フォロー」を押してください。",
    help: "👋 News Next Door です！近所の計画についての最新情報をお届けします。フォローするには、ページで「フォロー」を押してコードを送ってください。そのあとは何でも聞いてください！\nLIST = フォロー一覧\nLANGUAGE = 言語の変更\nSTOP = 配信停止",
    expired: "🤔 このコードは使えないか、期限切れのようです。ページで「フォロー」を押して新しいコードを取ってください。",
    listHead: "📋 フォロー中の一覧：",
    listEmpty: "📋 まだ何もフォローしていません。ページで「フォロー」を押して始めましょう！",
    listTail: "💬 これらについて何でも聞いてください！",
    unsure: "🤔 公式記録からは確かなことが言えません。こちらで確認できます：",
    limit: "😅 この1時間は質問が多すぎるようです！少し時間をおいてどうぞ。",
    langMenu: "🌍 言語を選んで、番号で返信してください：",
    langSet: "👍 了解です！これからは日本語でお送りします。",
    demo: "🧪【デモ：サンプルで実際のものではありません】",
    demoStep: "都市計画委員会の公聴会",
    demoUpdate: "🧪 これはデモです。実際にはまだ何も変わっていません。",
    dateTbd: "日程未定",
    statuses: { Filed: "申請済み", "In Public Review": "公開審査中", Noticed: "告知済み", gone: "進行中としての掲載が終了" },
  },
  hi: {
    following: "🎉 हो गया! अब आप इसे फ़ॉलो कर रहे हैं:",
    whatItIs: "💡 छोटे में:",
    askWhat: "👀 जानना चाहते हैं यह क्या है? मुझे लिखें “यह क्या है?”",
    status: "📍 अभी क्या स्थिति है:",
    next: "📅 अगली बैठक:",
    noMeeting: "📅 अभी बैठक की तारीख तय नहीं है। मैं नज़र रखूँगा।",
    remindBefore: (h) => `⏰ मैं ${h} घंटे पहले याद दिला दूँगा।`,
    soon: "⏰ यह जल्द ही है, इसलिए पूरी जानकारी अभी भेज रहा हूँ!",
    textIfChanges: "🔔 कुछ भी बदला तो मैं आपको बताऊँगा।",
    textWhenCity: "🔔 शहर के अपडेट करते ही मैं आपको बताऊँगा।",
    more: "🔗 ज़्यादा जानकारी और ऑडियो:",
    official: "📄 आधिकारिक रिकॉर्ड:",
    tips: "💬 कोई सवाल? बस मुझे लिखें!\nLIST = आप क्या फ़ॉलो कर रहे हैं\nLANGUAGE = भाषा बदलें\nSTOP = संदेश बंद करें",
    reminder: (ev, t, w, where) => `⏰ ध्यान दें! “${t}” की ${ev} ${w} को है${where ? `, जगह: ${where}` : ""}।`,
    howTo: "🙋 भाग कैसे लें:",
    update: (t) => `📢 “${t}” पर नई खबर!`,
    statusChange: (a, b) => `स्थिति: ${a} → ${b}`,
    newStep: (m) => `नया चरण: ${m}`,
    stopHint: "(संदेश बंद करने के लिए कभी भी STOP भेजें।)",
    stop: "👋 आपकी सदस्यता खत्म हो गई है, अब मैं संदेश नहीं भेजूँगा। वापस आना है? किसी भी पेज पर “फ़ॉलो करें” दबाएँ।",
    help: "👋 मैं News Next Door हूँ! मैं आपको आपके इलाके के प्रस्तावों की खबरें भेजता हूँ। किसी को फ़ॉलो करने के लिए उसके पेज पर “फ़ॉलो करें” दबाएँ और मुझे कोड भेजें। फिर मुझसे कुछ भी पूछें!\nLIST = आप क्या फ़ॉलो कर रहे हैं\nLANGUAGE = भाषा बदलें\nSTOP = संदेश बंद करें",
    expired: "🤔 यह कोड काम नहीं कर रहा या इसकी समय-सीमा खत्म हो गई है। नया कोड पाने के लिए पेज पर “फ़ॉलो करें” दबाएँ।",
    listHead: "📋 आप ये फ़ॉलो कर रहे हैं:",
    listEmpty: "📋 आप अभी कुछ भी फ़ॉलो नहीं कर रहे हैं। शुरू करने के लिए किसी भी पेज पर “फ़ॉलो करें” दबाएँ!",
    listTail: "💬 इनके बारे में मुझसे कुछ भी पूछें!",
    unsure: "🤔 आधिकारिक रिकॉर्ड से मैं यह पक्के तौर पर नहीं बता सकता। यहाँ देखें:",
    limit: "😅 इस घंटे बहुत सारे सवाल हो गए! थोड़ी देर बाद फिर कोशिश करें।",
    langMenu: "🌍 अपनी भाषा चुनें। कोई संख्या भेजें:",
    langSet: "👍 ठीक है! अब से मैं आपको हिन्दी में संदेश भेजूँगा।",
    demo: "🧪 [डेमो – नमूना, असली नहीं] ",
    demoStep: "सिटी प्लानिंग कमीशन की सार्वजनिक सुनवाई",
    demoUpdate: "🧪 यह सिर्फ़ डेमो है: असल में अभी कुछ नहीं बदला है।",
    dateTbd: "तारीख तय नहीं",
    statuses: { Filed: "दाखिल", "In Public Review": "सार्वजनिक समीक्षा में", Noticed: "सूचित", gone: "अब सक्रिय के रूप में सूचीबद्ध नहीं" },
  },
  ar: {
    following: "🎉 تمّ! أنت تتابع الآن:",
    whatItIs: "💡 باختصار:",
    askWhat: "👀 تريد أن تعرف ما هو؟ أرسل لي «ما هذا؟»",
    status: "📍 أين وصل:",
    next: "📅 الاجتماع القادم:",
    noMeeting: "📅 لم يُحدَّد موعد اجتماع بعد، وسأتابع لك.",
    remindBefore: (h) => `⏰ سأذكّرك قبل ${h} ساعة.`,
    soon: "⏰ الموعد قريب جدًا، إليك التفاصيل الآن!",
    textIfChanges: "🔔 سأراسلك إذا تغيّر أي شيء.",
    textWhenCity: "🔔 سأراسلك فور تحديث المدينة للسجل.",
    more: "🔗 مزيد من المعلومات والصوت:",
    official: "📄 السجل الرسمي:",
    tips: "💬 لديك سؤال؟ راسلني!\nLIST = ما تتابعه\nLANGUAGE = تغيير اللغة\nSTOP = إيقاف الرسائل",
    reminder: (ev, t, w, where) => `⏰ تنبيه! ${ev} الخاص بـ «${t}» في ${w}${where ? `، المكان: ${where}` : ""}.`,
    howTo: "🙋 كيف تشارك:",
    update: (t) => `📢 جديد بشأن «${t}»!`,
    statusChange: (a, b) => `الحالة: ${a} → ${b}`,
    newStep: (m) => `خطوة جديدة: ${m}`,
    stopHint: "(أرسل STOP في أي وقت لإيقاف الرسائل.)",
    stop: "👋 تم إلغاء اشتراكك، ولن أراسلك بعد الآن. تريد العودة؟ اضغط «متابعة» في أي صفحة.",
    help: "👋 أنا News Next Door! أرسل لك أخبار المقترحات في حيّك. للمتابعة، اضغط «متابعة» في صفحة المقترح وأرسل لي الرمز. ثم اسألني ما تشاء!\nLIST = ما تتابعه\nLANGUAGE = تغيير اللغة\nSTOP = إيقاف الرسائل",
    expired: "🤔 يبدو أن هذا الرمز غير صالح أو انتهت صلاحيته. اضغط «متابعة» في الصفحة للحصول على رمز جديد.",
    listHead: "📋 هذا ما تتابعه:",
    listEmpty: "📋 لا تتابع أي شيء بعد. اضغط «متابعة» في أي صفحة للبدء!",
    listTail: "💬 اسألني ما تشاء عنها!",
    unsure: "🤔 لا أستطيع التأكد من ذلك من السجل الرسمي. يمكنك التحقق هنا:",
    limit: "😅 أسئلة كثيرة خلال هذه الساعة! حاول مرة أخرى بعد قليل.",
    langMenu: "🌍 اختر لغتك. أرسل رقمًا:",
    langSet: "👍 تمّ! سأراسلك بالعربية من الآن فصاعدًا.",
    demo: "🧪 [تجربة – مثال وليس حقيقيًا] ",
    demoStep: "جلسة استماع عامة للجنة تخطيط المدينة",
    demoUpdate: "🧪 هذه مجرد تجربة: لم يتغيّر شيء فعلًا بعد.",
    dateTbd: "لم يُحدَّد الموعد",
    statuses: { Filed: "مقدَّم", "In Public Review": "قيد المراجعة العامة", Noticed: "تم الإخطار", gone: "لم يعد مُدرجًا كنشط" },
  },
  ru: {
    following: "🎉 Готово! Вы теперь следите за:",
    whatItIs: "💡 Если коротко:",
    askWhat: "👀 Интересно, что это? Напишите мне «Что это?»",
    status: "📍 На каком этапе:",
    next: "📅 Следующее собрание:",
    noMeeting: "📅 Дата собрания пока не назначена. Я буду следить.",
    remindBefore: (h) => `⏰ Напомню за ${h} часа.`,
    soon: "⏰ Это уже совсем скоро, вот подробности!",
    textIfChanges: "🔔 Напишу, если что-то изменится.",
    textWhenCity: "🔔 Напишу, как только город обновит данные.",
    more: "🔗 Подробнее и аудио:",
    official: "📄 Официальный документ:",
    tips: "💬 Есть вопросы? Просто напишите!\nLIST = за чем вы следите\nLANGUAGE = сменить язык\nSTOP = больше не писать",
    reminder: (ev, t, w, where) => `⏰ Напоминаю! ${ev} по «${t}» — ${w}${where ? `, место: ${where}` : ""}.`,
    howTo: "🙋 Как поучаствовать:",
    update: (t) => `📢 Новости по «${t}»!`,
    statusChange: (a, b) => `Статус: ${a} → ${b}`,
    newStep: (m) => `Новый этап: ${m}`,
    stopHint: "(Отправьте STOP в любой момент, чтобы остановить.)",
    stop: "👋 Вы отписались, больше писать не буду. Захотите вернуться — нажмите «Следить» на любой странице.",
    help: "👋 Я News Next Door! Присылаю новости о проектах в вашем районе. Чтобы следить за проектом, нажмите «Следить» на его странице и отправьте мне код. А потом спрашивайте что угодно!\nLIST = за чем вы следите\nLANGUAGE = сменить язык\nSTOP = больше не писать",
    expired: "🤔 Хм, этот код не работает или устарел. Нажмите «Следить» на странице, чтобы получить новый.",
    listHead: "📋 Вот за чем вы следите:",
    listEmpty: "📋 Вы пока ни за чем не следите. Нажмите «Следить» на любой странице!",
    listTail: "💬 Спрашивайте о них что угодно!",
    unsure: "🤔 По официальным данным я не могу сказать точно. Проверить можно здесь:",
    limit: "😅 Ого, за этот час много вопросов! Попробуйте чуть позже.",
    langMenu: "🌍 Выберите язык. Ответьте цифрой:",
    langSet: "👍 Готово! Теперь я буду писать вам по-русски.",
    demo: "🧪 [ДЕМО – пример, не по-настоящему] ",
    demoStep: "публичные слушания Комиссии по городскому планированию",
    demoUpdate: "🧪 Это только демо: на самом деле пока ничего не изменилось.",
    dateTbd: "дата не объявлена",
    statuses: { Filed: "Подана", "In Public Review": "На общественном рассмотрении", Noticed: "Объявлена", gone: "Больше не значится активной" },
  },
};

export const pack = (lang: TextLang): Pack => PACKS[lang] ?? PACKS.en;
const BRAND = "News Next Door";

/** Our page (details + audio), then the official source it's based on. */
const links = (t: Pack, page: string, official: string | null) => `${t.more} ${page}${official ? `\n${t.official} ${official}` : ""}`;

function when(e: EventRow, lang: TextLang): string {
  if (e.starts_at) return formatNycDateTime(e.starts_at, lang);
  if (e.date) return formatDateOnly(e.date, lang);
  return pack(lang).dateTbd;
}

const isDemo = (p: ProposalRow, e?: EventRow | null) => !!(p.is_sample || e?.is_demo);
const title = (p: ProposalRow, lang: TextLang) => (lang === "zh" && p.title_zh ? p.title_zh : p.title);
const summary = (p: ProposalRow, lang: TextLang) => (lang === "zh" ? p.summary_zh : lang === "en" ? p.summary : null);

/** Sent when someone follows a proposal. Short: what it is, what's next, one link, how to talk to us. */
export function confirmationText(p: ProposalRow, next: EventRow | undefined, reminderFor: EventRow | undefined, sourceUrl: string | null, lang: TextLang): string {
  const t = pack(lang);
  const soon = next?.starts_at && !reminderFor && Date.parse(next.starts_at) - Date.now() < config.reminderLeadHours * 3600_000;
  const about = shortAbout(summary(p, lang));
  return [
    `${isDemo(p, next) ? t.demo : ""}${BRAND}`,
    `${t.following}\n${title(p, lang)}`,
    about ? `${t.whatItIs} ${about}` : t.askWhat,
    next ? `${t.next} ${next.title}, ${when(next, lang)}${next.location ? `, ${next.location}` : ""}` : t.noMeeting,
    reminderFor ? t.remindBefore(config.reminderLeadHours) : soon ? t.soon : t.textIfChanges,
    links(t, proposalUrl(p.id), sourceUrl),
    t.tips,
  ].join("\n\n");
}

export function reminderText(p: ProposalRow, e: EventRow, sourceUrl: string | null, lang: TextLang): string {
  const t = pack(lang);
  return [
    `${isDemo(p, e) ? t.demo : ""}${t.reminder(e.title, title(p, lang), when(e, lang), e.location)}`,
    e.instructions ? `${t.howTo} ${e.instructions}` : null,
    links(t, proposalUrl(p.id, "participate"), sourceUrl),
    t.stopHint,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function updateText(p: ProposalRow, changes: string[], sourceUrl: string | null, lang: TextLang): string {
  const t = pack(lang);
  return [`${isDemo(p) ? t.demo : ""}${t.update(title(p, lang))}\n${changes.map((c) => `• ${c}`).join("\n")}`, links(t, proposalUrl(p.id, "timeline"), sourceUrl), t.stopHint].join("\n\n");
}

// ---------------------------------------------------------------- live city applications (ZAP)

/** What a follower of a live application was last told: the city's own status fields. */
export interface AppSnapshot {
  name: string;
  public_status: string;
  milestone: string | null;
  milestone_date: string | null;
  /** Short description for the welcome text: only a checked Grok plain-language version. */
  about_en?: string | null;
  about_zh?: string | null;
  /** Plain headline per language (the site's own, e.g. "A building plan at 50-08 Queens Blvd"). */
  headlines?: Partial<Record<TextLang, string>>;
}

const appStatus = (s: string, lang: TextLang) => pack(lang).statuses[s] ?? s;
const milestoneLine = (a: AppSnapshot, lang: TextLang) => (a.milestone ? `${a.milestone}${a.milestone_date ? ` (${formatDateOnly(a.milestone_date, lang)})` : ""}` : "");

/** Sent when someone follows a live city application. */
export function appConfirmationText(id: string, a: AppSnapshot, zapUrl: string, lang: TextLang): string {
  const t = pack(lang);
  const about = lang === "zh" ? a.about_zh : lang === "en" ? a.about_en : null;
  return [
    BRAND,
    `${t.following}\n${a.headlines?.[lang] ?? a.name}`,
    about ? `${t.whatItIs} ${about}` : t.askWhat,
    `${t.status} ${appStatus(a.public_status, lang)}`,
    t.textWhenCity,
    links(t, applicationUrl(id), zapUrl),
    t.tips,
  ].join("\n\n");
}

/** Lines describing what changed between two snapshots; empty when nothing a follower cares about changed. */
export function appChanges(before: AppSnapshot, after: AppSnapshot, lang: TextLang): string[] {
  const t = pack(lang);
  const out: string[] = [];
  if (before.public_status !== after.public_status) out.push(t.statusChange(appStatus(before.public_status, lang), appStatus(after.public_status, lang)));
  if (after.milestone && (before.milestone !== after.milestone || before.milestone_date !== after.milestone_date)) out.push(t.newStep(milestoneLine(after, lang)));
  return out;
}

export function appUpdateText(id: string, a: AppSnapshot, changes: string[], zapUrl: string, lang: TextLang, demo = false): string {
  const t = pack(lang);
  return [
    `${demo ? t.demo : ""}${t.update(a.headlines?.[lang] ?? a.name)}\n${changes.map((c) => `• ${c}`).join("\n")}`,
    demo ? t.demoUpdate : null,
    links(t, applicationUrl(id), zapUrl),
    t.stopHint,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Status name used when a followed application drops out of the city's active list. */
export const GONE_STATUS = "gone";

// ---------------------------------------------------------------- replies

export const stopText = (lang: TextLang) => `${BRAND}: ${pack(lang).stop}`;
export const helpText = (lang: TextLang) => `${BRAND}: ${pack(lang).help}`;
export const expiredText = (lang: TextLang) => `${BRAND}: ${pack(lang).expired}`;
export const limitText = (lang: TextLang) => `${BRAND}: ${pack(lang).limit}`;
export const unsureText = (lang: TextLang, links: string[]) => `${pack(lang).unsure}\n${links.join("\n")}`;
export const langSetText = (lang: TextLang) => `${BRAND}: ${pack(lang).langSet}`;
export const langMenuText = (lang: TextLang) =>
  [`${BRAND}: ${pack(lang).langMenu}`, ...TEXT_LANGS.map((l, i) => `${i + 1}. ${LANG_NAMES[l]}`)].join("\n");

export function listText(items: { title: string; page: string }[], lang: TextLang): string {
  const t = pack(lang);
  if (!items.length) return `${BRAND}: ${t.listEmpty}`;
  return [`${BRAND}: ${t.listHead}`, ...items.map((it, i) => `${i + 1}. ${it.title}\n${it.page}`), t.listTail].join("\n\n");
}

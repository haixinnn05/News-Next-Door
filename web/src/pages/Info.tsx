import { useAccount } from "../lib/account";
import { useLang } from "../lib/i18n";
import { Link } from "../lib/router";

const STEPS = [
  ["howStep1Title", "howStep1Body"],
  ["howStep2Title", "howStep2Body"],
  ["howStep3Title", "howStep3Body"],
  ["howStep4Title", "howStep4Body"],
] as const;

export function HowItWorks() {
  const { t } = useLang();
  const { user, zoneId } = useAccount();
  const exploreTo = user && !zoneId ? "/?scope=city" : "/";
  return (
    <div className="container page prose">
      <h1>{t("howItWorks")}</h1>
      {STEPS.map(([h, p]) => (
        <div key={h}>
          <h2>{t(h)}</h2>
          <p>{t(p)}</p>
        </div>
      ))}
      <p className="how-cta">
        <Link to={exploreTo} className="news-cta">
          {t("howExplore")}
        </Link>
      </p>
    </div>
  );
}

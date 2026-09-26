import { cardStatus, titleOf } from "../lib/format";
import { useLang } from "../lib/i18n";
import { Link } from "../lib/router";
import type { ProposalCard as Card } from "../lib/types";
import { Icon } from "./Icon";
import { ProposalArt } from "./Illustration";

export function CategoryChip({ category }: { category: Card["category"] }) {
  const { t } = useLang();
  return <span className={`chip ${category}`}>{t(category)}</span>;
}

export function StatusLine({ p }: { p: Card }) {
  const { lang } = useLang();
  const s = cardStatus(p, lang);
  return (
    <div className="status-line">
      <span className="status">{s.label}</span>
      {s.date && <> · {s.date}</>}
    </div>
  );
}

export function addressLine(p: Card): string {
  return p.address?.full ?? p.location_text ?? "";
}

export function ProposalCardView({ p }: { p: Card }) {
  const { lang, t } = useLang();
  return (
    <Link to={`/p/${p.id}`} className="proposal-card">
      <div className="thumb">
        <ProposalArt category={p.category} seed={p.id} />
        {p.is_sample && <span className="chip sample">{t("sample")}</span>}
      </div>
      <div className="body">
        <div className="top">
          <span className={`chip ${p.category}`}>{t(p.category)}</span>
          <span className="icon-btn" aria-hidden="true">
            <Icon name="arrowRight" size={15} />
          </span>
        </div>
        <h3>{titleOf(p, lang)}</h3>
        <div className="addr">{addressLine(p)}</div>
        <StatusLine p={p} />
      </div>
    </Link>
  );
}

export function ProposalRow({ p, onHover, hovered }: { p: Card; onHover?: (id: string | null) => void; hovered?: boolean }) {
  const { lang, t } = useLang();
  return (
    <Link to={`/p/${p.id}`} className={`list-row${hovered ? " hover" : ""}`} onMouseEnter={() => onHover?.(p.id)} onMouseLeave={() => onHover?.(null)}>
      <div className="thumb">
        <ProposalArt category={p.category} seed={p.id} />
      </div>
      <div className="grow">
        <h4>
          {titleOf(p, lang)} {p.is_sample && <span className="chip sample" style={{ height: 18, fontSize: 10.5, marginLeft: 4, verticalAlign: 1 }}>{t("sample")}</span>}
        </h4>
        <div className="addr">{addressLine(p)}</div>
        <StatusLine p={p} />
      </div>
      <span className="icon-btn" aria-hidden="true">
        <Icon name="chevronRight" size={15} />
      </span>
    </Link>
  );
}

import { NewsStory } from "../components/NewsFeed";
import { ProposalCardView } from "../components/ProposalCard";
import { ApplicationCard } from "./Application";
import { useAccount } from "../lib/account";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { storyFromCity } from "../lib/story";

export function MyProposals() {
  const { t, lang } = useLang();
  const { user, loading, openSignIn, savedIds } = useAccount();
  const res = useLoad(() => (user ? api.myProposals(lang) : Promise.resolve(null)), [user?.id, savedIds.size, lang]);

  if (loading) return <div className="container page" />;
  if (!user)
    return (
      <div className="container page">
        <h1>{t("myProposals")}</h1>
        <div className="state-box">
          <p>{t("signInToSee")}</p>
          <button className="btn primary sm" onClick={() => openSignIn()}>
            {t("signIn")}
          </button>
        </div>
      </div>
    );

  const m = res.data;
  return (
    <div className="container page">
      <h1>{t("myProposals")}</h1>
      <p className="muted">{t("myProposalsSub")}</p>
      {res.error && <div className="banner red">{res.error}</div>}

      <div className="section-head">
        <h2>{t("savedSection")}</h2>
      </div>
      {!m ? (
        <div className="skeleton" style={{ height: 180 }} />
      ) : m.saved.length || m.applications.length || (m.city ?? []).length ? (
        <div className="grid-3">
          {(m.city ?? []).map((a) => (
            <NewsStory key={a.id} story={storyFromCity(a)} />
          ))}
          {m.applications.map((a) => (
            <ApplicationCard key={a.id} a={a} />
          ))}
          {m.saved.map((p) => (
            <ProposalCardView key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="state-box">{t("savedEmpty")}</div>
      )}

      <div className="section-head">
        <h2>{t("followingSection")}</h2>
        {m && m.phones.length > 0 && (
          <span className="small muted">
            {t("linkedPhones")}: {m.phones.join(", ")}
          </span>
        )}
      </div>
      {!m ? (
        <div className="skeleton" style={{ height: 180 }} />
      ) : m.following.length ? (
        <>
          <div className="grid-3">
            {m.following.map((p) => (
              <ProposalCardView key={p.id} p={p} />
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            {t("stopHint")}
          </p>
        </>
      ) : (
        <div className="state-box">{t("followingEmpty")}</div>
      )}
    </div>
  );
}

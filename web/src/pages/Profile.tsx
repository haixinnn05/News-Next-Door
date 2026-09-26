import { useEffect, useState, type FormEvent } from "react";
import { LangChecks } from "../components/LangChecks";
import { useAccount } from "../lib/account";
import { useBoard } from "../lib/board";
import { useLang, type Lang } from "../lib/i18n";
import { useRouter } from "../lib/router";
import { zhBoardShort, zhBorough } from "../lib/zhCivic";

export function Profile() {
  const { t, lang, langs } = useLang();
  const { navigate } = useRouter();
  const { user, loading, zoneId, saveZone, saveLangs, updateName, openSignIn } = useAccount();
  const { boards } = useBoard();
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [picked, setPicked] = useState<Lang[]>(langs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);
  useEffect(() => {
    if (zoneId) setZone(zoneId);
  }, [zoneId]);
  useEffect(() => {
    if (langs.length) setPicked(langs);
  }, [langs]);

  if (loading) {
    return (
      <div className="profile">
        <div className="skeleton" style={{ height: 36, width: 160, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="welcome">
        <h1>{t("profile")}</h1>
        <p>{t("signInForNews")}</p>
        <div className="welcome-actions">
          <button className="news-cta" onClick={() => openSignIn()}>
            {t("signIn")}
          </button>
          <button className="welcome-secondary" onClick={() => openSignIn(null, "create")}>
            {t("createAccount")}
          </button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (name.trim() && name.trim() !== user.name) await updateName(name);
      if (zone && zone !== zoneId) await saveZone(zone);
      await saveLangs(picked);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signInFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile">
      <h1>{t("profile")}</h1>
      {error && <div className="banner red">{error}</div>}
      <form className="profile-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="pf-name">{t("name")}</label>
          <input id="pf-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <span className="label">{t("yourLanguages")}</span>
          <p className="profile-hint">{t("languagesWhy")}</p>
          <LangChecks value={picked} onChange={setPicked} />
        </div>
        <div className="field">
          <label htmlFor="pf-zone">{t("chooseZone")}</label>
          <select id="pf-zone" className="input" required value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">{t("chooseZone")}</option>
            {["Queens", "Brooklyn", "Manhattan"].map((borough) => (
              <optgroup key={borough} label={zhBorough(borough, lang)}>
                {boards
                  .filter((b) => b.borough === borough)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {zhBoardShort(b, lang)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button className="news-cta" disabled={busy}>
          {t("save")}
        </button>
      </form>
    </div>
  );
}

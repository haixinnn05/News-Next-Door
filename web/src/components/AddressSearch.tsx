import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api, ApiError } from "../lib/api";
import { useBoard } from "../lib/board";
import { localeOf, useLang } from "../lib/i18n";
import type { AddressSuggestion, LocateResult } from "../lib/types";
import { zhBoardShort, zhCivic } from "../lib/zhCivic";
import { Icon } from "./Icon";

/** Bolds the start of each word that matches something the resident typed, like map apps do. */
function Matched({ text, query }: { text: string; query: string }) {
  const tokens = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  return (
    <>
      {text.split(/(\s+)/).map((word, i) => {
        const lower = word.toLowerCase();
        const hit = tokens.filter((tk) => lower.startsWith(tk)).sort((a, b) => b.length - a.length)[0];
        if (!hit) return <Fragment key={i}>{word}</Fragment>;
        return (
          <Fragment key={i}>
            <b>{word.slice(0, hit.length)}</b>
            {word.slice(hit.length)}
          </Fragment>
        );
      })}
    </>
  );
}

export function AddressSearch({ located, onLocate }: { located: LocateResult | null; onLocate: (r: LocateResult | null) => void }) {
  const { t, lang } = useLang();
  const { boards } = useBoard();
  const listId = useId();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [located, error]);
  /** False when the text was filled in by picking a suggestion, so it doesn't trigger another lookup. */
  const typed = useRef(false);

  useEffect(() => {
    const q = text.trim();
    if (!typed.current || q.length < 3) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api
        .suggest(q, ctrl.signal)
        .then((list) => {
          setSuggestions(list);
          setActive(-1);
        })
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text]);

  const run = async (lookup: () => Promise<LocateResult>) => {
    setBusy(true);
    setError(null);
    setOpen(false);
    try {
      onLocate(await lookup());
    } catch (err) {
      setError(t(err instanceof ApiError && (err.status === 404 || err.status === 400) ? "addressNotFound" : "addressUnavailable"));
    } finally {
      setBusy(false);
    }
  };

  const pick = (s: AddressSuggestion) => {
    typed.current = false;
    setText(s.label);
    setSuggestions([]);
    setActive(-1);
    void run(() => api.locateAt(s));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (open && suggestions[active]) return pick(suggestions[active]);
    const q = text.trim();
    if (q.length >= 3) void run(() => api.locate(q));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = suggestions.length;
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && n) {
      e.preventDefault();
      const down = e.key === "ArrowDown";
      setOpen(true);
      setActive((i) => (down ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  const clear = () => {
    typed.current = false;
    setText("");
    setSuggestions([]);
    setError(null);
    onLocate(null);
  };

  const showList = open && suggestions.length > 0;
  let note: string | null = null;
  const board = located && boards.find((b) => b.id === located.board_id);
  if (located && board) {
    const distance = new Intl.NumberFormat(localeOf(lang), { style: "unit", unit: "mile", maximumFractionDigits: 1 }).format(located.distance_m / 1609.344);
    note = t(located.inside ? "addressInside" : located.district ? "addressNearest" : "addressNearestArea")
      .replace("{address}", located.label)
      .replace("{board}", zhBoardShort(board, lang))
      .replace("{district}", zhCivic(located.district ?? "", lang))
      .replace("{distance}", distance);
  }

  return (
    <div className="map-search">
      <form role="search" onSubmit={submit}>
        <Icon name="search" size={18} />
        <input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          value={text}
          onChange={(e) => {
            typed.current = true;
            setText(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={t("addressPlaceholder")}
          aria-label={t("addressPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {(text || located) && (
          <button type="button" className="clear" onClick={clear} aria-label={t("addressClear")}>
            <Icon name="x" size={16} />
          </button>
        )}
        <button type="submit" disabled={busy || text.trim().length < 3} aria-label={t("addressFind")} title={t("addressFind")} aria-busy={busy}>
          <Icon name="arrowRight" size={18} />
        </button>
      </form>
      <ul className="map-search-list" id={listId} role="listbox" aria-label={t("addressPlaceholder")} hidden={!showList} onMouseDown={(e) => e.preventDefault()}>
        {suggestions.map((s, i) => (
          <li
            key={`${s.lat},${s.lng}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(s)}
          >
            <Icon name="pin" size={16} />
            <span>
              <span className="name">
                <Matched text={s.name} query={text} />
              </span>
              {s.area && <span className="area">{s.area}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!showList && !dismissed && (error || note) && (
        <div className={`map-search-note${error ? " error" : ""}`} role={error ? "alert" : "status"}>
          <p>{error ?? note}</p>
          <button type="button" className="close" onClick={() => setDismissed(true)} aria-label={t("close")} title={t("close")}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

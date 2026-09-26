import { LANGS, type Lang } from "../lib/i18n";

export function LangChecks({ value, onChange }: { value: Lang[]; onChange: (langs: Lang[]) => void }) {
  const toggle = (id: Lang) => {
    if (value.includes(id)) {
      if (value.length === 1) return;
      onChange(value.filter((item) => item !== id));
      return;
    }
    onChange([...value, id]);
  };
  return (
    <div className="lang-checks" role="group">
      {LANGS.map((l) => (
        <label key={l.id} lang={l.html}>
          <input type="checkbox" checked={value.includes(l.id)} onChange={() => toggle(l.id)} />
          {l.label}
        </label>
      ))}
    </div>
  );
}

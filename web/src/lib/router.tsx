import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

const RouterCtx = createContext<{ path: string; search: string; navigate: (to: string, opts?: { replace?: boolean }) => void }>({ path: "/", search: "", navigate: () => {} });

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState({ path: location.pathname, search: location.search });
  useEffect(() => {
    const on = () => setLoc({ path: location.pathname, search: location.search });
    addEventListener("popstate", on);
    return () => removeEventListener("popstate", on);
  }, []);
  const navigate = (to: string, opts: { replace?: boolean } = {}) => {
    if (opts.replace) history.replaceState(null, "", to);
    else history.pushState(null, "", to);
    const u = new URL(to, location.origin);
    setLoc({ path: u.pathname, search: u.search });
    if (!opts.replace && !u.hash) scrollTo({ top: 0 });
  };
  return <RouterCtx.Provider value={{ ...loc, navigate }}>{children}</RouterCtx.Provider>;
}

export const useRouter = () => useContext(RouterCtx);

export function useQuery(): URLSearchParams {
  const { search } = useRouter();
  return new URLSearchParams(search);
}

export function Link({ to, children, onClick, ...rest }: { to: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || rest.target === "_blank") return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

/** Match "/p/:id/:tab?" style patterns. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  const out: Record<string, string> = {};
  for (let i = 0; i < Math.max(p.length, s.length); i++) {
    const seg = p[i];
    if (seg === undefined) return null;
    const optional = seg.endsWith("?");
    const name = seg.replace(/^:/, "").replace(/\?$/, "");
    if (s[i] === undefined) {
      if (optional) continue;
      return null;
    }
    if (seg.startsWith(":")) out[name] = decodeURIComponent(s[i]);
    else if (seg !== s[i]) return null;
  }
  return out;
}

import type { ReactNode } from "react";
import { BrandMark, Icon, type IconName } from "../components/Icon";
import { Link, useRouter } from "../lib/router";
import type { TeamMember } from "./types";

const NAV: { to: string; label: string; icon: IconName; also?: string[] }[] = [
  { to: "/admin/import", label: "Import Documents", icon: "upload", also: ["/admin"] },
  { to: "/admin/review", label: "Review Proposals", icon: "list" },
  { to: "/admin/audio", label: "Audio Generation", icon: "audio" },
  { to: "/admin/messages", label: "Message Delivery", icon: "send" },
  { to: "/admin/subscribers", label: "Subscribers", icon: "users" },
];

export function Layout({ children, member, onSignOut }: { children: ReactNode; member: TeamMember | null; onSignOut: () => void }) {
  const { path } = useRouter();
  const p = path.replace(/\/+$/, "") || "/admin";
  const isOn = (to: string, also: string[] = []) => p === to || p.startsWith(`${to}/`) || also.includes(p);

  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <Link to="/admin/import" className="adm-brand">
          <span className="adm-brand-mark">
            <BrandMark size={22} />
          </span>
          <span>News Next Door</span>
        </Link>
        <nav className="adm-nav" aria-label="Team console">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={isOn(n.to, n.also) ? "on" : undefined} aria-current={isOn(n.to, n.also) ? "page" : undefined}>
              <Icon name={n.icon} size={17} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="adm-side-foot">
          <nav className="adm-nav">
            <Link to="/admin/settings" className={isOn("/admin/settings") ? "on" : undefined}>
              <Icon name="settings" size={17} />
              <span>Settings</span>
            </Link>
          </nav>
          <div className="adm-side-links">
            {member && (
              <span className="adm-member" title={member.name}>
                {member.email}
              </span>
            )}
            <a href="/" target="_blank" rel="noreferrer">
              <Icon name="external" size={13} /> View public site
            </a>
            <button type="button" onClick={onSignOut}>
              <Icon name="logout" size={13} /> Sign out
            </button>
          </div>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}

"use client";

import { Activity, BookOpenCheck, FlaskConical, LayoutDashboard, RadioTower, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/lab", label: "Incident lab", icon: FlaskConical },
  { href: "/evidence", label: "Evidence", icon: RadioTower },
  { href: "/runbooks", label: "Runbooks", icon: BookOpenCheck },
];

export function ProductShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="product-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="global-header">
        <Link href="/" className="product-brand" aria-label="TraceForge overview">
          <span className="product-mark"><Activity size={19} strokeWidth={2.2} /></span>
          <span><strong>TraceForge</strong><small>Incident command lab</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}>{item.label}</Link>;
          })}
        </nav>
        <div className="header-status" aria-label="Environment status">
          <span className="environment-pill"><i /> Simulator online</span>
          <Link href="/lab" className="header-launch"><FlaskConical size={15} /> Open lab</Link>
        </div>
      </header>
      <div className="status-ribbon" aria-label="Simulation boundary">
        <ScrollText size={13} aria-hidden="true" />
        <div><span>Deterministic replay engine ready</span><span>3 services monitored</span><span>No live systems connected</span><span>Operator decisions recorded locally</span></div>
      </div>
      <div id="main-content">{children}</div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "active" : ""}><Icon size={18} /><span>{item.label}</span></Link>;
        })}
      </nav>
    </div>
  );
}

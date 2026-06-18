import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Sparkles,
  List,
  CircleCheckBig,
  LayoutDashboard,
  FileText,
  SlidersHorizontal,
  Users,
  ChevronLeft,
  PanelLeft,
  ChevronRight,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
  LayoutTemplate,
  Building2,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../useTheme';

type IconType = typeof LayoutGrid;

interface NavItem {
  to: string;
  label: string;
  icon: IconType;
  section: 'Workspace' | 'Administration';
  show: (isAdmin: boolean, isSuperAdmin: boolean) => boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Quotation Hub', icon: LayoutGrid, section: 'Workspace', show: () => true },
  { to: '/generate', label: 'Generate Quotation', icon: Sparkles, section: 'Workspace', show: () => true },
  { to: '/runs', label: 'My Runs', icon: List, section: 'Workspace', show: () => true },
  { to: '/approvals', label: 'Approvals', icon: CircleCheckBig, section: 'Workspace', show: () => true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Administration', show: (a) => a },
  { to: '/prompts', label: 'Prompt Editor', icon: FileText, section: 'Administration', show: (a) => a },
  { to: '/admin/products', label: 'Product Fields', icon: SlidersHorizontal, section: 'Administration', show: (a) => a },
  { to: '/admin/approval-templates', label: 'Approval Templates', icon: LayoutTemplate, section: 'Administration', show: (a) => a },
  { to: '/admin/docx-template', label: 'Document Template', icon: FileText, section: 'Administration', show: (a) => a },
  { to: '/admin/company-config', label: 'Company Config', icon: Building2, section: 'Administration', show: (a) => a },
  { to: '/users', label: 'Users', icon: Users, section: 'Administration', show: (_a, s) => s },
];

const CRUMBS: Record<string, [string, string]> = {
  '/': ['Workspace', 'Quotation Hub'],
  '/generate': ['Workspace', 'Generate Quotation'],
  '/runs': ['Workspace', 'My Runs'],
  '/approvals': ['Workspace', 'Approvals'],
  '/dashboard': ['Administration', 'Dashboard'],
  '/prompts': ['Administration', 'Prompt Editor'],
  '/admin/products': ['Administration', 'Product Fields'],
  '/admin/approval-templates': ['Administration', 'Approval Templates'],
  '/admin/docx-template': ['Administration', 'Document Template'],
  '/admin/company-config': ['Administration', 'Company Config'],
  '/users': ['Administration', 'Users'],
};

const SECTIONS: NavItem['section'][] = ['Workspace', 'Administration'];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const crumb = CRUMBS[loc.pathname] ?? ['Workspace', ''];

  function handleLogout() {
    logout();
    nav('/login');
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-base-200">
      {/* ── Sidebar ── */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-[248px]'} flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200`}
      >
        {/* Brand */}
        <div className="flex h-[60px] items-center gap-3 border-b border-border px-[18px]">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-gradient-brand shadow-[0_6px_14px_-5px_rgba(54,148,252,0.6)]">
            <Sparkles className="h-[18px] w-[18px] text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[14px] font-bold tracking-[-0.02em] text-foreground">iQuotation</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3.5">
          {SECTIONS.map((section) => {
            const items = NAV.filter((i) => i.section === section && i.show(isAdmin, isSuperAdmin));
            if (items.length === 0) return null;
            return (
              <div key={section}>
                {!collapsed && (
                  <div className="px-[11px] pb-2 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground first:pt-1.5">
                    {section}
                  </div>
                )}
                {items.map((item) => {
                  const active = loc.pathname === item.to;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13px] transition-colors ${
                        active
                          ? 'bg-brand-soft font-semibold text-brand'
                          : 'font-medium text-muted-foreground hover:bg-card hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Collapse */}
        <div className="border-t border-border p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-[11px] py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-card px-7">
          <div className="flex items-center gap-2.5 text-[13px]">
            <span className="font-medium text-muted-foreground">{crumb[0]}</span>
            <ChevronRight className="h-[15px] w-[15px] text-muted-foreground" />
            <span className="font-semibold text-foreground">{crumb[1]}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted-foreground transition-colors hover:bg-input-background hover:text-foreground"
            >
              {theme === 'dark' ? <Sun className="h-[17px] w-[17px]" strokeWidth={1.9} /> : <Moon className="h-[17px] w-[17px]" strokeWidth={1.9} />}
            </button>

            <div className="mx-1.5 h-[22px] w-px bg-border" />

            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="flex items-center gap-2.5 rounded-[11px] border border-border py-[5px] pl-1.5 pr-2.5 transition-colors hover:bg-input-background"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-[12px] font-bold text-brand">
                  {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <span className="hidden max-w-[140px] truncate text-[13px] font-semibold text-foreground sm:inline">
                  {user?.full_name || user?.email}
                </span>
                <ChevronDown className="h-[15px] w-[15px] text-muted-foreground" />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content z-50 mt-2 w-56 rounded-box border border-border bg-popover p-2 text-popover-foreground shadow-[var(--elevated-shadow)]"
              >
                <li className="mb-1 border-b border-border px-3 py-2">
                  <p className="truncate text-[12px] text-foreground">{user?.email}</p>
                  <p className="text-[10px] capitalize text-muted-foreground">{user?.role?.replace('_', ' ')}</p>
                </li>
                <li>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-error hover:bg-error/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-base-200">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

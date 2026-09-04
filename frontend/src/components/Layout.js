import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { initials } from "@/lib/ui";
import {
  LayoutDashboard, Sun, Phone, ListChecks, CalendarClock, Users2, Briefcase,
  Building2, UserCog, BarChart3, Upload, Bell, Settings as SettingsIcon,
  Search, LogOut, Menu, X, AlertTriangle, PhoneCall, ClipboardList, ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/my-day", label: "My Day", icon: Sun, roles: ["recruiter", "team_leader"] },
  { to: "/leads", label: "All Leads", icon: Users2, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/my-leads", label: "My Leads", icon: ClipboardList, roles: ["recruiter", "team_leader"] },
  { to: "/calling", label: "Calling List", icon: PhoneCall, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/followups", label: "Follow-ups", icon: CalendarClock, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/interviews", label: "Interviews", icon: Phone, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/joining", label: "Joining", icon: ListChecks, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/jobs", label: "Jobs", icon: Briefcase, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/clients", label: "Clients", icon: Building2, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/recruiters", label: "Recruiters", icon: UserCog, roles: ["admin", "team_leader"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/action-required", label: "Action Required", icon: AlertTriangle, roles: ["admin", "team_leader"] },
  { to: "/import", label: "Import Leads", icon: Upload, roles: ["admin"] },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["admin", "team_leader", "recruiter"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] },
];

const ROLE_LABEL = { admin: "Admin / Owner", team_leader: "Team Leader", recruiter: "Recruiter" };

function SidebarContent({ user, onNav }) {
  const loc = useLocation();
  const items = NAV.filter((n) => n.roles.includes(user.role));
  return (
    <div className="flex flex-col h-full bg-[#0B132B] text-slate-300">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-white/10 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white font-display">O</div>
        <div className="leading-tight">
          <p className="text-white font-bold font-display text-sm">OAKsphere</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Connect CRM</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {items.map((n) => {
          const active = loc.pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNav}
              data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-blue-600 text-white font-semibold shadow-sm" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <n.icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10 text-[11px] text-slate-500">
        v1.0 • {ROLE_LABEL[user.role]}
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [unread, setUnread] = useState(0);
  const pathname = useLocation().pathname;

  useEffect(() => {
    const refresh = () => api.get("/notifications/unread-count").then((r) => setUnread(r.data.count)).catch(() => {});
    refresh();
    window.addEventListener("oak:notif", refresh);
    return () => window.removeEventListener("oak:notif", refresh);
  }, [pathname]);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/leads/search?q=${encodeURIComponent(q)}`).then((r) => setResults(r.data)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (!user) return null;

  return (
    <div className="App flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="hidden lg:block w-64 flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <SidebarContent user={user} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-0">
          <SidebarContent user={user} onNav={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 flex items-center gap-3 px-4 sm:px-6 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20">
          <button data-testid="mobile-menu-btn" className="lg:hidden p-2" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              data-testid="global-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email…"
              className="pl-9 h-9 bg-slate-50 dark:bg-slate-800 border-slate-200"
            />
            {results.length > 0 && (
              <div className="absolute mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.id}
                    data-testid={`search-result-${r.id}`}
                    onClick={() => { setQ(""); setResults([]); navigate(`/leads?focus=${r.id}`); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{r.phone}</p>
                    </div>
                    {r.duplicate_flag && <span className="text-[10px] text-rose-600 font-semibold">DUPLICATE</span>}
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1" />
          <Link to="/notifications" data-testid="notification-bell" className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <Bell className="w-5 h-5 text-slate-500" />
            {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-semibold">{unread}</span>}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="user-menu-btn" className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <Avatar className="w-8 h-8">
                  {user.avatar && <AvatarImage src={user.avatar} />}
                  <AvatarFallback className="bg-blue-600 text-white text-xs">{initials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
                  <p className="text-[11px] text-slate-400">{ROLE_LABEL[user.role]}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="logout-btn" onClick={logout} className="text-rose-600">
                <LogOut className="w-4 h-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in-up">{children}</main>
      </div>
    </div>
  );
}

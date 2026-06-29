import React from 'react';
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Network,
  Users,
  ShieldCheck,
  Cloud,
  Gavel,
  HelpCircle,
  ChevronDown,
  Settings,
  Bell,
  Monitor,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Briefcase,
  Plug,
  ShoppingCart,
  CircleDollarSign,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type SubItem = {
  label: string;
  icon: React.ReactElement;
  href: string;
  status?: string;
};

type MenuItem = {
  label: string;
  icon: React.ReactElement;
  href: string;
  hasSubmenu?: boolean;
  subItems?: SubItem[];
  // Visible if user has ANY of these slugs. Empty/undefined = always visible.
  permissions?: string[];
};

type BottomItem = {
  label: string;
  icon: React.ReactElement;
  href: string;
  permissions?: string[];
};

type MenuGroup = {
  section: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    section: "MAIN MENU",
    items: [
      { label: "Dashboard", icon: <LayoutDashboard size={18} />, href: "/agency" },
      { label: "Workspaces", icon: <Network size={18} />, href: "/agency/workspaces", permissions: ["agency.workspace.*"] },
      { label: "Users", icon: <Users size={18} />, href: "/agency/team", permissions: ["agency.users.*"] },
      { label: "Roles", icon: <ShieldCheck size={18} />, href: "/agency/roles", permissions: ["agency.acl.*"] },
    ],
  },
  {
    section: "MANAGEMENT",
    items: [
      {
        label: "Audit Logs",
        icon: <ScrollText size={18} />,
        href: "#",
        hasSubmenu: true,
        permissions: ["agency.*"],
        subItems: [
          { label: "Agency Logs", icon: <Briefcase size={15} />, href: "/agency/audit-logs/agency" },
          { label: "Workspace Logs", icon: <Network size={15} />, href: "/agency/audit-logs/workspace" },
        ],
      },
      {
        label: "SaaS",
        icon: <Cloud size={18} />,
        href: "#",
        hasSubmenu: true,
        permissions: ["agency.*"],
        subItems: [
          { label: "Plans", icon: <Briefcase size={15} />, href: "/agency/saas/plans", status: "Soon" },
          { label: "API", icon: <Plug size={15} />, href: "/agency/saas/api" },
        ],
      },
      {
        label: "Billing",
        icon: <CreditCard size={18} />,
        href: "#",
        hasSubmenu: true,
        permissions: ["agency.*"],
        subItems: [
          { label: "Plans", icon: <ShoppingCart size={15} />, href: "/agency/billing/plans" },
          { label: "Manage", icon: <CircleDollarSign size={15} />, href: "/agency/billing/manage" },
        ],
      },
      { label: "Legal", icon: <Gavel size={18} />, href: "/agency/legal", permissions: ["agency.legal.*"] },
    ],
  },
];

const bottomItems: BottomItem[] = [
  { label: "Settings", icon: <Settings size={18} />, href: "/agency/settings/general", permissions: ["agency.settings.*"] },
  { label: "Notifications", icon: <Bell size={18} />, href: "/agency/settings/notifications", permissions: ["agency.*"] },
  { label: "White Label", icon: <Monitor size={18} />, href: "/agency/settings/white-label", permissions: ["agency.*"] },
  { label: "Help & Support", icon: <HelpCircle size={18} />, href: "/agency/help", permissions: ["agency.*"] },
];

const AgencySidebar = () => {
  const [location] = useLocation();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { mode } = useTheme();

  const user = React.useMemo(() => {
    try { return getUserInfo(); } catch { return {}; }
  }, []);
  const userPerms = (user.permissions as string[]) ?? [];

  const visibleMenuItems = React.useMemo(
    () => menuGroups.flatMap((g) => g.items).filter((item) => hasAnyPerm(userPerms, item.permissions ?? [])),
    [userPerms]
  );
  const visibleBottomItems = React.useMemo(
    () => bottomItems.filter((item) => hasAnyPerm(userPerms, item.permissions ?? [])),
    [userPerms]
  );

  const isActive = (href: string) => href !== "#" && location === href;
  const isParentActive = (item: MenuItem) => {
    if (isActive(item.href)) return true;
    return item.subItems?.some(s => isActive(s.href)) ?? false;
  };

  const dark = mode === "dark";

  // White-label: agency logo (uploaded via /agency/settings/white-label) overrides
  // the default "EC" + "EZCONN" mark. Falls back when no logo is set.
  const agencyId = user?.modelable_id;
  // localStorage cache → instant logo on revisit. 30-min TTL keeps signed URLs valid.
  const AGENCY_CACHE_KEY = agencyId ? `agency_cache_v1_${agencyId}` : null;
  const AGENCY_CACHE_TTL = 30 * 60 * 1000;
  const cachedAgency = (() => {
    if (!AGENCY_CACHE_KEY) return undefined;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(AGENCY_CACHE_KEY) : null;
      if (!raw) return undefined;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > AGENCY_CACHE_TTL) return undefined;
      return data;
    } catch {
      return undefined;
    }
  })();
  const { data: agencyResp, isLoading: isAgencyLoading } = useQuery<any>({
    queryKey: [`/api/agencies/${agencyId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/agencies/${agencyId}`);
      return res.json();
    },
    enabled: !!agencyId,
    initialData: cachedAgency,
    staleTime: 5 * 60 * 1000,
  });
  React.useEffect(() => {
    if (agencyResp && AGENCY_CACHE_KEY) {
      try {
        localStorage.setItem(AGENCY_CACHE_KEY, JSON.stringify({ data: agencyResp, ts: Date.now() }));
      } catch { /* ignore quota errors */ }
    }
  }, [agencyResp, AGENCY_CACHE_KEY]);
  // Theme-aware logo selection (replyagent parity). Light mode → small light → small dark
  // → wide light → wide dark → null. Dark mode mirrors with dark variants first. The
  // small/square variant is preferred for the 32x32 badge slot.
  const b = agencyResp?.agency?.branding;
  const agencyLogoUrl: string | null = dark
    ? b?.logo_dark_small || b?.logo_light_small || b?.logo_dark || b?.logo_light || null
    : b?.logo_light_small || b?.logo_dark_small || b?.logo_light || b?.logo_dark || null;

  return (
    <div className={cn(
      "relative h-screen flex flex-col border-r transition-all duration-300 ease-in-out z-50 shrink-0",
      isCollapsed ? "w-[70px]" : "w-[240px]",
      dark ? "bg-[#18181b] border-zinc-800" : "bg-[#fafaf9] border-slate-200"
    )}>

      {/* Collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute -right-3 top-16 w-6 h-6 rounded-full border flex items-center justify-center z-[100] shadow-md transition-all hover:scale-110",
          dark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-500"
        )}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo — white-label aware. Uploaded agency logo wins; otherwise default mark. */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b shrink-0",
        dark ? "border-slate-800" : "border-slate-100"
      )}>
        {isAgencyLoading ? (
          // Invisible placeholder during initial fetch — prevents the EC-badge flash
          // before the actual branded logo arrives.
          <div className="w-8 h-8 shrink-0" aria-hidden="true" />
        ) : agencyLogoUrl ? (
          // Plain image — replyagent parity. The agency uploads light/dark variants
          // separately so each version renders correctly against its background.
          <img
            src={agencyLogoUrl}
            alt="Agency logo"
            className="w-8 h-8 object-contain shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            EC
          </div>
        )}
        {!isCollapsed && (
          <div className="overflow-hidden">
            <p className={cn("font-bold text-sm leading-tight truncate", dark ? "text-white" : "text-slate-900")}>
              EZCONN
            </p>
            <p className="text-[11px] text-slate-400 truncate">Agency Manager</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-2 px-2">
        {visibleMenuItems.map((item) => {
          const active = isActive(item.href) || isParentActive(item);
          const open = expanded === item.label;

          return (
            <div key={item.label}>
              <div
                onClick={() => {
                  if (item.hasSubmenu) {
                    if (isCollapsed) setIsCollapsed(false);
                    setExpanded(open ? null : item.label);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all group relative",
                  active
                    ? (dark ? "bg-primary/10 text-white" : "bg-primary/10 text-primary")
                    : (dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"),
                  isCollapsed && "justify-center"
                )}
              >
                <span className={cn("shrink-0", active ? "text-primary" : "")}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <>
                    {item.hasSubmenu ? (
                      <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                    ) : (
                      <Link href={item.href} className="flex-1 text-[13px] font-medium">
                        {item.label}
                      </Link>
                    )}
                    {item.hasSubmenu && (
                      <ChevronDown size={13} className={cn("transition-transform shrink-0", open ? "rotate-180" : "", dark ? "text-slate-500" : "text-slate-400")} />
                    )}
                  </>
                )}

                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <div className={cn(
                    "absolute left-full ml-3 px-2.5 py-1.5 text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[200] shadow-lg",
                    dark ? "bg-slate-800 text-white border border-slate-700" : "bg-slate-900 text-white"
                  )}>
                    {item.label}
                  </div>
                )}
              </div>

              {/* Submenu */}
              {!isCollapsed && item.hasSubmenu && open && item.subItems && (
                <div className="mt-0.5 ml-4 pl-4 border-l space-y-0.5 border-slate-200 dark:border-slate-700">
                  {item.subItems.map((sub) => (
                    <Link key={sub.label} href={sub.href}>
                      <div className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-all",
                        isActive(sub.href)
                          ? (dark ? "text-white bg-primary/10" : "text-primary bg-primary/5")
                          : (dark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50")
                      )}>
                        <div className="flex items-center gap-2">
                          {sub.icon}
                          <span>{sub.label}</span>
                        </div>
                        {sub.status && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">{sub.status}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Bottom items */}
        {visibleBottomItems.map((item) => {
          const active = isActive(item.href);
          return (
            <div key={item.label}>
              <Link href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all group relative",
                  active
                    ? (dark ? "bg-primary/10 text-white" : "bg-primary/10 text-primary")
                    : (dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"),
                  isCollapsed && "justify-center"
                )}>
                  <span className={cn("shrink-0", active ? "text-primary" : "")}>
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="text-[13px] font-medium">{item.label}</span>}
                  {isCollapsed && (
                    <div className={cn(
                      "absolute left-full ml-3 px-2.5 py-1.5 text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[200] shadow-lg",
                      dark ? "bg-slate-800 text-white border border-slate-700" : "bg-slate-900 text-white"
                    )}>
                      {item.label}
                    </div>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User footer removed */}
    </div>
  );
};

export default AgencySidebar;

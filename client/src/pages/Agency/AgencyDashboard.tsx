import React from 'react';
import { getUserInfo } from "@/lib/auth";
import {
  Network,
  Users,
  ShieldCheck,
  TrendingUp,
  Layout,
  Cloud,
  Smartphone,
  ShoppingBag,
  Users2,
  Settings,

  CheckCircle2,
  Clock,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const AgencyDashboard = () => {
  const { mode } = useTheme();
  const [, setLocation] = useLocation();
  const dark = mode === "dark";

  const userInfo = React.useMemo(() => {
    try { return getUserInfo(); } catch { return {}; }
  }, []);
  const agencyId = userInfo?.modelable_id;

  const { data: dashboardResponse, isLoading } = useQuery({
    queryKey: [`/api/agencies/${agencyId}/dashboard-stats`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/agencies/${agencyId}/dashboard-stats`);
      return res.json();
    },
    retry: false,
  });

  const stats = dashboardResponse?.stats;
  const recentLogs = dashboardResponse?.recent_activity || [];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const statCards = [
    {
      label: "Total Workspaces",
      value: stats?.total_workspaces ?? 0,
      icon: <Network size={20} className="text-blue-500" />,
      bg: dark ? "bg-blue-500/10" : "bg-blue-50",
      color: "text-blue-600",
    },
    {
      label: "Team Members",
      value: stats?.total_agents ?? 0,
      icon: <Users size={20} className="text-violet-500" />,
      bg: dark ? "bg-violet-500/10" : "bg-violet-50",
      color: "text-violet-600",
    },
    {
      label: "Support Seats",
      value: stats?.premium_support_seats ?? "—",
      icon: <ShieldCheck size={20} className="text-emerald-500" />,
      bg: dark ? "bg-emerald-500/10" : "bg-emerald-50",
      color: "text-emerald-600",
    },
    {
      label: "Plan Status",
      value: "Active",
      icon: <TrendingUp size={20} className="text-orange-500" />,
      bg: dark ? "bg-orange-500/10" : "bg-orange-50",
      color: "text-orange-600",
    },
  ];

  const featureCards = [
    {
      title: "White Label Apps",
      desc: "Create fully branded apps for your clients with custom domains and branding.",
      status: "ACTIVE",
      statusColor: "text-emerald-600 bg-emerald-50",
      icon: <Layout size={22} className="text-teal-500" />,
      href: "/agency/settings/white-label",
    },
    {
      title: "Client Portal",
      desc: "Give clients access to track their projects and app performance in real-time.",
      status: "COMING SOON",
      statusColor: "text-orange-600 bg-orange-50",
      icon: <Cloud size={22} className="text-blue-500" />,
      href: "/agency/saas/plans",
    },
    {
      title: "Mobile Apps",
      desc: "White-label mobile apps for iOS and Android with your branding.",
      status: "ACTIVE",
      statusColor: "text-emerald-600 bg-emerald-50",
      icon: <Smartphone size={22} className="text-indigo-500" />,
      href: "#",
    },
    {
      title: "Marketplace",
      desc: "List your agency in the marketplace and reach more clients.",
      status: "ACTIVE",
      statusColor: "text-emerald-600 bg-emerald-50",
      icon: <ShoppingBag size={22} className="text-orange-500" />,
      href: "/agency/workspaces",
    },
    {
      title: "Community",
      desc: "Connect with other agencies, share knowledge and grow together.",
      status: "INCLUDED",
      statusColor: "text-blue-600 bg-blue-50",
      icon: <Users2 size={22} className="text-pink-500" />,
      href: "/agency/help",
    },
    {
      title: "Agency Settings",
      desc: "Manage your agency profile, branding, and account preferences.",
      status: "ACTIVE",
      statusColor: "text-emerald-600 bg-emerald-50",
      icon: <Settings size={22} className="text-slate-500" />,
      href: "/agency/settings/general",
    },
  ];

  return (
    <div className={cn("min-h-screen p-6 transition-colors animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out", dark ? "bg-[#0f172a] text-white" : "bg-slate-50 text-slate-900")}>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          {getGreeting()}, {userInfo?.first_name || "User"}! 👋
        </h1>
        <p className={cn("text-sm mt-1", dark ? "text-slate-400" : "text-slate-500")}>
          Welcome back to your agency dashboard
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => (
          <div key={i} className={cn(
            "rounded-xl p-5 border transition-all hover:shadow-md",
            dark ? "bg-[#1e293b] border-slate-800" : "bg-white border-slate-200"
          )}>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", card.bg)}>
              {card.icon}
            </div>
            <p className={cn("text-[12px] font-medium mb-1", dark ? "text-slate-400" : "text-slate-500")}>{card.label}</p>
            <p className={cn("text-2xl font-bold", dark ? "text-white" : "text-slate-900")}>
              {isLoading ? <span className="text-slate-300 text-base">Loading...</span> : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left: Features */}
        <div className="xl:col-span-2 space-y-6">
          <h2 className="text-base font-semibold">Agency Features</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featureCards.map((f, i) => (
              <div
                key={i}
                onClick={() => setLocation(f.href)}
                className={cn(
                  "rounded-xl p-5 border cursor-pointer transition-all hover:shadow-md hover:border-blue-200 group",
                  dark ? "bg-[#1e293b] border-slate-800" : "bg-white border-slate-200"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", dark ? "bg-slate-800" : "bg-slate-50")}>
                    {f.icon}
                  </div>
                  <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", f.statusColor)}>
                    {f.status}
                  </span>
                </div>
                <h3 className={cn("font-semibold text-[14px] mb-1 group-hover:text-blue-500 transition-colors", dark ? "text-white" : "text-slate-800")}>
                  {f.title}
                </h3>
                <p className={cn("text-[12px] leading-relaxed line-clamp-2", dark ? "text-slate-400" : "text-slate-500")}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Plan + Quick Actions + Activity */}
        <div className="space-y-5">

          {/* Plan Card */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-blue-600 to-violet-600 text-white">
            <div className="flex items-center gap-1.5 mb-1">
              <Star size={13} className="fill-white/60 text-white/60" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">Agency Plan</span>
            </div>
            <h3 className="text-xl font-bold mb-1">Professional</h3>
            <p className="text-[12px] text-white/60 mb-5">Next billing: June 15, 2026</p>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-[12px]">
                <span className="text-white/70">Workspaces</span>
                <span className="font-semibold">{stats?.total_workspaces || 0} / 50</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${Math.min(((stats?.total_workspaces || 0) / 50) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-white/70">Team Members</span>
                <span className="font-semibold">{stats?.total_agents || 0} / 100</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${Math.min(((stats?.total_agents || 0) / 100) * 100, 100)}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setLocation('/agency/billing/plans')}
              className="w-full py-2 rounded-lg bg-white text-blue-600 text-[13px] font-bold hover:bg-blue-50 transition-colors"
            >
              Upgrade to Enterprise
            </button>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Recent Activity</h2>
              <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <div className={cn("rounded-xl border overflow-hidden", dark ? "bg-[#1e293b] border-slate-800" : "bg-white border-slate-200")}>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">No recent activity</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentLogs.slice(0, 5).map((log: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={13} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[12px] font-medium truncate", dark ? "text-slate-300" : "text-slate-700")}>
                          {log.action} <span className="font-semibold">{log.target}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {log.time ? new Date(log.time).toLocaleDateString() : "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AgencyDashboard;

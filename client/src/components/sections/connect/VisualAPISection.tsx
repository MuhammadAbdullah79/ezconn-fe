import { useState } from "react";
import {
  Network,
  Plus,
  Trash2,
  RefreshCcw,
  Settings,
  ChevronLeft,
  Copy,
  Zap,
  Activity,
  ShieldCheck,
  Terminal,
  Database,
  ArrowRight,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Eye,
  Search,
  FileText,
  Webhook,
  Megaphone,
  TrendingUp,
  PhoneCall,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export default function VisualAPISection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<"LIST" | "MANAGE" | "LOGS">("LIST");
  const [activeTrigger, setActiveTrigger] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<any | null>(null);
  const [newTriggerName, setNewTriggerName] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "webhook" | "broadcast">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewUrlTrigger, setViewUrlTrigger] = useState<any | null>(null);
  const [renameTrigger, setRenameTrigger] = useState<any | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const labelCls = cn("block text-[10px] font-black uppercase tracking-widest", sub);

  const { data: triggers } = useQuery({
    queryKey: ["/api/integrations/api-triggers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/api-triggers");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/integrations/api-triggers", { name });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      toast({ title: "Created", description: "API trigger created successfully." });
      setIsCreateModalOpen(false);
      setNewTriggerName("");
      setActiveTrigger(data);
      setViewMode("MANAGE");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/integrations/api-triggers/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      toast({ title: "Saved", description: "Trigger configuration updated." });
      setViewMode("LIST");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/integrations/api-triggers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      toast({ title: "Deleted", description: "API trigger removed." });
      setDeleteConfirmation(null);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (payload: { id: number | string; name: string }) => {
      await apiRequest("PATCH", `/api/integrations/api-triggers/${payload.id}`, { name: payload.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/api-triggers"] });
      toast({ title: "Renamed", description: "Visual API renamed." });
      setRenameTrigger(null);
      setRenameValue("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const { data: logs, refetch: refetchLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/integrations/api-triggers", activeTrigger?.id, "logs"],
    queryFn: async () => {
      if (!activeTrigger) return [];
      const res = await apiRequest("GET", `/api/integrations/api-triggers/${activeTrigger.id}/logs`);
      return res.json();
    },
    enabled: !!activeTrigger && viewMode === "LOGS",
  });

  const handleCreateTrigger = () => {
    if (!newTriggerName.trim()) return;
    createMutation.mutate(newTriggerName);
  };

  const copyToClipboard = (val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: "Copied", description: "URL copied to clipboard." });
  };

  const getWebhookUrl = (slug: string) => `${window.location.origin}/v1/api-trigger/${slug}`;

  // ── Derived stats + filtering (matches Byte's Visual APIs dashboard) ──
  const allTriggers: any[] = triggers || [];
  const getType = (t: any) =>
    t?.type === "group_broadcast" || t?.type === "broadcast" ? "broadcast" : "webhook";
  const getCalls = (t: any) => t?.calls_30d ?? t?.calls ?? t?.calls_count ?? 0;

  const webhookCount = allTriggers.filter((t) => getType(t) === "webhook").length;
  const broadcastCount = allTriggers.filter((t) => getType(t) === "broadcast").length;
  const activeCount = allTriggers.filter((t) => t.live).length;
  const pausedCount = allTriggers.filter((t) => !t.live).length;
  const errorCount = allTriggers.filter((t) => t.in_error || t.status === "error").length;
  const totalCalls = allTriggers.reduce((s, t) => s + getCalls(t), 0);
  const avgPerDay = allTriggers.length ? Math.round(totalCalls / 30) : 0;
  const successRate =
    allTriggers.length === 0 || totalCalls === 0
      ? null
      : Math.round(
          (allTriggers.reduce((s, t) => s + (t.success_count ?? 0), 0) / totalCalls) * 100,
        );

  const displayedTriggers = allTriggers.filter((t) => {
    if (filterTab !== "all" && getType(t) !== filterTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (t.name || "").toLowerCase().includes(q) ||
        getWebhookUrl(t.slug || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Header content per view
  const headerTitle =
    viewMode === "MANAGE" ? "Manage Trigger" : viewMode === "LOGS" ? "Activity Logs" : "Visual API Triggers";
  const headerSub =
    viewMode === "MANAGE"
      ? activeTrigger?.name || "Configure your trigger"
      : viewMode === "LOGS"
        ? "Real-time execution history"
        : "Workflow automation endpoints for external integrations";

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Network className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>{headerTitle}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>{headerSub}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {viewMode === "LIST" && (
                <>
                  <a
                    href="https://docs.ezconn.io/visual-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={outlineBtn}
                  >
                    <FileText size={12} /> Docs
                  </a>
                  <button onClick={() => setIsCreateModalOpen(true)} className={primaryOutlineBtn}>
                    <Plus size={12} /> Add
                  </button>
                </>
              )}
              {viewMode === "MANAGE" && (
                <>
                  <button onClick={() => updateMutation.mutate(activeTrigger)} disabled={updateMutation.isPending} className={primaryBtn}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                  <button onClick={() => setViewMode("LIST")} className={outlineBtn}>
                    <ChevronLeft size={12} /> Back
                  </button>
                </>
              )}
              {viewMode === "LOGS" && (
                <>
                  <button onClick={() => refetchLogs()} className={outlineBtn}>
                    <RefreshCcw size={12} className={cn(logsLoading && "animate-spin")} /> Refresh
                  </button>
                  <button onClick={() => setViewMode("LIST")} className={outlineBtn}>
                    <ChevronLeft size={12} /> Back
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {viewMode === "LIST" && (
            <div className="p-8">
              {!triggers || triggers.length === 0 ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Network className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>No triggers yet</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      Create your first API trigger to start automated visual workflows from external systems.
                    </p>
                  </div>
                  <button onClick={() => setIsCreateModalOpen(true)} className={primaryOutlineBtn}>
                    <Plus size={12} /> Create Now
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ── Stat cards ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total */}
                    <div className={cn("rounded-[1.25rem] border p-5", softBorder, softBg)}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Network size={14} className="text-primary" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", sub)}>Total Visual APIs</span>
                      </div>
                      <p className={cn("text-[26px] font-black leading-none", text)}>{allTriggers.length}</p>
                      <p className={cn("text-[10px] font-bold mt-2 opacity-60", sub)}>
                        {webhookCount} Webhook · {broadcastCount} Group broadcast
                      </p>
                    </div>

                    {/* Active */}
                    <div className={cn("rounded-[1.25rem] border p-5", softBorder, softBg)}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", sub)}>Active</span>
                      </div>
                      <p className={cn("text-[26px] font-black leading-none", text)}>{activeCount}</p>
                      <p className={cn("text-[10px] font-bold mt-2 opacity-60", sub)}>
                        {pausedCount} paused · {errorCount} in error
                      </p>
                    </div>

                    {/* Calls received */}
                    <div className={cn("rounded-[1.25rem] border p-5", softBorder, softBg)}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <PhoneCall size={14} className="text-primary" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", sub)}>Calls received · 30d</span>
                      </div>
                      <p className={cn("text-[26px] font-black leading-none", text)}>{totalCalls}</p>
                      <p className={cn("text-[10px] font-bold mt-2 opacity-60", sub)}>Avg {avgPerDay} calls / day</p>
                    </div>

                    {/* Success rate */}
                    <div className={cn("rounded-[1.25rem] border p-5", softBorder, softBg)}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <TrendingUp size={14} className="text-amber-500" />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", sub)}>Success rate</span>
                      </div>
                      <p className={cn("text-[26px] font-black leading-none", text)}>
                        {successRate === null ? "—" : `${successRate}%`}
                      </p>
                      <p className={cn("text-[10px] font-bold mt-2 opacity-60", sub)}>Last 30 days</p>
                    </div>
                  </div>

                  {/* ── Filter tabs + search ── */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {[
                        { id: "all", label: "All", count: allTriggers.length },
                        { id: "webhook", label: "Webhook", count: webhookCount },
                        { id: "broadcast", label: "Group broadcast", count: broadcastCount },
                      ].map((tab) => {
                        const active = filterTab === (tab.id as any);
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setFilterTab(tab.id as any)}
                            className={cn(
                              "h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border",
                              active
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : cn(softBorder, dark ? "text-slate-400 hover:text-primary hover:border-primary/30" : "text-slate-500 hover:text-primary hover:border-primary/30"),
                            )}
                          >
                            {tab.label}
                            <span className={cn("px-1.5 py-0.5 rounded text-[9px]", active ? "bg-primary/20" : dark ? "bg-slate-800" : "bg-slate-200/70")}>
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search size={13} className={cn("absolute left-3 top-1/2 -translate-y-1/2", sub)} />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or URL..."
                        className={cn(inputCls, "pl-9 h-9 text-[12px]")}
                      />
                    </div>
                  </div>

                  {/* ── Table ── */}
                  <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                            <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Name</th>
                            <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Type</th>
                            <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>URL</th>
                            <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Status</th>
                            <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Calls · 30d</th>
                            <th className={cn("px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest", sub)}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedTriggers.length === 0 ? (
                            <tr>
                              <td colSpan={6} className={cn("px-6 py-12 text-center text-[12px] font-bold opacity-60", sub)}>
                                No matching Visual APIs.
                              </td>
                            </tr>
                          ) : (
                            displayedTriggers.map((trigger: any) => {
                              const type = getType(trigger);
                              return (
                                <tr
                                  key={trigger.id}
                                  className={cn("border-b transition-colors group", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", type === "broadcast" ? "bg-amber-500/10" : "bg-primary/10")}>
                                        {type === "broadcast" ? <Megaphone size={14} className="text-amber-500" /> : <Zap size={14} className="text-primary" />}
                                      </div>
                                      <div>
                                        <span className={cn("text-[13px] font-black block", text)}>{trigger.name}</span>
                                        {trigger.subtitle && <span className={cn("text-[10px] font-bold opacity-50", sub)}>{trigger.subtitle}</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {type === "broadcast" ? (
                                      <Badge variant="outline" className="h-5 px-2 rounded-md border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest gap-1">
                                        <Megaphone size={10} /> Group broadcast
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="h-5 px-2 rounded-md border-primary/30 bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest gap-1">
                                        <Webhook size={10} /> Webhook
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                      <code className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold border max-w-[180px] truncate", softBorder, dark ? "bg-slate-900/50" : "bg-slate-50")}>
                                        {getWebhookUrl(trigger.slug)}
                                      </code>
                                      <button
                                        onClick={() => setViewUrlTrigger(trigger)}
                                        className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100", dark ? "hover:bg-slate-800 text-primary" : "hover:bg-slate-100 text-primary")}
                                        title="View"
                                      >
                                        <Eye size={11} />
                                      </button>
                                      <button
                                        onClick={() => copyToClipboard(getWebhookUrl(trigger.slug))}
                                        className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100", dark ? "hover:bg-slate-800 text-primary" : "hover:bg-slate-100 text-primary")}
                                        title="Copy"
                                      >
                                        <Copy size={11} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {trigger.live ? (
                                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Test
                                      </span>
                                    )}
                                  </td>
                                  <td className={cn("px-6 py-4 text-[13px] font-black", text)}>
                                    {getCalls(trigger)}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all ml-auto", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                        >
                                          <MoreHorizontal size={14} />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-48", card, border)}>
                                        <DropdownMenuItem
                                          className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                          onClick={() => { setActiveTrigger(trigger); setViewMode("MANAGE"); }}
                                        >
                                          <Settings size={13} /> Manage
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                          onClick={() => { setRenameTrigger(trigger); setRenameValue(trigger.name || ""); }}
                                        >
                                          <Pencil size={13} /> Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                                          onClick={() => setDeleteConfirmation(trigger)}
                                        >
                                          <Trash2 size={13} /> Delete
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="my-1" />
                                        <DropdownMenuItem
                                          className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                          onClick={() => { setActiveTrigger(trigger); setViewMode("LOGS"); }}
                                        >
                                          <Activity size={13} /> Logs
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className={cn("px-6 py-3 border-t text-[10px] font-black uppercase tracking-widest", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                      Showing {displayedTriggers.length} of {allTriggers.length} Visual APIs
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MANAGE VIEW ── */}
          {viewMode === "MANAGE" && activeTrigger && (
            <div className="p-8 space-y-6">
              {/* Endpoint Configuration */}
              <div className={cn("rounded-[1.5rem] border p-6 space-y-5", softBg, softBorder)}>
                <h4 className={cn("text-[11px] font-black uppercase tracking-widest text-primary")}>Endpoint Configuration</h4>

                <div className="space-y-2">
                  <label className={labelCls}>Trigger URL</label>
                  <div className="flex gap-2">
                    <input readOnly value={getWebhookUrl(activeTrigger.slug)} className={cn(inputCls, "font-mono text-[12px] flex-1")} />
                    <button onClick={() => copyToClipboard(getWebhookUrl(activeTrigger.slug))} className={outlineBtn}>
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                  <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                    Send a POST request to this URL to trigger your workflow.
                  </p>
                </div>

                <div className={cn("flex items-center justify-between p-4 rounded-xl border", softBorder, dark ? "bg-slate-900/50" : "bg-white")}>
                  <div>
                    <p className={cn("text-[13px] font-black", text)}>Environment</p>
                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>Toggle between Test and Live mode.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[10px] font-black uppercase tracking-widest transition-opacity", !activeTrigger.live ? "text-amber-500" : "opacity-40")}>
                      Test
                    </span>
                    <Switch
                      checked={activeTrigger.live}
                      onCheckedChange={(checked) => setActiveTrigger({ ...activeTrigger, live: checked })}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <span className={cn("text-[10px] font-black uppercase tracking-widest transition-opacity", activeTrigger.live ? "text-emerald-500" : "opacity-40")}>
                      Live
                    </span>
                  </div>
                </div>
              </div>

              {/* Field Mapping */}
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder)}>
                <div className={cn("p-6 border-b flex items-center gap-3", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Database size={15} />
                  </div>
                  <div>
                    <p className={cn("text-[13px] font-black", text)}>Field Mapping</p>
                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>Map incoming API fields to internal fields.</p>
                  </div>
                </div>
                <div className={cn("p-6 space-y-5", softBg)}>
                  {[
                    { label: "First Name", key: "first_name", required: true },
                    { label: "Last Name", key: "last_name", required: false },
                    { label: "Email", key: "email", required: false },
                  ].map((field, i) => (
                    <div key={i} className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 items-center pb-5 border-b last:border-0 last:pb-0", softBorder)}>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className={cn("text-[13px] font-black", text)}>
                          {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={cn("flex-1 h-11 rounded-xl border flex items-center px-4 text-[12px] font-mono opacity-60", softBorder, dark ? "bg-slate-900" : "bg-white")}>
                          {field.key}
                        </div>
                        <ArrowRight className={sub} size={14} />
                        <div className={cn("flex-1 h-11 rounded-xl border flex items-center px-4 text-[12px] font-bold cursor-pointer transition-all hover:border-primary/40", softBorder, dark ? "bg-slate-900/50" : "bg-white")}>
                          <span className="opacity-60">Select payload key...</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Duplicate Handling */}
              <div className="space-y-3">
                <h4 className={cn("text-[11px] font-black uppercase tracking-widest text-primary")}>Duplicate Handling</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => setActiveTrigger({ ...activeTrigger, update_duplicates: true })}
                    className={cn(
                      "p-6 rounded-[1.5rem] border cursor-pointer transition-all",
                      activeTrigger.update_duplicates
                        ? "border-primary bg-primary/5"
                        : cn(softBorder, softBg, "hover:border-primary/40")
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", activeTrigger.update_duplicates ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                        <RefreshCcw size={18} />
                      </div>
                      {activeTrigger.update_duplicates && <CheckCircle2 size={18} className="text-primary" />}
                    </div>
                    <h5 className={cn("text-[13px] font-black mb-1", text)}>Update Duplicates</h5>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      Update existing records with the incoming data.
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTrigger({ ...activeTrigger, update_duplicates: false })}
                    className={cn(
                      "p-6 rounded-[1.5rem] border cursor-pointer transition-all",
                      !activeTrigger.update_duplicates
                        ? "border-primary bg-primary/5"
                        : cn(softBorder, softBg, "hover:border-primary/40")
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", !activeTrigger.update_duplicates ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                        <ShieldCheck size={18} />
                      </div>
                      {!activeTrigger.update_duplicates && <CheckCircle2 size={18} className="text-primary" />}
                    </div>
                    <h5 className={cn("text-[13px] font-black mb-1", text)}>Skip Duplicates</h5>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      Ignore incoming data if a matching record already exists.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── LOGS VIEW ── */}
          {viewMode === "LOGS" && activeTrigger && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                {logs && logs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Timestamp</th>
                          <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Status</th>
                          <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Error Code</th>
                          <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log: any) => (
                          <tr key={log.id} className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}>
                            <td className={cn("px-6 py-4 font-mono text-[11px] font-bold", sub)}>
                              {format(new Date(log.created_at), "PP p")}
                            </td>
                            <td className="px-6 py-4">
                              {log.status === "SUCCESS" || log.status === "processed" ? (
                                <Badge variant="outline" className="h-5 px-2 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                                  Success
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="h-5 px-2 rounded-md border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest">
                                  Failed
                                </Badge>
                              )}
                            </td>
                            <td className={cn("px-6 py-4 font-mono text-[11px] font-black", log.error_code ? "text-rose-500" : sub)}>
                              {log.error_code || "—"}
                            </td>
                            <td className={cn("px-6 py-4 text-[12px] font-medium", text)}>
                              {log.error || "Completed successfully."}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-20 px-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Terminal className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={cn("text-[14px] font-black tracking-tight", text)}>No logs yet</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                        Logs will appear here once requests hit this trigger.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Modal ── */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Plus size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[13px] font-black uppercase tracking-widest", text)}>
                    New API Trigger
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Create a new endpoint to start receiving data.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Trigger Name</label>
              <input
                placeholder="e.g. Lead Capture Form"
                value={newTriggerName}
                onChange={(e) => setNewTriggerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTrigger()}
                className={inputCls}
              />
            </div>

            <div className={cn("flex items-start gap-3 p-4 rounded-xl border", "border-primary/20 bg-primary/5")}>
              <AlertCircle size={14} className="text-primary mt-0.5 shrink-0" />
              <p className={cn("text-[11px] font-medium leading-relaxed", sub)}>
                A unique URL will be generated for this trigger that you can share with external systems.
              </p>
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => setIsCreateModalOpen(false)} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={handleCreateTrigger}
                disabled={!newTriggerName.trim() || createMutation.isPending}
                className={primaryBtn}
              >
                <Plus size={12} /> {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Delete Trigger?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{deleteConfirmation?.name || "This trigger"}</span> will be permanently removed and external systems using its URL will stop working.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteConfirmation.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── View URL Modal ── */}
      <Dialog open={!!viewUrlTrigger} onOpenChange={(open) => !open && setViewUrlTrigger(null)}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-lg", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Network size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[13px] font-black uppercase tracking-widest", text)}>
                    {viewUrlTrigger?.name || "Visual API"}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Endpoint URL for this Visual API.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>URL</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={viewUrlTrigger ? getWebhookUrl(viewUrlTrigger.slug) : ""}
                  className={cn(inputCls, "font-mono text-[11px] flex-1")}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => viewUrlTrigger && copyToClipboard(getWebhookUrl(viewUrlTrigger.slug))}
                  className={outlineBtn}
                  title="Copy"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>

            <div className={cn("flex justify-end pt-4 border-t", softBorder)}>
              <button onClick={() => setViewUrlTrigger(null)} className={outlineBtn}>
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rename Modal ── */}
      <Dialog open={!!renameTrigger} onOpenChange={(open) => { if (!open) { setRenameTrigger(null); setRenameValue(""); } }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Pencil size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[13px] font-black uppercase tracking-widest", text)}>
                    Rename Visual API
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Update the display name.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Name</label>
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && renameValue.trim() && renameMutation.mutate({ id: renameTrigger.id, name: renameValue.trim() })}
                className={inputCls}
                placeholder="Visual API name"
                autoFocus
              />
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => { setRenameTrigger(null); setRenameValue(""); }} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={() => renameMutation.mutate({ id: renameTrigger.id, name: renameValue.trim() })}
                disabled={!renameValue.trim() || renameMutation.isPending}
                className={primaryBtn}
              >
                {renameMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

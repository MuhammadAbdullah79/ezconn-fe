import { useState } from "react";
import {
  ChevronLeft,
  Plus,
  ExternalLink,
  Trash2,
  AlertCircle,
  Copy,
  Edit2,
  MessageCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export default function WebchatSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "manage">("list");
  const queryClient = useQueryClient();

  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white"
  );

  const { data: channels, isLoading } = useQuery({
    queryKey: ["/api/integrations/channels"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/channels");
      return res.json();
    },
  });

  const webchatInstances = channels?.webchat || [];
  const hasInstances = webchatInstances.length > 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: number | string) => {
      await apiRequest("DELETE", `/api/integrations/channels/webchat/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      toast({ title: "Deleted", description: "Webchat widget removed." });
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<any>(null);

  const handleConnect = () => {
    toast({ title: "Creating...", description: "Starting widget configuration." });
  };

  const copyEmbed = (id: string) => {
    const snippet = `<script src="https://ezconn.com/widget.js" data-id="${id}"></script>`;
    navigator.clipboard.writeText(snippet);
    toast({ title: "Copied", description: "Embed code copied to clipboard." });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-purple-500/15" : "bg-purple-500/10")}>
                <img src="/images/automations/webchat.svg" alt="Webchat" className="w-5 h-5" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>Webchat</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {view === "list"
                    ? "Create a Webchat interface for your website."
                    : "Create a Webchat interface that allows visitors to communicate with your business in real-time directly from a website."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {view === "manage" && (
                <>
                  <button onClick={handleConnect} className={primaryOutlineBtn}>
                    <Plus size={12} /> Add New
                  </button>
                  <button onClick={() => setView("list")} className={outlineBtn}>
                    <ChevronLeft size={12} /> Back
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="p-8">
              <div className={cn("p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-purple-500/40 flex flex-col", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <img src="/images/automations/webchat.svg" alt="Webchat" className="w-5 h-5" />
                    </div>
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>Webchat</h3>
                  </div>
                  <a
                    href="https://ezconn.com/docs/webchat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed mb-5 flex-1", sub)}>
                  Create a Webchat interface that allows visitors to communicate with your business in real-time.
                </p>

                <button onClick={() => setView("manage")} className={cn(primaryOutlineBtn, "self-end")}>
                  Manage
                </button>
              </div>
            </div>
          )}

          {/* ── MANAGE VIEW ── */}
          {view === "manage" && (
            <div className="p-8 space-y-5">
              {!hasInstances ? (
                <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <img src="/images/automations/webchat.svg" alt="Webchat" className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>No webchat instances found</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      Create a webchat widget to get started.
                    </p>
                  </div>
                  <button onClick={handleConnect} className={primaryOutlineBtn}>
                    <Plus size={12} /> Create Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {webchatInstances.map((instance: any) => (
                    <div key={instance.id} className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                      {/* Instance Header */}
                      <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-4", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                            <MessageCircle className="w-5 h-5 text-purple-500" />
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-[13px] font-black truncate", text)}>{instance.name || "Webchat Widget"}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="h-5 px-2 rounded-md border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                                ID: {instance.id}
                              </Badge>
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => copyEmbed(instance.id)}
                            className={outlineBtn}
                          >
                            <Copy size={12} /> Copy Embed
                          </button>
                          <button
                            onClick={() => toast({ title: "Edit", description: "Widget configuration." })}
                            className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary" : "border-slate-200 hover:border-primary/40 hover:text-primary")}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => { setInstanceToDelete(instance); setShowDeleteConfirm(true); }}
                            className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Delete Webchat Widget?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{instanceToDelete?.name || "This widget"}</span> will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { deleteMutation.mutate(instanceToDelete.id); setShowDeleteConfirm(false); }}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

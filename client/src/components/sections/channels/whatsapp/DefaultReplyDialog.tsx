import { useEffect, useMemo, useState } from "react";
import { Reply, ExternalLink, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Default auto-reply configuration per WhatsApp number. Mirrors replyagent's
 * "Default Reply" modal in `views/Workspaces/Settings/Whatsapp.vue`.
 *
 *   • Automation picker — choose any active automation in the workspace.
 *   • Trigger interval:
 *       0   → trigger once per contact, ever
 *       24  → trigger once per contact per 24 hours
 *       247 → trigger every inbound message (always)
 *
 * Backend route: `POST /api/whatsapp/autoreply/:number_id` with body
 * `{ auto_reply_automation_id, auto_reply_interval }`. Passing
 * `auto_reply_automation_id: null` clears the auto-reply.
 */
interface Props {
  open: boolean;
  number: any | null;
  onClose: () => void;
}

// Labels mirror replyagent (automation.trigger_auto_reply_once / _once_per_24 / _always).
const INTERVAL_OPTIONS = [
  { value: "0", label: "Once", description: "The default reply runs the first time this contact messages this number, ever." },
  { value: "24", label: "Once per 24h", description: "The default reply runs at most once per 24 hour window per contact." },
  { value: "247", label: "Always", description: "The default reply runs on every inbound message from this contact." },
];

export default function DefaultReplyDialog({ open, number, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const initialAutomationId = number?.auto_reply_automation_id ? String(number.auto_reply_automation_id) : "";
  const initialInterval = number?.auto_reply_interval ?? "247";

  const [automationId, setAutomationId] = useState<string>("");
  const [interval, setInterval] = useState<string>("247");

  useEffect(() => {
    if (open) {
      setAutomationId(initialAutomationId);
      setInterval(initialInterval);
    }
  }, [open, initialAutomationId, initialInterval]);

  // Pull the workspace's automations for the picker — Smart Flows backend
  // exposes them via `/api/automations`.
  const { data: automationsData } = useQuery({
    queryKey: ["/api/automations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/automations");
      return res.json();
    },
    enabled: open,
  });

  const automations: any[] = useMemo(() => {
    const raw = automationsData?.automations ?? automationsData?.data ?? automationsData ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [automationsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/autoreply/${number?.id}`, {
        auto_reply_automation_id: automationId || null,
        auto_reply_interval: interval,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? "Auto-reply saved" : "Could not save",
        description: data?.success ? "Default reply is now active for this number." : data?.message ?? "",
        variant: data?.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/autoreply/${number?.id}`, {
        auto_reply_automation_id: null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Auto-reply cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      onClose();
    },
  });

  if (!number) return null;

  const intervalDesc = INTERVAL_OPTIONS.find((o) => o.value === interval)?.description;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-3xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <Reply size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[14px] font-semibold", dark ? "text-white" : "text-slate-900")}>Instant replies</div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
                Pick a Smart Flow to run automatically whenever a contact messages{" "}
                <span className="font-mono">{number.display_phone_number}</span>.
              </p>
            </div>
          </div>

          {/* Automation picker + interval */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>
                Select automation
              </label>
              <select
                value={automationId}
                onChange={(e) => setAutomationId(e.target.value)}
                className={cn(
                  "w-full h-11 px-4 rounded-xl border text-[13px] font-bold focus:ring-2 focus:ring-primary/30 transition-all",
                  dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
                )}
              >
                <option value="">— Choose an automation —</option>
                {automations.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? `Automation #${a.id}`}
                  </option>
                ))}
              </select>
              {automationId && (
                <button
                  onClick={() => setLocation(`/automations/${automationId}`)}
                  className="text-[11px] font-bold text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Open automation <ExternalLink size={10} />
                </button>
              )}
            </div>
            <div className="space-y-2">
              <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>
                Trigger
              </label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className={cn(
                  "w-full h-11 px-4 rounded-xl border text-[13px] font-bold focus:ring-2 focus:ring-primary/30 transition-all",
                  dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
                )}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {intervalDesc && (
            <p className={cn("text-[11px] leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>{intervalDesc}</p>
          )}

          <p className={cn("text-[11px] leading-relaxed opacity-70", dark ? "text-slate-400" : "text-slate-600")}>
            Be aware that if a contact's conversation is marked as <strong>Done</strong> (in Live Chat or via Smart
            Flows), the default reply will trigger again on their next inbound message.
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {initialAutomationId && (
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                >
                  <Trash2 size={12} /> {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={saveMutation.isPending || deleteMutation.isPending}
                className={cn(
                  "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all",
                  dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400",
                )}
              >
                Close
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!automationId || saveMutation.isPending}
                className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

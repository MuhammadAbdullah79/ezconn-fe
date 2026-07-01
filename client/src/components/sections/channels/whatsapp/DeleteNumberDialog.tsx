import { useState, useEffect } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import DeletionGuard from "./DeletionGuard";

/**
 * Replyagent-parity confirmation for deleting a single WhatsApp phone number.
 *
 * Three mandatory checkboxes + type-to-confirm guard before Delete enables —
 * matches the safety flow in `views/Workspaces/Settings/Whatsapp.vue`:
 *   1. I understand removing this number breaks any flows / broadcasts using it
 *   2. I understand archived conversations will remain but no new ones will route here
 *   3. I understand this cannot be undone
 *
 * Backend route: `POST /api/whatsapp/delete-number/:number_id`.
 */
interface Props {
  open: boolean;
  number: any | null;
  onClose: () => void;
}

export default function DeleteNumberDialog({ open, number, onClose }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cb1, setCb1] = useState(false);
  const [cb2, setCb2] = useState(false);
  const [cb3, setCb3] = useState(false);
  const [guardOk, setGuardOk] = useState(false);

  useEffect(() => {
    if (!open) {
      setCb1(false);
      setCb2(false);
      setCb3(false);
      setGuardOk(false);
    }
  }, [open]);

  const valid = cb1 && cb2 && cb3 && guardOk;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/delete-number/${number?.id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? "Number deleted" : "Could not delete",
        description: data?.message ?? "",
        variant: data?.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
      onClose();
    },
  });

  if (!number) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-2xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 text-orange-500 mb-4">
              <AlertTriangle size={32} />
            </div>
            <div className={cn("text-base font-black tracking-tight", dark ? "text-white" : "text-slate-900")}>
              Delete this WhatsApp number?
            </div>
            <div className={cn("mt-2 text-[13px] font-mono", dark ? "text-emerald-400" : "text-emerald-600")}>
              {number.display_phone_number}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox id="dn1" checked={cb1} onCheckedChange={(c) => setCb1(!!c)} className="mt-1" />
              <label htmlFor="dn1" className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}>
                I understand that this number will be removed from the platform and any Smart Flows, broadcasts, or
                templates using it will fail until reconnected.
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="dn2" checked={cb2} onCheckedChange={(c) => setCb2(!!c)} className="mt-1" />
              <label htmlFor="dn2" className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}>
                I understand that previous conversations will be archived but no new messages will route through this
                number after deletion.
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="dn3" checked={cb3} onCheckedChange={(c) => setCb3(!!c)} className="mt-1" />
              <label htmlFor="dn3" className={cn("text-[12px] leading-relaxed cursor-pointer", dark ? "text-slate-300" : "text-slate-700")}>
                I understand that this action cannot be undone and re-connecting will require completing WhatsApp
                onboarding again.
              </label>
            </div>

            <p className="text-[11px] text-rose-500 font-bold leading-relaxed pt-1">
              Re-connecting the same number from Meta side may take up to 24 hours after deletion.
            </p>

            <DeletionGuard onValid={setGuardOk} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className={cn(
                "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all",
                dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400",
              )}
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!valid || mutation.isPending}
              className="h-10 px-5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-2 bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={12} /> {mutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

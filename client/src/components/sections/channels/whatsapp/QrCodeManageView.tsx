import { useEffect, useMemo, useRef, useState } from "react";
import {
  QrCode,
  Plus,
  MoreVertical,
  ArrowRightLeft,
  ReplyAll,
  Plug,
  PlugZap,
  Pencil,
  Trash2,
  Layers,
  ToggleLeft,
  RefreshCw,
  Copy as CopyIcon,
  CircleAlert,
  Check,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * QR Code (Z-API) manage view — full replyagent `Zapi.vue` parity.
 *
 * Backend routes:
 *   GET    /api/zapi/instances
 *   POST   /api/zapi/create-instance
 *   POST   /api/zapi/update-instance/:id    (rename / auto_reply / etc.)
 *   DELETE /api/zapi/delete-instance/:id
 *   POST   /api/zapi/connect-instance/:id   ({qr} or {connected})
 *   POST   /api/zapi/disconnect-instance/:id
 *   POST   /api/zapi/resubscribe-instance/:id   (restart)
 *   POST   /api/zapi/toggle-feeder/:id
 *   GET    /api/zapi/refresh-avatar/:id
 *   GET    /api/zapi/get-queue-items-count/:id
 *   DELETE /api/zapi/delete-queue-items/:id
 *
 * Mirrors replyagent's flow: instance list with avatar + status + provider
 * badge, 3-dot menu per instance (Migrate / Auto-reply / Connect / Disconnect /
 * Rename / Delete / Clear Queue / Feeder), create form, QR modal with 20s
 * auto-refresh polling, default-reply modal, multiple confirmation prompts.
 */

const MIGRATION_DEADLINE = new Date("2026-03-31T23:00:00Z");
const QR_REFRESH_MS = 20_000;

interface ZapiInstance {
  id: string | number;
  workspace_id?: string | number;
  name: string;
  code?: string | null;
  instance_id?: string | null;
  token?: string | null;
  status: string;
  provider?: string | null;
  phone_number?: string | null;
  profile_name?: string | null;
  profile_picture?: string | null;
  allow_in_feeder?: boolean;
  auto_reply_automation_id?: string | number | null;
  auto_reply_interval?: string | number;
  count?: number;
  migrated_at?: string | null;
}

interface Props {
  // ─── Design tokens passed down from parent so card styling stays consistent ───
  card: string;
  border: string;
  text: string;
  sub: string;
  softBg: string;
  softBorder: string;
  outlineBtn: string;
  inputCls: string;
  dark: boolean;
}

export default function QrCodeManageView({
  card,
  border,
  text,
  sub,
  softBg,
  softBorder,
  outlineBtn,
  inputCls,
  dark,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // ─── Local view state ───────────────────────────────────────────
  const [mode, setMode] = useState<"list" | "new">("list");

  // Create-instance form
  const [newName, setNewName] = useState("");
  const [newInstanceId, setNewInstanceId] = useState("");
  const [newToken, setNewToken] = useState("");
  const [newTerms, setNewTerms] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  // QR connection modal (with 20s polling)
  const [qrInstance, setQrInstance] = useState<ZapiInstance | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Default-reply modal
  const [drInstance, setDrInstance] = useState<ZapiInstance | null>(null);
  const [drAutomationId, setDrAutomationId] = useState<string | null>(null);
  const [drInterval, setDrInterval] = useState<string>("247");

  // Rename modal
  const [renameInstance, setRenameInstance] = useState<ZapiInstance | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  // Delete modal (with delete_media checkbox like replyagent)
  const [deleteInstance, setDeleteInstance] = useState<ZapiInstance | null>(null);
  const [deleteMedia, setDeleteMedia] = useState(false);

  // Confirmation prompts
  const [disconnectInstance, setDisconnectInstance] = useState<ZapiInstance | null>(null);
  const [clearQueueInstance, setClearQueueInstance] = useState<ZapiInstance | null>(null);

  // Avatar error tracking (which instance ids have failed avatars)
  const [avatarFailed, setAvatarFailed] = useState<Set<string>>(new Set());

  // Live migration countdown (legacy → uazapi by MIGRATION_DEADLINE)
  const [countdown, setCountdown] = useState(() => deadlineDelta());

  // ─── Data ──────────────────────────────────────────────────────
  const { data: instances = [] } = useQuery<ZapiInstance[]>({
    queryKey: ["/api/zapi/instances"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/zapi/instances");
      const json = await res.json();
      return Array.isArray(json) ? json : json?.instances ?? [];
    },
    refetchInterval: 30_000,
  });

  // Automations list for the AutomationPicker dropdown in the default-reply
  // modal. Source: workspace automation library.
  const { data: automationsRaw } = useQuery<any>({
    queryKey: ["/api/automations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/automations");
      return res.json();
    },
    enabled: !!drInstance,
  });
  const automations: any[] = useMemo(() => {
    if (!automationsRaw) return [];
    if (Array.isArray(automationsRaw)) return automationsRaw;
    if (Array.isArray(automationsRaw?.automations)) return automationsRaw.automations;
    return [];
  }, [automationsRaw]);

  // ─── Mutations ─────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const res = await apiRequest("POST", "/api/zapi/create-instance", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
      toast({ title: "Instance created", description: "QR Code instance ready to connect." });
      resetCreateForm();
      setMode("list");
    },
    onError: (e: any) => {
      toast({ title: "Error", description: extractMsg(e) ?? "Could not create instance.", variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (payload: { id: string | number; name: string }) => {
      const res = await apiRequest("POST", `/api/zapi/update-instance/${payload.id}`, {
        name: payload.name,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
      toast({ title: "Renamed", description: "Instance name updated." });
      setRenameInstance(null);
      setRenameValue("");
      setRenameError(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: extractMsg(e) ?? "Could not rename.", variant: "destructive" });
    },
  });

  const autoReplyMutation = useMutation({
    mutationFn: async (payload: {
      id: string | number;
      auto_reply_automation_id: string | null;
      auto_reply_interval: string;
    }) => {
      const res = await apiRequest("POST", `/api/zapi/update-instance/${payload.id}`, {
        auto_reply_automation_id: payload.auto_reply_automation_id,
        auto_reply_interval: payload.auto_reply_interval,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
      toast({ title: "Saved", description: "Auto-reply updated." });
      setDrInstance(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: extractMsg(e) ?? "Could not update auto-reply.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      // Send the delete-media choice (replyagent passes delete_media in the body).
      await apiRequest("DELETE", `/api/zapi/delete-instance/${id}`, { delete_media: deleteMedia });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
      toast({ title: "Deleted", description: "Instance removed." });
      setDeleteInstance(null);
      setDeleteMedia(false);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: extractMsg(e) ?? "Could not delete.", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("POST", `/api/zapi/disconnect-instance/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
      toast({ title: "Disconnected", description: "Instance disconnected." });
      setDisconnectInstance(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: extractMsg(e) ?? "Could not disconnect.", variant: "destructive" });
    },
  });

  const feederMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("POST", `/api/zapi/toggle-feeder/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
    },
  });

  const queueCountMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("GET", `/api/zapi/get-queue-items-count/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
    },
  });

  const clearQueueMutation = useMutation({
    mutationFn: async (id: string | number) => {
      await apiRequest("DELETE", `/api/zapi/delete-queue-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
      toast({ title: "Queue cleared" });
      setClearQueueInstance(null);
    },
  });

  const avatarRefreshMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("GET", `/api/zapi/refresh-avatar/${id}`);
      return res.json();
    },
    onSuccess: (_data, id) => {
      setAvatarFailed((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
    },
  });

  // ─── Effects ─────────────────────────────────────────────────────
  // Live countdown ticker for the migration banner.
  useEffect(() => {
    const i = setInterval(() => setCountdown(deadlineDelta()), 1_000);
    return () => clearInterval(i);
  }, []);

  // QR auto-refresh — when the connection modal is open, poll every 20s
  // (mirrors replyagent's `connection.refresh` + `setInterval`).
  useEffect(() => {
    if (!qrInstance) {
      if (qrIntervalRef.current) {
        clearInterval(qrIntervalRef.current);
        qrIntervalRef.current = null;
      }
      return;
    }
    fetchQr(qrInstance);
    qrIntervalRef.current = setInterval(() => fetchQr(qrInstance), QR_REFRESH_MS);
    return () => {
      if (qrIntervalRef.current) {
        clearInterval(qrIntervalRef.current);
        qrIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrInstance?.id]);

  // ─── Helpers ─────────────────────────────────────────────────────
  function resetCreateForm() {
    setNewName("");
    setNewInstanceId("");
    setNewToken("");
    setNewTerms(false);
    setNameError(null);
    setTermsError(null);
  }

  function deadlineDelta() {
    const now = Date.now();
    const diff = MIGRATION_DEADLINE.getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    return {
      days: Math.floor(diff / 86_400_000),
      hours: Math.floor((diff / 3_600_000) % 24),
      minutes: Math.floor((diff / 60_000) % 60),
      seconds: Math.floor((diff / 1_000) % 60),
      expired: false,
    };
  }

  // Replyagent's `charactersOnly` keydown filter: allow only letters + space/tab/backspace.
  function charactersOnly(e: React.KeyboardEvent<HTMLInputElement>) {
    const key = e.key;
    if (key.length === 1 && !/[A-Za-z ]/.test(key)) {
      e.preventDefault();
    }
  }

  function extractMsg(e: any): string | undefined {
    const body = e?.body ?? null;
    const inner = body?.message && typeof body.message === "object" ? body.message : body;
    return inner?.message ?? body?.message ?? e?.message;
  }

  async function fetchQr(instance: ZapiInstance) {
    setQrLoading(true);
    try {
      const res = await apiRequest("POST", `/api/zapi/connect-instance/${instance.id}`);
      const json = await res.json();
      if (json?.connected) {
        // Instance just paired — close modal + refresh list.
        setQrInstance(null);
        setQrImage(null);
        queryClient.invalidateQueries({ queryKey: ["/api/zapi/instances"] });
        toast({ title: "Connected", description: `${instance.name} is now live.` });
        return;
      }
      if (json?.qr) {
        // Backend returns either an image URL or a base64 data URL.
        setQrImage(typeof json.qr === "string" ? json.qr : json.qr?.value ?? null);
      }
    } catch (e: any) {
      toast({
        title: "Connection failed",
        description: extractMsg(e) ?? "Could not get QR code.",
        variant: "destructive",
      });
    } finally {
      setQrLoading(false);
    }
  }

  function handleCreate() {
    setNameError(null);
    setTermsError(null);
    if (!newName.trim()) {
      setNameError("Instance name is required");
      return;
    }
    if (!newTerms) {
      setTermsError("Please accept the Z-API terms");
      return;
    }
    // Name only — the backend provisions the Z-API instance on demand
    // (replyagent: createInstance(name) → instance_id + token generated).
    createMutation.mutate({ name: newName.trim() });
  }

  function openDefaultReply(instance: ZapiInstance) {
    setDrInstance(instance);
    setDrAutomationId(instance.auto_reply_automation_id ? String(instance.auto_reply_automation_id) : null);
    setDrInterval(String(instance.auto_reply_interval ?? "247"));
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied" });
  }

  // ─── Render helpers ─────────────────────────────────────────────
  const hasLegacyInstances = instances.some((i) => (i.provider ?? "zapi") === "zapi");

  function statusBadge(status: string) {
    const s = String(status ?? "").toUpperCase();
    if (s === "CONNECTED") {
      return (
        <Badge variant="outline" className="h-5 px-2 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
          Connected
        </Badge>
      );
    }
    if (s === "PENDING" || s === "DISCONNECTED") {
      return (
        <Badge variant="outline" className="h-5 px-2 rounded-md border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
          Disconnected
        </Badge>
      );
    }
    if (s === "FAILED") {
      return (
        <Badge variant="outline" className="h-5 px-2 rounded-md border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 text-[10px] font-semibold">
          Failed
        </Badge>
      );
    }
    if (s === "DELETING" || s === "DELETED") return null;
    return (
      <Badge variant="outline" className="h-5 px-2 rounded-md border-slate-300 bg-slate-50 text-slate-600 text-[10px] font-semibold">
        {s.toLowerCase()}
      </Badge>
    );
  }

  function providerBadge(provider: string | null | undefined) {
    const p = (provider ?? "zapi").toLowerCase();
    if (p === "uazapi") {
      return (
        <Badge variant="outline" className="h-5 px-2 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
          New
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="h-5 px-2 rounded-md border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
        Legacy
      </Badge>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6">
      {/* Mode-list header */}
      {mode === "list" && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className={cn("text-[16px] font-semibold", text)}>
              Z-API instances
            </h2>
            <p className={cn("text-[11px] font-bold opacity-60 mt-0.5", sub)}>
              Scan a QR code from WhatsApp to bring a number online.
            </p>
          </div>
          <button
            onClick={() => {
              resetCreateForm();
              setMode("new");
            }}
            className="h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <Plus size={12} /> Create instance
          </button>
        </div>
      )}

      {/* Migration banner — only shows while a legacy instance still exists AND the deadline hasn't passed. */}
      {mode === "list" && hasLegacyInstances && !countdown.expired && (
        <div className={cn("rounded-2xl border p-4 flex items-center gap-4", "border-rose-500/30 bg-rose-500/5")}>
          <CircleAlert size={20} className="text-rose-500 shrink-0" />
          <div className="grow">
            <p className="text-[13px] font-black text-rose-700 dark:text-rose-300">Action required: migrate legacy Z-API instances</p>
            <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-0.5">
              Z-API legacy provider is being retired. Migrate to the UAZAPI provider before the deadline below.
            </p>
          </div>
          <div className="text-right whitespace-nowrap">
            <div className="flex items-center gap-1.5 font-mono font-black text-rose-600">
              {(["days", "hours", "minutes", "seconds"] as const).map((u) => (
                <span key={u} className="px-2 py-1 rounded bg-rose-100 dark:bg-rose-900/40 text-[11px]">
                  {String((countdown as any)[u]).padStart(2, "0")}
                  {u === "days" ? "d" : u === "hours" ? "h" : u === "minutes" ? "m" : "s"}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-rose-500/70 mt-1">Deadline 31 Mar 2026 23:00 UTC</p>
          </div>
        </div>
      )}

      {/* Instance list */}
      {mode === "list" && (
        instances.length === 0 ? (
          <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className={cn("text-[14px] font-black tracking-tight", text)}>No instances yet</h3>
              <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                Create your first Z-API instance to start connecting WhatsApp numbers via QR.
              </p>
            </div>
            <button
              onClick={() => {
                resetCreateForm();
                setMode("new");
              }}
              className="h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
            >
              <Plus size={12} /> Create instance
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {instances.map((instance) => {
              const provider = (instance.provider ?? "zapi").toLowerCase();
              const isLegacy = provider === "zapi";
              const failed = avatarFailed.has(String(instance.id));
              const s = String(instance.status ?? "").toUpperCase();
              return (
                <div
                  key={instance.id}
                  className={cn("rounded-[1.5rem] border p-6 flex items-start gap-6", softBg, softBorder)}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {instance.profile_picture && !failed ? (
                      <img
                        src={instance.profile_picture}
                        alt={instance.name}
                        onError={() =>
                          setAvatarFailed((prev) => new Set(prev).add(String(instance.id)))
                        }
                        className={cn("w-24 h-24 rounded-2xl object-cover border", softBorder)}
                      />
                    ) : (
                      <div className={cn("w-24 h-24 rounded-2xl border flex items-center justify-center", softBorder, dark ? "bg-slate-900/40" : "bg-white")}>
                        <QrCode size={36} className="text-primary" />
                      </div>
                    )}
                    {failed && (
                      <button
                        onClick={() => avatarRefreshMutation.mutate(instance.id)}
                        className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center text-white text-[11px] font-black"
                      >
                        <RefreshCw
                          size={18}
                          className={cn(avatarRefreshMutation.isPending && "animate-spin")}
                        />
                      </button>
                    )}
                  </div>

                  {/* Details column */}
                  <div className="grow space-y-4">
                    {/* Name + status row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className={cn("text-[15px] font-black", text)}>{instance.name}</p>
                      {statusBadge(instance.status)}
                      {providerBadge(instance.provider)}
                      <div className="grow" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}>
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-52", card, border)}>
                          {isLegacy && s !== "DELETING" && s !== "DELETED" && (
                            <DropdownMenuItem
                              className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-amber-600 focus:text-amber-600 focus:bg-amber-500/10"
                              onClick={() =>
                                toast({
                                  title: "Migration not available",
                                  description: "Migrate-to-UAZAPI endpoint must be enabled in this environment.",
                                })
                              }
                            >
                              <ArrowRightLeft size={13} /> Migrate to UAZAPI
                            </DropdownMenuItem>
                          )}
                          {s === "CONNECTED" && (
                            <DropdownMenuItem
                              className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                              onClick={() => openDefaultReply(instance)}
                            >
                              <ReplyAll size={13} /> Auto-reply
                            </DropdownMenuItem>
                          )}
                          {(s === "PENDING" || s === "DISCONNECTED") && (
                            <DropdownMenuItem
                              className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                              onClick={() => {
                                setQrInstance(instance);
                                setQrImage(null);
                              }}
                            >
                              <Plug size={13} /> Connect
                            </DropdownMenuItem>
                          )}
                          {s === "CONNECTED" && (
                            <DropdownMenuItem
                              className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                              onClick={() => setDisconnectInstance(instance)}
                            >
                              <PlugZap size={13} /> Disconnect
                            </DropdownMenuItem>
                          )}
                          {["PENDING", "CONNECTED", "DISCONNECTED"].includes(s) && (
                            <DropdownMenuItem
                              className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                              onClick={() => {
                                setRenameInstance(instance);
                                setRenameValue(instance.name);
                                setRenameError(null);
                              }}
                            >
                              <Pencil size={13} /> Rename
                            </DropdownMenuItem>
                          )}
                          {s !== "DELETING" && s !== "DELETED" && (
                            <DropdownMenuItem
                              className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                              onClick={() => {
                                setDeleteInstance(instance);
                                setDeleteMedia(false);
                              }}
                            >
                              <Trash2 size={13} /> Delete
                            </DropdownMenuItem>
                          )}
                          {s === "DISCONNECTED" && (
                            <DropdownMenuItem
                              className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                              onClick={() => setClearQueueInstance(instance)}
                            >
                              <Layers size={13} /> Clear Queue
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                            onSelect={(e) => {
                              e.preventDefault();
                              feederMutation.mutate(instance.id);
                            }}
                          >
                            <ToggleLeft size={13} /> Enable AI Feeder
                            <Switch
                              checked={!!instance.allow_in_feeder}
                              onCheckedChange={() => feederMutation.mutate(instance.id)}
                              className="ml-auto data-[state=checked]:bg-primary"
                            />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Code field (read-only + copy) */}
                    {instance.code && (
                      <div className={cn("flex items-center gap-2 p-3 rounded-xl border", softBorder, dark ? "bg-slate-900/40" : "bg-white")}>
                        <span className={cn("text-[11px] font-semibold", sub)}>Code</span>
                        <code className={cn("text-[12px] font-mono font-bold flex-1 truncate", text)}>{instance.code}</code>
                        <button
                          onClick={() => copyCode(instance.code!)}
                          className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-primary" : "hover:bg-slate-100 text-primary")}
                        >
                          <CopyIcon size={11} />
                        </button>
                      </div>
                    )}

                    {/* Phone number */}
                    {instance.phone_number && (
                      <div className={cn("flex items-center gap-2 p-3 rounded-xl border", softBorder, dark ? "bg-slate-900/40" : "bg-white")}>
                        <span className={cn("text-[11px] font-semibold", sub)}>Phone</span>
                        <span className={cn("text-[12px] font-bold", text)}>{instance.phone_number}</span>
                      </div>
                    )}

                    {/* Queue count */}
                    <div className={cn("flex items-center gap-2 p-3 rounded-xl border", softBorder, dark ? "bg-slate-900/40" : "bg-white")}>
                      <span className={cn("text-[11px] font-semibold", sub)}>Queue</span>
                      {queueCountMutation.isPending && queueCountMutation.variables === instance.id ? (
                        <Loader2 size={14} className="animate-spin text-primary" />
                      ) : typeof instance.count !== "undefined" ? (
                        <span className={cn("text-[12px] font-bold", text)}>{instance.count}</span>
                      ) : (
                        <button
                          onClick={() => queueCountMutation.mutate(instance.id)}
                          className={cn(outlineBtn, "h-8 px-3")}
                        >
                          <RefreshCw size={11} /> Get count
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ─── Create-instance form ──────────────────────────────── */}
      {mode === "new" && (
        <div className={cn("rounded-[1.5rem] border p-6 space-y-5", softBg, softBorder)}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={cn("text-[15px] font-semibold", text)}>Create instance</h3>
              <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>Enter a friendly name and Z-API credentials.</p>
            </div>
            <button
              onClick={() => {
                resetCreateForm();
                setMode("list");
              }}
              className={outlineBtn}
            >
              <X size={12} /> Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={cn("text-[11px] font-semibold", sub)}>Instance name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 50))}
                onKeyDown={charactersOnly}
                maxLength={50}
                placeholder="Sales WhatsApp"
                className={inputCls}
              />
              {nameError && <p className="text-rose-500 text-[11px] font-bold">{nameError}</p>}
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={newTerms}
              onChange={(e) => {
                setNewTerms(e.target.checked);
                if (e.target.checked) setTermsError(null);
              }}
              className="mt-1 accent-[hsl(var(--primary))]"
            />
            <span className={cn("text-[12px] font-medium", text)}>
              I accept the Z-API <a href="https://z-api.io/terms" target="_blank" rel="noopener" className="text-primary underline">terms of service</a>
              and understand that Z-API is a third-party provider not affiliated with WhatsApp.
            </span>
          </label>
          {termsError && <p className="text-rose-500 text-[11px] font-bold">{termsError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                resetCreateForm();
                setMode("list");
              }}
              className={outlineBtn}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[11px] font-semibold flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Creating
                </>
              ) : (
                <>
                  <Plus size={12} /> Create
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── QR connection modal ──────────────────────────────── */}
      <Dialog open={!!qrInstance} onOpenChange={(open) => { if (!open) { setQrInstance(null); setQrImage(null); } }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <QrCode size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    Scan to connect
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Open WhatsApp on your phone → Linked devices → Link a device.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className={cn("rounded-2xl border p-6 flex items-center justify-center min-h-[260px]", softBorder, dark ? "bg-slate-950/40" : "bg-slate-50")}>
              {qrLoading && !qrImage ? (
                <Loader2 size={32} className="animate-spin text-primary" />
              ) : qrImage ? (
                <img src={qrImage} alt="QR" className="w-56 h-56 object-contain" />
              ) : (
                <p className={cn("text-[12px] font-medium", sub)}>Waiting for QR…</p>
              )}
            </div>

            <div className={cn("flex items-start gap-3 p-3 rounded-xl border text-[11px] font-medium", "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300")}>
              <CircleAlert size={14} className="shrink-0 mt-0.5" />
              <span>The QR refreshes automatically every 20 seconds. Keep this window open until the scan completes.</span>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => qrInstance && fetchQr(qrInstance)}
                className={outlineBtn}
                disabled={qrLoading}
              >
                <RefreshCw size={12} className={cn(qrLoading && "animate-spin")} /> Refresh
              </button>
              <button
                onClick={() => { setQrInstance(null); setQrImage(null); }}
                className="h-11 px-6 rounded-xl bg-primary text-white text-[11px] font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Default Reply modal (AutomationPicker + interval) ──────── */}
      <Dialog open={!!drInstance} onOpenChange={(open) => { if (!open) setDrInstance(null); }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-2xl", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ReplyAll size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    Default Auto-reply
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Choose which automation triggers when a visitor messages this instance.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className={cn("text-[11px] font-semibold", sub)}>Select automation</label>
                <select
                  value={drAutomationId ?? ""}
                  onChange={(e) => setDrAutomationId(e.target.value || null)}
                  className={inputCls}
                >
                  <option value="">— No automation —</option>
                  {automations.map((a: any) => (
                    <option key={a.id} value={String(a.id)}>{a.name ?? `Automation #${a.id}`}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className={cn("text-[11px] font-semibold", sub)}>Trigger</label>
                <select
                  value={drInterval}
                  onChange={(e) => setDrInterval(e.target.value)}
                  className={inputCls}
                >
                  <option value="0">Once per contact</option>
                  <option value="24">Once per 24h</option>
                  <option value="247">Always</option>
                </select>
              </div>
            </div>

            <p className={cn("text-[11px] font-medium leading-relaxed", sub)}>
              {drInterval === "0" && "The automation runs ONCE for every contact — even if they message again later."}
              {drInterval === "24" && "The automation runs ONCE per 24-hour window per contact."}
              {drInterval === "247" && "The automation runs on EVERY incoming message from any contact."}
            </p>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              {drInstance?.auto_reply_automation_id && (
                <>
                  {/* View Automation — open the linked automation (replyagent parity). */}
                  <button
                    onClick={() => {
                      const aid = drAutomationId ?? drInstance?.auto_reply_automation_id;
                      if (aid) { setDrInstance(null); setLocation(`/automations/${aid}`); }
                    }}
                    className="h-11 px-6 rounded-xl border border-primary/30 text-primary hover:bg-primary/5 text-[11px] font-semibold flex items-center gap-2"
                  >
                    <ExternalLink size={12} /> View Automation
                  </button>
                  <button
                    onClick={() =>
                      drInstance &&
                      autoReplyMutation.mutate({
                        id: drInstance.id,
                        auto_reply_automation_id: null,
                        auto_reply_interval: drInterval,
                      })
                    }
                    className="h-11 px-6 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/5 text-[11px] font-semibold flex items-center gap-2"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </>
              )}
              <button onClick={() => setDrInstance(null)} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={() =>
                  drInstance &&
                  autoReplyMutation.mutate({
                    id: drInstance.id,
                    auto_reply_automation_id: drAutomationId,
                    auto_reply_interval: drInterval,
                  })
                }
                disabled={autoReplyMutation.isPending}
                className="h-11 px-7 rounded-xl bg-primary text-white text-[11px] font-semibold flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                {autoReplyMutation.isPending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Saving
                  </>
                ) : (
                  <>
                    <Check size={12} /> Save
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Rename modal ─────────────────────────────────────── */}
      <Dialog open={!!renameInstance} onOpenChange={(open) => { if (!open) setRenameInstance(null); }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                  <Pencil size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>Rename instance</DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Letters only, max 50 characters.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-2">
              <input
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value.slice(0, 50));
                  setRenameError(null);
                }}
                onKeyDown={charactersOnly}
                maxLength={50}
                className={inputCls}
                autoFocus
              />
              {renameError && <p className="text-rose-500 text-[11px] font-bold">{renameError}</p>}
            </div>
            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => setRenameInstance(null)} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!renameValue.trim()) {
                    setRenameError("Name is required");
                    return;
                  }
                  renameMutation.mutate({ id: renameInstance!.id, name: renameValue.trim() });
                }}
                disabled={renameMutation.isPending}
                className="h-11 px-7 rounded-xl bg-primary text-white text-[11px] font-semibold flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                {renameMutation.isPending ? "Saving" : "Save"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirmation ───────────────────────────────── */}
      <AlertDialog open={!!deleteInstance} onOpenChange={(open) => !open && setDeleteInstance(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <CircleAlert size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Delete instance?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{deleteInstance?.name}</span> will be removed and its chats will stop syncing.
                </p>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteMedia}
                onChange={(e) => setDeleteMedia(e.target.checked)}
                className="mt-1 accent-[hsl(var(--primary))]"
              />
              <span className={cn("text-[12px] font-medium", text)}>
                Also delete all media files attached to this instance from storage.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteInstance && deleteMutation.mutate(deleteInstance.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold flex items-center gap-2 shadow-lg shadow-rose-500/20"
              >
                <Trash2 size={12} /> Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Disconnect prompt ───────────────────────────────── */}
      <AlertDialog open={!!disconnectInstance} onOpenChange={(open) => !open && setDisconnectInstance(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <PlugZap size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Disconnect instance?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                  The number will stop receiving WhatsApp messages until you scan the QR again.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  disconnectInstance && disconnectMutation.mutate(disconnectInstance.id)
                }
                className="h-11 px-7 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold flex items-center gap-2"
              >
                Disconnect
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Clear queue prompt ───────────────────────────────── */}
      <AlertDialog open={!!clearQueueInstance} onOpenChange={(open) => !open && setClearQueueInstance(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <Layers size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Clear queued items?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                  All pending outgoing messages waiting in this instance's queue will be deleted permanently.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>No</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  clearQueueInstance && clearQueueMutation.mutate(clearQueueInstance.id)
                }
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold flex items-center gap-2"
              >
                Yes, clear
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

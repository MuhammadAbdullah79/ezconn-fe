import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  MoreVertical,
  Trash2,
  Plus,
  Phone,
  Bot,
  Activity,
  AlertCircle,
  Smartphone,
  Zap,
  ExternalLink,
  QrCode,
  Check,
  RotateCw,
  ReplyAll,
  Sparkles,
  Eye,
  EyeOff,
  Copy as CopyIcon,
  BadgeCheck,
  Info,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Gauge,
  RefreshCcw,
  Repeat,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { useSocket } from "@/hooks/use-socket";

import DeleteAccountDialog from "./whatsapp/DeleteAccountDialog";
import DeleteNumberDialog from "./whatsapp/DeleteNumberDialog";
import ReconnectNumberDialog from "./whatsapp/ReconnectNumberDialog";
import DefaultReplyDialog from "./whatsapp/DefaultReplyDialog";
import LimitReachedDialog from "./whatsapp/LimitReachedDialog";
import QrCodeManageView from "./whatsapp/QrCodeManageView";

type ViewMode = "list" | "coex_manage" | "api_manage" | "qr_manage";

// ─── Meta FB JS SDK loader ──────────────────────────────────────────
//
// Meta's WhatsApp Embedded Signup is exposed as an `FB.login(...)` call
// configured with the app's Embedded Signup `config_id`. Loading the
// SDK is a one-shot side effect, so the loader memoises the in-flight
// promise on `window` and returns it on subsequent calls.

let _fbSdkPromise: Promise<void> | null = null;

function loadFacebookSdk(appId: string, version: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).FB) return Promise.resolve();
  if (_fbSdkPromise) return _fbSdkPromise;

  _fbSdkPromise = new Promise<void>((resolve, reject) => {
    (window as any).fbAsyncInit = () => {
      try {
        (window as any).FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version,
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    const id = "facebook-jssdk";
    if (document.getElementById(id)) return; // script already injected
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.onerror = () => reject(new Error("Failed to load Facebook SDK."));
    document.body.appendChild(s);
  });
  return _fbSdkPromise;
}

interface EmbeddedSignupResult {
  code: string;
  waba_id?: string;
  phone_number_id?: string;
  business_id?: string;
  user_id?: string;
}

/**
 * Calls `FB.login` with WhatsApp Embedded Signup options and resolves with
 * the combined OAuth code + WABA metadata once Meta posts the
 * `WA_EMBEDDED_SIGNUP` FINISH event. Rejects with `code: 'USER_CANCELLED'`
 * if the user closes the popup.
 */
function launchEmbeddedSignup(configId: string): Promise<EmbeddedSignupResult> {
  return new Promise((resolve, reject) => {
    const FB = (window as any).FB;
    if (!FB) {
      reject(new Error("Facebook SDK is not initialised."));
      return;
    }

    let signupData: Partial<EmbeddedSignupResult> = {};
    let cancelled = false;

    const onMessage = (event: MessageEvent) => {
      // Meta posts from `https://www.facebook.com` (or regional variants).
      if (typeof event.origin !== "string" || !/^https:\/\/([a-z-]+\.)?facebook\.com$/.test(event.origin)) {
        return;
      }
      try {
        const parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (parsed?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (parsed.event === "FINISH") {
          signupData = {
            ...signupData,
            waba_id: parsed.data?.waba_id,
            phone_number_id: parsed.data?.phone_number_id,
            business_id: parsed.data?.business_id,
            user_id: parsed.data?.user_id,
          };
        } else if (parsed.event === "CANCEL") {
          cancelled = true;
        }
      } catch {
        // Non-JSON or unrelated message — ignore.
      }
    };
    window.addEventListener("message", onMessage);

    FB.login(
      (response: any) => {
        window.removeEventListener("message", onMessage);
        if (cancelled) {
          const err: any = new Error("User cancelled the sign-up.");
          err.code = "USER_CANCELLED";
          reject(err);
          return;
        }
        const code = response?.authResponse?.code;
        if (!code) {
          const err: any = new Error("Meta did not return an authorisation code.");
          err.code = "NO_CODE";
          reject(err);
          return;
        }
        resolve({ code, ...signupData });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          feature: "whatsapp_embedded_signup",
          sessionInfoVersion: 3,
        },
      },
    );
  });
}

/**
 * WhatsApp channel management — replyagent parity rewrite.
 *
 * Layout mirrors the EZCONN "3 cards + Manage panel" structure (Coex /
 * Business API / QR Code) but the copy, the per-card prerequisites box,
 * the setup-difficulty indicator, and every per-account/per-number action
 * are wired to the new backend endpoints:
 *
 *   GET    /api/whatsapp/accounts?with=phoneNumbers,capi&onboard_platform=…
 *   POST   /api/whatsapp/profiles
 *   POST   /api/whatsapp/onboard          (Embed Signup return)
 *   POST   /api/whatsapp/onboard-manual   (manual credentials)
 *   POST   /api/whatsapp/delete/:id       (with delete_folder + delete_templates)
 *   POST   /api/whatsapp/delete-number/:id
 *   POST   /api/whatsapp/reconnect/:id
 *   POST   /api/whatsapp/autoreply/:id    (default reply automation)
 *   PUT    /api/whatsapp/toggle-feeder/:id
 *   GET    /api/whatsapp/capi/:account_id (CAPI dataset bound to account)
 *
 * Coex variant → `onboard_platform=whatsapp_business_app`; API variant →
 * `onboard_platform=whatsapp_business` (default). The Meta Embed Signup
 * popup redirects to `/settings/whatsapp-onboard` (a dedicated page that
 * parses Meta's hash response and dispatches the right backend call).
 */
export default function WhatsAppSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v === "coex") return "coex_manage";
    if (v === "api") return "api_manage";
    if (v === "qr") return "qr_manage";
    return "list";
  });

  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary",
  );

  // ─── Account data ────────────────────────────────────────────────

  // Use the new replyagent-compatible endpoint that returns
  // `{ wa: [{ ...account, phone_numbers, capi }] }`. We filter client-side
  // by onboard_platform so a single fetch powers both manage tabs.
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/whatsapp/accounts?with=phoneNumbers,capi");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const allAccounts: any[] = useMemo(() => accountsData?.wa ?? [], [accountsData]);
  const coexAccounts = useMemo(
    () => allAccounts.filter((a) => a.onboard_platform === "whatsapp_business_app"),
    [allAccounts],
  );
  const apiAccounts = useMemo(
    () => allAccounts.filter((a) => a.onboard_platform !== "whatsapp_business_app"),
    [allAccounts],
  );

  // Workspace WhatsApp channel limit — backend returns { limit, used, can_add }.
  // We pre-check this before launching the Meta Embedded Signup popup so the
  // user sees an in-app limit-reached prompt instead of having Meta reject
  // the registration. Falls back to 4 if the endpoint hasn't responded yet.
  const { data: limitsData } = useQuery({
    queryKey: ["/api/whatsapp/limits"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/whatsapp/limits");
      return res.json();
    },
  });
  const channelsLimit: number = limitsData?.limit ?? 4;
  const hasReachedLimit: boolean = limitsData ? !limitsData.can_add : false;

  // ─── Dialog state ────────────────────────────────────────────────

  const [showAddNumberDialog, setShowAddNumberDialog] = useState(false);
  const [showManualConnectDialog, setShowManualConnectDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  const [numberToDelete, setNumberToDelete] = useState<any>(null);
  const [numberToReconnect, setNumberToReconnect] = useState<any>(null);
  const [numberForDefaultReply, setNumberForDefaultReply] = useState<any>(null);
  const [accountForCapi, setAccountForCapi] = useState<any>(null);
  const [numberToRegister, setNumberToRegister] = useState<any>(null);

  const [newNumberData, setNewNumberData] = useState({
    phoneNumber: "",
    purposeType: "automated" as "automated" | "notification",
  });

  // Manual onboarding form
  const emptyManualForm = {
    waba_id: "",
    name: "",
    access_token: "",
    phone_number_id: "",
    display_phone_number: "",
    verified_name: "",
  };
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});

  // ─── Realtime: refresh on whatsapp.account_updated / number_updated ──

  const workspaceId = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_info");
      if (!raw) return 1;
      const parsed = JSON.parse(raw);
      const wsId = parsed?.workspace_id ?? parsed?.modelable_id ?? 1;
      return Number(wsId) || 1;
    } catch {
      return 1;
    }
  }, []);
  const socket = useSocket(workspaceId);

  useEffect(() => {
    if (!socket) return;
    // When the backend emits "whatsapp.account_updated" /
    // "whatsapp.number_updated" to the workspace room, refetch the channels
    // list so the UI reflects the latest status (PENDING→ACTIVE flips, name
    // approval changes, AI Feeder toggles from another tab, etc.).
    const refetch = () =>
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
    socket.on("whatsapp.account_updated", refetch);
    socket.on("whatsapp.number_updated", refetch);
    return () => {
      socket.off("whatsapp.account_updated", refetch);
      socket.off("whatsapp.number_updated", refetch);
    };
  }, [socket, queryClient]);

  // ─── Connect handlers ────────────────────────────────────────────

  const [isConnecting, setIsConnecting] = useState(false);

  /**
   * "Add New" → Meta WhatsApp Embedded Signup via FB JavaScript SDK.
   *
   * Replyagent used to redirect to its own `fb.replyagent.com` proxy page
   * which loaded the FB SDK on a whitelisted domain. We now load the SDK
   * inline because EZCONN's frontend origin (`http://localhost:5173` in dev,
   * `https://<prod-domain>` later) can be added to the Meta app's "Allowed
   * Domains for the JavaScript SDK" list directly.
   *
   * Flow:
   *   1. Lazy-load Meta FB SDK (script tag) and `FB.init` with our App ID.
   *   2. Attach a `message` listener for `WA_EMBEDDED_SIGNUP` events — this
   *      is how Meta hands back the `phone_number_id` + `waba_id` +
   *      `business_id` (these are NOT in the OAuth response).
   *   3. Call `FB.login(..., { config_id, response_type: 'code',
   *      override_default_response_type: true, extras })`. The user picks
   *      their WABA in the popup.
   *   4. On the callback fire, combine `authResponse.code` with the values
   *      captured from the message listener, then POST to
   *      `/api/whatsapp/onboard` with the replyagent contract
   *      (`_c`/`_w`/`_p`/`_u`/`_b`/`_s`) the backend already expects.
   *   5. Refetch the accounts list so the new WABA appears in the manage
   *      panel without a hard reload.
   *
   * `source = 'aka'` → backend sets `onboard_platform=whatsapp_business_app`
   * (Coexistence). `'api'` → standard Cloud API onboarding.
   */
  const openEmbeddedSignup = async (source?: "aka" | "api") => {
    if (hasReachedLimit) {
      setShowLimitDialog(true);
      return;
    }

    // Direct `import.meta.env.VITE_*` accesses so Vite's static replacement
    // kicks in at build time (a dynamic `(import.meta as any).env` lookup is
    // skipped by the transformer and yields undefined at runtime).
    const appId: string | undefined = import.meta.env.VITE_META_APP_ID as string | undefined;
    const configId: string | undefined = import.meta.env.VITE_META_COEX_CONFIG_ID as string | undefined;
    const graphVersion: string = (import.meta.env.VITE_META_GRAPH_VERSION as string | undefined) ?? "v22.0";

    if (!appId || !configId) {
      toast({
        title: "Embedded Signup not configured",
        description:
          "VITE_META_APP_ID and VITE_META_COEX_CONFIG_ID must be set in the frontend .env to launch Meta Embedded Signup.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnecting(true);
      await loadFacebookSdk(appId, graphVersion);

      const signupData = await launchEmbeddedSignup(configId);

      // `signupData.code` comes from the OAuth response, the rest from the
      // WA_EMBEDDED_SIGNUP message event.
      const res = await apiRequest("POST", "/api/whatsapp/onboard", {
        _c: signupData.code,
        _w: signupData.waba_id ?? null,
        _p: signupData.phone_number_id ?? null,
        _u: signupData.user_id ?? null,
        _b: signupData.business_id ?? null,
        _s: source === "aka" ? "aka" : "api",
      });
      const data = await res.json();

      if (data?.success === false) {
        throw new Error(data?.message ?? "Onboarding failed.");
      }

      toast({
        title: "WhatsApp connected",
        description: data?.message ?? "Your WhatsApp account is being configured.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/limits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
    } catch (err: any) {
      if (err?.code === "USER_CANCELLED") {
        // Silent — user closed the popup deliberately.
        return;
      }
      toast({
        title: "Sign-up failed",
        description: err?.message ?? "Something went wrong while connecting WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // ─── Manual onboard ──────────────────────────────────────────────

  const validateManualForm = () => {
    const errs: Record<string, string> = {};
    if (!manualForm.waba_id.trim()) errs.waba_id = "WABA ID is required";
    if (!manualForm.name.trim()) errs.name = "Account name is required";
    if (!manualForm.access_token.trim()) errs.access_token = "Access token is required";
    if (!manualForm.phone_number_id.trim()) errs.phone_number_id = "Phone Number ID is required";
    if (!manualForm.display_phone_number.trim()) errs.display_phone_number = "Display phone number is required";
    setManualErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const manualOnboardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/onboard-manual", {
        waba_id: manualForm.waba_id.trim(),
        name: manualForm.name.trim(),
        access_token: manualForm.access_token.trim(),
        phone_number_id: manualForm.phone_number_id.trim(),
        display_phone_number: manualForm.display_phone_number.trim(),
        ...(manualForm.verified_name.trim() ? { verified_name: manualForm.verified_name.trim() } : {}),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Account saved",
        description: data?.message ?? "WhatsApp account is registering.",
      });
      setShowManualConnectDialog(false);
      setManualForm(emptyManualForm);
      setManualErrors({});
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/channels"] });
    },
  });

  const submitManualOnboard = () => {
    if (!validateManualForm()) return;
    manualOnboardMutation.mutate();
  };

  // ─── AI feeder toggle (real call) ────────────────────────────────

  const feederMutation = useMutation({
    mutationFn: async (numberId: string) => {
      const res = await apiRequest("PUT", `/api/whatsapp/toggle-feeder/${numberId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
    },
  });

  // ─── Account verify (re-check Meta review/verification state) ─────

  const verifyAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest("POST", `/api/whatsapp/verify-account/${accountId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? "Account refreshed" : "Verify failed",
        description: data?.success ? "Latest status pulled from Meta." : data?.message ?? "",
        variant: data?.success ? undefined : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
    },
  });

  // ─── Webhook re-subscribe (manual trigger; cron handles it every 6h) ──

  const resubscribeMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await apiRequest("POST", `/api/whatsapp/resubscribe/${accountId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data?.success ? "Webhook re-subscribed" : "Re-subscribe failed",
        description: data?.message ?? "",
        variant: data?.success ? undefined : "destructive",
      });
    },
  });

  // ─── CAPI fetch when an account is opened ────────────────────────

  const { data: capiData } = useQuery({
    queryKey: ["/api/whatsapp/capi", accountForCapi?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/whatsapp/capi/${accountForCapi.id}`);
      return res.json();
    },
    enabled: !!accountForCapi,
  });

  // ─── Rendering helpers ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeAccounts = view === "coex_manage" ? coexAccounts : apiAccounts;

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* ── Header — dynamic per view ── */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm bg-emerald-500/10")}>
                <img src="/images/automations/whatsapp.svg" alt="WhatsApp" className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>
                    {view === "list" && "WhatsApp"}
                    {view === "coex_manage" && 'WhatsApp Business App "Coex"'}
                    {view === "api_manage" && "WhatsApp Business API"}
                    {view === "qr_manage" && "WhatsApp QR Code"}
                  </h1>
                  {view === "coex_manage" && (
                    <Badge variant="outline" className="h-5 px-2 rounded-md border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                      Coexistence
                    </Badge>
                  )}
                </div>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {view === "list" && "Connect your WhatsApp accounts to the platform."}
                  {view === "coex_manage" &&
                    'Link your existing WhatsApp Business number and manage conversations on both your phone and our platform simultaneously.'}
                  {view === "api_manage" &&
                    "The official WhatsApp Business API for medium and large businesses to communicate with customers at scale."}
                  {view === "qr_manage" &&
                    "Connect your WhatsApp number in seconds by scanning a QR code — no technical setup needed."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(view === "api_manage" || view === "coex_manage") && (
                <button
                  onClick={() => openEmbeddedSignup(view === "coex_manage" ? "aka" : "api")}
                  disabled={isConnecting}
                  className="h-10 px-5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <span className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                  ) : (
                    <Plus size={12} />
                  )}
                  {isConnecting ? "Connecting…" : "Add new"}
                </button>
              )}
              {view === "api_manage" && (
                <button
                  onClick={() => setShowManualConnectDialog(true)}
                  className={outlineBtn}
                >
                  <Plus size={12} /> Connect manually
                </button>
              )}
              {view !== "list" && (
                <button onClick={() => setView("list")} className={outlineBtn}>
                  <ChevronLeft size={12} /> Back
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW — 3 cards selector ── */}
          {view === "list" && (
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {/* ─── Coex card ─── */}
              <div className={cn("group p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col relative overflow-hidden", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Smartphone size={20} />
                  </div>
                  <Badge variant="outline" className="h-6 px-2.5 rounded-md border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                    Popular
                  </Badge>
                </div>

                <div className="space-y-2 mb-5 flex-1">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>Business App "Coex"</h3>
                  <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed", sub)}>
                    Link your existing WhatsApp Business number and manage conversations on both your phone and our
                    platform simultaneously.
                  </p>

                  {/* Feature checklist — 4 items */}
                  <ul className="space-y-1.5 pt-3 mt-3 border-t border-current/10">
                    {[
                      "Use your existing phone number",
                      "Real-time sync with mobile app",
                      "No API setup required",
                      "Official WhatsApp API",
                    ].map((feat) => (
                      <li key={feat} className={cn("text-[11px] font-medium opacity-70 leading-relaxed flex gap-2", sub)}>
                        <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Prerequisites box — orange warning */}
                  <div className="mt-4 rounded-lg p-3 text-[11px] leading-relaxed bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
                    <div className="font-black uppercase tracking-widest text-[10px] mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={11} /> Prerequisites
                    </div>
                    <ul className="space-y-1">
                      <li>• WhatsApp Business App already connected</li>
                      <li>• Latest version of the mobile app</li>
                      <li>• Country not on Meta's restricted list</li>
                      <li>• Facebook Business Manager Account</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <button
                    onClick={() => setView("coex_manage")}
                    className="w-full h-10 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    Manage
                  </button>
                  {/* Difficulty indicator */}
                  <div className={cn("flex items-center gap-1.5 text-[10px] font-bold opacity-60", sub)}>
                    <span>Setup difficulty:</span>
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={cn("w-2 h-2 rounded-full", n <= 2 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}
                      />
                    ))}
                    <span>Moderate</span>
                  </div>
                </div>
              </div>

              {/* ─── API card ─── */}
              <div className={cn("group p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col relative overflow-hidden", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Zap size={20} />
                  </div>
                  <a
                    href="https://business.whatsapp.com/products/business-platform"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary",
                    )}
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>

                <div className="space-y-2 mb-5 flex-1">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>Business API</h3>
                  <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed", sub)}>
                    The official WhatsApp Business API for medium and large businesses to communicate with customers
                    at scale.
                  </p>

                  <ul className="space-y-1.5 pt-3 mt-3 border-t border-current/10">
                    {[
                      "High-volume messaging",
                      "Message templates & automation",
                      "Verified business profile",
                      "Official WhatsApp API",
                    ].map((feat) => (
                      <li key={feat} className={cn("text-[11px] font-medium opacity-70 leading-relaxed flex gap-2", sub)}>
                        <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 rounded-lg p-3 text-[11px] leading-relaxed bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
                    <div className="font-black uppercase tracking-widest text-[10px] mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={11} /> Prerequisites
                    </div>
                    <ul className="space-y-1">
                      <li>• Facebook Business Manager Account</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <button
                    onClick={() => setView("api_manage")}
                    className="w-full h-10 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    Manage
                  </button>
                  <div className={cn("flex items-center gap-1.5 text-[10px] font-bold opacity-60", sub)}>
                    <span>Setup difficulty:</span>
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={cn("w-2 h-2 rounded-full", n <= 2 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}
                      />
                    ))}
                    <span>Moderate</span>
                  </div>
                </div>
              </div>

              {/* ─── QR Code card ─── */}
              <div className={cn("group p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col relative overflow-hidden", softBg, softBorder)}>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <QrCode size={20} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="h-6 px-2.5 rounded-md border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                      Popular
                    </Badge>
                    <Badge variant="outline" className="h-6 px-2.5 rounded-md border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest">
                      Quickest
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 mb-5 flex-1">
                  <h3 className={cn("text-[14px] font-black tracking-tight", text)}>QR Code</h3>
                  <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed", sub)}>
                    Our native QR Code integration makes it easy and intuitive to connect your WhatsApp number in
                    seconds.
                  </p>

                  <ul className="space-y-1.5 pt-3 mt-3 border-t border-current/10">
                    {[
                      "Connect in under 60 seconds",
                      "Scan QR code from your phone",
                      "No technical knowledge needed",
                    ].map((feat) => (
                      <li key={feat} className={cn("text-[11px] font-medium opacity-70 leading-relaxed flex gap-2", sub)}>
                        <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto space-y-3">
                  <button
                    onClick={() => setView("qr_manage")}
                    className="w-full h-10 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    Manage
                  </button>
                  <div className={cn("flex items-center gap-1.5 text-[10px] font-bold opacity-60", sub)}>
                    <span>Setup difficulty:</span>
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={cn("w-2 h-2 rounded-full", n <= 1 ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}
                      />
                    ))}
                    <span>Easy</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── COEX / API MANAGE VIEW ── */}
          {(view === "coex_manage" || view === "api_manage") && (
            <div className="p-8 space-y-5">
              {activeAccounts.length === 0 ? (
                <EmptyIntegrationState
                  dark={dark}
                  text={text}
                  sub={sub}
                  softBg={softBg}
                  softBorder={softBorder}
                  onConnect={() => openEmbeddedSignup(view === "coex_manage" ? "aka" : "api")}
                />
              ) : (
                <div className="space-y-4">
                  {activeAccounts.map((account: any) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      dark={dark}
                      text={text}
                      sub={sub}
                      card={card}
                      border={border}
                      softBg={softBg}
                      softBorder={softBorder}
                      outlineBtn={outlineBtn}
                      onDeleteAccount={() => setAccountToDelete(account)}
                      onDeleteNumber={(n: any) => setNumberToDelete(n)}
                      onReconnect={(n: any) => setNumberToReconnect(n)}
                      onDefaultReply={(n: any) => setNumberForDefaultReply(n)}
                      onToggleFeeder={(n: any) => feederMutation.mutate(n.id)}
                      onSetupCapi={() => setAccountForCapi(account)}
                      onVerifyAccount={() => verifyAccountMutation.mutate(account.id)}
                      isVerifying={verifyAccountMutation.isPending}
                      onResubscribe={() => resubscribeMutation.mutate(account.id)}
                      onRegisterNumber={(n: any) => setNumberToRegister(n)}
                      onOpenTemplates={() => setLocation(`/templates?wa_account_id=${account.id}`)}
                      onAddNumber={() => {
                        setSelectedAccount(account);
                        setShowAddNumberDialog(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── QR MANAGE VIEW (full Z-API replyagent mirror) ── */}
          {view === "qr_manage" && (
            <QrCodeManageView
              card={card}
              border={border}
              text={text}
              sub={sub}
              softBg={softBg}
              softBorder={softBorder}
              outlineBtn={outlineBtn}
              inputCls={inputCls}
              dark={dark}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Add Phone Number dialog (placeholder; existing UI preserved) ── */}
      <Dialog open={showAddNumberDialog} onOpenChange={setShowAddNumberDialog}>
        <DialogContent className={cn("rounded-[2rem] border p-0 max-w-lg overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Plus size={16} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Add Phone Number</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>Account: {selectedAccount?.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>
                  Phone Number (International Format)
                </label>
                <Input
                  placeholder="e.g. +1 555 000 0000"
                  value={newNumberData.phoneNumber}
                  onChange={(e) => setNewNumberData({ ...newNumberData, phoneNumber: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>Purpose</label>
                <RadioGroup
                  value={newNumberData.purposeType}
                  onValueChange={(v: any) => setNewNumberData({ ...newNumberData, purposeType: v })}
                  className="grid grid-cols-2 gap-3"
                >
                  {(
                    [
                      { v: "automated", label: "Automated", desc: "AI & flow processing", icon: <Bot size={16} /> },
                      { v: "notification", label: "Notification", desc: "System alerts only", icon: <Activity size={16} /> },
                    ] as const
                  ).map((opt) => {
                    const active = newNumberData.purposeType === opt.v;
                    return (
                      <button
                        key={opt.v}
                        onClick={() => setNewNumberData({ ...newNumberData, purposeType: opt.v })}
                        className={cn(
                          "p-4 rounded-[1rem] border text-left transition-all",
                          active
                            ? "border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/10"
                            : cn(softBorder, softBg, "hover:border-emerald-500/30"),
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all",
                            active ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-emerald-500/10 text-emerald-500",
                          )}
                        >
                          {opt.icon}
                        </div>
                        <p className={cn("text-[12px] font-black tracking-tight", text)}>{opt.label}</p>
                        <p className={cn("text-[10px] font-medium opacity-60 mt-0.5", sub)}>{opt.desc}</p>
                      </button>
                    );
                  })}
                </RadioGroup>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddNumberDialog(false)} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={() =>
                  toast({
                    title: "Coming soon",
                    description:
                      "Add Phone Number via Meta is initiated from Embedded Signup — use the 'Add new' button at the top to launch the Meta flow for this account.",
                  })
                }
                className="h-11 px-7 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                <Plus size={12} /> Add Number
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Manual Connect Dialog (kept from existing UI) ── */}
      <Dialog
        open={showManualConnectDialog}
        onOpenChange={(open) => {
          setShowManualConnectDialog(open);
          if (!open) setManualErrors({});
        }}
      >
        <DialogContent className={cn("rounded-[2rem] border p-0 max-w-xl overflow-hidden", card, border)}>
          <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Phone size={16} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Connect WhatsApp Manually</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                  Paste credentials from Meta dashboard. Account will register as PENDING and turn ACTIVE once verified.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>
                  Account Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. EZAUQ Sales"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
                {manualErrors.name && <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>
                  WABA ID <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. 681754671655525"
                  value={manualForm.waba_id}
                  onChange={(e) => setManualForm({ ...manualForm, waba_id: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
                <p className={cn("text-[10px] font-medium opacity-50 pl-1", sub)}>
                  From Meta dashboard → WhatsApp → API Setup → WhatsApp Business Account ID
                </p>
                {manualErrors.waba_id && <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.waba_id}</p>}
              </div>

              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>
                  Phone Number ID <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. 769635746243474"
                  value={manualForm.phone_number_id}
                  onChange={(e) => setManualForm({ ...manualForm, phone_number_id: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
                <p className={cn("text-[10px] font-medium opacity-50 pl-1", sub)}>
                  From Meta dashboard → API Setup → Phone number ID (digits only, not the +1 555 number)
                </p>
                {manualErrors.phone_number_id && (
                  <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.phone_number_id}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>
                  Display Phone Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="e.g. 15551414305 or +1 555 141 4305"
                  value={manualForm.display_phone_number}
                  onChange={(e) => setManualForm({ ...manualForm, display_phone_number: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
                {manualErrors.display_phone_number && (
                  <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.display_phone_number}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>
                  Verified Name <span className="opacity-60 normal-case font-bold">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. EZAUQ Pvt Ltd"
                  value={manualForm.verified_name}
                  onChange={(e) => setManualForm({ ...manualForm, verified_name: e.target.value })}
                  className={inputCls}
                  disabled={manualOnboardMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>
                  Access Token <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  placeholder="EAA... (paste from Meta dashboard → API Setup → Access Token)"
                  value={manualForm.access_token}
                  onChange={(e) => setManualForm({ ...manualForm, access_token: e.target.value })}
                  className={cn(inputCls, "h-24 py-3 font-mono text-[11px] resize-none")}
                  disabled={manualOnboardMutation.isPending}
                />
                <p className={cn("text-[10px] font-medium opacity-50 pl-1", sub)}>
                  Temporary tokens expire after 24 hours. For long-term use, generate a permanent System User token from Business Manager.
                </p>
                {manualErrors.access_token && (
                  <p className="text-[10px] font-bold text-rose-500 pl-1">{manualErrors.access_token}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowManualConnectDialog(false)}
                disabled={manualOnboardMutation.isPending}
                className={cn(outlineBtn, "disabled:opacity-50 disabled:cursor-not-allowed")}
              >
                Cancel
              </button>
              <button
                onClick={submitManualOnboard}
                disabled={manualOnboardMutation.isPending}
                className="h-11 px-7 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                {manualOnboardMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Registering...
                  </>
                ) : (
                  <>
                    <Plus size={12} /> Connect Account
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reusable dialogs (replyagent-parity safety flows) ── */}
      <DeleteAccountDialog
        open={!!accountToDelete}
        account={accountToDelete}
        onClose={() => setAccountToDelete(null)}
      />
      <DeleteNumberDialog
        open={!!numberToDelete}
        number={numberToDelete}
        onClose={() => setNumberToDelete(null)}
      />
      <ReconnectNumberDialog
        open={!!numberToReconnect}
        number={numberToReconnect}
        onClose={() => setNumberToReconnect(null)}
      />
      <DefaultReplyDialog
        open={!!numberForDefaultReply}
        number={numberForDefaultReply}
        onClose={() => setNumberForDefaultReply(null)}
      />
      <LimitReachedDialog
        open={showLimitDialog}
        limit={channelsLimit}
        onClose={() => setShowLimitDialog(false)}
      />

      {/* ── CAPI quick-setup dialog ── */}
      <CapiSetupDialog
        open={!!accountForCapi}
        account={accountForCapi}
        existing={capiData}
        onClose={() => setAccountForCapi(null)}
      />

      {/* ── Register / 2-step PIN dialog ── */}
      <RegisterPinDialog
        open={!!numberToRegister}
        number={numberToRegister}
        onClose={() => setNumberToRegister(null)}
      />
    </>
  );
}

// ─── Per-account card (replyagent-parity table layout) ────────────────

function AccountCard(props: {
  account: any;
  dark: boolean;
  text: string;
  sub: string;
  card: string;
  border: string;
  softBg: string;
  softBorder: string;
  outlineBtn: string;
  onDeleteAccount: () => void;
  onDeleteNumber: (n: any) => void;
  onReconnect: (n: any) => void;
  onDefaultReply: (n: any) => void;
  onToggleFeeder: (n: any) => void;
  onSetupCapi: () => void;
  onVerifyAccount: () => void;
  isVerifying: boolean;
  onResubscribe: () => void;
  onRegisterNumber: (n: any) => void;
  onOpenTemplates: () => void;
  onAddNumber: () => void;
}) {
  const { account, dark, text, sub, card, border, softBg, softBorder, outlineBtn } = props;

  const accountBadgeTone = account.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : account.status === "PENDING" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";

  // ── Gap 9: parse on-behalf-of business info (JSON string from Meta) ──
  const onBehalfOf = (() => {
    if (!account.on_behalf_of_business_info) return null;
    try {
      const parsed =
        typeof account.on_behalf_of_business_info === "string"
          ? JSON.parse(account.on_behalf_of_business_info)
          : account.on_behalf_of_business_info;
      return parsed?.name ?? parsed?.business_name ?? null;
    } catch {
      return null;
    }
  })();

  // ── Gap 4: humanise account review + ownership status into badges ──
  const reviewStatus: string | null = account.account_review_status ?? null;
  const reviewTone =
    reviewStatus === "APPROVED"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : reviewStatus === "REJECTED"
        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  const ownershipType: string | null = account.ownership_type ?? null;

  // ── Gap 8: health — surface any account/number error_code ──
  const numbers: any[] = account.phone_numbers ?? [];
  const healthError: string | null =
    account.error_code || numbers.find((n) => n.error_code)?.error_code || null;

  return (
    <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
      {/* Account Header */}
      <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <img src="/images/automations/whatsapp.svg" alt="WA" className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn("text-[13px] font-black truncate", text)}>{account.name}</p>
              <Badge variant="outline" className={cn("h-5 px-2 rounded-md text-[9px] font-black uppercase tracking-widest", accountBadgeTone)}>
                {account.status}
              </Badge>
              {account.business_verification_status === "verified" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center text-emerald-500">
                        <BadgeCheck size={14} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Business Verified by Meta</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Gap 4 — Meta account review status */}
              {reviewStatus && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={cn("h-5 px-2 rounded-md text-[9px] font-black uppercase tracking-widest", reviewTone)}>
                        Review: {reviewStatus}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Meta account review status</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Gap 4 — ownership type (CLIENT_OWNED / SHARED / SELF) */}
              {ownershipType && (
                <Badge variant="outline" className={cn("h-5 px-2 rounded-md text-[9px] font-black uppercase tracking-widest", dark ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600")}>
                  {ownershipType.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold opacity-60 flex-wrap">
              <span className={sub}>WABA: {account.waba_id}</span>
              {account.currency && <span className={sub}>• {account.currency}</span>}
              {/* Gap 9 — on-behalf-of business (partner-managed accounts) */}
              {onBehalfOf && (
                <span className={cn("inline-flex items-center gap-1", sub)}>
                  • <Building2 size={10} /> On behalf of: {onBehalfOf}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button onClick={props.onOpenTemplates} className={outlineBtn}>
            Templates
          </button>

          {account.capi ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={props.onSetupCapi}
                    className="h-11 px-5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                  >
                    <Sparkles size={12} /> CAPI ✓
                  </button>
                </TooltipTrigger>
                <TooltipContent>Dataset: {account.capi.dataset_id}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button onClick={props.onSetupCapi} className={outlineBtn}>
              <Sparkles size={12} /> Setup CAPI
            </button>
          )}

          <a
            href="https://business.facebook.com/settings/whatsapp-business-accounts/"
            target="_blank"
            rel="noopener noreferrer"
            className={outlineBtn}
          >
            Access BM <ExternalLink size={12} />
          </a>
          <a
            href="https://developers.facebook.com/docs/whatsapp/pricing/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn("text-[11px] font-bold underline-offset-2 hover:underline", dark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")}
          >
            Pricing
          </a>

          {/* Gap 7 — re-check Meta review/verification state */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={props.onVerifyAccount} disabled={props.isVerifying} className={cn(outlineBtn, "disabled:opacity-50 disabled:cursor-not-allowed")}>
                  <RefreshCcw size={12} className={props.isVerifying ? "animate-spin" : ""} /> Verify
                </button>
              </TooltipTrigger>
              <TooltipContent>Re-check account status from Meta</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Gap 6 — manual webhook re-subscribe (cron also runs every 6h) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={props.onResubscribe} className={outlineBtn}>
                  <Repeat size={12} /> Re-subscribe
                </button>
              </TooltipTrigger>
              <TooltipContent>Re-establish the WhatsApp webhook subscription</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <button
            onClick={props.onDeleteAccount}
            className={cn("h-11 px-5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2", "border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500")}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>

      {/* Gap 8 — health alert banner when Meta flags an account/number error */}
      {healthError && (
        <div className="mx-5 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 flex items-start gap-3">
          <ShieldAlert size={15} className="text-rose-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
              Action needed
            </p>
            <p className={cn("text-[11px] font-medium opacity-80 mt-0.5", sub)}>
              Meta reported an error on this account (code{" "}
              <span className="font-mono font-bold">{String(healthError)}</span>). Use “Verify” to refresh, or open{" "}
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-rose-600 dark:text-rose-400"
              >
                Meta’s error reference
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* Phone Numbers */}
      <div className="p-5 space-y-3">
        <h4 className={cn("text-[10px] font-black uppercase tracking-widest ml-1", sub)}>Phone numbers</h4>
        {(account.phone_numbers ?? []).length === 0 ? (
          <p className={cn("text-[12px] py-4 text-center", sub)}>No phone numbers attached to this account yet.</p>
        ) : (
          (account.phone_numbers ?? []).map((number: any) => (
            <PhoneNumberRow
              key={number.id}
              number={number}
              dark={dark}
              text={text}
              sub={sub}
              card={card}
              border={border}
              onDelete={() => props.onDeleteNumber(number)}
              onReconnect={() => props.onReconnect(number)}
              onDefaultReply={() => props.onDefaultReply(number)}
              onToggleFeeder={() => props.onToggleFeeder(number)}
              onRegister={() => props.onRegisterNumber(number)}
              onTemplates={props.onOpenTemplates}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PhoneNumberRow(props: {
  number: any;
  dark: boolean;
  text: string;
  sub: string;
  card: string;
  border: string;
  onDelete: () => void;
  onReconnect: () => void;
  onDefaultReply: () => void;
  onToggleFeeder: () => void;
  onRegister: () => void;
  onTemplates: () => void;
}) {
  const { number, dark, text, sub, card, border } = props;

  const isActive = number.status === "ACTIVE";
  const isBlocked = ["LOCKED", "FAILED"].includes(number.status);
  const isDisconnected = number.status === "DISCONNECTED";
  const isPending = number.status === "PENDING";

  // ── Gap 5: messaging-limit tier + throughput level (from Meta) ──
  const limitTier: string | null = number.current_limit
    ? String(number.current_limit).replace(/^TIER_/, "").replace(/_/g, " ")
    : null;
  const throughputLevel: string | null = (() => {
    if (!number.throughput) return null;
    try {
      const t = typeof number.throughput === "string" ? JSON.parse(number.throughput) : number.throughput;
      return t?.level ?? null;
    } catch {
      return null;
    }
  })();

  let statusBadge = (
    <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
      Active
    </span>
  );
  if (isPending) {
    statusBadge = (
      <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        Pending
      </span>
    );
  } else if (isBlocked) {
    const blockedLabel = number.error_code === "PAYMENT_FAILED" ? "Payment failed" : "Blocked";
    statusBadge = (
      <a
        href="https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes"
        target="_blank"
        rel="noopener noreferrer"
        className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
      >
        {blockedLabel}
        {number.error_code ? ` (${number.error_code})` : ""}
      </a>
    );
  } else if (isDisconnected) {
    statusBadge = (
      <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
        Disconnected
      </span>
    );
  }

  return (
    <div className={cn("p-4 rounded-[1rem] border flex items-center justify-between gap-4 flex-wrap", card, border)}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Phone size={16} />
          </div>
          <div
            className={cn("absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2", isActive ? "bg-emerald-500" : isPending ? "bg-amber-500" : "bg-rose-500")}
            style={{ borderColor: dark ? "#0f1829" : "white" }}
          />
        </div>
        <div className="min-w-0">
          <p className={cn("text-[13px] font-black", text)}>{number.display_phone_number}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {["AVAILABLE_WITHOUT_REVIEW", "APPROVED"].includes(number.name_status) ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-emerald-500">
                      <BadgeCheck size={11} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Display name approved by Meta</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("opacity-50", sub)}>
                      <Info size={11} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Display name pending Meta approval</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <p className={cn("text-[10px] font-medium opacity-60 truncate", sub)}>{number.verified_name}</p>
          </div>
          {/* Gap 5 — messaging limit tier + throughput level */}
          {(limitTier || throughputLevel) && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {limitTier && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border", dark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500")}>
                        <Gauge size={9} /> {limitTier}/24h
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Messaging limit tier — unique customers you can message per 24h</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {throughputLevel && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn("inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border", dark ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500")}>
                        <Activity size={9} /> {throughputLevel}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Throughput level — sending rate this number supports</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {statusBadge}

        {!isActive && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={props.onReconnect} className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}>
                  <RotateCw size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Refresh status</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {!isActive && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={props.onRegister} className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400 hover:text-emerald-500" : "hover:bg-slate-100 text-slate-500 hover:text-emerald-500")}>
                  <KeyRound size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Register on Cloud API with a 2-step PIN</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {isActive && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={props.onDefaultReply}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                    number.auto_reply_automation_id
                      ? "bg-emerald-500/10 text-emerald-500"
                      : dark
                        ? "hover:bg-slate-800 text-slate-400"
                        : "hover:bg-slate-100 text-slate-500",
                  )}
                >
                  <ReplyAll size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{number.auto_reply_automation_id ? "Auto-reply configured" : "Set auto-reply"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="flex items-center gap-2">
          <span className={cn("text-[9px] font-black uppercase tracking-widest hidden sm:inline", sub)}>AI Feeder</span>
          <Switch
            checked={!!number.allow_in_feeder}
            onCheckedChange={() => props.onToggleFeeder()}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}>
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={cn("rounded-xl p-1.5 min-w-[180px]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
            <DropdownMenuItem
              onClick={props.onDefaultReply}
              className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
            >
              <ReplyAll size={12} /> Default reply
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={props.onTemplates}
              className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
            >
              <CopyIcon size={12} /> Manage Templates
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onReconnect} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
              <RotateCw size={12} /> Refresh status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onRegister} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
              <KeyRound size={12} /> Register / 2-step PIN
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={props.onDelete}
              className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500"
            >
              <Trash2 size={12} /> Delete number
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── CAPI quick-setup dialog ──────────────────────────────────────────

function CapiSetupDialog({
  open,
  account,
  existing,
  onClose,
}: {
  open: boolean;
  account: any;
  existing: any;
  onClose: () => void;
}) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [datasetId, setDatasetId] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (open) {
      setDatasetId(existing?.dataset_id ?? "");
      setName(existing?.name ?? account?.name ?? "");
      setToken("");
      setShowToken(false);
    }
  }, [open, existing, account]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/capi/${account?.id}`, {
        dataset_id: datasetId.trim(),
        name: name.trim(),
        token: token.trim(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: "CAPI configured" });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/capi", account?.id] });
        onClose();
      } else if (data?.error_code === "capi_exists") {
        toast({
          title: "CAPI already configured",
          description: "Delete the existing dataset before creating a new one.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Could not configure CAPI", description: data?.message ?? "", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/whatsapp/capi/${account?.id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "CAPI removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/capi", account?.id] });
      onClose();
    },
  });

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-xl overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[13px] font-black uppercase tracking-widest", dark ? "text-white" : "text-slate-900")}>Conversions API</div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
                Forward WhatsApp events to Meta's Conversions API to attribute ad spend and improve audience
                optimization. Find your dataset ID + token in Meta Events Manager.
              </p>
            </div>
          </div>

          {existing ? (
            <div className={cn("p-4 rounded-xl border", dark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200")}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={cn("text-[11px] font-black uppercase tracking-widest opacity-60", dark ? "text-slate-400" : "text-slate-600")}>
                    Dataset ID
                  </div>
                  <div className={cn("text-[13px] font-bold font-mono truncate", dark ? "text-white" : "text-slate-900")}>{existing.dataset_id}</div>
                  <div className={cn("text-[11px] opacity-60 mt-1", dark ? "text-slate-400" : "text-slate-600")}>{existing.name}</div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="h-9 px-4 rounded-lg border text-[10px] font-black uppercase tracking-widest border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest", dark ? "text-slate-400" : "text-slate-600")}>
                  Dataset ID <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  placeholder="e.g. 749358745689745"
                  className={cn("h-11 rounded-xl text-[13px] font-bold", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}
                />
              </div>
              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest", dark ? "text-slate-400" : "text-slate-600")}>Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Friendly name shown in the UI"
                  className={cn("h-11 rounded-xl text-[13px] font-bold", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}
                />
              </div>
              <div className="space-y-2">
                <label className={cn("text-[10px] font-black uppercase tracking-widest", dark ? "text-slate-400" : "text-slate-600")}>
                  Access Token <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Textarea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="EAA..."
                    className={cn("h-24 rounded-xl py-3 font-mono text-[11px] resize-none", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900", showToken ? "" : "text-security-disc")}
                  />
                  <button
                    onClick={() => setShowToken((s) => !s)}
                    className={cn("absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-all", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
                    type="button"
                  >
                    {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className={cn("h-10 px-5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
            >
              Close
            </button>
            {!existing && (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!datasetId.trim() || !token.trim() || saveMutation.isPending}
                className="h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Register / 2-step PIN dialog (Gap 3) ─────────────────────────────

function RegisterPinDialog({
  open,
  number,
  onClose,
}: {
  open: boolean;
  number: any;
  onClose: () => void;
}) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pin, setPin] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [issuedPin, setIssuedPin] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setAutoGenerate(true);
      setIssuedPin(null);
    }
  }, [open]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/whatsapp/register/${number?.id}`, {
        ...(autoGenerate ? {} : { pin: pin.trim() }),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        setIssuedPin(data?.pin ?? null);
        toast({ title: "Number registered", description: "Two-step PIN set and number activated." });
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts", "phoneNumbers,capi"] });
      } else {
        toast({ title: "Registration failed", description: data?.message ?? "", variant: "destructive" });
      }
    },
  });

  if (!number) return null;

  const pinValid = autoGenerate || /^\d{6}$/.test(pin.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200")}>
        <div className="p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-[13px] font-black uppercase tracking-widest", dark ? "text-white" : "text-slate-900")}>
                Register / 2-step PIN
              </div>
              <p className={cn("text-[11px] font-medium opacity-60 mt-1 leading-relaxed", dark ? "text-slate-400" : "text-slate-600")}>
                Registers <span className="font-bold">{number.display_phone_number}</span> on the WhatsApp Cloud API with a 6-digit
                two-step verification PIN, then activates it. Keep the PIN safe — Meta may prompt for it later.
              </p>
            </div>
          </div>

          {issuedPin ? (
            <div className={cn("p-4 rounded-xl border text-center", dark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200")}>
              <div className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", dark ? "text-slate-400" : "text-slate-600")}>Your 2-step PIN</div>
              <div className={cn("text-[28px] font-black tracking-[0.3em] font-mono mt-1", dark ? "text-white" : "text-slate-900")}>{issuedPin}</div>
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-2">Save this PIN now — it won't be shown again.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className={cn("flex items-center gap-2 cursor-pointer text-[11px] font-bold", dark ? "text-slate-300" : "text-slate-700")}>
                <input type="checkbox" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} className="accent-emerald-500" />
                Auto-generate a secure PIN
              </label>
              {!autoGenerate && (
                <div className="space-y-2">
                  <label className={cn("text-[10px] font-black uppercase tracking-widest", dark ? "text-slate-400" : "text-slate-600")}>
                    6-digit PIN <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    inputMode="numeric"
                    className={cn("h-11 rounded-xl text-[15px] font-black tracking-[0.3em] text-center font-mono", dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className={cn("h-10 px-5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all", dark ? "border-slate-700 text-slate-300 hover:border-slate-500" : "border-slate-200 text-slate-700 hover:border-slate-400")}
            >
              {issuedPin ? "Done" : "Cancel"}
            </button>
            {!issuedPin && (
              <button
                onClick={() => registerMutation.mutate()}
                disabled={!pinValid || registerMutation.isPending}
                className="h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {registerMutation.isPending ? "Registering…" : "Register"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty integration state ──────────────────────────────────────────

function EmptyIntegrationState({
  dark,
  text,
  sub,
  softBg,
  softBorder,
  onConnect,
}: {
  dark: boolean;
  text: string;
  sub: string;
  softBg: string;
  softBorder: string;
  onConnect: () => void;
}) {
  return (
    <div className={cn("rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5", softBg, softBorder)}>
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <img src="/images/automations/whatsapp.svg" alt="WhatsApp" className="w-8 h-8" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className={cn("text-[14px] font-black tracking-tight", text)}>WhatsApp is not connected yet</h3>
        <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
          Connect your WhatsApp Business account now to get started.
        </p>
      </div>
      <button
        onClick={onConnect}
        className="h-10 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-primary text-primary hover:bg-primary hover:text-white"
      >
        Connect now
      </button>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import {
  Cpu,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronDown,
  AlertCircle,
  Loader2,
  Database,
  Copy as CopyIcon,
  MoreVertical,
  UserCog,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface AITheme {
  id: string;
  name: string;
  subtitle: string;
  type: string;
  automation_id: string | null;
  channel: any;
  payload: string | null;
  properties: any;
}

interface AIProduct {
  id?: string;
  name: string;
  external_id?: string | null;
  payload?: string | null;
  link_text?: string | null;
  trigger_url?: string | null;
  properties?: any;
  ai_theme_id?: string;
}

type ViewMode =
  | "list"
  | "manage_theme"
  | "edit_product"
  | "edit_theme"
  | "user_access";

/**
 * AI Products — replyagent parity for the `ai-products` settings module.
 *
 * Three workspace-level concepts wire together here:
 *  - **Themes**: row in `ai_themes` linking a Baserow / Supabase table
 *    (via `properties.spreadsheet_id`) to an automation + a channel.
 *  - **Products**: row in `ai_products` representing a single sellable
 *    item under a theme; each gets a unique `trigger_url` deep link.
 *  - **User access**: polymorphic pivot via `user_accesses` lets
 *    workspace owners pick which agents see which themes.
 *
 * Card design preserve — only inner controls / forms / dropdowns match
 * replyagent. Backend endpoints (see `ai-themes.controller.ts` and
 * `ai-products.controller.ts`):
 *
 *    GET    /api/ai-themes
 *    GET    /api/ai-themes/:id
 *    POST   /api/ai-themes
 *    PATCH  /api/ai-themes/:id
 *    DELETE /api/ai-themes/:id
 *    GET    /api/ai-themes/:id/users
 *    POST   /api/ai-themes/:id/users/:userId/toggle
 *    GET    /api/ai-themes/:id/fields                  (Baserow field proxy)
 *    GET    /api/ai-themes/:theme/ai-products
 *    POST   /api/ai-themes/:theme/ai-products
 *    PATCH  /api/ai-themes/:theme/ai-products/:product
 *    DELETE /api/ai-themes/:theme/ai-products/:product
 */
export default function AIProductsSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTheme, setSelectedTheme] = useState<AITheme | null>(null);
  const [editingTheme, setEditingTheme] = useState<Partial<AITheme> & { type?: string }>({});
  const [payloadEnabled, setPayloadEnabled] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AIProduct | null>(null);
  const [deleteThemeOpen, setDeleteThemeOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<AIProduct | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // ── Design tokens (card design preserved from existing EZCONN section) ───
  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );

  const textareaCls = cn(
    "w-full rounded-xl text-[13px] font-mono transition-all px-4 py-3 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark
      ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary"
      : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary",
  );

  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white",
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const labelCls = cn("block text-[11px] font-semibold", sub);

  // ─── Data fetches ─────────────────────────────────────────────────
  const { data: themesData, isLoading: themesLoading } = useQuery<any>({
    queryKey: ["/api/ai-themes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/ai-themes");
      return res.json();
    },
  });
  const themes: AITheme[] = useMemo(() => {
    if (!themesData) return [];
    if (Array.isArray(themesData)) return themesData;
    if (Array.isArray(themesData?.themes)) return themesData.themes;
    return [];
  }, [themesData]);

  // Integrations check — drives the Add-Theme dropdown options. We hit the
  // generic integrations list endpoint and filter for the two providers we
  // care about. Replyagent's `wsStore.getIntegrationByType` parity.
  const { data: integrationsData } = useQuery<any>({
    queryKey: ["/api/integrations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations");
      return res.json();
    },
  });
  const integrationsList: any[] = useMemo(() => {
    if (Array.isArray(integrationsData)) return integrationsData;
    if (Array.isArray(integrationsData?.integrations)) return integrationsData.integrations;
    return [];
  }, [integrationsData]);
  const hasBaserow = integrationsList.some(
    (i: any) => String(i.type ?? "").toUpperCase() === "BASEROW",
  );
  const hasSupabase = integrationsList.some(
    (i: any) => String(i.type ?? "").toUpperCase() === "SUPABASE",
  );

  // Permission check — owner / super_user / explicit manage_theme right.
  // EZCONN persists the authed user under `localStorage.user_info` (set on
  // login) so we don't need an extra round-trip; the rest of the app uses
  // the same source.
  const me = useMemo<any>(() => {
    try {
      const raw = localStorage.getItem("user_info");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const isPrivileged = useMemo(() => {
    if (!me) return false;
    const role = me?.roleable?.role?.slug ?? me?.role?.slug ?? me?.role ?? "";
    if (me?.is_owner) return true;
    if (typeof role === "string" && (role === "owner" || role === "super_user")) return true;
    const perms: string[] = Array.isArray(me?.permissions) ? me.permissions : [];
    return perms.includes("workspace.ai.manage_theme") || perms.includes("workspace.*");
  }, [me]);

  // Automations list — populates the AutomationPicker dropdown in the
  // theme-edit form. Same source we use elsewhere (Visual API / Z-API).
  const { data: automationsData } = useQuery<any>({
    queryKey: ["/api/automations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/automations");
      return res.json();
    },
    enabled: viewMode === "edit_theme",
  });
  const automations: any[] = useMemo(() => {
    if (Array.isArray(automationsData)) return automationsData;
    if (Array.isArray(automationsData?.automations)) return automationsData.automations;
    return [];
  }, [automationsData]);

  // Workspace members — User Access view. Backend returns
  // `{members: [{id, name, email, ...}]}`.
  const { data: membersData } = useQuery<any>({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/members");
      return res.json();
    },
    enabled: viewMode === "user_access",
  });
  const members: any[] = useMemo(() => {
    if (Array.isArray(membersData)) return membersData;
    if (Array.isArray(membersData?.members)) return membersData.members;
    if (Array.isArray(membersData?.users)) return membersData.users;
    return [];
  }, [membersData]);

  // User access — list of user ids that already have access to the current
  // theme. Toggling a row mutates this set.
  const { data: accessData, refetch: refetchAccess } = useQuery<any>({
    queryKey: ["/api/ai-themes", selectedTheme?.id, "users"],
    queryFn: async () => {
      if (!selectedTheme) return { user_ids: [] };
      const res = await apiRequest("GET", `/api/ai-themes/${selectedTheme.id}/users`);
      return res.json();
    },
    enabled: !!selectedTheme && viewMode === "user_access",
  });
  const accessUserIds: Set<string> = useMemo(() => {
    const ids = accessData?.user_ids ?? [];
    return new Set(ids.map((x: any) => String(x)));
  }, [accessData]);

  // Products list — manage-theme view.
  const { data: productsData, isLoading: productsLoading } = useQuery<any>({
    queryKey: ["/api/ai-themes", selectedTheme?.id, "products"],
    queryFn: async () => {
      if (!selectedTheme) return { products: [] };
      const res = await apiRequest(
        "GET",
        `/api/ai-themes/${selectedTheme.id}/ai-products`,
      );
      return res.json();
    },
    enabled: !!selectedTheme && viewMode === "manage_theme",
  });
  const products: AIProduct[] = useMemo(() => {
    if (Array.isArray(productsData)) return productsData;
    if (Array.isArray(productsData?.products)) return productsData.products;
    return [];
  }, [productsData]);

  // ─── Mutations ────────────────────────────────────────────────────
  const saveThemeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const id = editingTheme?.id;
      const url = id ? `/api/ai-themes/${id}` : "/api/ai-themes";
      const method = id ? "PATCH" : "POST";
      const res = await apiRequest(method, url, payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-themes"] });
      toast({ title: "Saved", description: "Theme saved successfully." });
      const saved = data?.theme ?? data;
      if (saved?.id) setSelectedTheme(saved);
      setViewMode(editingTheme?.id ? "manage_theme" : "list");
      setEditingTheme({});
      setPayloadEnabled(false);
    },
    onError: (err: any) => errorToast(err, "Save failed"),
  });

  const deleteThemeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-themes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-themes"] });
      toast({ title: "Deleted", description: "Theme removed." });
      setDeleteThemeOpen(false);
      setSelectedTheme(null);
      setViewMode("list");
    },
    onError: (err: any) => errorToast(err, "Delete failed"),
  });

  const saveProductMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedTheme) throw new Error("No theme selected");
      const id = editingProduct?.id;
      const url = id
        ? `/api/ai-themes/${selectedTheme.id}/ai-products/${id}`
        : `/api/ai-themes/${selectedTheme.id}/ai-products`;
      const method = id ? "PATCH" : "POST";
      const res = await apiRequest(method, url, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/ai-themes", selectedTheme?.id, "products"],
      });
      toast({ title: "Saved", description: "Product saved successfully." });
      setViewMode("manage_theme");
      setEditingProduct(null);
    },
    onError: (err: any) => errorToast(err, "Save failed"),
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!selectedTheme) throw new Error("No theme selected");
      await apiRequest(
        "DELETE",
        `/api/ai-themes/${selectedTheme.id}/ai-products/${productId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/ai-themes", selectedTheme?.id, "products"],
      });
      toast({ title: "Deleted", description: "Product removed." });
      setProductToDelete(null);
    },
    onError: (err: any) => errorToast(err, "Delete failed"),
  });

  const toggleAccessMutation = useMutation({
    mutationFn: async (payload: { userId: string; access: boolean }) => {
      if (!selectedTheme) throw new Error("No theme selected");
      const res = await apiRequest(
        "POST",
        `/api/ai-themes/${selectedTheme.id}/users/${payload.userId}/toggle`,
        { access: payload.access },
      );
      return res.json();
    },
    onSuccess: () => {
      refetchAccess();
    },
    onError: (err: any) => errorToast(err, "Failed to update access"),
  });

  // ─── Helpers ──────────────────────────────────────────────────────
  function errorToast(err: any, fallbackTitle = "Error") {
    const body = err?.body ?? null;
    const inner = body?.message && typeof body.message === "object" ? body.message : body;
    const msg = inner?.message ?? body?.message ?? err?.message ?? "Something went wrong.";
    const code = inner?.code ?? body?.code;
    const titleByCode: Record<string, string> = {
      NOT_FOUND: "Not found",
      VALIDATION: "Validation error",
    };
    toast({
      title: code && titleByCode[code] ? titleByCode[code] : fallbackTitle,
      description: msg,
      variant: "destructive",
    });
  }

  function startCreateTheme(type: "baserow" | "supabase") {
    setEditingTheme({
      name: "",
      subtitle: "",
      type,
      automation_id: null,
      channel: "WHATSAPP",
      payload: null,
      properties: {},
    });
    setPayloadEnabled(false);
    setSelectedTheme(null);
    setViewMode("edit_theme");
  }

  function startEditTheme(theme: AITheme) {
    setEditingTheme({ ...theme });
    setPayloadEnabled(!!theme.payload);
    setSelectedTheme(theme);
    setViewMode("edit_theme");
  }

  function openManageTheme(theme: AITheme) {
    setSelectedTheme(theme);
    setViewMode("manage_theme");
  }

  function openUserAccess(theme: AITheme) {
    setSelectedTheme(theme);
    setUserSearchQuery("");
    setViewMode("user_access");
  }

  function backToList() {
    setSelectedTheme(null);
    setViewMode("list");
    setEditingTheme({});
    setPayloadEnabled(false);
  }

  function backToManage() {
    setViewMode("manage_theme");
    setEditingProduct(null);
  }

  function handleSaveTheme() {
    const t = editingTheme;
    if (!t?.name || !t?.subtitle || !t?.type || !t?.channel || !t?.automation_id) {
      toast({
        title: "Missing fields",
        description: "Name, subtitle, type, automation and channel are required.",
        variant: "destructive",
      });
      return;
    }
    saveThemeMutation.mutate({
      name: t.name,
      subtitle: t.subtitle,
      type: t.type,
      automation_id: t.automation_id,
      channel: t.channel,
      payload: payloadEnabled ? (t.payload ?? null) : null,
      payload_enabled: payloadEnabled,
      properties: t.properties ?? {},
    });
  }

  function handleSaveProduct() {
    const p = editingProduct;
    if (!p?.name) {
      toast({
        title: "Missing fields",
        description: "Product name is required.",
        variant: "destructive",
      });
      return;
    }
    saveProductMutation.mutate({
      name: p.name,
      external_id: p.external_id ?? null,
      payload: p.payload ?? null,
      link_text: p.link_text ?? null,
      properties: p.properties ?? {},
    });
  }

  function copyToClipboard(value: string | null | undefined, label = "URL") {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  }

  // Header copy per view (matches replyagent's verbatim labels).
  const headerTitle =
    viewMode === "edit_product"
      ? editingProduct?.id
        ? "Edit Product"
        : "New Product"
      : viewMode === "edit_theme"
        ? editingTheme?.id
          ? "Edit Theme"
          : "New Theme"
        : viewMode === "user_access"
          ? "Theme Access"
          : viewMode === "manage_theme"
            ? selectedTheme?.name || "Manage Theme"
            : "AI Products";
  const headerSub =
    viewMode === "edit_product"
      ? selectedTheme?.name || "Configure your product"
      : viewMode === "edit_theme"
        ? "Bind a data source to an automation"
        : viewMode === "user_access"
          ? `Grant agents access to ${selectedTheme?.name ?? "this theme"}`
          : viewMode === "manage_theme"
            ? selectedTheme?.subtitle || "Manage products in this theme"
            : "Organize and manage your AI Products";

  // ─── Provider icon (Baserow has a logo asset; everything else falls
  //     back to the Cpu glyph). Memoised per type so img-load failures
  //     stick. ─────────────────────────────────────────────────────────
  const ProviderIcon = ({ type, className = "w-7 h-7" }: { type?: string; className?: string }) => {
    const [errored, setErrored] = useState(false);
    const t = (type ?? "").toLowerCase();
    if (!t || errored || !["baserow", "supabase"].includes(t)) {
      return <Database className={cn(className, "text-primary")} />;
    }
    return (
      <img
        src={`/images/integrations/${t}.png`}
        alt={t}
        className={cn(className, "object-contain")}
        onError={() => setErrored(true)}
      />
    );
  };

  // Reset payload-enabled when entering edit-theme so the switch reflects
  // the persisted state (already handled in startEditTheme but defensive).
  useEffect(() => {
    if (viewMode !== "edit_theme") return;
    setPayloadEnabled(!!editingTheme?.payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view, card design preserved */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>{headerTitle}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>{headerSub}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {viewMode === "list" && isPrivileged && (hasBaserow || hasSupabase) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={primaryOutlineBtn}>
                      <Plus size={12} /> Add Theme <ChevronDown size={12} className="opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-52", card, border)}>
                    {hasBaserow && (
                      <DropdownMenuItem
                        className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                        onClick={() => startCreateTheme("baserow")}
                      >
                        <ProviderIcon type="baserow" className="w-4 h-4" /> Baserow.io
                      </DropdownMenuItem>
                    )}
                    {hasSupabase && (
                      <DropdownMenuItem
                        className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                        onClick={() => startCreateTheme("supabase")}
                      >
                        <ProviderIcon type="supabase" className="w-4 h-4" /> Supabase
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {viewMode === "list" && isPrivileged && !hasBaserow && !hasSupabase && (
                <p className={cn("text-[10px] font-bold opacity-60", sub)}>
                  Connect Baserow or Supabase first
                </p>
              )}

              {viewMode === "manage_theme" && (
                <>
                  <button
                    onClick={() => {
                      setEditingProduct({
                        name: "",
                        external_id: "",
                        payload: "",
                        link_text: "",
                        properties: {},
                      });
                      setViewMode("edit_product");
                    }}
                    className={primaryOutlineBtn}
                  >
                    <Plus size={12} /> Add Product
                  </button>
                  <button onClick={backToList} className={outlineBtn}>
                    <ChevronLeft size={12} /> Back
                  </button>
                </>
              )}

              {viewMode === "edit_product" && (
                <button onClick={backToManage} className={outlineBtn}>
                  <ChevronLeft size={12} /> Back
                </button>
              )}

              {viewMode === "edit_theme" && (
                <button
                  onClick={() => {
                    if (editingTheme?.id && selectedTheme) {
                      setViewMode("manage_theme");
                    } else {
                      backToList();
                    }
                    setEditingTheme({});
                  }}
                  className={outlineBtn}
                >
                  <ChevronLeft size={12} /> Back
                </button>
              )}

              {viewMode === "user_access" && (
                <button
                  onClick={() => setViewMode("manage_theme")}
                  className={outlineBtn}
                >
                  <ChevronLeft size={12} /> Back
                </button>
              )}
            </div>
          </div>

          {/* ─── LIST VIEW (Themes grid + stats) ─── */}
          {viewMode === "list" && (
            <div className="p-8 space-y-6">
              {/* Stats panel — replyagent shows a single counter; keep it
                  minimal but real (sources from the actual list length). */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={cn("rounded-[1.5rem] border p-5", softBg, softBorder)}>
                  <p className={cn("text-[11px] font-semibold", sub)}>Total databases</p>
                  <p className={cn("text-[28px] font-black mt-2", text)}>{themes.length}</p>
                </div>
              </div>

              {/* Themes grid */}
              {themesLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : themes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {themes.map((theme) => (
                    <div
                      key={theme.id}
                      className={cn(
                        "p-6 rounded-[1.5rem] border transition-all hover:shadow-md hover:border-primary/40 flex flex-col",
                        softBg,
                        softBorder,
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <ProviderIcon type={theme.type} />
                        </div>
                        {isPrivileged && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={cn(
                                  "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                                  dark
                                    ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400"
                                    : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500",
                                )}
                              >
                                <MoreVertical size={14} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-44", card, border)}>
                              <DropdownMenuItem
                                className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                onClick={() => openUserAccess(theme)}
                              >
                                <UserCog size={13} /> Access
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer"
                                onClick={() => startEditTheme(theme)}
                              >
                                <Edit2 size={13} /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuItem
                                className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10"
                                onClick={() => {
                                  setSelectedTheme(theme);
                                  setDeleteThemeOpen(true);
                                }}
                              >
                                <Trash2 size={13} /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <h3 className={cn("text-[14px] font-black tracking-tight mb-1", text)}>{theme.name}</h3>
                      <p
                        className={cn(
                          "text-[11px] font-medium opacity-70 leading-relaxed mb-5 flex-1 line-clamp-2",
                          sub,
                        )}
                      >
                        {theme.subtitle}
                      </p>
                      <button onClick={() => openManageTheme(theme)} className={cn(primaryOutlineBtn, "self-end")}>
                        Manage
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5",
                    softBg,
                    softBorder,
                  )}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>No themes yet</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      {hasBaserow || hasSupabase
                        ? "Create your first AI theme to bind a Baserow / Supabase table to an automation."
                        : "Connect a Baserow or Supabase integration first, then come back to create themes."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── MANAGE THEME (Products table) ─── */}
          {viewMode === "manage_theme" && selectedTheme && (
            <div className="p-8">
              {productsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : products.length > 0 ? (
                <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Name</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>External ID</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Trigger URL</th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product) => (
                          <tr
                            key={product.id}
                            className={cn(
                              "border-b transition-colors",
                              softBorder,
                              dark ? "hover:bg-slate-900/40" : "hover:bg-white/80",
                            )}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Cpu size={14} className="text-primary" />
                                </div>
                                <div>
                                  <p className={cn("text-[13px] font-black", text)}>{product.name}</p>
                                  {product.link_text && (
                                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>{product.link_text}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className={cn("px-6 py-4 text-[11px] font-bold", sub)}>{product.external_id || "—"}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 max-w-[280px]">
                                <code className={cn("px-2 py-1 rounded-md text-[10px] font-bold border truncate", softBorder, dark ? "bg-slate-900/50" : "bg-slate-50")}>{product.trigger_url || "—"}</code>
                                {product.trigger_url && (
                                  <button
                                    onClick={() => copyToClipboard(product.trigger_url!, "Trigger URL")}
                                    className={cn("w-7 h-7 rounded-md flex items-center justify-center", dark ? "hover:bg-slate-800 text-primary" : "hover:bg-slate-100 text-primary")}
                                    title="Copy trigger URL"
                                  >
                                    <CopyIcon size={11} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingProduct({ ...product });
                                    setViewMode("edit_product");
                                  }}
                                  className={cn(
                                    "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                                    dark
                                      ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400"
                                      : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500",
                                  )}
                                  title="Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setProductToDelete(product)}
                                  className={cn(
                                    "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                                    dark
                                      ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400"
                                      : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500",
                                  )}
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div
                    className={cn(
                      "px-6 py-3 border-t text-[11px] font-semibold",
                      softBorder,
                      sub,
                      dark ? "bg-slate-900/40" : "bg-white/60",
                    )}
                  >
                    Showing {products.length} of {products.length} products
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-[1.5rem] border py-16 px-8 flex flex-col items-center justify-center text-center space-y-5",
                    softBg,
                    softBorder,
                  )}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Cpu className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[14px] font-black tracking-tight", text)}>No products yet</h3>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      Add your first product to make it discoverable through this theme.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingProduct({
                        name: "",
                        external_id: "",
                        payload: "",
                        link_text: "",
                        properties: {},
                      });
                      setViewMode("edit_product");
                    }}
                    className={primaryOutlineBtn}
                  >
                    <Plus size={12} /> Add Product
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── EDIT THEME FORM ─── */}
          {viewMode === "edit_theme" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-3xl space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>
                        Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={editingTheme?.name ?? ""}
                        onChange={(e) =>
                          setEditingTheme((prev) => ({ ...prev, name: e.target.value.slice(0, 255) }))
                        }
                        maxLength={255}
                        placeholder="Theme name"
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>
                        Subtitle <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={editingTheme?.subtitle ?? ""}
                        onChange={(e) =>
                          setEditingTheme((prev) => ({ ...prev, subtitle: e.target.value.slice(0, 1024) }))
                        }
                        maxLength={1024}
                        placeholder="Short description"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>
                        Smart flow <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editingTheme?.automation_id ?? ""}
                        onChange={(e) =>
                          setEditingTheme((prev) => ({
                            ...prev,
                            automation_id: e.target.value || null,
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="">— Select an automation —</option>
                        {automations.map((a: any) => (
                          <option key={a.id} value={String(a.id)}>
                            {a.name ?? `Automation #${a.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>
                        Channel <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={
                          typeof editingTheme?.channel === "string" ? editingTheme.channel : "WHATSAPP"
                        }
                        onChange={(e) =>
                          setEditingTheme((prev) => ({ ...prev, channel: e.target.value }))
                        }
                        className={inputCls}
                      >
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="TELEGRAM">Telegram</option>
                        <option value="INSTAGRAM">Instagram</option>
                        <option value="MESSENGER">Messenger</option>
                        <option value="WEBCHAT">Webchat</option>
                        <option value="ZAPI">Z-API</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>
                      Type <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={editingTheme?.type ?? ""}
                      readOnly
                      className={cn(inputCls, "opacity-60 cursor-not-allowed")}
                    />
                    <p className={cn("text-[10px] font-medium opacity-60", sub)}>
                      Provider is locked once the theme is created. Delete and re-add to switch providers.
                    </p>
                  </div>

                  {/* Spreadsheet / table id — Baserow themes need this so we
                      can fetch column metadata. */}
                  {(editingTheme?.type ?? "").toLowerCase() === "baserow" && (
                    <div className="space-y-2">
                      <label className={labelCls}>Baserow table ID</label>
                      <input
                        value={editingTheme?.properties?.spreadsheet_id ?? ""}
                        onChange={(e) =>
                          setEditingTheme((prev) => ({
                            ...prev,
                            properties: {
                              ...(prev?.properties ?? {}),
                              spreadsheet_id: e.target.value,
                            },
                          }))
                        }
                        placeholder="e.g. 123456"
                        className={inputCls}
                      />
                    </div>
                  )}

                  {/* Payload toggle + textarea — matches replyagent's
                      payload_enabled UX. */}
                  <div className={cn("rounded-[1rem] border p-5 space-y-3", softBorder, dark ? "bg-slate-900/40" : "bg-white")}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn("text-[12px] font-black", text)}>Static payload</p>
                        <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                          A JSON template the agent merges into every reply for this theme.
                        </p>
                      </div>
                      <Switch
                        checked={payloadEnabled}
                        onCheckedChange={(checked) => {
                          setPayloadEnabled(checked);
                          if (!checked) {
                            setEditingTheme((prev) => ({ ...prev, payload: null }));
                          }
                        }}
                      />
                    </div>
                    {payloadEnabled && (
                      <textarea
                        value={editingTheme?.payload ?? ""}
                        onChange={(e) => setEditingTheme((prev) => ({ ...prev, payload: e.target.value }))}
                        rows={6}
                        placeholder='{"reply_with": "{{product.name}}"}'
                        className={textareaCls}
                      />
                    )}
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button
                    onClick={() => {
                      setEditingTheme({});
                      if (editingTheme?.id && selectedTheme) setViewMode("manage_theme");
                      else backToList();
                    }}
                    className={outlineBtn}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTheme}
                    disabled={saveThemeMutation.isPending}
                    className={primaryBtn}
                  >
                    {saveThemeMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    {editingTheme?.id ? "Update theme" : "Create theme"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── EDIT PRODUCT FORM ─── */}
          {viewMode === "edit_product" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-2xl space-y-6">
                  <div className="space-y-2">
                    <label className={labelCls}>
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={editingProduct?.name ?? ""}
                      onChange={(e) =>
                        setEditingProduct((prev) => (prev ? { ...prev, name: e.target.value.slice(0, 255) } : null))
                      }
                      maxLength={255}
                      placeholder="Product name"
                      className={inputCls}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelCls}>External ID</label>
                      <input
                        value={editingProduct?.external_id ?? ""}
                        onChange={(e) =>
                          setEditingProduct((prev) =>
                            prev ? { ...prev, external_id: e.target.value.slice(0, 255) } : null,
                          )
                        }
                        maxLength={255}
                        placeholder="Baserow row id / Supabase pk"
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={labelCls}>Link text</label>
                      <input
                        value={editingProduct?.link_text ?? ""}
                        onChange={(e) =>
                          setEditingProduct((prev) =>
                            prev ? { ...prev, link_text: e.target.value.slice(0, 255) } : null,
                          )
                        }
                        maxLength={255}
                        placeholder="Override label for the trigger URL"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>Payload (optional)</label>
                    <input
                      value={editingProduct?.payload ?? ""}
                      onChange={(e) =>
                        setEditingProduct((prev) => (prev ? { ...prev, payload: e.target.value } : null))
                      }
                      placeholder='{"sku": "ABC-123"}'
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>Trigger URL</label>
                    <input
                      readOnly
                      value={editingProduct?.trigger_url ?? "Generated after save"}
                      className={cn(inputCls, "font-mono text-[12px] opacity-60")}
                    />
                    <p className={cn("text-[10px] font-medium opacity-60", sub)}>
                      Auto-generated on save. Share this link in messages to deep-link to the product.
                    </p>
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={backToManage} className={outlineBtn}>
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProduct}
                    disabled={!editingProduct?.name || saveProductMutation.isPending}
                    className={primaryBtn}
                  >
                    {saveProductMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                    {editingProduct?.id ? "Update product" : "Create product"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── USER ACCESS VIEW ─── */}
          {viewMode === "user_access" && selectedTheme && (
            <div className="p-8 space-y-5">
              <div className={cn("rounded-[1.5rem] border p-6", softBg, softBorder)}>
                <p className={cn("text-[12px] font-medium leading-relaxed", sub)}>
                  Toggle which workspace members can manage products under{" "}
                  <span className={cn("font-black", text)}>{selectedTheme.name}</span>. Owners and
                  super-users always have access.
                </p>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search size={14} className={cn("absolute left-4 top-1/2 -translate-y-1/2", sub)} />
                <input
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className={cn(inputCls, "pl-10")}
                />
              </div>

              {/* Members list */}
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                {members.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className={cn("text-[12px] font-medium", sub)}>No workspace members found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Member</th>
                          <th className={cn("px-6 py-4 text-left text-[11px] font-semibold", sub)}>Role</th>
                          <th className={cn("px-6 py-4 text-right text-[11px] font-semibold", sub)}>Access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members
                          .filter((m: any) => {
                            const q = userSearchQuery.trim().toLowerCase();
                            if (!q) return true;
                            const name = (m.name ?? m.full_name ?? "").toLowerCase();
                            const email = (m.email ?? "").toLowerCase();
                            return name.includes(q) || email.includes(q);
                          })
                          .map((member: any) => {
                            const userId = String(member.id);
                            const hasAccess = accessUserIds.has(userId);
                            const isAlwaysOn =
                              member.is_owner ||
                              member?.roleable?.role?.slug === "owner" ||
                              member?.roleable?.role?.slug === "super_user" ||
                              member?.role?.slug === "owner" ||
                              member?.role?.slug === "super_user";
                            const roleLabel =
                              member?.roleable?.role?.name ??
                              member?.role?.name ??
                              member?.role?.slug ??
                              "Agent";
                            return (
                              <tr
                                key={member.id}
                                className={cn(
                                  "border-b transition-colors",
                                  softBorder,
                                  dark ? "hover:bg-slate-900/40" : "hover:bg-white/80",
                                )}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[12px]">
                                      {String(member.name ?? member.email ?? "?")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                    <div>
                                      <p className={cn("text-[13px] font-black", text)}>
                                        {member.name ?? member.full_name ?? member.email ?? "Unknown"}
                                      </p>
                                      {member.email && (
                                        <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                          {member.email}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className={cn("px-6 py-4 text-[11px] font-bold", sub)}>
                                  {roleLabel}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {isAlwaysOn ? (
                                    <span className={cn("text-[11px] font-semibold", "text-emerald-500")}>
                                      Always on
                                    </span>
                                  ) : (
                                    <Switch
                                      checked={hasAccess}
                                      onCheckedChange={(checked) =>
                                        toggleAccessMutation.mutate({ userId, access: checked })
                                      }
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Delete Theme Dialog ─── */}
      <AlertDialog open={deleteThemeOpen} onOpenChange={setDeleteThemeOpen}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Delete theme?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{selectedTheme?.name ?? "This theme"}</span> and all
                  associated products + user access entries will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedTheme && deleteThemeMutation.mutate(selectedTheme.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Product Dialog ─── */}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>Delete product?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{productToDelete?.name ?? "This product"}</span> will be
                  permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => productToDelete?.id && deleteProductMutation.mutate(productToDelete.id)}
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

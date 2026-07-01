import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Trash2,
  Loader2,
  Code2,
  Webhook as WebhookIcon,
  Plus,
  AlertCircle,
  ExternalLink,
  ShieldOff,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

// The events shipped to the backend's webhook dispatcher. Keep this list
// aligned with `WEBHOOK_EVENT_SLUGS` in
// backend/src/webhooks/outbound-dispatcher.service.ts — the slugs are what
// the dispatcher matches against the webhook's events column.
type WebhookEventSlug =
  | "contact_created"
  | "contact_deleted"
  | "message_sent"
  | "message_delivered"
  | "message_read"
  | "message_failed";

interface WebhookEventOption {
  slug: WebhookEventSlug;
  label: string;
  description: string;
  group: "contact" | "message";
}

const EVENT_OPTIONS: WebhookEventOption[] = [
  {
    slug: "contact_created",
    label: "Contact Created",
    description: "A new contact was added to your workspace.",
    group: "contact",
  },
  {
    slug: "contact_deleted",
    label: "Contact Deleted",
    description: "A contact was removed from your workspace.",
    group: "contact",
  },
  {
    slug: "message_sent",
    label: "Message Sent",
    description: "An outbound message was accepted by the channel.",
    group: "message",
  },
  {
    slug: "message_delivered",
    label: "Message Delivered",
    description: "The channel confirmed the message reached the recipient.",
    group: "message",
  },
  {
    slug: "message_read",
    label: "Message Read",
    description: "The recipient opened the message.",
    group: "message",
  },
  {
    slug: "message_failed",
    label: "Message Failed",
    description: "The channel could not deliver the message.",
    group: "message",
  },
];

// Docs URL — placeholder for the future public API documentation site.
// Replace with the real URL once the docs portal is live.
const API_DOCS_URL = "https://ezconn.com/docs/api";

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEventSlug[];
}

interface PlanFeatures {
  allow_api: boolean;
}

const DeveloperSettingsSection = () => {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [webhookForm, setWebhookForm] = useState<{
    name: string;
    url: string;
    events: WebhookEventSlug[];
  }>({ name: "", url: "", events: [] });
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    url?: string;
    events?: string;
  }>({});
  const [webhookToDelete, setWebhookToDelete] = useState<Webhook | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  // ── Design tokens ─────────────────────────────────────────
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
  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary",
  );
  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white",
  );
  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";
  const labelCls = cn("block text-[11px] font-semibold", sub);
  const iconBtn = cn(
    "w-11 h-11 rounded-xl border flex items-center justify-center transition-all shrink-0",
    dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500",
  );

  // ─── Data queries ──────────────────────────────────────────────────────

  const { data: planFeatures, isLoading: isLoadingFeatures } = useQuery<PlanFeatures>({
    queryKey: ["/api/workspaces/plan-features"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/plan-features");
      return res.json();
    },
  });

  const allowApi = planFeatures?.allow_api ?? false;

  const { data: tokenResp, isLoading: isLoadingToken } = useQuery<{
    success: boolean;
    api_token: string | null;
  }>({
    queryKey: ["/api/users/api-token"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/api-token");
      return res.json();
    },
    enabled: allowApi,
  });

  const { data: webhooksResp, isLoading: isLoadingWebhooks } = useQuery<{
    webhooks: any[];
  }>({
    queryKey: ["/api/webhooks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/webhooks");
      return res.json();
    },
  });

  const webhooks: Webhook[] = (webhooksResp?.webhooks ?? []).map((w) => ({
    id: String(w.id),
    name: w.name,
    url: w.url,
    events: parseEvents(w.events),
  }));

  // ─── Mutations ────────────────────────────────────────────────────────

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users/api-token");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/api-token"] });
      toast({
        title: t("dev.tokenRegenerated", { defaultValue: "API key regenerated" }),
        description: t("dev.tokenRegeneratedDesc", {
          defaultValue: "Old key is now invalid. Update any integrations using it.",
        }),
      });
      setConfirmRegenerate(false);
    },
    onError: (error: any) => {
      toast({
        title: t("common.error", { defaultValue: "Error" }),
        description: error?.message ?? "Could not regenerate the API key.",
        variant: "destructive",
      });
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      url: string;
      events: WebhookEventSlug[];
    }) => {
      const res = await apiRequest("POST", "/api/webhooks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: t("dev.webhookCreated", { defaultValue: "Webhook created" }),
      });
      closeWebhookModal();
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async (args: {
      id: string;
      data: { name: string; url: string; events: WebhookEventSlug[] };
    }) => {
      const res = await apiRequest("PATCH", `/api/webhooks/${args.id}`, args.data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: t("dev.webhookUpdated", { defaultValue: "Webhook updated" }),
      });
      closeWebhookModal();
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/webhooks/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: t("dev.webhookDeleted", { defaultValue: "Webhook deleted" }),
      });
      setWebhookToDelete(null);
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (tokenResp?.api_token) {
      navigator.clipboard.writeText(tokenResp.api_token);
      toast({
        title: t("dev.copied", { defaultValue: "Copied" }),
        description: t("dev.copiedDesc", {
          defaultValue: "The API key has been copied to your clipboard.",
        }),
      });
    }
  };

  const openCreateWebhook = () => {
    setEditingWebhook(null);
    setWebhookForm({ name: "", url: "", events: [] });
    setFormErrors({});
    setShowWebhookModal(true);
  };

  const openEditWebhook = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setWebhookForm({
      name: webhook.name,
      url: webhook.url,
      events: [...webhook.events],
    });
    setFormErrors({});
    setShowWebhookModal(true);
  };

  const closeWebhookModal = () => {
    setShowWebhookModal(false);
    setEditingWebhook(null);
    setWebhookForm({ name: "", url: "", events: [] });
    setFormErrors({});
  };

  const toggleEvent = (slug: WebhookEventSlug) => {
    setWebhookForm((prev) => ({
      ...prev,
      events: prev.events.includes(slug)
        ? prev.events.filter((e) => e !== slug)
        : [...prev.events, slug],
    }));
  };

  const validateForm = (): boolean => {
    const errs: typeof formErrors = {};
    if (!webhookForm.name.trim()) errs.name = "Name is required";
    if (!webhookForm.url.trim()) {
      errs.url = "URL is required";
    } else if (!isValidUrl(webhookForm.url.trim())) {
      errs.url = "Enter a valid http(s) URL";
    }
    if (webhookForm.events.length === 0) errs.events = "Select at least one event";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitWebhook = () => {
    if (!validateForm()) return;
    const payload = {
      name: webhookForm.name.trim(),
      url: webhookForm.url.trim(),
      events: webhookForm.events,
    };
    if (editingWebhook) {
      updateWebhookMutation.mutate({ id: editingWebhook.id, data: payload });
    } else {
      createWebhookMutation.mutate(payload);
    }
  };

  const isSubmittingWebhook =
    createWebhookMutation.isPending || updateWebhookMutation.isPending;

  // ─── Render ───────────────────────────────────────────────────────────

  if (isLoadingFeatures) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Code2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                  {t("dev.title", { defaultValue: "Developer Settings" })}
                </h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  {t("dev.subtitle", {
                    defaultValue:
                      "Everything you need to connect your application with EZCONN APIs.",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            {/* API Docs */}
            <div className={cn("flex items-center justify-between gap-4 p-5 rounded-[1.5rem] border", softBg, softBorder)}>
              <div>
                <p className={cn("text-[13px] font-black", text)}>
                  {t("dev.apiDocsTitle", { defaultValue: "API Documentation" })}
                </p>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                  {t("dev.apiDocsDesc", {
                    defaultValue: "Understand our API capabilities and endpoints.",
                  })}
                </p>
              </div>
              <a
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(primaryOutlineBtn, "shrink-0")}
              >
                <ExternalLink size={12} /> {t("dev.viewDocs", { defaultValue: "View Docs" })}
              </a>
            </div>

            {/* API Key — plan-gated */}
            {allowApi ? (
              <div className={cn("rounded-[1.5rem] border p-6 space-y-3", softBg, softBorder)}>
                <div>
                  <p className={cn("text-[13px] font-black", text)}>
                    {t("dev.apiKeyTitle", { defaultValue: "API Key" })}
                  </p>
                  <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {t("dev.apiKeyDesc", {
                      defaultValue: "Use this key to authenticate API requests.",
                    })}
                  </p>
                </div>
                {isLoadingToken ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <span className={cn("text-[12px] font-bold", sub)}>
                      {t("common.loading", { defaultValue: "Loading…" })}
                    </span>
                  </div>
                ) : tokenResp?.api_token ? (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[480px]">
                      <input
                        readOnly
                        type={showApiKey ? "text" : "password"}
                        value={tokenResp.api_token}
                        className={cn(inputCls, "pr-12 font-mono text-[12px]")}
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className={cn(
                          "absolute right-3 top-1/2 -translate-y-1/2 transition-colors",
                          sub,
                          "hover:text-primary",
                        )}
                      >
                        {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <button onClick={handleCopy} className={iconBtn} title={t("dev.copy", { defaultValue: "Copy" })}>
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmRegenerate(true)}
                      disabled={regenerateMutation.isPending}
                      className={iconBtn}
                      title={t("dev.regenerate", { defaultValue: "Regenerate" })}
                    >
                      <RefreshCw size={15} className={cn(regenerateMutation.isPending && "animate-spin")} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRegenerate(true)}
                    disabled={regenerateMutation.isPending}
                    className={cn(primaryOutlineBtn)}
                  >
                    {regenerateMutation.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Plus size={12} />
                    )}
                    {t("dev.generateKey", { defaultValue: "Generate API key" })}
                  </button>
                )}
              </div>
            ) : (
              <div className={cn("flex items-start justify-between gap-4 p-6 rounded-[1.5rem] border", softBg, softBorder)}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <ShieldOff size={16} />
                  </div>
                  <div>
                    <p className={cn("text-[13px] font-black", text)}>
                      {t("dev.planLockedTitle", {
                        defaultValue: "API access not included in your plan",
                      })}
                    </p>
                    <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 max-w-md", sub)}>
                      {t("dev.planLockedDesc", {
                        defaultValue:
                          "Upgrade your subscription to generate an API key and call the public API.",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Webhooks */}
            <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder)}>
              <div className={cn("p-6 border-b flex items-center justify-between gap-4", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <WebhookIcon size={15} />
                  </div>
                  <div>
                    <p className={cn("text-[13px] font-black", text)}>
                      {t("dev.webhooksTitle", { defaultValue: "Webhooks" })}
                    </p>
                    <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                      {t("dev.webhooksDesc", {
                        defaultValue:
                          "Receive HTTPS callbacks when contacts or messages change.",
                      })}
                    </p>
                  </div>
                </div>
                <button onClick={openCreateWebhook} className={cn(primaryOutlineBtn, "shrink-0")}>
                  <Plus size={12} /> {t("dev.configure", { defaultValue: "Configure" })}
                </button>
              </div>

              <div className={cn("p-6", softBg)}>
                {isLoadingWebhooks ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : webhooks.length > 0 ? (
                  <div className="space-y-3">
                    {webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className={cn(
                          "flex items-center justify-between gap-3 p-4 rounded-xl border",
                          softBorder,
                          dark ? "bg-slate-900/40" : "bg-white",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-[13px] font-black break-all", text)}>{webhook.name}</p>
                          <p className={cn("text-[11px] font-medium opacity-70 break-all mt-0.5", sub)}>{webhook.url}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {webhook.events.map((slug) => {
                              const opt = EVENT_OPTIONS.find((e) => e.slug === slug);
                              return (
                                <span
                                  key={slug}
                                  className="inline-flex h-5 px-2 items-center rounded-md border border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold"
                                >
                                  {opt?.label ?? slug}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => openEditWebhook(webhook)}
                            className={cn(
                              "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                              dark
                                ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400"
                                : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500",
                            )}
                            title={t("common.edit", { defaultValue: "Edit" })}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setWebhookToDelete(webhook)}
                            disabled={deleteWebhookMutation.isPending}
                            className={cn(
                              "w-9 h-9 rounded-lg border flex items-center justify-center transition-all",
                              dark
                                ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400"
                                : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500",
                            )}
                            title={t("common.delete", { defaultValue: "Delete" })}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <WebhookIcon className="w-7 h-7 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={cn("text-[13px] font-black", text)}>
                        {t("dev.webhookEmptyTitle", { defaultValue: "No webhooks configured" })}
                      </h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                        {t("dev.webhookEmptyDesc", {
                          defaultValue: "Configure a webhook to receive event callbacks.",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Create / Edit Webhook Modal ── */}
      <Dialog open={showWebhookModal} onOpenChange={(o) => (!o ? closeWebhookModal() : null)}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <WebhookIcon size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[14px] font-semibold", text)}>
                    {editingWebhook
                      ? t("dev.editWebhook", { defaultValue: "Edit Webhook" })
                      : t("dev.configureWebhook", { defaultValue: "Configure Webhook" })}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {t("dev.webhookFormDesc", {
                      defaultValue: "Receive event callbacks at your endpoint.",
                    })}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>
                {t("dev.webhookName", { defaultValue: "Name" })}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                placeholder="e.g. Make.com sync"
                value={webhookForm.name}
                onChange={(e) =>
                  setWebhookForm((prev) => ({ ...prev, name: e.target.value.slice(0, 255) }))
                }
                className={cn(inputCls, formErrors.name && "!border-rose-500 focus:!ring-rose-500/30")}
              />
              {formErrors.name && (
                <p className="text-[11px] font-bold text-rose-500">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className={labelCls}>
                {t("dev.webhookUrl", { defaultValue: "Webhook URL" })}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  placeholder="https://example.com/api/webhook"
                  value={webhookForm.url}
                  onChange={(e) =>
                    setWebhookForm((prev) => ({ ...prev, url: e.target.value.slice(0, 2000) }))
                  }
                  className={cn(
                    inputCls,
                    "pr-16",
                    formErrors.url && "!border-rose-500 focus:!ring-rose-500/30",
                  )}
                />
                <span className={cn("absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold", sub)}>
                  {webhookForm.url.length}/2000
                </span>
              </div>
              {formErrors.url && (
                <p className="text-[11px] font-bold text-rose-500">{formErrors.url}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className={labelCls}>
                {t("dev.webhookEvents", { defaultValue: "Events" })}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                {t("dev.webhookEventsDesc", {
                  defaultValue: "Choose what triggers a callback.",
                })}
              </p>
              {(["contact", "message"] as const).map((group) => (
                <div key={group} className="space-y-1.5 pt-2">
                  <p className={cn("text-[11px] font-semibold opacity-70", sub)}>
                    {group === "contact"
                      ? t("dev.contactEvents", { defaultValue: "Contact lifecycle" })
                      : t("dev.messageEvents", { defaultValue: "Message lifecycle" })}
                  </p>
                  <div className="space-y-2">
                    {EVENT_OPTIONS.filter((e) => e.group === group).map((event) => {
                      const checked = webhookForm.events.includes(event.slug);
                      return (
                        <div
                          key={event.slug}
                          onClick={() => toggleEvent(event.slug)}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all",
                            checked
                              ? "border-primary bg-primary/5"
                              : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/40" : "bg-white hover:border-primary/40"),
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="rounded accent-[hsl(var(--primary))] w-4 h-4 pointer-events-none mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <span className={cn("text-[13px] font-semibold", text)}>
                              {event.label}
                            </span>
                            <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                              {event.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {formErrors.events && (
                <p className="text-[11px] font-bold text-rose-500">{formErrors.events}</p>
              )}
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={closeWebhookModal} className={outlineBtn}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                onClick={handleSubmitWebhook}
                disabled={isSubmittingWebhook}
                className={primaryBtn}
              >
                {isSubmittingWebhook && <Loader2 size={12} className="animate-spin" />}
                {editingWebhook
                  ? t("common.save", { defaultValue: "Save" })
                  : t("dev.create", { defaultValue: "Create" })}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog
        open={!!webhookToDelete}
        onOpenChange={(open) => !open && setWebhookToDelete(null)}
      >
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>
                  {t("dev.deleteWebhookTitle", { defaultValue: "Delete Webhook?" })}
                </h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black break-all">{webhookToDelete?.name}</span>
                  {" "}
                  {t("dev.deleteWebhookDesc", {
                    defaultValue: "will be permanently removed.",
                  })}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => webhookToDelete && deleteWebhookMutation.mutate(webhookToDelete.id)}
                disabled={deleteWebhookMutation.isPending}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                {deleteWebhookMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                <Trash2 size={12} /> {t("common.delete", { defaultValue: "Delete" })}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Regenerate Confirm ── */}
      <AlertDialog open={confirmRegenerate} onOpenChange={(open) => !open && setConfirmRegenerate(false)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[14px] font-semibold", text)}>
                  {tokenResp?.api_token
                    ? t("dev.regenerateTitle", { defaultValue: "Regenerate API key?" })
                    : t("dev.generateTitle", { defaultValue: "Generate API key?" })}
                </h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  {tokenResp?.api_token
                    ? t("dev.regenerateDesc", {
                        defaultValue:
                          "Any integrations using the current key will stop working immediately.",
                      })
                    : t("dev.generateDesc", {
                        defaultValue:
                          "A new API key will be generated and shown here. Keep it private.",
                      })}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                className={cn(primaryBtn, "h-11")}
              >
                {regenerateMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                {tokenResp?.api_token
                  ? t("dev.regenerate", { defaultValue: "Regenerate" })
                  : t("dev.generate", { defaultValue: "Generate" })}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

function parseEvents(raw: any): WebhookEventSlug[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as WebhookEventSlug[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WebhookEventSlug[]) : [];
  } catch {
    return [];
  }
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default DeveloperSettingsSection;

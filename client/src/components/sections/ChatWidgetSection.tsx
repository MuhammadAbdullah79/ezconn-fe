import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import {
  Edit2,
  Trash2,
  MessageCircle,
  Mail,
  Phone,
  Copy,
  Info,
  Plus,
  Loader2,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";
import {
  FaWhatsapp,
  FaTelegramPlane,
  FaFacebookMessenger,
  FaInstagram,
} from "react-icons/fa";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export default function ChatWidgetSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  type ChannelState = { enabled: boolean; value: string };
  const emptyChannels: Record<string, ChannelState> = {
    email: { enabled: false, value: "" },
    phone: { enabled: false, value: "" },
    custom_number: { enabled: false, value: "" },
    whatsapp: { enabled: false, value: "" },
    telegram: { enabled: false, value: "" },
    messenger: { enabled: false, value: "" },
    instagram: { enabled: false, value: "" },
  };

  const emptyForm = {
    name: "",
    title: "",
    channels: JSON.parse(JSON.stringify(emptyChannels)) as Record<string, ChannelState>,
    headerColor: "#1e40af",
    bodyColor: "#ffffff",
    position: "right",
    footerText: "Powered by Ezconn",
    fontFamily: "Verdana",
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [widgetToDelete, setWidgetToDelete] = useState<any>(null);
  const [formData, setFormData] = useState(emptyForm);

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

  const selectCls = cn(
    inputCls,
    "appearance-none cursor-pointer pr-10 bg-no-repeat",
    dark
      ? "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]"
      : "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
    "[background-position:right_1rem_center]"
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

  const { data: widgets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/widgets"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/widgets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      toast({ title: "Success", description: "Widget saved successfully" });
      setIsCreateModalOpen(false);
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/widgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      toast({ title: "Success", description: "Widget deleted successfully" });
      setWidgetToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Connected channels (used to populate the "Select an action" dropdowns)
  const { data: connectedChannels } = useQuery<any>({
    queryKey: ["/api/integrations/channels"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/channels");
      return res.json();
    },
  });

  // Channel catalogue — Byte parity. "input" = type a value, "action" = pick a
  // connected account from the dropdown.
  const CHANNELS: {
    key: string;
    label: string;
    Icon: any;
    color: string;
    gradient?: string;
    kind: "input" | "action";
    inputType?: string;
    placeholder?: string;
    source?: string;
    tip: string;
  }[] = [
    { key: "email", label: "Email", Icon: Mail, color: "#6366f1", gradient: "linear-gradient(135deg,#818cf8,#6366f1)", kind: "input", inputType: "email", placeholder: "Enter email address", tip: "Visitors can email you at this address." },
    { key: "phone", label: "Phone", Icon: Phone, color: "#10b981", gradient: "linear-gradient(135deg,#34d399,#059669)", kind: "input", inputType: "tel", placeholder: "Enter phone number", tip: "Visitors can call this number directly." },
    { key: "custom_number", label: "Custom Number", Icon: Phone, color: "#f43f5e", gradient: "linear-gradient(135deg,#fb7185,#e11d48)", kind: "input", inputType: "tel", placeholder: "Enter phone number", tip: "A custom WhatsApp/SMS number that isn't connected as a channel." },
    { key: "whatsapp", label: "WhatsApp", Icon: FaWhatsapp, color: "#25D366", gradient: "linear-gradient(135deg,#25D366,#128C7E)", kind: "action", source: "whatsapp", tip: "Link the button to a connected WhatsApp channel." },
    { key: "telegram", label: "Telegram", Icon: FaTelegramPlane, color: "#229ED9", gradient: "linear-gradient(135deg,#37BBFE,#007DBB)", kind: "action", source: "telegram", tip: "Link the button to a connected Telegram bot." },
    { key: "messenger", label: "Messenger", Icon: FaFacebookMessenger, color: "#0084FF", gradient: "linear-gradient(135deg,#00C6FF,#0078FF 55%,#A033FF)", kind: "action", source: "messenger", tip: "Link the button to a connected Facebook Page." },
    { key: "instagram", label: "Instagram", Icon: FaInstagram, color: "#E1306C", gradient: "linear-gradient(135deg,#feda75,#fa7e1e 35%,#d62976 65%,#962fbf 90%,#4f5bd5)", kind: "action", source: "instagram", tip: "Link the button to a connected Instagram account." },
  ];

  const channelBg = (ch: { color: string; gradient?: string }) =>
    ch.gradient ? { backgroundImage: ch.gradient } : { backgroundColor: ch.color };

  const getActionOptions = (source?: string) => {
    if (!source || !connectedChannels) return [];
    const arr = connectedChannels[source];
    return Array.isArray(arr) ? arr : [];
  };

  const handleCreateWidget = () => {
    if (formData.name.trim() && formData.title.trim()) {
      // actions = enabled channels with a value/action chosen (Byte-style).
      const actions = Object.entries(formData.channels)
        .filter(([, c]) => c.enabled && c.value)
        .map(([key, c]) => ({ channel: key.toUpperCase(), value: c.value }));
      saveMutation.mutate({
        id: editingId,
        name: formData.name,
        title: formData.title,
        subtitle: formData.footerText,
        header_bg: formData.headerColor,
        body_bg: formData.bodyColor,
        font_family: formData.fontFamily,
        position: formData.position,
        actions, // backend may ignore until widget_actions support is added
      });
    }
  };

  const handleEditWidget = (widget: any) => {
    const channels = JSON.parse(JSON.stringify(emptyChannels)) as Record<string, ChannelState>;
    // Re-hydrate from saved actions if the backend returns them.
    if (Array.isArray(widget.actions)) {
      widget.actions.forEach((a: any) => {
        const k = String(a.channel || "").toLowerCase();
        if (channels[k]) channels[k] = { enabled: true, value: a.value || "" };
      });
    }
    setFormData({
      name: widget.name,
      title: widget.title,
      channels,
      headerColor: widget.header_bg || "#1e40af",
      bodyColor: widget.body_bg || "#ffffff",
      position: widget.position || "right",
      footerText: widget.subtitle || "Powered by Ezconn",
      fontFamily: widget.font_family || "Verdana",
    });
    setEditingId(widget.id);
    setIsCreateModalOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(JSON.parse(JSON.stringify(emptyForm)));
    setIsCreateModalOpen(true);
  };

  const closeForm = () => {
    setIsCreateModalOpen(false);
    setFormData(JSON.parse(JSON.stringify(emptyForm)));
    setEditingId(null);
  };

  const toggleChannel = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      channels: { ...prev.channels, [key]: { ...prev.channels[key], enabled: !prev.channels[key].enabled } },
    }));
  };

  const setChannelValue = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      channels: { ...prev.channels, [key]: { ...prev.channels[key], value, enabled: value ? true : prev.channels[key].enabled } },
    }));
  };

  const activeChannels = CHANNELS.filter((c) => formData.channels[c.key]?.enabled);

  const widgetCode = `<!-- EZCONN Chat Widget -->
<script src="https://widget.ezconn.io/embed.js"></script>
<script>
  EZConnWidget.init({
    id: "widget_${widgets.length + 1}",
    headerColor: "${formData.headerColor}",
    position: "${formData.position}"
  });
</script>`;

  const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="flex gap-2 items-center">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-11 h-11 rounded-xl cursor-pointer border", softBorder)}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, "flex-1")}
      />
    </div>
  );

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>
                  {isCreateModalOpen ? (editingId ? "Edit Widget" : "Create Widget") : "Chat Widget"}
                </h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Embed a chat widget on your website.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isCreateModalOpen ? (
                <button onClick={openCreate} className={primaryOutlineBtn}>
                  <Plus size={12} /> Add New
                </button>
              ) : (
                <button onClick={closeForm} className={outlineBtn}>
                  <ChevronLeft size={12} /> Back
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {!isCreateModalOpen && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                        <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Name</th>
                        <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Title</th>
                        <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Channels</th>
                        <th className={cn("px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest", sub)}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                          </td>
                        </tr>
                      ) : widgets.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                <MessageCircle className="w-7 h-7 text-primary" />
                              </div>
                              <div className="space-y-1">
                                <h3 className={cn("text-[13px] font-black", text)}>No widgets yet</h3>
                                <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                  Create your first chat widget to embed on your website.
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        widgets.map((widget) => (
                          <tr
                            key={widget.id}
                            className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <MessageCircle size={14} className="text-primary" />
                                </div>
                                <span className="text-[13px] font-black text-primary">{widget.name}</span>
                              </div>
                            </td>
                            <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>{widget.title}</td>
                            <td className="px-6 py-4">
                              {(() => {
                                const acts = Array.isArray(widget.actions)
                                  ? widget.actions
                                  : Array.isArray(widget.channels)
                                    ? widget.channels
                                    : [];
                                if (acts.length === 0)
                                  return <span className={cn("text-[11px] font-bold", sub)}>—</span>;
                                return (
                                  <div className="flex items-center gap-1.5">
                                    {acts.map((a: any, i: number) => {
                                      const ch = CHANNELS.find(
                                        (c) => c.key === String(a.channel || a).toLowerCase(),
                                      );
                                      if (!ch) return null;
                                      const Icon = ch.Icon;
                                      return (
                                        <span
                                          key={i}
                                          className="w-7 h-7 rounded-full flex items-center justify-center shadow-sm ring-1 ring-black/5"
                                          style={channelBg(ch)}
                                          title={ch.label}
                                        >
                                          <Icon size={14} color="#ffffff" />
                                        </span>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditWidget(widget)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title="Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setWidgetToDelete(widget)}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={cn("px-6 py-3 border-t text-[10px] font-black uppercase tracking-widest", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                  Showing {widgets.length} of {widgets.length} chat widgets
                </div>
              </div>
            </div>
          )}

          {/* ── CREATE / EDIT FORM ── */}
          {isCreateModalOpen && (
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <div className="lg:col-span-2 space-y-6">
                  <div className={cn("rounded-[1.5rem] border p-6 space-y-5", softBg, softBorder)}>
                    <div className="space-y-2">
                      <label className={labelCls}>Widget Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputCls}
                        placeholder="Name this widget"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className={labelCls}>Welcome Message</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className={inputCls}
                        placeholder="Hi there, choose your preferred channel to contact us."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelCls}>Header Color</label>
                        <ColorInput value={formData.headerColor} onChange={(v) => setFormData({ ...formData, headerColor: v })} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelCls}>Title Font Family</label>
                        <select
                          value={formData.fontFamily}
                          onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                          className={selectCls}
                        >
                          <option value="Verdana">Verdana</option>
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Helvetica">Helvetica</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelCls}>Body Color</label>
                        <ColorInput value={formData.bodyColor} onChange={(v) => setFormData({ ...formData, bodyColor: v })} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelCls}>Position on Website</label>
                        <select
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          className={selectCls}
                        >
                          <option value="right">Right Bottom</option>
                          <option value="left">Left Bottom</option>
                          <option value="bottom-right">Bottom Right</option>
                          <option value="bottom-left">Bottom Left</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Channels */}
                  <div className={cn("rounded-[1.5rem] border p-6 space-y-4", softBg, softBorder)}>
                    <label className={cn(labelCls, "text-primary")}>Select the channels to add to the widget</label>
                    <div className="space-y-3">
                      {CHANNELS.map((ch) => {
                        const state = formData.channels[ch.key];
                        const options = getActionOptions(ch.source);
                        const Icon = ch.Icon;
                        return (
                          <div key={ch.key} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={state.enabled}
                              onChange={() => toggleChannel(ch.key)}
                              className="rounded accent-[hsl(var(--primary))] w-4 h-4"
                            />
                            <span
                              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md ring-1 ring-black/5"
                              style={channelBg(ch)}
                              title={ch.label}
                            >
                              <Icon size={17} color="#ffffff" />
                            </span>

                            {ch.kind === "input" ? (
                              <input
                                type={ch.inputType}
                                value={state.value}
                                onChange={(e) => setChannelValue(ch.key, e.target.value)}
                                placeholder={ch.placeholder}
                                className={cn(inputCls, "flex-1")}
                              />
                            ) : (
                              <select
                                value={state.value}
                                onChange={(e) => setChannelValue(ch.key, e.target.value)}
                                className={cn(selectCls, "flex-1")}
                              >
                                <option value="">
                                  {options.length ? "Select an action" : `No ${ch.label} connected`}
                                </option>
                                {options.map((acc: any) => (
                                  <option key={acc.id} value={String(acc.id)}>
                                    {acc.name || acc.display_phone_number || acc.username || `#${acc.id}`}
                                  </option>
                                ))}
                              </select>
                            )}

                            <button
                              type="button"
                              title={ch.tip}
                              className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                            >
                              <Info size={15} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={cn("rounded-[1.5rem] border p-6 space-y-2", softBg, softBorder)}>
                    <label className={labelCls}>Footer Text</label>
                    <input
                      type="text"
                      value={formData.footerText}
                      onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                      className={inputCls}
                      placeholder="Powered by Ezconn"
                    />
                  </div>
                </div>

                {/* Preview + Code */}
                <div className="space-y-6">
                  <div className={cn("rounded-[1.5rem] border p-6 space-y-3", softBg, softBorder)}>
                    <label className={labelCls}>Widget Preview</label>
                    <div
                      className="rounded-[1.25rem] overflow-hidden shadow-lg border"
                      style={{ backgroundColor: formData.bodyColor, borderColor: dark ? "#1e293b" : "#e2e8f0" }}
                    >
                      <div
                        style={{ backgroundColor: formData.headerColor }}
                        className="p-4 text-white min-h-[5rem] flex items-center justify-center"
                      >
                        <p className="text-[13px] font-bold text-center" style={{ fontFamily: formData.fontFamily }}>
                          {formData.title || "Hi there, choose your preferred channel to contact us."}
                        </p>
                      </div>
                      <div className="p-6 flex flex-col items-center gap-4">
                        {activeChannels.length > 0 && (
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            {activeChannels.map((ch) => {
                              const Icon = ch.Icon;
                              return (
                                <span
                                  key={ch.key}
                                  className="w-10 h-10 rounded-full flex items-center justify-center shadow-md ring-1 ring-black/5 transition-transform hover:scale-110"
                                  style={channelBg(ch)}
                                  title={ch.label}
                                >
                                  <Icon size={19} color="#ffffff" />
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <MessageCircle size={28} className="text-white" />
                        </div>
                      </div>
                      {formData.footerText && (
                        <div className={cn("border-t p-3 text-center text-[11px] font-bold", softBorder, sub)}>
                          {formData.footerText}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={cn("rounded-[1.5rem] border p-6 space-y-3", softBg, softBorder)}>
                    <label className={labelCls}>Embed Code</label>
                    <div className={cn("relative rounded-xl border p-4 font-mono text-[11px] overflow-auto h-44", softBorder, dark ? "bg-slate-950/50 text-slate-300" : "bg-white text-slate-700")}>
                      <pre className="whitespace-pre-wrap">{widgetCode}</pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(widgetCode);
                          toast({ title: "Copied", description: "Embed code copied to clipboard." });
                        }}
                        className={cn("absolute top-2 right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className={cn("flex justify-end gap-2 pt-6 mt-6 border-t", softBorder)}>
                <button onClick={closeForm} className={outlineBtn}>
                  Cancel
                </button>
                <button
                  onClick={handleCreateWidget}
                  disabled={!formData.name.trim() || !formData.title.trim() || saveMutation.isPending}
                  className={primaryBtn}
                >
                  {saveMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!widgetToDelete} onOpenChange={(open) => !open && setWidgetToDelete(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Delete Widget?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{widgetToDelete?.name || "This widget"}</span> will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(widgetToDelete.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
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

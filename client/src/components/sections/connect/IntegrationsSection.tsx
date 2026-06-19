import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plug,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Plus,
  ArrowRight,
  Check,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";

// Each integration card is gated by its own Connect permission (replyagent
// Integrations.vue $can per integration). Cards with no entry here (Cal.com,
// Baserow) have no EZCONN permission and are hidden entirely.
const INTEGRATION_PERMS: Record<string, string> = {
  MICROSOFT: "workspace.settings.ms_tts",
  CLOUDINARY: "workspace.settings.cloudinary",
  ACTIVECAMPAIGN: "workspace.settings.active_campaign",
  CHATGPT: "workspace.settings.open_ai",
  MAKE: "workspace.settings.make_dot_com",
  ELEVENLABS: "workspace.settings.eleven_labs",
};

export default function IntegrationsSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const _intPerms = getUserInfo().permissions ?? [];
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 pl-11 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const { data: integrationsData, isLoading } = useQuery({
    queryKey: ["/api/integrations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/integrations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Connected", description: "Integration connected successfully!" });
      setConnectingId(null);
      setFormData({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to connect. Please check your credentials.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string | number; status: string }) => {
      await apiRequest("PATCH", `/api/integrations/${id}`, { action: status === "ACTIVE" ? "activate" : "pause" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Updated", description: "Integration status updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update integration.", variant: "destructive" });
    },
  });

  const staticIntegrations = [
    {
      id: "MICROSOFT",
      name: "Microsoft TTS",
      category: "Voice & Speech",
      description: "Harness Azure's lifelike AI voices for high-fidelity audio messages, canned responses, and automated voice interactions.",
      icon: "/images/integrations/tts.png",
      actionLabel: "Connect Service",
      fields: [
        { key: "key", label: "Azure API Key", placeholder: "Enter your subscription key" },
        { key: "region", label: "Region", placeholder: "e.g. eastus" },
      ],
    },
    {
      id: "CLOUDINARY",
      name: "Cloudinary",
      category: "Media Delivery",
      description: "The professional standard for image and video management. Optimize, transform, and deliver assets at lightning speed.",
      icon: "/images/integrations/cloudinary.svg",
      actionLabel: "Link Account",
      fields: [
        { key: "cloud_name", label: "Cloud Name", placeholder: "Your unique cloud identifier" },
        { key: "api_key", label: "API Key", placeholder: "Access API Key" },
        { key: "api_secret", label: "API Secret", placeholder: "Secure Secret" },
      ],
    },
    {
      id: "ACTIVECAMPAIGN",
      name: "ActiveCampaign",
      category: "Marketing Automation",
      description: "Synchronize your customer intelligence. Automatically pipeline contacts into advanced marketing automation flows.",
      icon: "/images/integrations/activecampaign.svg",
      actionLabel: "Sync Gateway",
      fields: [
        { key: "api_url", label: "API URL", placeholder: "https://youraccount.api-us1.com" },
        { key: "api_key", label: "API Key", placeholder: "Account API Key" },
      ],
    },
    {
      id: "CHATGPT",
      name: "OpenAI",
      category: "Artificial Intelligence",
      description: "Deploy world-class LLMs to analyze context and generate human-like responses. Power Whisper for precise voice-to-text.",
      icon: "/images/integrations/chat_gpt.svg",
      actionLabel: "Authorize LLM",
      fields: [{ key: "api_key", label: "OpenAI Key", placeholder: "sk-..." }],
    },
    {
      id: "MAKE",
      name: "Make.com",
      category: "Workflow Automation",
      description: "Connect to 1,600+ third-party applications. Build complex visual workflows and automate tasks without a single line of code.",
      icon: "/images/integrations/make.png",
      actionLabel: "View Blueprint",
      externalUrl: "https://make.com",
    },
    {
      id: "ELEVENLABS",
      name: "ElevenLabs",
      category: "Neural Synthesis",
      description: "The most realistic AI voice generator. Synthesize top-tier audio in 29+ languages with emotional range and clarity.",
      icon: "/images/integrations/elevenlabs.png",
      actionLabel: "Connect Engine",
      fields: [{ key: "api_key", label: "ElevenLabs API Key", placeholder: "Enter your API Key" }],
    },
    {
      id: "CAL",
      name: "Cal.com",
      category: "Scheduling",
      description: "Open-source scheduling infrastructure. Manage availability and booking sessions directly within your smart automation flows.",
      icon: "/images/integrations/cal_dot_com.png",
      actionLabel: "Manage Sync",
      fields: [{ key: "api_key", label: "Cal.com API Key", placeholder: "Account API Key" }],
    },
    {
      id: "BASEROW",
      name: "Baserow.io",
      category: "Data Management",
      description: "No-code relational database. Manipulate complex datasets and synchronize external tables with your workspace records.",
      icon: "/images/integrations/baserow.png",
      actionLabel: "Manage Tables",
      fields: [{ key: "token", label: "API Token", placeholder: "Enter Baserow Token" }],
    },
  ];

  // Show only integrations the agent is permitted to access (owner holds
  // `workspace.*` so passes all). Cal.com / Baserow have no permission → hidden.
  const visibleIntegrations = staticIntegrations.filter((i) => {
    const slug = INTEGRATION_PERMS[i.id];
    return !!slug && hasAnyPerm(_intPerms, [slug]);
  });

  const handleConnect = (item: any) => {
    if (item.externalUrl) {
      window.open(item.externalUrl, "_blank");
      return;
    }
    const existing = integrationsData?.integrations?.find((i: any) => i.type === item.id);
    if (existing) {
      toast({ title: "Active Session", description: `${item.name} is already operational.` });
      return;
    }
    setConnectingId(item.id);
  };

  const submitConnection = () => {
    if (!connectingId) return;
    createMutation.mutate({ type: connectingId, ...formData });
  };

  const toggleIntegration = (type: string, checked: boolean) => {
    const integration = integrationsData?.integrations?.find((i: any) => i.type === type);
    if (integration) {
      toggleMutation.mutate({ id: integration.id, status: checked ? "ACTIVE" : "PAUSED" });
    } else {
      toast({ title: "Action Required", description: "Initial authentication required." });
    }
  };

  const isConnected = (type: string) => {
    return integrationsData?.integrations?.some((i: any) => i.type === type && i.status === "ACTIVE");
  };

  const currentConnecting = staticIntegrations.find((i) => i.id === connectingId);
  const connectedCount = integrationsData?.integrations?.length || 0;

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
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Plug className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>Integrations</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Connect external applications to unlock your account's full potential.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="h-7 px-3 rounded-md border-primary/20 bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest">
                {visibleIntegrations.length} Available
              </Badge>
              <Badge variant="outline" className="h-7 px-3 rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                <Check size={10} className="mr-1" /> {connectedCount} Connected
              </Badge>
            </div>
          </div>

          {/* Integrations Grid */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {visibleIntegrations.map((item) => {
                const connected = isConnected(item.id);
                const canToggle = integrationsData?.integrations?.some((i: any) => i.type === item.id);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-6 rounded-[1.5rem] border transition-all hover:shadow-md flex flex-col",
                      connected
                        ? "border-primary/30 bg-primary/5"
                        : cn(softBg, softBorder, "hover:border-primary/40")
                    )}
                  >
                    {/* Top Row: Icon + Category + External */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border shrink-0", dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
                        <img src={item.icon} alt={item.name} className="h-7 w-7 object-contain" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("h-5 px-2 rounded-md text-[9px] font-black uppercase tracking-widest", dark ? "border-slate-700 bg-slate-800/50 text-slate-400" : "border-slate-200 bg-slate-100 text-slate-500")}>
                          {item.category}
                        </Badge>
                        <button
                          onClick={() => handleConnect(item)}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                            dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary"
                          )}
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Title + Description */}
                    <div className="space-y-2 mb-5 flex-1">
                      <h3 className={cn("text-[14px] font-black tracking-tight flex items-center gap-2", text)}>
                        {item.name}
                        {connected && (
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        )}
                      </h3>
                      <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed line-clamp-3", sub)}>
                        {item.description}
                      </p>
                    </div>

                    {/* Footer: Switch + Action */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={connected}
                          onCheckedChange={(c) => toggleIntegration(item.id, c)}
                          disabled={!canToggle}
                          className="data-[state=checked]:bg-primary"
                        />
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", sub)}>
                          {connected ? "On" : "Off"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleConnect(item)}
                        className={cn(
                          "h-10 px-5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                          connected
                            ? "border-primary bg-primary text-white hover:bg-primary/90"
                            : "border-primary text-primary hover:bg-primary hover:text-white"
                        )}
                      >
                        {connected ? "Manage" : item.actionLabel}
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Connection Modal ── */}
      <Dialog open={!!connectingId} onOpenChange={(open) => !open && setConnectingId(null)}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[13px] font-black uppercase tracking-widest", text)}>
                    Connect {currentConnecting?.name}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Securely link your platform credentials.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {currentConnecting?.fields?.map((field: any) => (
                <div key={field.key} className="space-y-2">
                  <label className={cn("block text-[10px] font-black uppercase tracking-widest", sub)}>
                    {field.label}
                  </label>
                  <div className="relative">
                    <div className={cn("absolute left-4 top-1/2 -translate-y-1/2", sub)}>
                      <Info size={14} />
                    </div>
                    <input
                      type="text"
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder || `Enter ${field.label}...`}
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => setConnectingId(null)} className={outlineBtn}>
                Discard
              </button>
              <button
                onClick={submitConnection}
                disabled={createMutation.isPending}
                className={primaryBtn}
              >
                {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Authorize
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

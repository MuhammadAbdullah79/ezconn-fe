import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  BadgeCheck,
  Mail,
  Copy,
  Palette,
  Globe,
  Zap,
  Upload,
  Image as ImageIcon,
  Trash2,
  Info,
  ChevronsUpDown,
  Sparkles,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function WhiteLabelSection() {
  const { mode } = useTheme();
  const { toast } = useToast();
  const dark = mode === "dark";

  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const primaryBtn =
    "h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20";

  const { data: brandingData, isLoading } = useQuery<any>({
    queryKey: ["/api/workspaces/branding"],
  });

  const updateBrandingMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/workspaces/branding", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/branding"] });
      toast({ title: "Saved", description: "Your branding has been updated." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save",
        variant: "destructive",
      });
    },
  });

  const [colors, setColors] = useState({
    mainTheme: "#4D62D5",
    links: "#5742F5",
    incomingBubble: "#705800",
    incomingText: "#FFFFFF",
    outgoingBubble: "#9C9C9C",
    outgoingText: "#FFFFFF",
  });

  useEffect(() => {
    if (brandingData) {
      setColors({
        mainTheme: brandingData.color || "#4D62D5",
        links: brandingData.link_color || "#5742F5",
        incomingBubble: brandingData.incoming_chat_color || "#705800",
        incomingText: brandingData.incoming_chat_text_color || "#FFFFFF",
        outgoingBubble: brandingData.outgoing_chat_color || "#9C9C9C",
        outgoingText: brandingData.outgoing_chat_text_color || "#FFFFFF",
      });
    }
  }, [brandingData]);

  const handleColorChange = (key: keyof typeof colors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value.toUpperCase() }));
  };

  const handleSaveColors = () => {
    updateBrandingMutation.mutate(colors);
  };

  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailUser, setEmailUser] = useState("info");
  const [emailDomain, setEmailDomain] = useState("");

  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<string>("light");
  const [logoPreview, setLogoPreview] = useState<Record<string, string>>({});

  const handleLogoAction = (action: string, type: string) => {
    if (action === "upload") {
      uploadTargetRef.current = type;
      fileInputRef.current?.click();
      return;
    }
    if (action === "gallery") {
      navigate("/settings?tab=Media Gallery");
      return;
    }
    if (action === "remove") {
      setLogoPreview((p) => {
        const next = { ...p };
        delete next[type];
        return next;
      });
      toast({ title: "Removed", description: `${type} image removed.` });
      return;
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(file);
    setLogoPreview((p) => ({ ...p, [uploadTargetRef.current]: url }));
    toast({ title: "Uploaded", description: `${file.name} set as ${uploadTargetRef.current} image.` });
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = [
    { value: "logo", label: "Logo", icon: ImageIcon },
    { value: "favicon", label: "Favicon", icon: Zap },
    { value: "colors", label: "Colors", icon: Palette },
    { value: "domain", label: "Domain", icon: Globe },
    { value: "email", label: "Email", icon: Mail },
  ];

  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <CardContent className="p-0">
        {/* ── Header ── */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <BadgeCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>White Label</h1>
              <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                Change color, logo and favicon of your Workspace
              </p>
            </div>
          </div>
          <div className={cn("px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", dark ? "border-slate-800 bg-slate-950/50 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600")}>
            <Sparkles size={11} className="text-primary" /> Premium Branding
          </div>
        </div>

        <div>
          <Tabs defaultValue="colors" className="w-full">
            {/* Tabs Bar */}
            <div className={cn("px-8 border-b flex justify-start overflow-x-auto", softBorder)}>
              <TabsList className="h-auto p-0 gap-8 bg-transparent border-none flex justify-start rounded-none">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      "flex items-center gap-2 px-1 py-5 rounded-none text-[11px] font-black uppercase tracking-widest transition-all shadow-none bg-transparent border-b-2 border-transparent",
                      "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-primary",
                      "hover:text-primary",
                      dark ? "text-slate-500" : "text-slate-400"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── LOGO TAB ── */}
            <TabsContent value="logo" className="p-8 outline-none space-y-6">
              <SectionHeading
                dark={dark}
                title="Brand Logo"
                description="Upload your logo for light and dark mode. Transparent PNG or SVG recommended (460×140px)."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LogoUpload
                  dark={dark}
                  themeLabel="Light Theme"
                  logoSrc={logoPreview.light || "/white-label/ezconn-logo.svg"}
                  zoneBg={dark ? "bg-white/95" : "bg-slate-50/80"}
                  zoneBorder={dark ? "border-slate-700" : "border-slate-200"}
                  onAction={(a) => handleLogoAction(a, "light")}
                />
                <LogoUpload
                  dark={dark}
                  themeLabel="Dark Theme"
                  logoSrc={logoPreview.dark || "/white-label/ezconn-logo-dark.svg"}
                  zoneBg="bg-[#020617]"
                  zoneBorder="border-slate-800"
                  onAction={(a) => handleLogoAction(a, "dark")}
                />
              </div>

              <InfoNote dark={dark}>
                Logo displays in the top-left of your workspace. Recommended dimensions: 460×140px.
              </InfoNote>
            </TabsContent>

            {/* ── FAVICON TAB ── */}
            <TabsContent value="favicon" className="p-8 outline-none space-y-6">
              <SectionHeading
                dark={dark}
                title="Browser Favicon"
                description="The small icon that appears in browser tabs. Square ICO or PNG (64×64px recommended)."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload zone */}
                <div className="space-y-3">
                  <FieldLabel dark={dark}>Upload Favicon</FieldLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className={cn(
                        "w-32 h-32 border-2 border-dashed rounded-[1.5rem] flex items-center justify-center cursor-pointer transition-all hover:border-primary/40 group",
                        dark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
                      )}>
                        <img src={logoPreview.favicon || "/white-label/favicon.png"} alt="Favicon" className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={cn("w-52 rounded-xl p-1.5", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                      <DropdownMenuItem onClick={() => handleLogoAction("upload", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                        <Upload size={13} /> Upload New
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLogoAction("gallery", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
                        <ImageIcon size={13} /> From Gallery
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLogoAction("remove", "favicon")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500">
                        <Trash2 size={13} /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Browser preview */}
                <div className="space-y-3">
                  <FieldLabel dark={dark}>Browser Tab Preview</FieldLabel>
                  <div className={cn("p-4 rounded-[1.25rem] border", softBg, softBorder)}>
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                      <div className="bg-slate-100 px-2 py-1.5 flex items-center gap-1.5">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                          <div className="w-2 h-2 rounded-full bg-yellow-400" />
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                        </div>
                        <div className="flex-1 ml-2 bg-white rounded px-2 py-1 flex items-center gap-1.5 max-w-[200px]">
                          <img src={logoPreview.favicon || "/white-label/favicon.png"} className="w-3 h-3 shrink-0" alt="" />
                          <span className="text-[9px] font-bold text-slate-700 truncate">Workspace — Ezconn</span>
                        </div>
                      </div>
                      <div className="h-12 bg-white" />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── COLORS TAB ── */}
            <TabsContent value="colors" className="px-8 py-5 outline-none space-y-4">
              <SectionHeading
                dark={dark}
                title="Theme Colors"
                description="Customize the colors used across your workspace UI and chat bubbles."
              />

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <h4 className={cn("text-[11px] font-black uppercase tracking-widest", text)}>Brand</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ColorPicker dark={dark} label="Main Theme" value={colors.mainTheme} onChange={(v) => handleColorChange("mainTheme", v)} />
                  <ColorPicker dark={dark} label="Links & Actions" value={colors.links} onChange={(v) => handleColorChange("links", v)} />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 bg-primary rounded-full" />
                  <h4 className={cn("text-[11px] font-black uppercase tracking-widest", text)}>Chat Bubbles</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ColorPicker dark={dark} label="Incoming Bubble" value={colors.incomingBubble} onChange={(v) => handleColorChange("incomingBubble", v)} />
                  <ColorPicker dark={dark} label="Incoming Text" value={colors.incomingText} onChange={(v) => handleColorChange("incomingText", v)} />
                  <ColorPicker dark={dark} label="Outgoing Bubble" value={colors.outgoingBubble} onChange={(v) => handleColorChange("outgoingBubble", v)} />
                  <ColorPicker dark={dark} label="Outgoing Text" value={colors.outgoingText} onChange={(v) => handleColorChange("outgoingText", v)} />
                </div>
              </div>

              {/* Chat preview */}
              <div className={cn("p-3.5 rounded-[1.5rem] border", softBg, softBorder)}>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={14} className="text-primary" />
                  <h5 className={cn("text-[10px] font-black uppercase tracking-widest", text)}>Live Preview</h5>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-lg rounded-tl-sm max-w-[60%]" style={{ backgroundColor: colors.incomingBubble, color: colors.incomingText }}>
                      <p className="text-[12px] font-medium">Hi, I have a question.</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="px-3 py-2 rounded-lg rounded-tr-sm max-w-[60%]" style={{ backgroundColor: colors.outgoingBubble, color: colors.outgoingText }}>
                      <p className="text-[12px] font-medium">Sure! How can I help?</p>
                    </div>
                  </div>
                </div>
              </div>

              <SaveFooter
                dark={dark}
                onClick={handleSaveColors}
                loading={updateBrandingMutation.isPending}
                primaryBtn={primaryBtn}
              />
            </TabsContent>

            {/* ── DOMAIN TAB ── */}
            <TabsContent value="domain" className="p-8 outline-none space-y-6">
              <SectionHeading
                dark={dark}
                title="Custom Domain"
                description="Point your workspace to your own domain for a fully branded experience."
              />

              <div className={cn("flex border rounded-xl overflow-hidden h-11 items-center transition-all max-w-2xl",
                dark ? "bg-slate-950/50 border-slate-800 focus-within:border-primary/40" : "bg-white border-slate-200 focus-within:border-primary/40")}>
                <span className={cn("px-3 text-[10px] font-black uppercase tracking-widest border-r h-full flex items-center",
                  dark ? "text-slate-500 border-slate-800 bg-slate-900/40" : "text-slate-400 border-slate-200 bg-slate-50")}>https://</span>
                <input
                  placeholder="app"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className={cn("bg-transparent h-full text-[12px] font-black outline-none px-3 flex-1 min-w-0", text)}
                />
                <span className={cn("px-2 text-[12px] font-bold opacity-50 border-l h-full flex items-center", dark ? "border-slate-800" : "border-slate-200")}>.</span>
                <input
                  placeholder="yourdomain.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className={cn("bg-transparent h-full text-[12px] font-black outline-none px-3 flex-1 min-w-0", text)}
                />
              </div>

              <div className={cn("p-5 rounded-[1.25rem] border space-y-3 max-w-2xl", softBg, softBorder)}>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Info size={14} />
                  </div>
                  <div className="space-y-2">
                    <p className={cn("text-[11px] font-black uppercase tracking-widest", text)}>DNS Setup Required</p>
                    <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed", sub)}>
                      Custom domain connection requires DNS configuration. Allow up to 24 hours for SSL provisioning.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => updateBrandingMutation.mutate({ slug, domain: customDomain })}
                  disabled={updateBrandingMutation.isPending}
                  className={primaryBtn}
                >
                  {updateBrandingMutation.isPending ? "Connecting..." : "Connect Domain"}
                </button>
              </div>
            </TabsContent>

            {/* ── EMAIL TAB ── */}
            <TabsContent value="email" className="p-8 outline-none">
              {!showEmailForm ? (
                <div className="flex flex-col items-center justify-center text-center space-y-5 min-h-[260px]">
                  <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center shadow-inner group overflow-hidden">
                    <Mail className="w-8 h-8 text-primary transition-transform group-hover:scale-110" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>Custom Email Domain</h3>
                    <p className={cn("text-[12px] font-medium leading-relaxed opacity-60", sub)}>
                      Send notifications from your own branded email address instead of the default Ezconn domain.
                    </p>
                  </div>
                  <button onClick={() => setShowEmailForm(true)} className={primaryBtn}>
                    Configure SMTP
                  </button>
                </div>
              ) : (
                <div className="space-y-6 max-w-2xl">
                  <SectionHeading
                    dark={dark}
                    title="Configure Email Domain"
                    description="Enter the email address you want notifications to be sent from."
                  />

                  <div className="space-y-2">
                    <FieldLabel dark={dark}>Email Address</FieldLabel>
                    <div className={cn("flex border rounded-xl overflow-hidden h-11 items-center transition-all",
                      dark ? "bg-slate-950/50 border-slate-800 focus-within:border-primary/40" : "bg-white border-slate-200 focus-within:border-primary/40")}>
                      <input
                        value={emailUser}
                        onChange={(e) => setEmailUser(e.target.value)}
                        className={cn("w-28 h-full text-[12px] font-black outline-none px-3 border-r", dark ? "border-slate-800" : "border-slate-200", text)}
                      />
                      <div className={cn("h-full px-3 flex items-center text-slate-400 font-black text-base", dark ? "bg-slate-900/40" : "bg-slate-50")}>
                        @
                      </div>
                      <input
                        placeholder="your-domain.com"
                        value={emailDomain}
                        onChange={(e) => setEmailDomain(e.target.value)}
                        className={cn("flex-1 h-full text-[12px] font-black outline-none px-3 min-w-0", text)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowEmailForm(false)}
                      className={cn(
                        "h-11 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                        dark ? "border-slate-800 text-slate-300 hover:border-slate-700" : "border-slate-200 text-slate-700 hover:border-slate-300"
                      )}
                    >
                      Cancel
                    </button>
                    <button className={primaryBtn}>Continue</button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Helpers ── */

function SectionHeading({ dark, title, description }: { dark: boolean; title: string; description?: string }) {
  const text = dark ? "text-white" : "text-slate-900";
  const sub  = dark ? "text-slate-500" : "text-slate-400";
  return (
    <div className="space-y-1.5">
      <h3 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>{title}</h3>
      {description && (
        <p className={cn("text-[11px] font-medium leading-relaxed opacity-60 max-w-2xl", sub)}>{description}</p>
      )}
    </div>
  );
}

function FieldLabel({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const sub = dark ? "text-slate-400" : "text-slate-500";
  return (
    <label className={cn("text-[10px] font-black uppercase tracking-widest pl-1 block", sub)}>{children}</label>
  );
}

function SaveFooter({
  dark,
  onClick,
  loading,
  primaryBtn,
}: {
  dark: boolean;
  onClick: () => void;
  loading: boolean;
  primaryBtn: string;
}) {
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const border = dark ? "border-slate-800" : "border-slate-100";
  return (
    <div className={cn("flex items-center justify-end gap-3 pt-6 border-t", border)}>
      <p className={cn("text-[11px] font-bold opacity-50 mr-auto", sub)}>
        <Info size={12} className="inline-block mr-1.5 -mt-0.5" />
        Branding applies across the entire Workspace
      </p>
      <button onClick={onClick} disabled={loading} className={primaryBtn}>
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

function InfoNote({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";
  return (
    <div className={cn("p-4 rounded-[1.25rem] border flex gap-3 items-start", softBg, softBorder)}>
      <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
        <Info size={13} />
      </div>
      <p className={cn("text-[11px] font-medium leading-relaxed opacity-70", sub)}>{children}</p>
    </div>
  );
}

function ColorPicker({
  dark,
  label,
  value,
  onChange,
}: {
  dark: boolean;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const text = dark ? "text-white" : "text-slate-900";
  return (
    <div className="space-y-1.5">
      <FieldLabel dark={dark}>{label}</FieldLabel>
      <div className="relative">
        <div className={cn(
          "flex items-center gap-3 px-4 h-10 border rounded-xl transition-all hover:border-primary/40",
          dark ? "bg-slate-950/50 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div
            className="w-6 h-6 rounded-lg shadow-inner shrink-0 border"
            style={{ backgroundColor: value, borderColor: "rgba(0,0,0,0.1)" }}
          />
          <span className={cn("text-[12px] font-black tracking-tight flex-1", text)}>{value}</span>
          <div className="p-1 rounded-md bg-primary/10">
            <ChevronsUpDown className="w-3 h-3 text-primary" />
          </div>
        </div>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

function LogoUpload({
  dark,
  themeLabel,
  logoSrc,
  zoneBg,
  zoneBorder,
  onAction,
}: {
  dark: boolean;
  themeLabel: string;
  logoSrc: string;
  zoneBg: string;
  zoneBorder: string;
  onAction: (action: string) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel dark={dark}>{themeLabel}</FieldLabel>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className={cn(
            "relative group border-2 border-dashed rounded-[1.5rem] h-32 flex items-center justify-center cursor-pointer transition-all hover:border-primary/50",
            zoneBg,
            zoneBorder
          )}>
            <img src={logoSrc} alt={`${themeLabel} logo`} className="max-w-[180px] max-h-[64px] object-contain transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[1.5rem] flex items-center justify-center">
              <div className="p-2.5 rounded-xl bg-white/90 shadow-lg">
                <Upload className="w-4 h-4 text-primary" />
              </div>
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className={cn("w-52 rounded-xl p-1.5", dark ? "bg-[#0f1829] border-slate-800" : "")}>
          <DropdownMenuItem onClick={() => onAction("upload")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
            <Upload size={13} /> Upload New
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("gallery")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]">
            <ImageIcon size={13} /> From Gallery
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("remove")} className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500">
            <Trash2 size={13} /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

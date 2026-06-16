import React, { useState, useEffect, useRef } from 'react';
import { getUserInfo } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Settings, 
  CheckCircle2,
  Image as ImageIcon,
  Upload,
  ChevronDown,
  Trash2,
  ChevronUp,
  Mail,
  Zap,
  Info,
  ExternalLink
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTheme } from "@/contexts/ThemeContext";
import { hexToHsl } from "@/components/AgencyBrandingFetcher";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';

const AgencyWhiteLabelSettings = () => {
  const { mode, setAgencyPrimaryColor } = useTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const dark = mode === 'dark';
  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  // Force hide browser scrollbar for this page
  useEffect(() => {
    const targets: { el: HTMLElement; orig: string }[] = [];
    const hide = (el: HTMLElement | null) => {
      if (!el) return;
      targets.push({ el, orig: el.style.overflowY });
      el.style.overflowY = 'hidden';
    };
    hide(document.documentElement as HTMLElement);
    hide(document.body);
    let node = document.querySelector('main') as HTMLElement | null;
    while (node) {
      hide(node);
      node = node.parentElement as HTMLElement | null;
    }
    return () => {
      targets.forEach(({ el, orig }) => { el.style.overflowY = orig; });
    };
  }, []);

  const { data: agencyResponse } = useQuery({
    queryKey: [`/api/agencies/${agencyId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/agencies/${agencyId}`);
      return res.json();
    }
  });

  const [brandingData, setBrandingData] = useState({
    color: "#149f8f",
    logo: "",            // legacy alias = logo_light
    logo_light: "",
    logo_light_small: "",
    logo_dark: "",
    logo_dark_small: "",
    logo_small: "",      // legacy alias = logo_light_small
    favicon: "",
    slug: "",
    domain: ""
  });

  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailFormData, setEmailFormData] = useState({
    user: "info",
    domain: ""
  });

  useEffect(() => {
    if (agencyResponse?.agency?.branding) {
      const b = agencyResponse.agency.branding;
      setBrandingData({
        color: b.color || "#149f8f",
        logo: b.logo_light || b.logo || "",
        logo_light: b.logo_light || b.logo || "",
        logo_light_small: b.logo_light_small || b.logo_small || "",
        logo_dark: b.logo_dark || "",
        logo_dark_small: b.logo_dark_small || "",
        logo_small: b.logo_light_small || b.logo_small || "",
        favicon: b.favicon || "",
        slug: agencyResponse.agency.slug || "",
        domain: b.domain || ""
      });
    }
  }, [agencyResponse]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/agencies/${agencyId}/branding`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agencies/${agencyId}`] });
      toast({ title: t("agency.settings.general.updated") });
    }
  });

  const handleColorChange = (color: string) => {
    setBrandingData({ ...brandingData, color });
    setAgencyPrimaryColor(hexToHsl(color));
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(() => {
      updateMutation.mutate({ color });
    }, 500);
  };

  type BrandingAsset =
    | 'logo_light'
    | 'logo_light_small'
    | 'logo_dark'
    | 'logo_dark_small'
    | 'favicon'
    | 'logo'         // legacy alias
    | 'logo_small';  // legacy alias

  const handleFileUpload = async (file: File, type: BrandingAsset) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const res = await apiRequest("POST", "/api/gallery/upload", formData);
      const data = await res.json();
      if (data.success && data.media?.length > 0) {
        const fileUrl = data.media[0].file_url;
        setBrandingData(prev => ({ ...prev, [type]: fileUrl }));
        updateMutation.mutate({ [type]: fileUrl });
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = (type: BrandingAsset) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file, type);
    };
    input.click();
  };

  const handleRemoveAsset = (type: BrandingAsset) => {
    setBrandingData(prev => ({ ...prev, [type]: "" }));
    updateMutation.mutate({ [type]: null });
  };

  const features = [
    "agency.settings.general.whiteLabel.customize",
    "agency.settings.general.whiteLabel.logoDisplay",
    "agency.settings.general.whiteLabel.colorDisplay",
    "agency.settings.general.whiteLabel.emailUsage",
    "agency.settings.general.whiteLabel.whiteLabelAll"
  ];

  return (
    <div className={cn("h-screen overflow-hidden flex flex-col font-sans transition-all duration-300", bg)}>
      
      {/* ── Immersive Header ── */}
      <div className={cn("px-8 py-5 border-b flex items-center justify-between transition-colors", card, border)}>
        <div className="flex items-center gap-4">
          <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className={cn("text-[15px] font-black tracking-tight uppercase tracking-widest", text)}>White Label</h1>
            <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
              Personalize your agency branding and domains.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar pb-24">
        <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
          <CardContent className="p-0">
            <Tabs defaultValue="features" className="w-full">
              <div className={cn("px-8 border-b flex justify-start", dark ? "border-slate-800" : "border-slate-100")}>
                <TabsList className="h-auto p-0 gap-8 bg-transparent border-none flex w-full justify-start rounded-none">
                  {["features", "logo", "favicon", "colors", "domain", "notification"].map((tab) => (
                    <TabsTrigger 
                      key={tab}
                      value={tab} 
                      className={cn(
                        "px-1 py-5 rounded-none text-[11px] font-black uppercase tracking-widest transition-all shadow-none relative bg-transparent",
                        "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary",
                        "hover:text-primary border-b-2 border-transparent",
                        dark 
                          ? "text-slate-500 data-[state=active]:text-primary" 
                          : "text-slate-400 data-[state=active]:text-primary"
                      )}
                    >
                      {tab === "notification" ? t("agency.settings.general.whiteLabel.email") : t(`agency.settings.general.whiteLabel.${tab}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* ── Features Tab ── */}
              <TabsContent value="features" className="p-8 outline-none">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-5">
                    <div className="rounded-[2rem] bg-primary p-7 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-125 transition-all duration-700" />
                      
                      <div className="flex items-center gap-2 mb-6 relative">
                        <div className="p-2 bg-white/15 rounded-xl">
                          <Zap size={16} className="fill-white text-white" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Premium Branding</span>
                      </div>
                      
                      <h3 className="text-4xl font-black mb-1 tracking-tighter italic leading-none">$0</h3>
                      <p className="text-[12px] text-white/60 mb-8 font-bold">Lifetime White Label Access</p>

                      <button className="w-full py-3 rounded-xl bg-white text-primary text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
                        Explore All Features
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-7 flex flex-col justify-center">
                    <h3 className={cn("text-[16px] font-black tracking-tight mb-3", text)}>Personalize your Workspace</h3>
                    <p className={cn("text-[12px] font-medium leading-relaxed mb-6 opacity-60", sub)}>
                      Ditch our brand and make it yours. Your logo, your colors, and your own custom domain for all client interactions.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {features.map((feature, i) => (
                        <div key={i} className={cn("flex items-center gap-3 p-3.5 rounded-2xl border transition-all hover:bg-primary/5 group", 
                          dark ? "bg-slate-950/30 border-slate-800" : "bg-slate-50/50 border-slate-100")}>
                          <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
                            <CheckCircle2 size={14} strokeWidth={3} />
                          </div>
                          <span className={cn("text-[12px] font-bold truncate", text)}>{t(feature)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Logo Tab ── */}
              <TabsContent value="logo" className="p-8 space-y-8 outline-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Light Theme Logo */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><ImageIcon size={16} /></div>
                      <h4 className={cn("text-[12px] font-black uppercase tracking-widest", text)}>Light Theme Branding</h4>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", sub)}>{t("agency.settings.general.whiteLabel.fullLogo")}</p>
                        <div className={cn("w-full h-20 border-2 border-dashed rounded-[1.25rem] flex items-center justify-center relative group transition-all cursor-pointer overflow-hidden",
                          dark ? "bg-slate-950/50 border-slate-800 hover:border-primary/50" : "bg-slate-50/50 border-slate-200 hover:border-primary/30")}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="w-full h-full flex items-center justify-center">
                                {brandingData.logo ? (
                                  <img src={brandingData.logo} alt="Agency Logo" className="max-h-10 object-contain" />
                                ) : (
                                  <div className="flex items-center gap-2 opacity-40 grayscale group-hover:grayscale-0 transition-all">
                                    <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center font-black text-white text-[14px]">R</div>
                                    <span className={cn("text-[14px] font-black tracking-tighter", text)}>REPLYAGENT</span>
                                  </div>
                                )}
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className={cn("w-56 rounded-2xl p-2", dark ? "bg-[#0f1829] border-slate-800 text-white" : "")}>
                              <DropdownMenuItem onClick={() => handleUploadClick('logo')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[11px]">
                                <Upload size={14} /> {t("common.uploadNew")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRemoveAsset('logo')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[11px] text-rose-500 hover:text-rose-600">
                                <Trash2 size={14} /> {t("common.remove")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Icon Only Logo (App Icon) — backed by branding.mid_logo_light_small */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Zap size={16} /></div>
                      <h4 className={cn("text-[12px] font-black uppercase tracking-widest", text)}>App Icon</h4>
                    </div>
                    <div className="space-y-2">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", sub)}>{t("agency.settings.general.whiteLabel.smallLogo")}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className={cn("w-16 h-16 border-2 border-dashed rounded-[1.25rem] flex items-center justify-center relative group transition-all cursor-pointer overflow-hidden",
                            dark ? "bg-slate-950/50 border-slate-800 hover:border-primary/50" : "bg-slate-50/50 border-slate-200 hover:border-primary/30")}>
                            {brandingData.logo_small ? (
                              <img src={brandingData.logo_small} alt="App Icon" className="w-full h-full object-contain rounded-lg" />
                            ) : (
                              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-black text-white text-lg shadow-lg shadow-primary/20 transition-transform group-hover:scale-110">R</div>
                            )}
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className={cn("w-56 rounded-2xl p-2", dark ? "bg-[#0f1829] border-slate-800 text-white" : "")}>
                          <DropdownMenuItem onClick={() => handleUploadClick('logo_small')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[11px]">
                            <Upload size={14} /> {t("common.uploadNew")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRemoveAsset('logo_small')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[11px] text-rose-500 hover:text-rose-600">
                            <Trash2 size={14} /> {t("common.remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* ── Dark Theme Branding ── (replyagent parity: separate logos for dark backgrounds) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Dark Theme Wide Logo */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><ImageIcon size={16} /></div>
                      <h4 className={cn("text-[12px] font-black uppercase tracking-widest", text)}>Dark Theme Branding</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", sub)}>{t("agency.settings.general.whiteLabel.fullLogo")}</p>
                        <div className={cn("w-full h-20 border-2 border-dashed rounded-[1.25rem] flex items-center justify-center relative group transition-all cursor-pointer overflow-hidden",
                          "bg-slate-900 border-slate-800 hover:border-primary/50")}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="w-full h-full flex items-center justify-center">
                                {brandingData.logo_dark ? (
                                  <img src={brandingData.logo_dark} alt="Agency Dark Logo" className="max-h-10 object-contain" />
                                ) : (
                                  <div className="flex items-center gap-2 opacity-40 grayscale group-hover:grayscale-0 transition-all">
                                    <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center font-black text-white text-[14px]">R</div>
                                    <span className="text-[14px] font-black tracking-tighter text-white">REPLYAGENT</span>
                                  </div>
                                )}
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className={cn("w-56 rounded-2xl p-2", dark ? "bg-[#0f1829] border-slate-800 text-white" : "")}>
                              <DropdownMenuItem onClick={() => handleUploadClick('logo_dark')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[11px]">
                                <Upload size={14} /> {t("common.uploadNew")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRemoveAsset('logo_dark')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[11px] text-rose-500 hover:text-rose-600">
                                <Trash2 size={14} /> {t("common.remove")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dark Theme App Icon — backed by branding.mid_logo_dark_small */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Zap size={16} /></div>
                      <h4 className={cn("text-[12px] font-black uppercase tracking-widest", text)}>Dark App Icon</h4>
                    </div>
                    <div className="space-y-2">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", sub)}>{t("agency.settings.general.whiteLabel.smallLogo")}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className={cn("w-16 h-16 border-2 border-dashed rounded-[1.25rem] flex items-center justify-center relative group transition-all cursor-pointer overflow-hidden",
                            "bg-slate-900 border-slate-800 hover:border-primary/50")}>
                            {brandingData.logo_dark_small ? (
                              <img src={brandingData.logo_dark_small} alt="Dark App Icon" className="w-full h-full object-contain rounded-lg" />
                            ) : (
                              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-black text-white text-lg shadow-lg shadow-primary/20 transition-transform group-hover:scale-110">R</div>
                            )}
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className={cn("w-56 rounded-2xl p-2", dark ? "bg-[#0f1829] border-slate-800 text-white" : "")}>
                          <DropdownMenuItem onClick={() => handleUploadClick('logo_dark_small')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[11px]">
                            <Upload size={14} /> {t("common.uploadNew")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRemoveAsset('logo_dark_small')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[11px] text-rose-500 hover:text-rose-600">
                            <Trash2 size={14} /> {t("common.remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                <div className={cn("p-4 rounded-[1.25rem] flex gap-3 items-start border", dark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100")}>
                  <Info size={14} className="text-primary mt-0.5 shrink-0" />
                  <p className={cn("text-[11px] font-medium leading-relaxed opacity-60", sub)}>
                    Transparent PNG or SVG recommended. Logo: 460x140px | Icon: 256x256px. Upload separate light/dark versions so the logo always contrasts with the background.
                  </p>
                </div>
              </TabsContent>
              
              {/* ── Favicon Tab ── */}
              <TabsContent value="favicon" className="p-10 space-y-6 outline-none">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary"><ExternalLink size={18} /></div>
                  <h4 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Browser Favicon</h4>
                </div>
                
                <div className="space-y-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className={cn("w-16 h-16 border-2 border-dashed rounded-[1.25rem] flex items-center justify-center cursor-pointer transition-all hover:border-primary/50",
                        dark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200")}>
                        {brandingData.favicon ? (
                          <img src={brandingData.favicon} alt="Favicon" className="w-10 h-10 object-contain rounded-lg" />
                        ) : (
                          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-black text-white text-xs">R</div>
                        )}
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={cn("w-56 rounded-2xl p-2", dark ? "bg-[#0f1829] border-slate-800 text-white" : "")}>
                      <DropdownMenuItem onClick={() => handleUploadClick('favicon')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[12px]">
                        <Upload size={14} /> {t("common.uploadNew")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleRemoveAsset('favicon')} className="rounded-xl py-2.5 cursor-pointer gap-2 font-bold text-[12px] text-rose-500 hover:text-rose-600">
                        <Trash2 size={14} /> {t("common.remove")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p className={cn("text-[11px] font-bold opacity-40", sub)}>Square ICO or PNG (64x64px recommended)</p>
                </div>
              </TabsContent>

              {/* ── Colors Tab ── */}
              <TabsContent value="colors" className="p-10 space-y-8 outline-none">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary"><Zap size={18} /></div>
                  <h4 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Brand Colors</h4>
                </div>

                <div className="flex items-center gap-6">
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className={cn("flex items-center gap-4 px-5 py-3 border rounded-2xl cursor-pointer transition-all w-[240px] shadow-sm", 
                        dark ? "bg-slate-950/50 border-slate-800 hover:border-primary/50" : "bg-white border-slate-200 hover:border-primary/30")}>
                        <div className="w-6 h-6 rounded-lg shrink-0 shadow-lg" style={{ backgroundColor: brandingData.color }} />
                        <span className={cn("text-[14px] font-black tracking-tight flex-1", text)}>
                          {brandingData.color.toUpperCase()}
                        </span>
                        <div className="flex flex-col gap-0.5 opacity-30 group-hover:opacity-100 transition-all">
                          <ChevronUp size={12} />
                          <ChevronDown size={12} />
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className={cn("w-80 p-4 rounded-[1.5rem] border shadow-2xl transition-all", dark ? "bg-[#0f1829] border-slate-800" : "bg-white")}>
                      <HexColorPicker color={brandingData.color} onChange={handleColorChange} className="!w-full !h-40" />
                      <div className="flex items-center justify-between gap-3 mt-5">
                          {["R", "G", "B"].map((label, idx) => {
                            const r = parseInt(brandingData.color.slice(1, 3), 16) || 0;
                            const g = parseInt(brandingData.color.slice(3, 5), 16) || 0;
                            const b = parseInt(brandingData.color.slice(5, 7), 16) || 0;
                            const val = idx === 0 ? r : idx === 1 ? g : b;
                            return (
                              <div key={label} className="flex-1 space-y-1.5">
                                <div className={cn("rounded-xl py-2 text-center text-[11px] font-black border",
                                  dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-slate-50 border-slate-100 text-slate-800")}>
                                  {val}
                                </div>
                                <p className="text-[9px] text-center font-black uppercase tracking-widest opacity-40">{label}</p>
                              </div>
                            );
                          })}
                        </div>
                    </PopoverContent>
                  </Popover>
                  
                  <p className={cn("text-[13px] font-medium leading-relaxed opacity-60 max-w-sm", sub)}>
                    This primary color will be used for buttons, links, and accents across all your workspaces.
                  </p>
                </div>
              </TabsContent>

              {/* ── Domain Tab ── */}
              <TabsContent value="domain" className="p-8 space-y-7 outline-none">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><ExternalLink size={16} /></div>
                  <h4 className={cn("text-[12px] font-black uppercase tracking-widest", text)}>Custom Domains</h4>
                </div>

                <div className="flex items-center gap-3 max-w-2xl">
                   <div className={cn("flex border rounded-xl overflow-hidden h-11 items-center transition-all flex-1",
                     dark ? "bg-slate-950/50 border-slate-800 focus-within:border-primary/50" : "bg-white border-slate-200 focus-within:border-primary/30")}>
                      <span className={cn("px-4 text-[11px] font-black uppercase tracking-widest border-r h-full flex items-center transition-colors",
                        dark ? "text-slate-600 border-slate-800 bg-slate-900/30" : "text-slate-400 border-slate-100 bg-slate-50")}>https://</span>
                      <input 
                        placeholder="app" 
                        value={brandingData.slug}
                        onChange={(e) => setBrandingData({ ...brandingData, slug: e.target.value })}
                        className={cn("bg-transparent h-full text-[12px] font-black outline-none px-4 flex-1", text)} 
                      />
                      <span className={cn("px-4 text-[12px] font-bold text-slate-400 border-l h-full flex items-center", dark ? "border-slate-800" : "border-slate-100")}>.</span>
                      <input 
                        placeholder="yourdomain.com" 
                        value={brandingData.domain}
                        onChange={(e) => setBrandingData({ ...brandingData, domain: e.target.value })}
                        className={cn("bg-transparent h-full text-[12px] font-black outline-none px-4 flex-1", text)} 
                      />
                   </div>

                   <button 
                    onClick={() => updateMutation.mutate({ domain: brandingData.domain, slug: brandingData.slug })}
                    className="px-7 py-0 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white transition-all shadow-lg shadow-primary/20">
                      {updateMutation.isPending ? t("common.connecting") : t("common.connect")}
                   </button>
                </div>

                <div className={cn("p-5 rounded-[1.5rem] border space-y-3", dark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100")}>
                  <div className="flex gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary h-fit"><Info size={16} /></div>
                    <div className="space-y-2">
                      <h3 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>{t("agency.settings.general.whiteLabel.makeShine")}</h3>
                      <p className={cn("text-[11px] font-medium leading-relaxed opacity-60", sub)}>
                        Ditch the default domains and give your clients a fully branded experience under your own top-level domain.
                      </p>
                      <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 max-w-xl">
                        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={12} />
                        <p className={cn("text-[10px] font-bold leading-relaxed text-amber-600 dark:text-amber-500")}>
                          <span className="uppercase tracking-widest pr-1">Note:</span> Custom domain connection requires DNS configuration. Allow up to 24 hours for SSL.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── Notification Tab ── */}
              <TabsContent value="notification" className="p-8 outline-none">
                {!showEmailForm ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-5 min-h-[250px]">
                    <div className="w-16 h-16 bg-primary/10 rounded-[1.75rem] flex items-center justify-center shadow-inner group overflow-hidden">
                       <Mail className="w-8 h-8 text-primary transition-transform group-hover:scale-110" />
                    </div>
                    
                    <div className="space-y-1.5">
                      <h3 className={cn("text-[16px] font-black tracking-tight", text)}>{t("agency.settings.general.whiteLabel.email")}</h3>
                      <p className={cn("text-[12px] font-medium max-w-sm mx-auto opacity-60", sub)}>
                        {t("agency.settings.general.whiteLabel.emailIntegrate")}
                      </p>
                    </div>

                    <button 
                      onClick={() => setShowEmailForm(true)}
                      className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white transition-all shadow-lg shadow-primary/20">
                      {t("common.connectNow")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-2xl">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5">
                        <label className={cn("text-[12px] font-black uppercase tracking-widest", text)}>{t("agency.settings.general.whiteLabel.enterDomain")}</label>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className={cn("flex border rounded-xl overflow-hidden h-11 items-center transition-all flex-1",
                          dark ? "bg-slate-950/50 border-slate-800" : "bg-white border-slate-200")}>
                          <input 
                            value={emailFormData.user}
                            onChange={(e) => setEmailFormData(prev => ({ ...prev, user: e.target.value }))}
                            className={cn("w-24 h-full text-[12px] font-black outline-none px-4 border-r", dark ? "border-slate-800" : "border-slate-100", text)} 
                          />
                          <div className={cn("h-full px-3 flex items-center text-slate-400 font-black text-md", dark ? "bg-slate-900/30" : "bg-slate-50")}>
                            @
                          </div>
                          <input 
                            placeholder="your-domain.com"
                            value={emailFormData.domain}
                            onChange={(e) => setEmailFormData(prev => ({ ...prev, domain: e.target.value }))}
                            className={cn("flex-1 h-full text-[12px] font-black outline-none px-4", text)} 
                          />
                        </div>
                        
                        <button className="h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20">
                           {t("common.continue")}
                        </button>
                        <button onClick={() => setShowEmailForm(false)} className={cn("h-11 w-11 rounded-xl flex items-center justify-center border", dark ? "border-slate-800 hover:bg-slate-900" : "border-slate-100 hover:bg-slate-50")}>
                          <X size={16} className="opacity-40" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Supporting Icons not imported
const X = ({ size, className }: { size: number; className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
const AlertCircle = ({ size, className }: { size: number; className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>;

export default AgencyWhiteLabelSettings;

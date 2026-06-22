import React, { useState, useEffect } from 'react';
import { getUserInfo } from "@/lib/auth";
import { 
  Bell,
  Save,
  Globe,
  Settings,
  Mail
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';

const AgencyNotificationsSettings = () => {
  const { mode } = useTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const [notifEmail, setNotifEmail] = useState("");
  const [notifLanguage, setNotifLanguage] = useState("en-US");

  const { data: agencyResponse } = useQuery({
    queryKey: [`/api/agencies/${agencyId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/agencies/${agencyId}`);
      return res.json();
    }
  });

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

  useEffect(() => {
    if (agencyResponse?.agency) {
      setNotifEmail(agencyResponse.agency.notification_email || "");
      setNotifLanguage(agencyResponse.agency.notification_language || "en-US");
    }
  }, [agencyResponse]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/agencies/${agencyId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agencies/${agencyId}`] });
      toast({ title: t("common.saved"), description: t("agency.settings.notifications.updated") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("common.errorDesc"), variant: "destructive" });
    }
  });

  const LANGUAGES = [
    { code: "en-US", label: t("common.languages.en"), flag: "us" },
    { code: "es-ES", label: t("common.languages.es"), flag: "es" },
    { code: "pt-BR", label: t("common.languages.pt"), flag: "br" },
  ];

  const selectedLang = LANGUAGES.find(l => l.code === notifLanguage) || LANGUAGES[0];
  const dark = mode === 'dark';

  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={cn("h-screen overflow-hidden transition-colors flex flex-col font-sans", bg)}>
      
      {/* ── Header Card ── */}
      <div className={cn('px-8 py-5 border-b flex items-center justify-between', card, border)}>
        <div className="flex items-center gap-4">
          <div className={cn('p-2.5 rounded-xl shadow-sm', dark ? 'bg-primary/15' : 'bg-primary/10')}>
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className={cn('text-[15px] font-bold', text)}>{t("agency.settings.notifications.title")}</h1>
            <p className={cn('text-[11px] mt-0.5', sub)}>
              {t("agency.settings.notifications.updated")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-8">
        <div className={cn("rounded-2xl border overflow-hidden shadow-sm h-fit max-h-full", card, border)}>
          <div className="p-8 max-w-[550px] space-y-8">
            
            {/* Notification Email Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Mail size={16} strokeWidth={2.5} />
                <label className={cn("text-[12px] font-black uppercase tracking-widest", text)}>
                  {t("agency.settings.notifications.email")}
                </label>
              </div>
              
              <div className="space-y-2">
                <Input 
                  value={notifEmail}
                  onChange={(e) => setNotifEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className={cn("text-[13px] h-11 px-4 rounded-xl transition-all border shadow-none focus-visible:ring-primary/20 focus-visible:border-primary/50", 
                    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900")} 
                />
                <p className={cn("text-[11px] font-bold leading-relaxed", sub)}>
                  {t("agency.settings.notifications.emailDesc")}
                </p>
              </div>
            </div>

            <div className={cn("h-px w-full", dark ? "bg-slate-800/50" : "bg-slate-100")}></div>

            {/* Notification Language Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Globe size={16} strokeWidth={2.5} />
                <label className={cn("text-[12px] font-black uppercase tracking-widest", text)}>
                  {t("common.languages_label", "Languages")}
                </label>
              </div>

              <div className="space-y-2">
                <Select value={notifLanguage} onValueChange={setNotifLanguage}>
                  <SelectTrigger className={cn("text-[13px] h-11 px-4 rounded-xl transition-all border shadow-none focus-visible:ring-primary/20", 
                    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900")}>
                    <SelectValue placeholder={t("agency.settings.notifications.selectLanguage")}>
                      <div className="flex items-center gap-2">
                        <img src={`https://flagcdn.com/w20/${selectedLang.flag}.png`} width="20" alt={selectedLang.flag} className="rounded-sm" />
                        <span className="font-bold">{selectedLang.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className={cn("border shadow-2xl rounded-xl overflow-hidden", 
                    dark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900")}>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code} className="text-[13px] font-bold focus:bg-primary focus:text-primary-foreground">
                        <div className="flex items-center gap-2">
                          <img src={`https://flagcdn.com/w20/${lang.flag}.png`} width="20" alt={lang.flag} className="rounded-sm" />
                          <span>{lang.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={cn("text-[11px] font-bold leading-relaxed", sub)}>
                  {t("agency.settings.notifications.languageDesc")}
                </p>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              <button 
                onClick={() => updateMutation.mutate({ notification_email: notifEmail, notification_language: notifLanguage })}
                disabled={updateMutation.isPending}
                className={cn(
                  "px-10 py-3 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all shadow-lg",
                  "bg-primary text-white hover:bg-primary/90 shadow-primary/20 active:scale-95 disabled:opacity-50"
                )}>
                {updateMutation.isPending ? t("common.saving") : t("common.save")}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencyNotificationsSettings;

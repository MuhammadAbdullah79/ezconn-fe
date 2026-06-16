import React, { useState, useEffect } from 'react';
import { Plug, Copy, RefreshCw, CheckCircle, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";

const AgencyAPI = () => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Force hide all scrollbars for this page
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

  const { data: tokenData, isLoading } = useQuery({
    queryKey: ['/api/users/api-token'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/api-token");
      return res.json();
    },
  });

  const apiKey: string = tokenData?.api_token ?? "";
  const hasKey = !!apiKey;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users/api-token");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/users/api-token'], { success: true, api_token: data.api_token });
      toast({
        title: t("agency.api.generated_toast"),
        description: t("agency.api.generated_desc"),
      });
    },
    onError: (err: unknown) => {
      if (!(err instanceof ApiError)) {
        toast({ title: t("common.error"), description: t("common.errorDesc"), variant: "destructive" });
      }
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast({
      title: t("common.copied"),
      description: t("agency.api.copied_desc"),
    });
    setTimeout(() => setCopied(false), 2000);
  };

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
            <Plug className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className={cn('text-[15px] font-bold', text)}>{t("agency.api.title")}</h1>
            <p className={cn('text-[11px] mt-0.5', sub)}>
              {t("agency.api.desc")}
            </p>
          </div>
        </div>

        <button className={cn("px-5 py-2 rounded-lg font-bold text-[12px] transition-all border shadow-sm",
          dark
            ? "bg-slate-800/50 hover:bg-primary text-primary hover:text-white border-primary/30 hover:border-primary"
            : "bg-white hover:bg-primary hover:text-white text-primary border-primary/20 hover:border-primary")}>
           {t("agency.api.view_instructions")}
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-8">
        {/* Unified Main Card */}
        <div className={cn("flex flex-col rounded-2xl border overflow-hidden shadow-sm h-fit max-w-4xl mx-auto", card, border)}>

          <div className="min-h-[400px] flex flex-col items-center justify-center text-center py-16 px-6">

            {/* Visual Icon */}
            <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-inner",
              dark ? "bg-slate-900/50" : "bg-slate-50")}>
              {isLoading
                ? <Loader2 className="w-10 h-10 text-primary opacity-80 animate-spin" strokeWidth={1.5} />
                : <Plug className="w-10 h-10 text-primary opacity-80" strokeWidth={1.5} />
              }
            </div>

            {isLoading ? (
              <p className={cn("text-[13px] font-medium", sub)}>Loading…</p>
            ) : !hasKey ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className={cn("text-[22px] font-black mb-2 tracking-tight", text)}>
                  {t("agency.api.key_title")}
                </h2>
                <p className={cn("text-[13px] mb-8 font-medium max-w-md mx-auto leading-relaxed", sub)}>
                  {t("agency.api.key_desc_empty")}
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="px-10 py-3 rounded-xl font-bold text-[13px] transition-all bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2 mx-auto">
                  {generateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  {t("agency.api.generate_key")}
                </button>
              </div>
            ) : (
              <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-500">
                <h2 className={cn("text-[24px] font-black mb-2 tracking-tight", text)}>
                  {t("agency.api.your_key_title")}
                </h2>
                <p className={cn("text-[13px] mb-8 font-medium mx-auto", sub)}>
                  {t("agency.api.your_key_desc")}
                </p>

                {/* API Key Box */}
                <div className="relative mb-8 group w-full max-w-[600px] mx-auto">
                  <input
                    type="text"
                    readOnly
                    value={apiKey}
                    className={cn("w-full px-6 py-4 rounded-xl border text-center font-mono text-[13px] font-bold tracking-wider transition-all focus:outline-none shadow-sm",
                      dark
                        ? "bg-slate-950/50 border-slate-800 text-slate-300 focus:border-primary/50"
                        : "bg-slate-50/50 border-slate-100 text-slate-600 focus:border-primary/30")}
                  />
                  <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending}
                    className={cn("px-6 py-3 rounded-xl font-bold text-[13px] transition-all border flex items-center gap-2 shadow-sm disabled:opacity-50",
                      dark
                        ? "bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-slate-700"
                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200")}>
                    {generateMutation.isPending
                      ? <Loader2 size={16} className="animate-spin" />
                      : <RefreshCw size={16} className="opacity-70" />
                    }
                    {t("agency.api.regenerate_key")}
                  </button>

                  <button
                    onClick={handleCopy}
                    className={cn("px-10 py-3 rounded-xl font-bold text-[13px] transition-all border flex items-center gap-2 shadow-lg",
                      copied
                        ? "bg-green-500 text-white border-green-500 shadow-green-500/20"
                        : "bg-primary text-white border-primary hover:bg-primary/90 shadow-primary/20")}>
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    {copied ? t("common.copied") : t("common.copy")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencyAPI;

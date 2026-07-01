import React, { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface AIAssistantSettings {
  agreeToTerms: boolean;
  contentPrompts: boolean;
}

const DEFAULT_SETTINGS: AIAssistantSettings = {
  agreeToTerms: false,
  contentPrompts: false,
};

const AIAssistantsSection = () => {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<AIAssistantSettings>(DEFAULT_SETTINGS);

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const outlineBtn = cn(
    "h-10 px-5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const { isLoading, data: fetchedData } = useQuery<AIAssistantSettings>({
    queryKey: ["/api/workspaces/ai-assistant-settings"],
  });

  useEffect(() => {
    if (fetchedData) setSettings(fetchedData);
  }, [fetchedData]);

  const mutation = useMutation({
    mutationFn: async (data: AIAssistantSettings) => {
      const res = await apiRequest("POST", "/api/workspaces/ai-assistant-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/ai-assistant-settings"] });
      toast({ title: "Settings Saved", description: "AI Assistants settings have been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleTermsChange = (checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      agreeToTerms: checked,
      contentPrompts: checked ? prev.contentPrompts : false,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>AI assistants</h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60 max-w-2xl", sub)}>
                These settings apply to the entire account.
              </p>
            </div>
          </div>
          <button
            onClick={() => mutation.mutate(settings)}
            disabled={mutation.isPending}
            className={primaryBtn}
          >
            {mutation.isPending && <Loader2 size={12} className="animate-spin" />}
            Save
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Content Prompts */}
          <div className={cn("rounded-[1.5rem] border p-6 space-y-4", softBg, softBorder)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className={cn("text-[13px] font-black", text)}>Content Prompts</h4>
                <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed mt-1 max-w-2xl", sub)}>
                  Lets agents use AI to rewrite and refine responses in real time during customer conversations.
                </p>
              </div>
              <Switch
                aria-label="Enable Content Prompts"
                checked={settings.contentPrompts}
                onCheckedChange={(val) => setSettings((prev) => ({ ...prev, contentPrompts: val }))}
                disabled={!settings.agreeToTerms}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            <div className={cn("flex items-start gap-3 p-4 rounded-xl border", "border-primary/20 bg-primary/5")}>
              <input
                type="checkbox"
                id="terms"
                checked={settings.agreeToTerms}
                onChange={(e) => handleTermsChange(e.target.checked)}
                className="rounded accent-[hsl(var(--primary))] w-4 h-4 mt-0.5 shrink-0"
              />
              <label htmlFor="terms" className={cn("text-[11px] font-medium leading-relaxed cursor-pointer", sub)}>
                By using this tool, you agree to comply with Google's{" "}
                <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">
                  Gemini API Additional Terms of Service
                </a>{" "}
                and{" "}
                <a href="https://policies.google.com/terms/generative-ai/use-policy" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">
                  Generative AI Prohibited Use Policy
                </a>
                . Please avoid sharing any sensitive information in your prompts.
              </label>
            </div>
          </div>

          {/* Customer Analysis */}
          <div className={cn("rounded-[1.5rem] border p-6 space-y-4", softBg, softBorder)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className={cn("text-[13px] font-black", text)}>Customer Analysis</h4>
                <p className={cn("text-[11px] font-medium opacity-60 leading-relaxed mt-1 max-w-2xl", sub)}>
                  Lets agents use AI to understand customer conversations — generate summaries, run sentiment analysis, and more.
                </p>
              </div>
              <button
                onClick={() => toast({ title: "Request Sent", description: "Your request for access has been sent." })}
                className={cn(outlineBtn, "shrink-0 border-primary text-primary hover:bg-primary hover:text-white")}
              >
                Request Access
              </button>
            </div>

            <div className={cn("pt-4 border-t", softBorder)}>
              <p className={cn("text-[11px] font-bold opacity-60", sub)}>
                Available in these modules
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {["Chat Manager", "Insights"].map((m) => (
                  <span
                    key={m}
                    className="inline-flex h-6 px-3 items-center rounded-md border border-primary/20 bg-primary/5 text-primary text-[11px] font-semibold"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIAssistantsSection;

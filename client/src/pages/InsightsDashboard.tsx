"use client";

import React, { useState } from "react";
import { Download, Calendar } from "react-feather";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

import { DateRangeProvider, useDateRange } from "@/contexts/DateRangeContext";
import { TabProvider, useTab } from "@/contexts/TabContext";
import { ExportProvider, useExport } from "@/contexts/ExportContext";

import OverviewTab from "@/components/tabs/OverviewTab";
import AgentPerformanceTab from "@/components/tabs/agent-performance/AgentPerformanceTab";
import WhatsAppPricingTab from "@/components/tabs/whatsapp-pricing/WhatsAppPricingTab";
import BotDashboardTab from "@/components/tabs/BotDashboardTab";
import VoiceOfCustomerTab from "@/components/tabs/voice-of-customer/VoiceOfCustomerTab";
import CSATDashboardTab from "@/components/tabs/csat-dashboard/CSATDashboardTab";
import ExportModal from "@/components/ExportModal";

import {
  LayoutDashboard,
  UserCheck,
  MessageSquare,
  Cpu,
  Mic,
  Star,
  TrendingUp
} from "lucide-react";

function InsightsDashboardContent() {
  const { dateRange, setDateRange, customDate, setCustomDate, isCustomDateOpen, setIsCustomDateOpen } = useDateRange();
  const { activeTab, setActiveTab } = useTab();
  const { isExportModalOpen, setIsExportModalOpen } = useExport();
  const [localActiveTab, setLocalActiveTab] = useState(activeTab);

  const tabs = [
    { id: "overview", label: "Overview", ctx: "overview", icon: <LayoutDashboard size={14} /> },
    { id: "agent-performance", label: "Performance", ctx: "agentPerformance", icon: <UserCheck size={14} /> },
    { id: "whatsapp-pricing", label: "WhatsApp", ctx: "whatsapp", icon: <MessageSquare size={14} /> },
    { id: "bot-dashboard", label: "Bot", ctx: "botDashboard", icon: <Cpu size={14} /> },
    { id: "voice-of-customer", label: "Voice", ctx: "voiceOfCustomer", icon: <Mic size={14} /> },
    { id: "csat-dashboard", label: "CSAT", ctx: "csatDashboard", icon: <Star size={14} /> },
  ];

  return (
    <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out" data-testid="insights-dashboard">
      {/* Header Row: Title on Left, Everything else on Right */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800/50">
        {/* Title Section: Elegant with Icon */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/10 shadow-inner">
            <TrendingUp size={24} strokeWidth={2.5} />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Insights <span className="text-primary font-bold opacity-90">Dashboard</span>
            </h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 opacity-80">
              Track performance, analyze trends, and optimize operations
            </p>
          </div>
        </div>

        {/* Right side group: Tabs + Actions */}
        <div className="flex items-center gap-3">
          {/* Navigation Tabs - More compact with icons */}
          <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl p-1 border border-slate-200/50 dark:border-slate-700/50 w-fit shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setLocalActiveTab(tab.id);
                  setActiveTab(tab.ctx);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 relative group",
                  localActiveTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/50 shadow-none hover:shadow-sm"
                )}
                data-testid={`tab-${tab.id}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="h-3 w-[1px] bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-2">
            {/* Date Range Selector */}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger
                className="w-[120px] h-7 rounded-lg bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-semibold shadow-sm no-focus-outline"
              >
                <div className="flex items-center gap-2 text-primary">
                  <Calendar className="h-2.5 w-2.5" />
                  <span className="text-[9.5px] font-bold"><SelectValue /></span>
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl no-focus-outline">
                <SelectItem value="last-7-days" className="text-xs">Last 7 Days</SelectItem>
                <SelectItem value="last-14-days" className="text-xs">Last 14 Days</SelectItem>
                <SelectItem value="last-30-days" className="text-xs">Last 30 Days</SelectItem>
                <SelectItem value="this-month" className="text-xs">This Month</SelectItem>
                <SelectItem value="this-quarter" className="text-xs">This Quarter</SelectItem>
                <SelectItem value="custom" className="text-xs">Custom</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Picker */}
            {dateRange === "custom" && (
              <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-8 rounded-lg px-3 gap-2 font-semibold bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 transition-all duration-300 hover:bg-white dark:hover:bg-slate-700"
                  >
                    <Calendar className="h-3 w-3 text-primary" />
                    <span className="text-[11px]">
                      {customDate
                        ? customDate.to
                          ? `${customDate.from ? format(customDate.from, 'dd/MM/yy') : ""} - ${customDate.to ? format(customDate.to, 'dd/MM/yy') : ""}`
                          : customDate.from ? format(customDate.from, 'dd/MM/yy') : ""
                        : "Select Date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={customDate?.from}
                    selected={customDate}
                    onSelect={setCustomDate}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Export Button - Height aligned with Date Range and Tabs */}
            <Button
              onClick={() => setIsExportModalOpen(true)}
              variant="outline"
              className="h-7 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[9.5px] shadow-sm transition-all duration-300 active:scale-95 flex items-center gap-2 hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-none"
              data-testid="export-button"
            >
              <Download size={10} />
              <span>Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Content with Entry Animation - Increased Spacing for Better Alignment */}
      <div className="mt-10 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {localActiveTab === "overview" && <OverviewTab />}
        {localActiveTab === "agent-performance" && <AgentPerformanceTab />}
        {localActiveTab === "whatsapp-pricing" && <WhatsAppPricingTab />}
        {localActiveTab === "bot-dashboard" && <BotDashboardTab />}
        {localActiveTab === "voice-of-customer" && <VoiceOfCustomerTab />}
        {localActiveTab === "csat-dashboard" && <CSATDashboardTab />}
      </div>

      <ExportModal />
    </div>
  );
}

export default function InsightsDashboard() {
  return (
    <DateRangeProvider>
      <TabProvider>
        <ExportProvider>
          <InsightsDashboardContent />
        </ExportProvider>
      </TabProvider>
    </DateRangeProvider>
  );
}
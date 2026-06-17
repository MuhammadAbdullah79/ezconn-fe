import { useState, useRef, useEffect } from "react";
import { Plus, BarChart2, Edit2, Copy, Trash2, Send, Zap, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Archive, Calendar, FileText, X, Download, Paperclip } from "react-feather";
import { ChartContainer } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, ChevronDown, ChevronsUpDown, ChevronUp, ChevronDown as ChevronDownIcon, ArrowLeft, Info, Activity, Megaphone, MessageSquare } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import PreviewV2 from "@/components/PreviewV2";
import { useToast } from "@/hooks/use-toast";
import CustomDropdown from "@/components/CustomDropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

interface SortEntry {
  column: string;
  direction: "asc" | "desc";
}

interface Campaign {
  id: number;
  name: string;
  type: string;
  messageType: string;
  sent: number;
  delivered: number;
  status: string;
  // New fields for API Triggered
  startDate?: Date;
  endDate?: Date;
  neverEnds?: boolean;
  whatsAppTemplateName: string;
  // New fields for Broadcast
  schedules?: Schedule[];
  recurringStartDate?: Date;
  recurringEndDate?: Date;
  recurringTime?: { hour: string; minute: string; period: string };
  repeatFrequency?: string;
  dailyRepeatInterval?: string;
  weeklyRepeatDays?: string[];
  monthlyRepeatDates?: number[];
  deliverInTimezone?: boolean;
  csvFileName?: string;
  csvContent?: any[];
  recipients?: Recipient[];
  engagementData?: EngagementData[];
  scheduledAt?: Date;
}

interface Schedule {
  id: number;
  date: Date | undefined;
  hour: string;
  minute: string;
  period: string;
}

interface Recipient {
  id: number;
  name: string;
  phone: string;
  status: "Sent" | "Delivered" | "Viewed" | "Failed";
  time: string;
}

interface EngagementData {
  hour: string;
  delivered: number;
  viewed: number;
}

export default function CampaignManager() {
  const { toast } = useToast();
  const [selectedCampaigns, setSelectedCampaigns] = useState<number[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [activeDetailsTab, setActiveDetailsTab] = useState("details");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<string[]>([]);
  const [selectedMessageTypes, setSelectedMessageTypes] = useState<string[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
  const [sort, setSort] = useState<SortEntry | null>(null);
  const [csvSort, setCsvSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [campaignCreationStep, setCampaignCreationStep] = useState<"selectType" | "apiTriggeredForm" | "broadcastForm">("selectType");
  const [editingCampaignId, setEditingCampaignId] = useState<number | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignStartDate, setCampaignStartDate] = useState<Date | undefined>(undefined);
  const [campaignEndDate, setCampaignEndDate] = useState<Date | undefined>(undefined);
  const [selectedWhatsAppTemplate, setSelectedWhatsAppTemplate] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);
  const [neverEnds, setNeverEnds] = useState(false);
  const [broadcastCampaignType, setBroadcastCampaignType] = useState("");
  const [deliverInTimezone, setDeliverInTimezone] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [localCsvData, setLocalCsvData] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isViewCsvModalOpen, setIsViewCsvModalOpen] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([{ id: Date.now(), date: undefined, hour: "", minute: "", period: "" }]);

  // For Recurring Broadcast
  const [recurringStartDate, setRecurringStartDate] = useState<Date | undefined>(undefined);
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);
  const [recurringTime, setRecurringTime] = useState({ hour: "", minute: "", period: "" });
  const [repeatFrequency, setRepeatFrequency] = useState(""); // "daily", "weekly", "monthly"
  const [dailyRepeatInterval, setDailyRepeatInterval] = useState("1"); // "1" for "Single Day", "2" for "2 Days" etc.
  const [weeklyRepeatDays, setWeeklyRepeatDays] = useState<string[]>([]); // e.g., ["mon", "tue"]
  const [monthlyRepeatDates, setMonthlyRepeatDates] = useState<number[]>([]); // e.g., [1, 15, 31]

  // For Popover states
  const [recurringStartPickerOpen, setRecurringStartPickerOpen] = useState(false);
  const [recurringEndPickerOpen, setRecurringEndPickerOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch campaigns from backend
  const { data: broadcastsData, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["/api/broadcasts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/broadcasts");
      return res.json();
    }
  });

  // Channels (WhatsApp accounts) — drives which channel the new broadcast
  // gets bound to. We auto-select the first one so the existing create form
  // doesn't need an extra picker; users with multiple accounts can extend
  // later. Without a channel the backend rejects the create.
  const { data: channelsResponse } = useQuery<any>({
    queryKey: ["/api/broadcasts/channels"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/broadcasts/channels");
      return res.json();
    },
  });
  const channels: any[] = channelsResponse?.channels ?? [];
  const defaultChannel = channels[0] ?? null;

  // Real WhatsApp templates (approved only) — replaces the previous hardcoded
  // mock list. The shape returned by the backend (`components` array, Meta
  // format) gets flattened into the {header, body, footer, variables, buttons}
  // shape PreviewV2 + the form selects expect.
  const { data: templatesResponse } = useQuery<any>({
    queryKey: ["/api/broadcasts/templates", defaultChannel?.channelable_id ?? ""],
    queryFn: async () => {
      const channelParam = defaultChannel?.channelable_id
        ? `?channelable_id=${defaultChannel.channelable_id}`
        : "";
      const res = await apiRequest("GET", `/api/broadcasts/templates${channelParam}`);
      return res.json();
    },
    enabled: !!defaultChannel,
  });

  const createBroadcastMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/broadcasts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      toast({
        title: "Broadcast Created",
        description: "Your broadcast has been created successfully.",
      });
      setCreateOpen(false);
      resetCreateCampaignForm();
    }
  });

  const updateBroadcastMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PATCH", `/api/broadcasts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      toast({
        title: "Broadcast Updated",
        description: "Your broadcast has been updated successfully.",
      });
      setCreateOpen(false);
      setEditingCampaignId(null);
      resetCreateCampaignForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/broadcasts/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Campaign deleted",
        description: "The campaign has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      setShowDeleteModal(false);
      setCampaignToDelete(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  // Real WhatsApp templates. The backend returns each Meta `components` array;
  // we flatten the HEADER/BODY/FOOTER/BUTTONS entries into the simpler shape
  // PreviewV2 + the existing form code already understand. Variables are
  // pulled out of the body text by counting `{{1}}` `{{2}}` placeholders.
  // NOTE: declared BEFORE `campaigns` because that memo references this
  // value — flipping the order causes a TDZ runtime crash.
  const whatsappTemplates = useMemo(() => {
    const list: any[] = templatesResponse?.templates ?? [];
    return list.map((t: any) => {
      const components: any[] = Array.isArray(t.components) ? t.components : [];
      const header = components.find((c) => c?.type === "HEADER");
      const body = components.find((c) => c?.type === "BODY");
      const footer = components.find((c) => c?.type === "FOOTER");
      const buttonsBlock = components.find((c) => c?.type === "BUTTONS");

      const bodyText: string = body?.text ?? "";
      const placeholderCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;
      const variables = Array.from({ length: placeholderCount }, (_, i) => `param_${i + 1}`);
      const variableSamples: Record<string, string> = {};
      variables.forEach((v) => (variableSamples[v] = ""));

      return {
        id: Number(t.id),
        backend_id: t.id, // preserve string form for write-back
        name: t.name,
        category: t.category,
        language: t.language,
        body: bodyText,
        header: header?.text ?? "",
        footer: footer?.text ?? "",
        variables,
        variableSamples,
        buttons: Array.isArray(buttonsBlock?.buttons)
          ? buttonsBlock.buttons.map((b: any, idx: number) => ({
              id: idx + 1,
              type: b?.type ?? "quick-reply",
              buttonText: b?.text ?? "",
              websiteUrl: b?.url ?? "",
              phoneNumber: b?.phone_number ?? "",
            }))
          : [],
      };
    });
  }, [templatesResponse]);

  const campaigns = useMemo(() => {
    if (!broadcastsData?.broadcasts) return [];
    const templateById = new Map<number, any>();
    whatsappTemplates.forEach((t: any) => templateById.set(t.id, t));

    // Backend status (lowercase: draft / pending / in_progress / completed /
    // failed) → the UI status vocab used by the badge colours and filters.
    const statusToUi: Record<string, string> = {
      draft: "draft",
      pending: "scheduled",
      in_progress: "sending",
      completed: "sent",
      failed: "failed",
    };

    return (broadcastsData.broadcasts as any[]).map((b: any) => {
      const rawStatus = String(b.status ?? "draft").toLowerCase();
      const uiStatus = statusToUi[rawStatus] ?? rawStatus;
      const metaType = b.metadata?.type ?? (b.channel_type === "whatsapp" ? "Broadcast" : "API Triggered");
      const metaMessageType =
        b.metadata?.messageType ?? b.metadata?.message_type ?? (b.scheduled_at ? "Scheduled" : "Immediate");
      const templateRow = b.wa_template_id ? templateById.get(Number(b.wa_template_id)) : null;

      return {
        id: Number(b.id),
        name: b.name,
        type: metaType,
        messageType: metaMessageType,
        sent: b.total_sent || 0,
        delivered: b.total_sent || 0, // Per-recipient delivery tracking not wired yet; falls back to total_sent
        status: uiStatus,
        whatsAppTemplateName: templateRow?.name ?? (b.metadata?.whatsAppTemplateName ?? ""),
        startDate: b.created_at ? new Date(b.created_at) : undefined,
        scheduledAt: b.scheduled_at ? new Date(b.scheduled_at) : undefined,
        repeatFrequency: b.repeat_frequency || "",
        dailyRepeatInterval: b.daily_repeat_interval || "1",
        weeklyRepeatDays: Array.isArray(b.weekly_repeat_days) ? b.weekly_repeat_days : [],
        monthlyRepeatDates: Array.isArray(b.monthly_repeat_dates) ? b.monthly_repeat_dates : [],
        deliverInTimezone: !!b.deliver_in_timezone,
        csvFileName: b.csv_filename || "",
        recurringStartDate: b.start_date ? new Date(b.start_date) : undefined,
        recurringEndDate: b.end_date ? new Date(b.end_date) : undefined,
        recurringTime: b.recurring_time ? b.recurring_time : { hour: "", minute: "", period: "" },
        endDate: b.end_date ? new Date(b.end_date) : undefined,
        neverEnds: !!b.never_ends,
      };
    }) as Campaign[];
  }, [broadcastsData, whatsappTemplates]);

  const handleConfirmDelete = () => {
    if (campaignToDelete) {
      deleteMutation.mutate(campaignToDelete.id);
    }
  };

  // Modal states
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneCampaignName, setCloneCampaignName] = useState("");
  const [campaignToCloneId, setCampaignToCloneId] = useState<number | null>(null);
  const [selectedCampaignForPerformance, setSelectedCampaignForPerformance] = useState<Campaign | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [campaignToArchive, setCampaignToArchive] = useState<Campaign | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [recipientSort, setRecipientSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientRowsPerPage, setRecipientRowsPerPage] = useState(10);
  const [selectedRecipientStatus, setSelectedRecipientStatus] = useState<string[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleColumnSort = (column: string) => {
    if (sort?.column === column) {
      // Toggle: asc -> desc -> unsorted
      if (sort.direction === "asc") {
        setSort({ column, direction: "desc" });
      } else {
        setSort(null);
      }
    } else {
      // New column, start with asc
      setSort({ column, direction: "asc" });
    }
  };

  const renderSortIcon = (column: string) => {
    const isActive = sort?.column === column;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!isActive) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (sort?.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDownIcon size={14} className={color} /></div>;
  };

  const getSortedCampaigns = () => {
    let data = [...campaigns];

    if (sort) {
      data.sort((a, b) => {
        const aVal = a[sort.column as keyof Campaign];
        const bVal = b[sort.column as keyof Campaign];

        let comparison = 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
          comparison = sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = sort.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        return comparison;
      });
    }

    return data;
  };

  // Handle CSV column sorting
  const handleCsvColumnSort = (column: string) => {
    if (csvSort?.column === column) {
      // Toggle: asc -> desc -> unsorted
      if (csvSort.direction === "asc") {
        setCsvSort({ column, direction: "desc" });
      } else {
        setCsvSort(null);
      }
    } else {
      // New column, start with asc
      setCsvSort({ column, direction: "asc" });
    }
  };

  // Get sorted CSV data based on current sort state
  const getSortedCsvData = () => {
    if (!csvSort) return csvData;

    const sortedData = [...csvData].sort((a, b) => {
      const aVal = a[csvSort.column as keyof typeof a];
      const bVal = b[csvSort.column as keyof typeof b];

      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = csvSort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = csvSort.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return comparison;
    });

    return sortedData;
  };

  const getSortedLocalCsvData = () => {
    if (!csvSort) return localCsvData;

    const sortedData = [...localCsvData].sort((a, b) => {
      const aVal = a[csvSort.column as keyof typeof a];
      const bVal = b[csvSort.column as keyof typeof b];

      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = csvSort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = csvSort.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return comparison;
    });

    return sortedData;
  };

  // Render sort icon for CSV columns
  const renderCsvSortIcon = (column: string) => {
    const isActive = csvSort?.column === column;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!isActive) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (csvSort?.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDownIcon size={14} className={color} /></div>;
  };

  useEffect(() => {
    if (editingCampaignId !== null) {
      const campaignToEdit = campaigns.find(c => c.id === editingCampaignId);
      if (campaignToEdit) {
        setCampaignName(campaignToEdit.name);
        setSelectedWhatsAppTemplate(campaignToEdit.whatsAppTemplateName);
        // Set the selectedTemplate to match the pre-selected template name
        setSelectedTemplate(whatsappTemplates.find(t => t.name === campaignToEdit.whatsAppTemplateName) || null);

        if (campaignToEdit.type === "API Triggered") {
          setCampaignCreationStep("apiTriggeredForm");
          setCampaignStartDate(campaignToEdit.startDate);
          setCampaignEndDate(campaignToEdit.endDate);
          setNeverEnds(campaignToEdit.neverEnds || false);
        } else if (campaignToEdit.type === "Broadcast") {
          setCampaignCreationStep("broadcastForm");
          setBroadcastCampaignType(campaignToEdit.messageType);
          setDeliverInTimezone(campaignToEdit.deliverInTimezone || false);
          // For csvFile, we can't directly restore a File object from just its name and content
          // A dummy File object is created for display purposes, actual content is in csvData
          setCsvFile(campaignToEdit.csvFileName ? new File([], campaignToEdit.csvFileName) : null);
          setCsvData(campaignToEdit.csvContent || []);

          if (campaignToEdit.messageType === 'Scheduled') {
            setSchedules(campaignToEdit.schedules || [{ id: Date.now(), date: undefined, hour: "", minute: "", period: "" }]);
          } else if (campaignToEdit.messageType === 'Recurring') {
            setRecurringStartDate(campaignToEdit.recurringStartDate);
            setRecurringEndDate(campaignToEdit.recurringEndDate);
            setRecurringTime(campaignToEdit.recurringTime || { hour: "", minute: "", period: "" });
            setRepeatFrequency(campaignToEdit.repeatFrequency || "");
            setDailyRepeatInterval(campaignToEdit.dailyRepeatInterval || "1");
            setWeeklyRepeatDays(campaignToEdit.weeklyRepeatDays || []);
            setMonthlyRepeatDates(campaignToEdit.monthlyRepeatDates || []);
          }
        }
      }
    } else {
      // Reset form when not editing (e.g., creating a new campaign)
      resetCreateCampaignForm();
    }
  }, [editingCampaignId, campaigns]);



  const toggleCampaign = (id: number) => {
    setSelectedCampaigns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const filteredIds = getFilteredCampaigns().map(c => c.id);
    if (selectedCampaigns.length === filteredIds.length && filteredIds.every(id => selectedCampaigns.includes(id))) {
      setSelectedCampaigns([]);
    } else {
      setSelectedCampaigns(filteredIds);
    }
  };

  const getTypeBadgeClasses = (type: string) => {
    if (type === "Broadcast") return "bg-purple-100 text-purple-700";
    if (type === "API Triggered") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  // Filter campaigns by tab, search, and dropdowns
  const getFilteredCampaigns = () => {
    let filtered = campaigns;

    // Filter by status
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(c => selectedStatus.includes(c.status));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by campaign type
    if (selectedCampaignTypes.length > 0) {
      filtered = filtered.filter(c => selectedCampaignTypes.includes(c.type));
    }

    // Filter by message type
    if (selectedMessageTypes.length > 0) {
      filtered = filtered.filter(c => selectedMessageTypes.includes(c.messageType));
    }

    return getSortedCampaigns().filter(c => filtered.includes(c));
  };

  // Clone handlers
  const handleOpenCloneDialog = (campaignId: number) => {
    const campaignToClone = campaigns.find(c => c.id === campaignId);
    if (!campaignToClone) return;

    setCampaignToCloneId(campaignId);
    setCloneCampaignName(campaignToClone.name);
    setCloneDialogOpen(true);
  };

  const handleCancelCloneDialog = () => {
    setCloneDialogOpen(false);
    setCloneCampaignName("");
    setCampaignToCloneId(null);
  };

  const handleCloneCampaign = () => {
    if (!campaignToCloneId || !cloneCampaignName.trim()) return;

    const campaignToClone = campaigns.find(c => c.id === campaignToCloneId);
    if (!campaignToClone) return;

    const clonedCampaign: Campaign = {
      ...campaignToClone,
      id: Date.now(),
      name: cloneCampaignName,
      status: "draft",
      sent: 0,
      delivered: 0,
    };

    createBroadcastMutation.mutate(clonedCampaign);
    toast({
      title: "Campaign Cloned",
      description: `${cloneCampaignName} has been cloned to Draft`,
    });
    handleCancelCloneDialog();
  };

  // Archive handlers
  const handleOpenArchiveModal = (campaign: Campaign) => {
    setCampaignToArchive(campaign);
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = () => {
    if (!campaignToArchive) return;

    updateBroadcastMutation.mutate({ id: campaignToArchive.id, data: { status: "archived" } });
    toast({
      title: "Campaign Archived",
      description: `${campaignToArchive.name} has been archived`,
    });
    setShowArchiveModal(false);
    setCampaignToArchive(null);
  };

  // Delete handlers
  const handleOpenDeleteModal = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setShowDeleteModal(true);
  };

  // Get archivable campaigns (non-archived)
  const getArchivableCampaigns = () => {
    return selectedCampaigns.filter(id => {
      const campaign = campaigns.find(c => c.id === id);
      return campaign && campaign.status !== "archived";
    });
  };

  // Get deletable campaigns (archived only)
  const getDeletableCampaigns = () => {
    return selectedCampaigns.filter(id => {
      const campaign = campaigns.find(c => c.id === id);
      return campaign && campaign.status === "archived";
    });
  };

  // Bulk archive handler
  const handleBulkArchive = () => {
    const archivable = getArchivableCampaigns();
    // Bulk actions should ideally hit a bulk API. For now, hitting update for each or TODO.
    archivable.forEach(id => updateBroadcastMutation.mutate({ id, data: { status: "archived" } }));
    toast({
      title: "Campaigns Archived",
      description: `${archivable.length} campaign(s) have been archived`,
    });
    setShowBulkArchiveModal(false);
    setSelectedCampaigns([]);
  };

  // Bulk delete handler
  const handleBulkDelete = () => {
    const deletable = getDeletableCampaigns();
    // Bulk actions should ideally hit a bulk API.
    deletable.forEach(id => deleteMutation.mutate(id));
    toast({
      title: "Campaigns Deleted",
      description: `${deletable.length} campaign(s) have been deleted`,
    });
    setShowBulkDeleteModal(false);
    setSelectedCampaigns([]);
  };

  const handleRecipientSort = (column: string) => {
    if (recipientSort?.column === column) {
      if (recipientSort.direction === "asc") {
        setRecipientSort({ column, direction: "desc" });
      } else {
        setRecipientSort(null);
      }
    } else {
      setRecipientSort({ column, direction: "asc" });
    }
  };

  const renderRecipientSortIcon = (column: string) => {
    const isActive = recipientSort?.column === column;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!isActive) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (recipientSort?.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDownIcon size={14} className={color} /></div>;
  };

  const getSortedRecipients = () => {
    let data = [...(selectedCampaignForPerformance?.recipients || [])];

    if (recipientSearchQuery) {
      data = data.filter(r => r.name.toLowerCase().includes(recipientSearchQuery.toLowerCase()) || r.phone.toLowerCase().includes(recipientSearchQuery.toLowerCase()));
    }

    if (recipientSort) {
      data.sort((a, b) => {
        const aVal = a[recipientSort.column as keyof typeof a];
        const bVal = b[recipientSort.column as keyof typeof b];

        let comparison = 0;
        if (recipientSort.column === "status") {
          const order = ["Viewed", "Delivered", "Sent", "Failed"];
          const aIndex = order.indexOf(aVal as string);
          const bIndex = order.indexOf(bVal as string);
          comparison = recipientSort.direction === "asc" ? aIndex - bIndex : bIndex - aIndex;
        } else if (typeof aVal === "string" && typeof bVal === "string") {
          comparison = recipientSort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = recipientSort.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        return comparison;
      });
    }

    if (selectedRecipientStatus.length > 0) {
      data = data.filter(r => selectedRecipientStatus.includes(r.status));
    }

    return data;
  };

  const resetCreateCampaignForm = () => {
    setCampaignCreationStep("selectType");
    setCampaignName("");
    setCampaignStartDate(undefined);
    setCampaignEndDate(undefined);
    setSelectedWhatsAppTemplate(null);
    setSelectedTemplate(null);
    setNeverEnds(false);
    setSchedules([{ id: Date.now(), date: undefined, hour: "", minute: "", period: "" }]);
    setBroadcastCampaignType("");
    setCsvFile(null);
    setCsvData([]);
    setCsvError(null);
    setDeliverInTimezone(false);
    setRecurringStartDate(undefined);
    setRecurringEndDate(undefined);
    setRecurringTime({ hour: "", minute: "", period: "" });
    setRepeatFrequency("");
    setDailyRepeatInterval("1");
    setWeeklyRepeatDays([]);
    setMonthlyRepeatDates([]);
    setCsvSort(null);
  };

  // Helper: build the proper backend payload from the form state. The wire
  // shape is what the new `BroadcastsService` expects — flat schema columns
  // plus a `metadata` blob carrying all the UI-only / recurring extras.
  const buildBroadcastPayload = (
    type: "API Triggered" | "Broadcast",
    uiStatus: "draft" | "scheduled",
  ) => {
    const templateRow = whatsappTemplates.find((t: any) => t.name === selectedWhatsAppTemplate);
    const wa_template_id = templateRow?.backend_id ?? templateRow?.id ?? null;

    // First scheduled slot drives `scheduled_at`. Backend treats "pending"
    // broadcasts as ready-for-cron; the actual gate is `scheduled_at <= NOW()`.
    let scheduled_at: string | null = null;
    if (uiStatus === "scheduled") {
      if (type === "API Triggered" && campaignStartDate) {
        scheduled_at = campaignStartDate.toISOString();
      } else if (type === "Broadcast") {
        if (broadcastCampaignType === "Scheduled" && schedules[0]?.date) {
          scheduled_at = new Date(schedules[0].date).toISOString();
        } else if (broadcastCampaignType === "Recurring" && recurringStartDate) {
          scheduled_at = new Date(recurringStartDate).toISOString();
        }
      }
    }

    const metadata: Record<string, any> = {
      type,
      messageType: type === "API Triggered" ? "Recurring" : broadcastCampaignType,
      whatsAppTemplateName: selectedWhatsAppTemplate,
    };
    if (type === "API Triggered") {
      Object.assign(metadata, {
        startDate: campaignStartDate ?? null,
        endDate: neverEnds ? null : campaignEndDate ?? null,
        neverEnds,
      });
    } else {
      Object.assign(metadata, {
        csvFileName: csvFile?.name ?? null,
        deliverInTimezone,
      });
      if (broadcastCampaignType === "Scheduled") metadata.schedules = schedules;
      if (broadcastCampaignType === "Recurring") {
        Object.assign(metadata, {
          recurringStartDate,
          recurringEndDate,
          recurringTime,
          repeatFrequency,
          dailyRepeatInterval,
          weeklyRepeatDays,
          monthlyRepeatDates,
        });
      }
    }

    return {
      name: campaignName,
      channel_type: "whatsapp" as const,
      channelable_id: defaultChannel?.channelable_id ?? null,
      channelable_type: defaultChannel?.channelable_type ?? null,
      wa_template_id,
      scheduled_at,
      status: uiStatus, // backend normalises "scheduled" → "pending"
      metadata,
    };
  };

  const handleCreateCampaign = (status: "draft" | "scheduled") => {
    if (!defaultChannel) {
      toast({
        title: "No WhatsApp account",
        description: "Connect a WhatsApp account before creating campaigns.",
        variant: "destructive",
      });
      return;
    }
    const payload = buildBroadcastPayload("API Triggered", status);
    if (editingCampaignId) {
      updateBroadcastMutation.mutate({ id: editingCampaignId, data: payload });
    } else {
      createBroadcastMutation.mutate(payload);
    }
    setCreateOpen(false);
    setEditingCampaignId(null);
    resetCreateCampaignForm();
  };

  const handleCreateBroadcastCampaign = (status: "draft" | "scheduled") => {
    if (!defaultChannel) {
      toast({
        title: "No WhatsApp account",
        description: "Connect a WhatsApp account before creating campaigns.",
        variant: "destructive",
      });
      return;
    }
    if (broadcastCampaignType === "Immediate") setDeliverInTimezone(false);
    const payload = buildBroadcastPayload("Broadcast", status);
    if (editingCampaignId) {
      updateBroadcastMutation.mutate({ id: editingCampaignId, data: payload });
    } else {
      createBroadcastMutation.mutate(payload);
    }
    setCreateOpen(false);
    setEditingCampaignId(null);
    resetCreateCampaignForm();
  };

  // Send Now — transitions a draft broadcast into pending so the every-minute
  // cron sweep picks it up. Available from the row action menu.
  const sendBroadcastMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/broadcasts/${id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      toast({
        title: "Broadcast queued",
        description: "It will be executed within the next minute.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Send failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleScheduleChange = (index: number, field: keyof Schedule, value: any) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    setSchedules(newSchedules);
  };

  const addSchedule = () => {
    if (schedules.length < 5) {
      setSchedules([...schedules, { id: Date.now(), date: undefined, hour: "", minute: "", period: "" }]);
    }
  };

  const removeSchedule = (id: number) => {
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const toggleWeeklyDay = (day: string) => {
    setWeeklyRepeatDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleMonthlyDate = (date: number) => {
    setMonthlyRepeatDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const isSchedulesInvalid = schedules.length === 0 || schedules.some(s => !s.date || !s.hour || !s.minute || !s.period);

  const isRecurringInvalid = !recurringStartDate || !recurringEndDate || !recurringTime.hour || !recurringTime.minute || !recurringTime.period || !repeatFrequency || (repeatFrequency === 'weekly' && weeklyRepeatDays.length === 0) || (repeatFrequency === 'monthly' && monthlyRepeatDates.length === 0);

  const hasAtLeastOneCompleteRow = localCsvData.some(row => row.name?.trim() && row.number?.trim());
  const hasPartiallyFilledRow = localCsvData.some(row => (row.name?.trim() && !row.number?.trim()) || (!row.name?.trim() && row.number?.trim()));
  const isCsvSaveDisabled = !hasAtLeastOneCompleteRow || hasPartiallyFilledRow;

  // Utility function to format tooltip names
  const formatTooltipName = (name: string): string => {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-md p-2 shadow-md">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm">{formatTooltipName(entry.name)}:</span>
              <span className="text-sm font-medium" style={{ color: entry.color }}>
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };


  return (
    <div className="px-6 py-6 animate-in fade-in duration-700" data-testid="campaign-manager">
        {/* Unified Main Card */}
        <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-300 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col">
            
            {/* 1. Branded Header Section */}
            <div className="py-3 px-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-transparent">
                <div className="flex items-center gap-6">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-inner">
                        <Send size={20} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                            Campaign Manager
                        </h1>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Create, manage and monitor your outbound messaging campaigns
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        onClick={() => setCreateOpen(true)}
                        className="h-8 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-[11px] shadow-lg shadow-primary/20 transition-all duration-300 active:scale-95 flex items-center gap-2 border-0 hover:bg-primary/90"
                        data-testid="button-create-campaign"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        <span>Create Campaign</span>
                    </Button>
                </div>
            </div>

            {/* 3. Filter Row Section */}
            <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-transparent flex items-center gap-2 flex-wrap">
                <div className="relative group flex-1 min-w-[280px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-8.5 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-lg text-[12px] font-medium focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
                        data-testid="input-search"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <CustomDropdown
                        options={[
                            { id: "draft", name: "Draft" },
                            { id: "scheduled", name: "Scheduled" },
                            { id: "delivered", name: "Delivered" },
                            { id: "archived", name: "Archived" },
                        ]}
                        selected={selectedStatus}
                        onChange={setSelectedStatus}
                        placeholder="Status"
                        width="140px"
                        showSelectedOption={true}
                        showSearch={false}
                        triggerContent={
                            <>
                                <div className="flex items-center gap-2 truncate">
                                    <Activity className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className={cn("truncate text-[12px]", selectedStatus.length > 0 ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400")}>
                                        {selectedStatus.length === 0
                                            ? "Status"
                                            : (["draft","scheduled","delivered","archived"].find(id => id === selectedStatus[0])
                                                ? selectedStatus[0].charAt(0).toUpperCase() + selectedStatus[0].slice(1)
                                                : selectedStatus[0])}
                                    </span>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                            </>
                        }
                    />

                    <CustomDropdown
                        options={[
                            { id: "Broadcast", name: "Broadcast" },
                            { id: "API Triggered", name: "API Triggered" },
                        ]}
                        selected={selectedCampaignTypes}
                        onChange={setSelectedCampaignTypes}
                        placeholder="Campaign Type"
                        width="160px"
                        showSelectedOption={true}
                        showSearch={false}
                        triggerContent={
                            <>
                                <div className="flex items-center gap-2 truncate">
                                    <Megaphone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className={cn("truncate text-[12px]", selectedCampaignTypes.length > 0 ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400")}>
                                        {selectedCampaignTypes.length === 0 ? "Campaign Type" : selectedCampaignTypes[0]}
                                    </span>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                            </>
                        }
                    />

                    <CustomDropdown
                        options={[
                            { id: "Immediate", name: "Immediate" },
                            { id: "Scheduled", name: "Scheduled" },
                            { id: "Recurring", name: "Recurring" },
                        ]}
                        selected={selectedMessageTypes}
                        onChange={setSelectedMessageTypes}
                        placeholder="Message Type"
                        width="160px"
                        showSelectedOption={true}
                        showSearch={false}
                        triggerContent={
                            <>
                                <div className="flex items-center gap-2 truncate">
                                    <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className={cn("truncate text-[12px]", selectedMessageTypes.length > 0 ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400")}>
                                        {selectedMessageTypes.length === 0 ? "Message Type" : selectedMessageTypes[0]}
                                    </span>
                                </div>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                            </>
                        }
                    />
                </div>
            </div>

            {/* 4. Bulk Actions Bar (Conditional) */}
            {selectedCampaigns.length > 0 && (
                <div className="px-4 py-2 bg-primary/10 dark:bg-primary/15 border-b border-primary/20 dark:border-primary/20 flex items-center justify-between animate-in slide-in-from-top-1 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                            {selectedCampaigns.length}
                        </div>
                        <span className="text-[11px] font-semibold text-primary">Campaigns selected</span>
                    </div>
                    <div className="flex gap-2">
                        {getArchivableCampaigns().length > 0 && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setShowBulkArchiveModal(true)}
                                className="h-7 px-3 rounded-md bg-white dark:bg-slate-900 border-primary/30 text-primary hover:bg-primary/10 text-[10px] font-semibold transition-all"
                            >
                                <Archive size={14} className="mr-2" />
                                Archive Selected
                            </Button>
                        )}
                        {getDeletableCampaigns().length > 0 && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setShowBulkDeleteModal(true)}
                                className="h-7 px-3 rounded-md bg-white dark:bg-slate-900 border-red-200 text-red-500 hover:bg-red-50 text-[10px] font-semibold transition-all"
                            >
                                <Trash2 size={14} className="mr-2" />
                                Delete Selected
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* 5. Main Table Section */}
            <div className="flex-1 overflow-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80">
                        <tr>
                            <th className="py-2 px-3 w-10">
                                <Checkbox
                                    checked={getFilteredCampaigns().length > 0 && getFilteredCampaigns().every(c => selectedCampaigns.includes(c.id))}
                                    onCheckedChange={toggleAll}
                                    className="border-slate-300 dark:border-slate-700 data-[state=checked]:bg-primary"
                                />
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("name")}>
                                <div className="flex items-center gap-2">
                                    Campaign Name
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("name")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("type")}>
                                <div className="flex items-center gap-2">
                                    Campaign Type
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("type")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("messageType")}>
                                <div className="flex items-center gap-2">
                                    Message Type
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("messageType")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("status")}>
                                <div className="flex items-center gap-2">
                                    Status
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("status")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("sent")}>
                                <div className="flex items-center gap-2">
                                    Sent
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("sent")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("delivered")}>
                                <div className="flex items-center gap-2">
                                    Delivered
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        {renderSortIcon("delivered")}
                                    </div>
                                </div>
                            </th>
                            <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                        {isLoadingCampaigns ? (
                            <tr>
                                <td colSpan={8} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={24} className="animate-spin text-primary" />
                                        <p className="text-[11px] font-semibold text-slate-400">Fetching Campaigns...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : getFilteredCampaigns().length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3 opacity-60">
                                        <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-2">
                                            <Send size={32} strokeWidth={1} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[14px] font-bold text-slate-900 dark:text-white">No campaigns found</p>
                                            <p className="text-[11px] font-medium text-slate-400">Create your first messaging campaign to reach your customers</p>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            onClick={() => setCreateOpen(true)} 
                                            className="mt-1 h-7.5 px-5 rounded-lg text-[10px] font-bold border-primary/30 text-primary hover:bg-primary/10 transition-all shadow-sm"
                                        >
                                            Create one now
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            getFilteredCampaigns().map((campaign) => (
                                <tr 
                                    key={campaign.id} 
                                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <td className="py-2 px-3">
                                        <Checkbox
                                            checked={selectedCampaigns.includes(campaign.id)}
                                            onCheckedChange={() => toggleCampaign(campaign.id)}
                                            className="border-slate-300 dark:border-slate-700 data-[state=checked]:bg-primary"
                                        />
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className="text-[12px] font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate max-w-[200px] block">
                                            {campaign.name}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className={cn(
                                            "text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                                            campaign.type === "Broadcast" ? "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50" :
                                            "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50"
                                        )}>
                                            {campaign.type}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                            {campaign.messageType}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md text-[10px] font-semibold border shadow-sm",
                                            campaign.status === "delivered" ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50" :
                                            campaign.status === "scheduled" ? "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/50" :
                                            "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                        )}>
                                            {campaign.status}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                                        {campaign.sent.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                                        {campaign.delivered.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                                                    <MoreVertical size={14} className="text-slate-400" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl">
                                                <DropdownMenuItem 
                                                    onClick={() => {
                                                        setSelectedCampaignForPerformance(campaign);
                                                        setDetailsOpen(true);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/15 hover:text-primary"
                                                >
                                                    <BarChart2 size={14} className="text-primary" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => {
                                                        setEditingCampaignId(campaign.id);
                                                        setCreateOpen(true);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/15 hover:text-primary"
                                                >
                                                    <Edit2 size={14} className="text-primary" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleOpenCloneDialog(campaign.id)}
                                                    className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/15 hover:text-primary"
                                                >
                                                    <Copy size={14} className="text-primary" />
                                                    Clone
                                                </DropdownMenuItem>
                                                {(campaign.status === "draft" || campaign.status === "failed") && (
                                                    <DropdownMenuItem
                                                        onClick={() => sendBroadcastMutation.mutate(campaign.id)}
                                                        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 rounded-lg cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                    >
                                                        <Send size={14} className="text-emerald-600" />
                                                        Send Now
                                                    </DropdownMenuItem>
                                                )}
                                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-1"></div>
                                                {campaign.status !== "archived" ? (
                                                    <DropdownMenuItem 
                                                        onClick={() => handleOpenArchiveModal(campaign)}
                                                        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                                    >
                                                        <Archive size={14} className="text-slate-500" />
                                                        Archive
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem 
                                                        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-red-500 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        onClick={() => handleOpenDeleteModal(campaign)}
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 6. Pagination Footer Section */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">Rows per page:</span>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 transition-all text-[11px] font-semibold tabular-nums"
                                onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
                            >
                                {rowsPerPage}
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                            </button>
                            {rowsDropdownOpen && (
                                <div className="absolute bottom-full left-0 mb-1 z-[60] w-full rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                                    <ul className="py-1">
                                        {[10, 25, 50].map(option => (
                                            <li
                                                key={option}
                                                className={cn(
                                                    "px-3 py-2 text-[11px] font-semibold tabular-nums cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors text-center",
                                                    rowsPerPage === option ? "bg-primary/10 text-primary" : "text-slate-600"
                                                )}
                                                onClick={() => {
                                                    setRowsPerPage(option);
                                                    setRowsDropdownOpen(false);
                                                }}
                                            >
                                                {option}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                        {getFilteredCampaigns().length} results total
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                        Page 1 <span className="text-slate-300 mx-1">/</span> 1
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30" disabled>
                            <ChevronsLeft size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30" disabled>
                            <ChevronLeft size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30" disabled>
                            <ChevronRight size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30" disabled>
                            <ChevronsRight size={14} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>

      {/* Create Campaign Dialog */}
      <Dialog open={createOpen} onOpenChange={(isOpen) => {
        setCreateOpen(isOpen);
        if (!isOpen) {
          resetCreateCampaignForm();
          setEditingCampaignId(null); // Reset editingCampaignId when dialog Cancels
        }
      }}>
        <DialogContent className={campaignCreationStep === "apiTriggeredForm" || campaignCreationStep === "broadcastForm" ? "max-w-3xl" : "max-w-lg"} data-testid="dialog-create-campaign">
          {campaignCreationStep === "selectType" && (
            <>
              <DialogHeader className="mb-2">
                <DialogTitle>Create Campaign</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <Card className="cursor-pointer hover-elevate active-elevate-2 shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0" data-testid="card-api-triggered" onClick={() => setCampaignCreationStep("apiTriggeredForm")}>
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <Zap size={24} className="text-primary dark:text-primary/80" />
                    </div>
                    <CardTitle className="text-base">API Triggered</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground">Send messages based on API calls and user actions</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover-elevate active-elevate-2 shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0" data-testid="card-broadcast" onClick={() => setCampaignCreationStep("broadcastForm")}>
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <Send size={24} className="text-primary dark:text-primary/80" />
                    </div>
                    <CardTitle className="text-base">Broadcast</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground">Send bulk messages to a list of contacts</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {campaignCreationStep === "apiTriggeredForm" && (
            <>
              <DialogHeader className="mb-2">
                <div className="flex items-center gap-3 mb-2">
                  {!editingCampaignId && (
                    <ArrowLeft size={18} className="cursor-pointer" onClick={() => setCampaignCreationStep("selectType")} />
                  )}
                  <DialogTitle>{editingCampaignId ? "Edit API Triggered Campaign" : "Create API Triggered Campaign"}</DialogTitle>
                </div>
              </DialogHeader>

              <div className="flex gap-4">
                {/* Left: Form */}
                <div className="flex-1 !max-h-[62vh] overflow-y-auto pr-2 -ml-1">
                  <div className="space-y-6 pl-1 pb-1">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">Campaign Details</h3>
                      <p className="text-sm text-muted-foreground">Give your campaign a name and choose when you want to schedule your campaign.</p>
                    </div>

                    {/* Campaign Name */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground">Campaign name<span className="text-red-500 pl-0.5">*</span></label>
                      </div>
                      <div className="relative">
                        <Input
                          placeholder="Enter campaign name..."
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value.slice(0, 512))}
                          className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {campaignName.length}/512
                        </span>
                      </div>
                    </div>

                    {/* Campaign Start and End Date */}
                    <div className="flex flex-col gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Campaign start date<span className="text-red-500 pl-0.5">*</span></label>
                        <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className="w-full justify-between text-left font-normal border-input [border-color:hsl(var(--input))] hover-elevate"
                            >
                              <div className="flex items-center">
                                <Calendar size={14} className="mr-2" />
                                {campaignStartDate ? campaignStartDate.toLocaleDateString() : <span>Pick a date</span>}
                              </div>
                              <ChevronDown size={14} className="text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={campaignStartDate}
                              onSelect={(date) => {
                                setCampaignStartDate(date);
                                if (campaignEndDate && date && date > campaignEndDate) {
                                  setCampaignEndDate(undefined);
                                }
                                setStartDatePickerOpen(false);
                              }}
                              disabled={campaignEndDate ? { after: campaignEndDate } : undefined}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-foreground">Campaign end date<span className="text-red-500 pl-0.5">*</span></label>
                          <div className="flex items-end space-x-2 mt-2">
                            <Checkbox id="never-ends" checked={neverEnds} onCheckedChange={(checked) => {
                              setNeverEnds(checked as boolean);
                              if (checked) {
                                setCampaignEndDate(undefined);
                              }
                            }} />
                            <label
                              htmlFor="never-ends"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Never end
                            </label>
                          </div>
                        </div>
                        <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className="w-full justify-between text-left font-normal border-input [border-color:hsl(var(--input))] hover-elevate"
                              disabled={neverEnds}
                            >
                              <div className="flex items-center">
                                <Calendar size={14} className="mr-2" />
                                {campaignEndDate ? campaignEndDate.toLocaleDateString() : <span>Pick a date</span>}
                              </div>
                              <ChevronDown size={14} className="text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                              mode="single"
                              selected={campaignEndDate}
                              onSelect={(date) => {
                                setCampaignEndDate(date);
                                if (campaignStartDate && date && date < campaignStartDate) {
                                  setCampaignStartDate(undefined);
                                }
                                setEndDatePickerOpen(false);
                              }}
                              disabled={campaignStartDate ? { before: campaignStartDate } : undefined}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* WhatsApp Template Dropdown */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">WhatsApp Template<span className="text-red-500 pl-0.5">*</span></label>
                      <Select
                        value={selectedWhatsAppTemplate || ""}
                        onValueChange={(value) => {
                          setSelectedWhatsAppTemplate(value);
                          setSelectedTemplate(whatsappTemplates.find(t => t.name === value) || null);
                        }}
                      >
                        <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {whatsappTemplates.map(template => (
                            <SelectItem key={template.id} value={template.name}>{template.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Right: Template Preview */}
                <div>
                  <h3 className="font-semibold text-lg mb-1">Template Preview</h3>
                  <div className="flex flex-col items-center h-full max-h-[62vh] w-full max-w-[31vh]">
                    <PreviewV2
                      mode="chat"
                      headerText={selectedTemplate?.header || ""}
                      bodyText={selectedTemplate?.body || ""}
                      footerText={selectedTemplate?.footer || ""}
                      selectedMediaFile={null}
                      templateButtons={selectedTemplate?.buttons || []}
                      variableSamples={selectedTemplate?.variableSamples || {}}
                    />
                    <p className="text-[10px] py-1">Preview may not reflect the exact WhatsApp interface</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                {editingCampaignId ? (
                  <Button
                    variant="outline"
                    onClick={() => { setCreateOpen(false); setEditingCampaignId(null); }}
                    className="border-input [border-color:hsl(var(--input))] font-normal"
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setCampaignCreationStep("selectType")}
                    className="border-input [border-color:hsl(var(--input))] font-normal"
                  >
                    Back
                  </Button>
                )}
                <div className="flex gap-2">
                  {!editingCampaignId && (
                    <Button
                      variant="outline"
                      className="btn-outline-primary font-normal"
                      disabled={!campaignName}
                      onClick={() => handleCreateCampaign("draft")}
                    >
                      Save Draft
                    </Button>
                  )}
                  <Button
                    className="gap-2 font-normal btn-outline-primary"
                    variant="outline"
                    disabled={!campaignName || !campaignStartDate || (!campaignEndDate && !neverEnds) || !selectedWhatsAppTemplate}
                    onClick={() => handleCreateCampaign("scheduled")}
                  >
                    {editingCampaignId ? "Save Campaign" : "Set Live"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {campaignCreationStep === "broadcastForm" && (
            <>
              <DialogHeader className="mb-2">
                <div className="flex items-center gap-3 mb-2">
                  {!editingCampaignId && (
                    <ArrowLeft size={18} className="cursor-pointer" onClick={() => setCampaignCreationStep("selectType")} />
                  )}
                  <DialogTitle>{editingCampaignId ? "Edit Broadcast Campaign" : "Create Broadcast Campaign"}</DialogTitle>
                </div>
              </DialogHeader>

              <div className="flex gap-4">
                {/* Left: Form */}
                <div className="flex-1 !max-h-[62vh] overflow-y-auto pr-2 -ml-1">
                  <div className="space-y-6 pl-1 pb-1">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">Campaign Details</h3>
                      <p className="text-sm text-muted-foreground">Give your campaign a name and choose its type.</p>
                    </div>

                    {/* Campaign Name */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground">Campaign name<span className="text-red-500 pl-0.5">*</span></label>
                      </div>
                      <div className="relative">
                        <Input
                          placeholder="Enter campaign name..."
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value.slice(0, 512))}
                          className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {campaignName.length}/512
                        </span>
                      </div>
                    </div>

                    {/* Campaign Type */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Campaign Type<span className="text-red-500 pl-0.5">*</span></label>
                      <Select value={broadcastCampaignType} onValueChange={setBroadcastCampaignType}>
                        <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Immediate">Immediate</SelectItem>
                          <SelectItem value="Scheduled">Scheduled</SelectItem>
                          <SelectItem value="Recurring">Recurring</SelectItem>
                        </SelectContent>
                      </Select>

                      {broadcastCampaignType === 'Scheduled' && (
                        <div className="space-y-4 pt-2">
                          {schedules.map((schedule, index) => (
                            <div key={schedule.id} className="flex flex-col gap-6 p-4 border rounded-lg border border-input [border-color:hsl(var(--input))]">
                              <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-1">
                                  <div className="flex justify-between items-end">
                                    <label className="text-sm font-medium text-foreground">Campaign schedule date<span className="text-red-500 pl-0.5">*</span></label>
                                    {schedules.length > 1 && (
                                      <button onClick={() => removeSchedule(schedule.id)} className="text-muted-foreground hover:text-foreground transition-colors ml-4 mt-1">
                                        <X size={16} />
                                      </button>
                                    )}
                                  </div>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={"outline"}
                                        className="w-full justify-between text-left font-normal border-input [border-color:hsl(var(--input))] hover-elevate"
                                      >
                                        <div className="flex items-center">
                                          <Calendar size={14} className="mr-2" />
                                          {schedule.date ? schedule.date.toLocaleDateString() : <span>Pick a date</span>}
                                        </div>
                                        <ChevronDown size={14} className="text-muted-foreground" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                      <CalendarComponent
                                        mode="single"
                                        selected={schedule.date}
                                        onSelect={(date) => handleScheduleChange(index, 'date', date)}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Campaign schedule time<span className="text-red-500 pl-0.5">*</span></label>
                                <div className="flex gap-2">
                                  <Select value={schedule.hour} onValueChange={(value) => handleScheduleChange(index, 'hour', value)}>
                                    <SelectTrigger className="w-[80px] border border-input [border-color:hsl(var(--input))] hover-elevate">
                                      <SelectValue placeholder="HH" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: 12 }, (_, i) => `${i + 1}`.padStart(2, '0')).map(hour => (
                                        <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select value={schedule.minute} onValueChange={(value) => handleScheduleChange(index, 'minute', value)}>
                                    <SelectTrigger className="w-[80px] border border-input [border-color:hsl(var(--input))] hover-elevate">
                                      <SelectValue placeholder="MM" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: 60 }, (_, i) => `${i}`.padStart(2, '0')).map(minute => (
                                        <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select value={schedule.period} onValueChange={(value) => handleScheduleChange(index, 'period', value)}>
                                    <SelectTrigger className="w-[95px] border border-input [border-color:hsl(var(--input))] hover-elevate">
                                      <SelectValue placeholder="AM/PM" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="AM">AM</SelectItem>
                                      <SelectItem value="PM">PM</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs"
                            disabled={isSchedulesInvalid || schedules.length >= 5}
                            onClick={addSchedule}
                          >
                            <Plus size={14} className="mr-1" />
                            Add another schedule
                          </Button>

                          {/* Timezone Checkbox */}
                          <div className="flex items-center space-x-2">
                            <Checkbox id="timezone-delivery" checked={deliverInTimezone} onCheckedChange={(checked) => setDeliverInTimezone(checked as boolean)} />
                            <label htmlFor="timezone-delivery" className="text-sm font-medium leading-none">Deliver in user's timezone</label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="break-normal w-[16rem] whitespace-normal">You can send campaign messages to the user as per their local time zone. i.e. If you schedule your campaign for 9:30 am Singapore time, we will deliver to users in Singapore at 9:30 am (UTC/GMT +8 hours) and to users in Dubai at 9:30 am (UTC/GMT +4 hours). Note that the Campaign Start Time is always the timezone of your Digital Connect Account.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      )}

                      {broadcastCampaignType === 'Recurring' && (() => {
                        const weekDays = [
                          { display: 'M', value: 'mon' },
                          { display: 'T', value: 'tue' },
                          { display: 'W', value: 'wed' },
                          { display: 'T', value: 'thu' },
                          { display: 'F', value: 'fri' },
                          { display: 'S', value: 'sat' },
                          { display: 'S', value: 'sun' }
                        ];
                        return (
                          <div className="space-y-4 pt-2">
                            {/* Start and End Date */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground">Start date<span className="text-red-500 pl-0.5">*</span></label>
                              <Popover open={recurringStartPickerOpen} onOpenChange={setRecurringStartPickerOpen}>
                                <PopoverTrigger asChild>
                                  <Button variant={"outline"} className="w-full justify-between text-left font-normal border-input [border-color:hsl(var(--input))] hover-elevate">
                                    <div className="flex items-center">
                                      <Calendar size={14} className="mr-2" />
                                      {recurringStartDate ? recurringStartDate.toLocaleDateString() : <span>Pick a date</span>}
                                    </div>
                                    <ChevronDown size={14} className="text-muted-foreground" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <CalendarComponent
                                    mode="single"
                                    selected={recurringStartDate}
                                    onSelect={(date) => {
                                      setRecurringStartDate(date);
                                      if (recurringEndDate && date && date > recurringEndDate) setRecurringEndDate(undefined);
                                      setRecurringStartPickerOpen(false);
                                    }}
                                    disabled={recurringEndDate ? { after: recurringEndDate } : undefined}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground">End date<span className="text-red-500 pl-0.5">*</span></label>
                              <Popover open={recurringEndPickerOpen} onOpenChange={setRecurringEndPickerOpen}>
                                <PopoverTrigger asChild>
                                  <Button variant={"outline"} className="w-full justify-between text-left font-normal border-input [border-color:hsl(var(--input))] hover-elevate">
                                    <div className="flex items-center">
                                      <Calendar size={14} className="mr-2" />
                                      {recurringEndDate ? recurringEndDate.toLocaleDateString() : <span>Pick a date</span>}
                                    </div>
                                    <ChevronDown size={14} className="text-muted-foreground" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <CalendarComponent
                                    mode="single"
                                    selected={recurringEndDate}
                                    onSelect={(date) => {
                                      setRecurringEndDate(date);
                                      if (recurringStartDate && date && date < recurringStartDate) setRecurringStartDate(undefined);
                                      setRecurringEndPickerOpen(false);
                                    }}
                                    disabled={recurringStartDate ? { before: recurringStartDate } : undefined}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>

                            {/* Time Picker */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground">At<span className="text-red-500 pl-0.5">*</span></label>
                              <div className="flex gap-2">
                                <Select value={recurringTime.hour} onValueChange={(value) => setRecurringTime(t => ({ ...t, hour: value }))}>
                                  <SelectTrigger className="w-[80px] border border-input [border-color:hsl(var(--input))] hover-elevate">
                                    <SelectValue placeholder="HH" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => `${i + 1}`.padStart(2, '0')).map(hour => (
                                      <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={recurringTime.minute} onValueChange={(value) => setRecurringTime(t => ({ ...t, minute: value }))}>
                                  <SelectTrigger className="w-[80px] border border-input [border-color:hsl(var(--input))] hover-elevate">
                                    <SelectValue placeholder="MM" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 60 }, (_, i) => `${i}`.padStart(2, '0')).map(minute => (
                                      <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={recurringTime.period} onValueChange={(value) => setRecurringTime(t => ({ ...t, period: value }))}>
                                  <SelectTrigger className="w-[95px] border border-input [border-color:hsl(var(--input))] hover-elevate">
                                    <SelectValue placeholder="AM/PM" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AM">AM</SelectItem>
                                    <SelectItem value="PM">PM</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Repeat Row */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground">Repeat<span className="text-red-500 pl-0.5">*</span></label>
                              <div className="flex items-center gap-2">
                                <Select value={repeatFrequency} onValueChange={setRepeatFrequency}>
                                  <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate flex-1">
                                    <SelectValue placeholder="Select frequency" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                  </SelectContent>
                                </Select>
                                {repeatFrequency && (
                                  <>
                                    <span className="text-sm text-muted-foreground">every</span>
                                    <Select
                                      value={repeatFrequency === 'daily' ? dailyRepeatInterval : ''}
                                      onValueChange={setDailyRepeatInterval}
                                      disabled={repeatFrequency !== 'daily'}
                                    >
                                      <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate flex-1">
                                        <SelectValue placeholder={
                                          repeatFrequency === 'weekly' ? "Single Week" :
                                            repeatFrequency === 'monthly' ? "Single Month" :
                                              "Select interval"
                                        } />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">Single Day</SelectItem>
                                        {Array.from({ length: 5 }, (_, i) => i + 2).map(day => (
                                          <SelectItem key={day} value={String(day)}>{day} Days</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Conditional Multi-select */}
                            {repeatFrequency === 'weekly' && (
                              <div className="space-y-2">
                                <div className="flex gap-1">
                                  {weekDays.map(day => (
                                    <Button
                                      key={day.value}
                                      variant={weeklyRepeatDays.includes(day.value) ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => toggleWeeklyDay(day.value)}
                                      className="flex-1"
                                    >
                                      {day.display}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {repeatFrequency === 'monthly' && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-7 gap-1">
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                                    <Button
                                      key={date}
                                      variant={monthlyRepeatDates.includes(date) ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => toggleMonthlyDate(date)}
                                      className="h-8 w-8 p-0"
                                    >
                                      {date}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Timezone Checkbox */}
                            <div className="flex items-center space-x-2 pt-2">
                              <Checkbox id="timezone-delivery-Recurring" checked={deliverInTimezone} onCheckedChange={(checked) => setDeliverInTimezone(checked as boolean)} />
                              <label htmlFor="timezone-delivery-Recurring" className="text-sm font-medium leading-none">Deliver in user's timezone</label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="break-normal w-[16rem] whitespace-normal">You can send campaign messages to the user as per their local time zone. i.e. If you schedule your campaign for 9:30 am Singapore time, we will deliver to users in Singapore at 9:30 am (UTC/GMT +8 hours) and to users in Dubai at 9:30 am (UTC/GMT +4 hours). Note that the Campaign Start Time is always the timezone of your Digital Connect Account.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* WhatsApp Template Dropdown */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">WhatsApp Template<span className="text-red-500 pl-0.5">*</span></label>
                      <Select
                        value={selectedWhatsAppTemplate || ""}
                        onValueChange={(value) => {
                          setSelectedWhatsAppTemplate(value);
                          setSelectedTemplate(whatsappTemplates.find(t => t.name === value) || null);
                        }}
                      >
                        <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {whatsappTemplates.map(template => (
                            <SelectItem key={template.id} value={template.name}>{template.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* CSV Upload */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Contact List (CSV)<span className="text-red-500 pl-0.5">*</span></label>
                      <p className="text-xs text-muted-foreground">Upload a CSV with 'name' and 'number' columns.</p>
                      <input type="file" id="csv-upload" accept=".csv" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        setCsvFile(file);
                        setCsvData([]);
                        setCsvError(null);

                        if (!file.name.endsWith(".csv")) {
                          setCsvError("Invalid file type. Please upload a .csv file.");
                          setCsvFile(null);
                          return;
                        }

                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const text = event.target?.result as string;
                          if (!text) {
                            setCsvError("Could not read the file.");
                            setCsvFile(null);
                            return;
                          }

                          const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                          if (lines.length < 2) {
                            setCsvError("CSV must have a header and at least one data row.");
                            setCsvFile(null);
                            return;
                          }

                          const header = lines[0].split(",").map(h => h.trim());
                          if (header.includes("name") && header.includes("number")) {
                            const data = lines.slice(1).map(line => {
                              const values = line.split(",");
                              const obj: { [key: string]: string } = {};
                              header.forEach((h, i) => {
                                obj[h] = values[i] || "";
                              });
                              return obj;
                            });
                            setCsvData(data);
                          } else {
                            setCsvError("Invalid CSV format. Header must include 'name' and 'number' columns.");
                            setCsvFile(null);
                            setCsvData([]);
                          }
                        };
                        reader.onerror = () => {
                          setCsvError("Error reading file.");
                          setCsvFile(null);
                          setCsvData([]);
                        };
                        reader.readAsText(file);

                        if (e.target) {
                          e.target.value = ''
                        }
                      }} />
                      {!csvFile ? (
                        <Button className="btn-outline-primary font-normal" variant="outline" onClick={() => document.getElementById('csv-upload')?.click()}>
                          Browse
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded border border-input [border-color:hsl(var(--input))]">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Paperclip size={14} className="text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-foreground text-sm">{csvFile.name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">({(csvFile.size / 1024).toFixed(1)}KB)</span>
                          </div>
                          <button
                            onClick={() => {
                              setLocalCsvData(JSON.parse(JSON.stringify(csvData))); // Deep copy
                              setIsViewCsvModalOpen(true);
                            }}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setCsvFile(null)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      {csvError && <p className="text-sm text-red-500">{csvError}</p>}
                    </div>
                  </div>
                </div>

                {/* Right: Template Preview */}
                <div>
                  <h3 className="font-semibold text-lg mb-1">Template Preview</h3>
                  <div className="h-full max-h-[62vh] w-full max-w-[31vh] flex flex-col items-center">
                    <PreviewV2
                      mode="chat"
                      headerText={selectedTemplate?.header || ""}
                      bodyText={selectedTemplate?.body || ""}
                      footerText={selectedTemplate?.footer || ""}
                      selectedMediaFile={null}
                      templateButtons={selectedTemplate?.buttons || []}
                      variableSamples={selectedTemplate?.variableSamples || {}}
                    />
                    <p className="text-[10px] py-1">Preview may not reflect the exact WhatsApp interface</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                {editingCampaignId ? (
                  <Button
                    variant="outline"
                    onClick={() => { setCreateOpen(false); setEditingCampaignId(null); }}
                    className="border-input [border-color:hsl(var(--input))] font-normal"
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setCampaignCreationStep("selectType")}
                    className="border-input [border-color:hsl(var(--input))] font-normal"
                  >
                    Back
                  </Button>
                )}
                <div className="flex gap-2">
                  {!editingCampaignId && (
                    <Button
                      variant="outline"
                      className="btn-outline-primary font-normal"
                      disabled={!campaignName}
                      onClick={() => handleCreateBroadcastCampaign("draft")}
                    >
                      Save Draft
                    </Button>
                  )}
                  <Button
                    className="gap-2 font-normal btn-outline-primary"
                    variant="outline"
                    disabled={
                      !campaignName ||
                      !broadcastCampaignType ||
                      !selectedWhatsAppTemplate ||
                      !csvFile ||
                      (broadcastCampaignType === 'Scheduled' && isSchedulesInvalid) ||
                      (broadcastCampaignType === 'Recurring' && isRecurringInvalid)
                    }
                    onClick={() => handleCreateBroadcastCampaign("scheduled")}
                  >
                    {editingCampaignId ? "Save Campaign" : "Set Live"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* View CSV Modal */}
      <Dialog open={isViewCsvModalOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setCsvSort(null);
        }
        setIsViewCsvModalOpen(isOpen);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>CSV Editor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="select-none">
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30" onClick={() => handleCsvColumnSort("name")}>
                      <div className="flex items-center gap-2">
                        Name
                        {renderCsvSortIcon("name")}
                      </div>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30" onClick={() => handleCsvColumnSort("number")}>
                      <div className="flex items-center gap-2">
                        Number
                        {renderCsvSortIcon("number")}
                      </div>
                    </th>
                    <th className="w-10">
                      <Button variant="ghost" size="sm" onClick={() => setLocalCsvData([...localCsvData, { name: "", number: "" }])}><Plus /></Button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedLocalCsvData().map((row, index) => (
                    <tr key={index} className="border-b border-gray-300">
                      <td>
                        <Input
                          value={row.name}
                          onChange={(e) => {
                            const newData = localCsvData.map(originalRow =>
                              originalRow === row ? { ...originalRow, name: e.target.value } : originalRow
                            );
                            setLocalCsvData(newData);
                          }}
                          className="border-none rounded-none focus-visible:ring-0"
                        />
                      </td>
                      <td>
                        <Input
                          value={row.number}
                          onChange={(e) => {
                            const newData = localCsvData.map(originalRow =>
                              originalRow === row ? { ...originalRow, number: e.target.value } : originalRow
                            );
                            setLocalCsvData(newData);
                          }}
                          className="border-none rounded-none focus-visible:ring-0"
                        />
                      </td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setLocalCsvData(localCsvData.filter(originalRow => originalRow !== row));
                        }}><X /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setIsViewCsvModalOpen(false)}
                className="border-input [border-color:hsl(var(--input))] font-normal"
              >
                Cancel
              </Button>
              <Button
                className="btn-outline-primary"
                variant="outline"
                onClick={() => {
                  const filteredData = localCsvData.filter(row => row.name?.trim() || row.number?.trim());
                  setCsvData(filteredData);
                  setIsViewCsvModalOpen(false);
                }}
                disabled={isCsvSaveDisabled}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={(isOpen) => {
        setDetailsOpen(isOpen);
        if (!isOpen) {
          setSelectedCampaignForPerformance(null);
        }
      }}>
        <DialogContent className={`max-w-5xl ${activeDetailsTab === "details" ? "max-w-2xl" :
          activeDetailsTab === "performance" ? "max-w-4xl" :
            activeDetailsTab === "recipients" ? "max-w-3xl" : ""
          }`} data-testid="dialog-details">
          <DialogHeader className="mb-2">
            <DialogTitle>Campaign Performance - {selectedCampaignForPerformance?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex items-center space-x-1 bg-slate-200/75 dark:bg-slate-800 rounded-lg p-1 w-fit">
              <button
                onClick={() => setActiveDetailsTab("details")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeDetailsTab === "details"
                  ? "bg-background text-foreground shadow-[0_-3px_6px_rgba(0,0,0,0.00),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.02)]"
                  : "text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                data-testid="tab-details"
              >
                Details
              </button>
              <button
                onClick={() => setActiveDetailsTab("performance")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeDetailsTab === "performance"
                  ? "bg-background text-foreground shadow-[0_-3px_6px_rgba(0,0,0,0.00),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.02)]"
                  : "text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                data-testid="tab-performance"
              >
                Performance
              </button>
              <button
                onClick={() => setActiveDetailsTab("recipients")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeDetailsTab === "recipients"
                  ? "bg-background text-foreground shadow-[0_-3px_6px_rgba(0,0,0,0.00),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.02)]"
                  : "text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                data-testid="tab-recipients"
              >
                Recipients
              </button>
            </div>

            {/* Details Tab */}
            {activeDetailsTab === "details" && (() => {
              const selectedTemplate = whatsappTemplates.find(t => t.name === selectedCampaignForPerformance?.whatsAppTemplateName);
              return (
                <div className="flex gap-4">
                  {/* Left: Details */}
                  <div className="flex-1 space-y-4 !max-h-[62vh] overflow-y-auto">
                    <div className="flex flex-col gap-x-4 gap-y-6">
                      <div>
                        <label className="text-sm font-medium text-foreground">Campaign Name</label>
                        <p className="mt-1 text-sm">{selectedCampaignForPerformance?.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Campaign Type</label>
                        <p className="mt-1 text-sm">{selectedCampaignForPerformance?.type}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Message Type</label>
                        <p className="mt-1 text-sm">{selectedCampaignForPerformance?.messageType}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Status</label>
                        <p className="mt-1 text-sm capitalize">{selectedCampaignForPerformance?.status}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">WhatsApp Template</label>
                        <p className="mt-1 text-sm">{selectedCampaignForPerformance?.whatsAppTemplateName}</p>
                      </div>

                      {/* API Triggered Fields */}
                      {selectedCampaignForPerformance?.type === 'API Triggered' && (
                        <>
                          {selectedCampaignForPerformance?.startDate && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Start Date</label>
                              <p className="mt-1 text-sm">{new Date(selectedCampaignForPerformance.startDate).toLocaleDateString()}</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.endDate ? (
                            <div>
                              <label className="text-sm font-medium text-foreground">End Date</label>
                              <p className="mt-1 text-sm">{new Date(selectedCampaignForPerformance.endDate).toLocaleDateString()}</p>
                            </div>
                          ) : selectedCampaignForPerformance?.neverEnds ? (
                            <div>
                              <label className="text-sm font-medium text-foreground">End Date</label>
                              <p className="mt-1 text-sm">Never</p>
                            </div>
                          ) : null}
                        </>
                      )}

                      {/* Broadcast Fields */}
                      {selectedCampaignForPerformance?.type === 'Broadcast' && (
                        <>
                          {selectedCampaignForPerformance?.csvContent && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Number of contacts</label>
                              <p className="mt-1 text-sm">{selectedCampaignForPerformance.csvContent.length} contacts</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.deliverInTimezone && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Deliver in User's Timezone</label>
                              <p className="mt-1 text-sm">Yes</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.schedules && selectedCampaignForPerformance.schedules.length > 0 && (
                            <div className="col-span-2">
                              <label className="text-sm font-medium text-foreground">Schedules</label>
                              <ul className="mt-1 space-y-1 text-sm">
                                {selectedCampaignForPerformance.schedules.map(s => (
                                  <li key={s.id}>{s.date ? new Date(s.date).toLocaleDateString() : ''} at {s.hour}:{s.minute} {s.period}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.recurringStartDate && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Recurring Start Date</label>
                              <p className="mt-1 text-sm">{new Date(selectedCampaignForPerformance.recurringStartDate).toLocaleDateString()}</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.recurringEndDate && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Recurring End Date</label>
                              <p className="mt-1 text-sm">{new Date(selectedCampaignForPerformance.recurringEndDate).toLocaleDateString()}</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.recurringTime && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Recurring Time</label>
                              <p className="mt-1 text-sm">{selectedCampaignForPerformance.recurringTime.hour}:{selectedCampaignForPerformance.recurringTime.minute} {selectedCampaignForPerformance.recurringTime.period}</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.repeatFrequency && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Repeat Frequency</label>
                              <p className="mt-1 text-sm capitalize">{selectedCampaignForPerformance.repeatFrequency}</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.dailyRepeatInterval && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Daily Repeat Interval</label>
                              <p className="mt-1 text-sm">{selectedCampaignForPerformance.dailyRepeatInterval} days</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.weeklyRepeatDays && selectedCampaignForPerformance.weeklyRepeatDays.length > 0 && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Weekly Repeat Days</label>
                              <p className="mt-1 text-sm">{selectedCampaignForPerformance.weeklyRepeatDays.join(', ')}</p>
                            </div>
                          )}
                          {selectedCampaignForPerformance?.monthlyRepeatDates && selectedCampaignForPerformance.monthlyRepeatDates.length > 0 && (
                            <div>
                              <label className="text-sm font-medium text-foreground">Monthly Repeat Dates</label>
                              <p className="mt-1 text-sm">{selectedCampaignForPerformance.monthlyRepeatDates.join(', ')}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Template Preview */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1">Template Preview</label>
                    <div className="h-full max-h-[62vh] w-full max-w-[31vh] flex flex-col items-center">
                      <PreviewV2
                        mode="chat"
                        headerText={selectedTemplate?.header || ""}
                        bodyText={selectedTemplate?.body || ""}
                        footerText={selectedTemplate?.footer || ""}
                        selectedMediaFile={null}
                        templateButtons={selectedTemplate?.buttons || []}
                        variableSamples={selectedTemplate?.variableSamples || {}}
                      />
                      <p className="text-[10px] py-1">Preview may not reflect the exact WhatsApp interface</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Performance Tab */}
            {activeDetailsTab === "performance" && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Sent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">15,420</div>
                      <p className="text-xs text-muted-foreground mt-1">Total messages</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Delivered</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">14,892</div>
                      <p className="text-xs text-muted-foreground mt-1">96.6% delivery rate</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Failed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">528</div>
                      <p className="text-xs text-muted-foreground mt-1">3.4% failure rate</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Viewed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">12,453</div>
                      <p className="text-xs text-muted-foreground mt-1">83.6% view rate</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Chart */}
                <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm">Engagement Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        delivered: {
                          label: "Delivered",
                          color: "hsl(var(--primary))",
                        },
                        viewed: {
                          label: "Viewed",
                          color: "hsl(var(--chart-2))",
                        },
                      }}
                      className="h-[300px] w-full"
                    >
                      <AreaChart data={selectedCampaignForPerformance?.engagementData || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <Area type="monotone" dataKey="delivered" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                        <Area type="monotone" dataKey="viewed" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.2} strokeWidth={2} />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recipients Tab */}
            {activeDetailsTab === "recipients" && (() => {
              const sortedRecipients = getSortedRecipients();
              const paginatedRecipients = sortedRecipients.slice((recipientPage - 1) * recipientRowsPerPage, recipientPage * recipientRowsPerPage);
              const totalRecipientPages = Math.ceil(sortedRecipients.length / recipientRowsPerPage);

              const recipientStatusOptions = [
                { id: "Sent", name: "Sent" },
                { id: "Delivered", name: "Delivered" },
                { id: "Viewed", name: "Viewed" },
                { id: "Failed", name: "Failed" },
              ];

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-3"> {/* New flex container */}
                    <div className="relative w-80">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search recipients..."
                        value={recipientSearchQuery}
                        onChange={(e) => {
                          setRecipientSearchQuery(e.target.value);
                          setRecipientPage(1); // Reset to first page on search
                        }}
                        className="pl-10 text-sm w-full border border-input rounded-md bg-background focus:outline-none transition-color"
                        data-testid="input-search-recipients"
                      />
                    </div>
                    <CustomDropdown
                      options={recipientStatusOptions}
                      selected={selectedRecipientStatus}
                      onChange={(values) => {
                        setSelectedRecipientStatus(values);
                        setRecipientPage(1); // Reset to first page on filter change
                      }}
                      placeholder="Status"
                      width="160px"
                    />
                  </div>
                  <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                    <CardContent className="pt-2">
                      <ScrollArea className="h-104">
                        <div className="overflow-x-auto mt-6">
                          <table className="w-full text-xs">
                            <thead className="select-none">
                              <tr className="border-b">
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30" onClick={() => handleRecipientSort('name')}>
                                  <div className="flex items-center gap-2">
                                    Name
                                    {renderRecipientSortIcon('name')}
                                  </div>
                                </th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30" onClick={() => handleRecipientSort('phone')}>
                                  <div className="flex items-center gap-2">
                                    Phone
                                    {renderRecipientSortIcon('phone')}
                                  </div>
                                </th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30" onClick={() => handleRecipientSort('status')}>
                                  <div className="flex items-center gap-2">
                                    Status
                                    {renderRecipientSortIcon('status')}
                                  </div>
                                </th>
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30" onClick={() => handleRecipientSort('time')}>
                                  <div className="flex items-center gap-2">
                                    Time
                                    {renderRecipientSortIcon('time')}
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedRecipients.map((recipient) => (
                                <tr key={recipient.id} className="border-b hover:bg-muted/50" data-testid={`recipient-${recipient.id}`}>
                                  <td className="py-2 px-3 font-medium">{recipient.name}</td>
                                  <td className="py-2 px-3">{recipient.phone}</td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${recipient.status === "Viewed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                      recipient.status === "Delivered" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                        recipient.status === "Sent" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                      }`}>
                                      {recipient.status}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-muted-foreground">{recipient.time}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </ScrollArea>
                      {/* Pagination */}
                      <div className="flex items-center justify-between mt-4 text-xs">
                        <span className="text-muted-foreground">{sortedRecipients.length} results</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Rows per page:</span>
                          <Select value={String(recipientRowsPerPage)} onValueChange={(value) => {
                            setRecipientRowsPerPage(Number(value));
                            setRecipientPage(1);
                          }}>
                            <SelectTrigger className="w-16 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground">Page {recipientPage} of {totalRecipientPages || 1}</span>
                          <div className="flex gap-1">
                            <button className="p-1 hover:bg-muted dark:hover:bg-slate-700 rounded disabled:opacity-50 transition-colors" disabled={recipientPage === 1} onClick={() => setRecipientPage(1)}>
                              <ChevronsLeft size={16} />
                            </button>
                            <button className="p-1 hover:bg-muted dark:hover:bg-slate-700 rounded disabled:opacity-50 transition-colors" disabled={recipientPage === 1} onClick={() => setRecipientPage(p => p - 1)}>
                              <ChevronLeft size={16} />
                            </button>
                            <button className="p-1 hover:bg-muted dark:hover:bg-slate-700 rounded disabled:opacity-50 transition-colors" disabled={recipientPage === totalRecipientPages} onClick={() => setRecipientPage(p => p + 1)}>
                              <ChevronRight size={16} />
                            </button>
                            <button className="p-1 hover:bg-muted dark:hover:bg-slate-700 rounded disabled:opacity-50 transition-colors" disabled={recipientPage === totalRecipientPages} onClick={() => setRecipientPage(totalRecipientPages)}>
                              <ChevronsRight size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Clone Campaign Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={handleCancelCloneDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clone Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Campaign Name<span className="text-red-500 pl-0.5">*</span></label>
              <div className="relative">
                <Input
                  placeholder="Enter campaign name..."
                  value={cloneCampaignName}
                  onChange={(e) => setCloneCampaignName(e.target.value.slice(0, 512))}
                  className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {cloneCampaignName.length}/512
                </span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancelCloneDialog}>
                Cancel
              </Button>
              <Button
                className="btn-outline-primary"
                variant="outline"
                onClick={handleCloneCampaign}
                disabled={!cloneCampaignName.trim()}
              >
                Clone Campaign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Campaign Modal */}
      <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>Archive Campaign</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Are you sure you want to archive <span className="font-semibold break-all">{campaignToArchive?.name}</span>? You can restore it from the Archived tab.
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowArchiveModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmArchive}
              className="bg-orange-500 hover:bg-orange-600 border-orange-600 text-white"
            >
              Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Campaign Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>Delete Campaign</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Are you sure you want to delete <span className="font-semibold break-all">{campaignToDelete?.name}</span>? This action cannot be undone.            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowDeleteModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 border-red-600 text-white"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Archive Modal */}
      <Dialog open={showBulkArchiveModal} onOpenChange={setShowBulkArchiveModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>Archive Campaigns</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Are you sure you want to archive <span className="font-semibold">{getArchivableCampaigns().length} campaign(s)</span>? You can restore them from the Archived tab.
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowBulkArchiveModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkArchive}
              className="bg-orange-500 hover:bg-orange-600 border-orange-600 text-white"
            >
              Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>Delete Campaigns</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Are you sure you want to delete <span className="font-semibold">{getDeletableCampaigns().length} campaign(s)</span>? This action cannot be undone.
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowBulkDeleteModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDelete}
              className="bg-red-500 hover:bg-red-600 border-red-600 text-white"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

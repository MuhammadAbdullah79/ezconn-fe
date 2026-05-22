import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, RefreshCw, MoreVertical, Download, FileText } from "react-feather";
import { Calendar, ChevronsUpDown, ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, MessageSquare, Activity } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import CustomDropdown from "@/components/CustomDropdown";
import { format } from "date-fns";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getQueryFn } from "@/lib/queryClient";


interface SortEntry {
    id: string;
    column: string;
    direction: "asc" | "desc";
}

interface Conversation {
    id: string;
    customerNumber: string;
    customer: string;
    agent: string;
    agentId: string;
    startTime: string;
    duration: string;
    status: "Active" | "Queued" | "In Progress" | "Completed" | "Pending" | "Expired" | "Spammed" | "Forwarded";
    messages: number;
    timeline: string;
    sentiment: string;
    sentimentSummary: string;
}

// Dead-code mock array removed — component reads live data from /api/logs/conversations.


export default function ConversationLogsPage() {
    const [search, setSearch] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const { data: logsResponse, isLoading } = useQuery<{ logs: Conversation[]; total: number }>({
        queryKey: ["/api/logs/conversations", { page, limit: rowsPerPage, search, status: selectedStatus[0] }],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: rowsPerPage.toString(),
                search: search
            });
            if (selectedStatus.length > 0 && selectedStatus[0]) {
                params.append('status', selectedStatus[0]);
            }
            const res = await apiRequest("GET", `/api/logs/conversations?${params.toString()}`);
            return res.json();
        }
    });

    const { data: statsResponse } = useQuery<{ conversations: any }>({
        queryKey: ["/api/logs/stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/logs/stats");
            return res.json();
        }
    });

    const conversations = logsResponse?.logs || [];
    const stats = statsResponse?.conversations || {
        total: 0,
        queued: 0,
        active: 0,
        completed: 0,
        resolutionRate: "0%"
    };

    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [dateRangePreset, setDateRangePreset] = useState("last-7-days");
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
    const [sorts, setSorts] = useState<SortEntry[]>([]);
    const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);


    // Modal State
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [viewDetailsOpen, setViewDetailsOpen] = useState(false);

    const handleViewDetails = (conv: Conversation) => {
        setSelectedConversation(conv);
        setViewDetailsOpen(true);
    };

    const statusOptions = [
        { id: "Active", name: "Active" },
        { id: "Queued", name: "Queued" },
        { id: "In Progress", name: "In Progress" },
        { id: "Completed", name: "Completed" },
        { id: "Pending", name: "Pending" },
        { id: "Expired", name: "Expired" },
        { id: "Spammed", name: "Spammed" },
        { id: "Forwarded", name: "Forwarded" },
    ];

    const kpiData = {
        totalConversations: stats.total,
        queued: stats.queued,
        active: stats.active,
        completed: stats.completed,
        resolutionRate: stats.resolutionRate,
    };

    const toggleRowSelection = (id: string) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const toggleAllRows = () => {
        const data = getFilteredAndSortedData();
        if (selectedRows.size === data.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(data.map(c => c.id)));
        }
    };

    const renderSortIcon = (column: string) => {
        const sort = sorts.find(s => s.column === column);
        const isActive = !!sort;
        const color = isActive ? "text-foreground" : "text-muted-foreground";

        if (!sort) {
            return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
        }
        if (sort.direction === "asc") {
            return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
        }
        return <div className="w-4 h-4 flex items-center justify-center"><ChevronDown size={14} className={color} /></div>;
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setRowsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleColumnSort = (column: string) => {
        const existingSort = sorts.find(s => s.column === column);
        if (existingSort) {
            if (existingSort.direction === "asc") {
                setSorts([{ id: existingSort.id, column, direction: "desc" }]);
            } else {
                setSorts([]);
            }
        } else {
            setSorts([{ id: Date.now().toString(), column, direction: "asc" }]);
        }
    };

    const getFilteredAndSortedData = () => {
        let data = [...conversations];

        // Apply search
        if (search) {
            data = data.filter(item =>
                item.customer.toLowerCase().includes(search.toLowerCase()) ||
                item.agent.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Apply status filter
        if (selectedStatus.length > 0) {
            data = data.filter(item => selectedStatus.includes(item.status));
        }

        // Apply date range filter
        const currentDate = new Date(2025, 10, 4); // November 4, 2025
        currentDate.setHours(0, 0, 0, 0); // Set to start of day

        if (dateRangePreset !== "custom") {
            data = data.filter(item => {
                // Parse date from "2025-11-04 10:30 AM" format
                const dateStr = item.startTime.split(" ").slice(0, 1)[0]; // Get "2025-11-04"
                const itemDate = new Date(dateStr);
                itemDate.setHours(0, 0, 0, 0); // Set to start of day for comparison

                switch (dateRangePreset) {
                    case "last-7-days":
                        const sevenDaysAgo = new Date(currentDate);
                        sevenDaysAgo.setDate(currentDate.getDate() - 7);
                        return itemDate >= sevenDaysAgo && itemDate <= currentDate;

                    case "last-14-days":
                        const fourteenDaysAgo = new Date(currentDate);
                        fourteenDaysAgo.setDate(currentDate.getDate() - 14);
                        return itemDate >= fourteenDaysAgo && itemDate <= currentDate;

                    case "last-30-days":
                        const thirtyDaysAgo = new Date(currentDate);
                        thirtyDaysAgo.setDate(currentDate.getDate() - 30);
                        return itemDate >= thirtyDaysAgo && itemDate <= currentDate;

                    case "this-month":
                        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                        return itemDate >= firstDayOfMonth && itemDate <= currentDate;

                    case "this-quarter":
                        const currentQuarter = Math.floor(currentDate.getMonth() / 3);
                        const firstDayOfQuarter = new Date(currentDate.getFullYear(), currentQuarter * 3, 1);
                        return itemDate >= firstDayOfQuarter && itemDate <= currentDate;

                    default:
                        return true;
                }
            });
        } else if (customDateRange?.from && customDateRange?.to) {
            data = data.filter(item => {
                // Parse date from "2025-11-04 10:30 AM" format
                const dateStr = item.startTime.split(" ").slice(0, 1)[0]; // Get "2025-11-04"
                const itemDate = new Date(dateStr);
                itemDate.setHours(0, 0, 0, 0); // Set to start of day

                const fromDate = new Date(customDateRange.from!);
                fromDate.setHours(0, 0, 0, 0);

                const toDate = new Date(customDateRange.to!);
                toDate.setHours(23, 59, 59, 999); // Include the entire end date

                return itemDate >= fromDate && itemDate <= toDate;
            });
        }

        // Apply sorting - Excel-style multi-level sort
        if (sorts.length > 0) {
            data.sort((a, b) => {
                for (const sort of sorts) {
                    const aVal = a[sort.column as keyof Conversation];
                    const bVal = b[sort.column as keyof Conversation];

                    let comparison = 0;
                    if (typeof aVal === "string" && typeof bVal === "string") {
                        comparison = sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    } else if (typeof aVal === "number" && typeof bVal === "number") {
                        comparison = sort.direction === "asc" ? aVal - bVal : bVal - aVal;
                    }

                    // If values are different, return the comparison result
                    if (comparison !== 0) {
                        return comparison;
                    }
                    // If values are equal, continue to next sort criterion
                }
                return 0; // All criteria are equal
            });
        }

        return data;
    };

    const handleExportSelectedAsCSV = () => {
        if (selectedRows.size === 0) {
            return;
        }

        const selectedConversations = conversations.filter(c => selectedRows.has(c.id));

        const escapeCSV = (value: string | number) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = ["Customer Number", "Customer Name", "Started Time", "Duration", "Agent Name", "Agent ID", "Status", "Number of Messages", "Conversation Timeline", "Sentiment", "Sentiment Summary"];

        const rows = selectedConversations.map(conv => [
            escapeCSV(conv.customerNumber),
            escapeCSV(conv.customer),
            escapeCSV(conv.startTime),
            escapeCSV(conv.duration),
            escapeCSV(conv.agent),
            escapeCSV(conv.agentId),
            escapeCSV(conv.status),
            escapeCSV(conv.messages),
            escapeCSV(conv.timeline),
            escapeCSV(conv.sentiment),
            escapeCSV(conv.sentimentSummary),
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `conversations_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportSingleAsCSV = (conv: Conversation) => {
        const escapeCSV = (value: string | number) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = ["Customer Number", "Customer Name", "Started Time", "Duration", "Agent Name", "Agent ID", "Status", "Number of Messages", "Conversation Timeline", "Sentiment", "Sentiment Summary"];

        const row = [
            escapeCSV(conv.customerNumber),
            escapeCSV(conv.customer),
            escapeCSV(conv.startTime),
            escapeCSV(conv.duration),
            escapeCSV(conv.agent),
            escapeCSV(conv.agentId),
            escapeCSV(conv.status),
            escapeCSV(conv.messages),
            escapeCSV(conv.timeline),
            escapeCSV(conv.sentiment),
            escapeCSV(conv.sentimentSummary),
        ];

        const csvContent = [
            headers.join(","),
            row.join(","),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", `conversation_${conv.id}_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const paginatedData = conversations; // Backend already paginates
    const totalPages = Math.ceil((logsResponse?.total || 0) / rowsPerPage);

    return (
        <div className="animate-in fade-in duration-700 p-6">
            {/* Unified Master Card */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-300 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col">
                
                {/* 1. Branded Header Section */}
                <div className="py-2 px-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-transparent rounded-t-[20px]">
                    <div className="flex items-center gap-6">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-inner">
                            <MessageSquare size={20} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-0.5">
                            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                Conversation Logs
                            </h1>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Detailed history and real-time statistics of all agent-customer interactions
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"
                                    onClick={() => {
                                        // Refresh logic
                                    }}
                                >
                                    <RefreshCw size={14} className="text-slate-500" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px]">Refresh Logs</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* 2. Compact Stats Row (Integrated) */}
                <div className="grid grid-cols-2 md:grid-cols-5 border-b border-slate-200 dark:border-slate-800/80 divide-x divide-slate-100 dark:divide-slate-800/50">
                    <div className="p-4 bg-slate-50/30 dark:bg-transparent">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Conversations</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{kpiData.totalConversations}</p>
                            <span className="text-[10px] font-medium text-slate-400">total</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Queued</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-amber-600">{kpiData.queued}</p>
                            <span className="text-[10px] font-medium text-slate-400">waiting</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-blue-600">{kpiData.active}</p>
                            <span className="text-[10px] font-medium text-slate-400">in progress</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completed</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-emerald-600">{kpiData.completed}</p>
                            <span className="text-[10px] font-medium text-slate-400">resolved</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Resolution Rate</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-bold text-indigo-600">{kpiData.resolutionRate}</p>
                            <span className="text-[10px] font-medium text-slate-400">success</span>
                        </div>
                    </div>
                </div>

                {/* 3. Unified Filter Row Section */}
                <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-transparent flex items-center gap-2 flex-wrap">
                    <div className="relative group flex-1 min-w-[200px] max-w-[280px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search customer, agent or number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="block w-full pl-9 pr-3 h-9 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 focus:bg-white dark:focus:bg-slate-900 transition-all duration-200 shadow-sm shadow-slate-100/50 dark:shadow-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
                            <SelectTrigger style={{ borderRadius: '6px' }} className="h-9 w-[140px] !rounded-md border border-input bg-white dark:bg-slate-800/50 text-[12px] font-medium shadow-sm hover:bg-slate-50 transition-all">
                                <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-input dark:border-slate-800 shadow-xl">
                                <SelectItem value="last-7-days" className="text-xs">Last 7 Days</SelectItem>
                                <SelectItem value="last-14-days" className="text-xs">Last 14 Days</SelectItem>
                                <SelectItem value="last-30-days" className="text-xs">Last 30 Days</SelectItem>
                                <SelectItem value="this-month" className="text-xs">This Month</SelectItem>
                                <SelectItem value="this-quarter" className="text-xs">This Quarter</SelectItem>
                                <SelectItem value="custom" className="text-xs text-primary font-bold">Custom Range</SelectItem>
                            </SelectContent>
                        </Select>

                        {dateRangePreset === "custom" && (
                            <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" style={{ borderRadius: '6px' }} className="h-9 px-3 !rounded-md border border-input bg-white dark:bg-slate-800/50 text-[11px] font-medium gap-2 shadow-sm">
                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                        <span>
                                            {customDateRange?.from ? format(customDateRange.from, 'dd/MM') : "Start"} - {customDateRange?.to ? format(customDateRange.to, 'dd/MM') : "End"}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-2xl border border-input dark:border-slate-800 shadow-2xl overflow-hidden" align="end">
                                    <CalendarComponent
                                        mode="range"
                                        selected={customDateRange}
                                        onSelect={setCustomDateRange}
                                        className="bg-white dark:bg-slate-900"
                                    />
                                </PopoverContent>
                            </Popover>
                        )}

                        <CustomDropdown
                            options={statusOptions}
                            selected={selectedStatus}
                            onChange={setSelectedStatus}
                            placeholder="Status"
                            width="140px"
                            className="!w-[140px]"
                            popoutAlign="right"
                            triggerContent={
                                <>
                                    <div className="flex items-center gap-2 truncate">
                                        <Activity className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span className={cn("truncate text-[12px]", selectedStatus.length > 0 ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400")}>
                                            {selectedStatus.length === 0 ? "Status" : `Status (${selectedStatus.length})`}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-400/50 shrink-0" />
                                </>
                            }
                        />
                    </div>
                </div>

                {/* 4. Table Content Area */}
                <div className="flex-1 overflow-auto min-h-[300px]">
                    {selectedRows.size > 0 && (
                        <div className="flex items-center gap-3 px-5 py-2 bg-primary/[0.06] dark:bg-primary/5 border-b border-primary/20 dark:border-primary/20 animate-in slide-in-from-top-2">
                            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">{selectedRows.size} Selected</span>
                            <div className="flex gap-1 ml-auto">
                                <Button 
                                    onClick={handleExportSelectedAsCSV}
                                    variant="outline" 
                                    className="h-7 px-3 rounded-md border-primary/30 text-primary gap-2 text-[10px] font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                                >
                                    <Download size={12} />
                                    Export Selected
                                </Button>
                            </div>
                        </div>
                    )}

                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
                            <tr>
                                <th className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 w-10">
                                    <Checkbox
                                        checked={selectedRows.size > 0 && selectedRows.size === getFilteredAndSortedData().length}
                                        onCheckedChange={toggleAllRows}
                                        className="rounded-[4px] border-slate-300 dark:border-slate-700"
                                    />
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("customer")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        Customer {renderSortIcon("customer")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("agent")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        Agent {renderSortIcon("agent")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("startTime")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        Start Time {renderSortIcon("startTime")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("duration")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        Duration {renderSortIcon("duration")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("status")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        Status {renderSortIcon("status")}
                                    </div>
                                </th>
                                <th 
                                    onClick={() => handleColumnSort("messages")}
                                    className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition-colors text-center"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        Messages {renderSortIcon("messages")}
                                    </div>
                                </th>
                                <th className="px-5 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 w-20">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-800">
                                                <Search className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-400">No conversation logs found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((conv) => (
                                    <tr 
                                        key={conv.id} 
                                        className="group hover:bg-primary/[0.06] dark:hover:bg-primary/5 transition-all duration-200"
                                    >
                                        <td className="px-5 py-2.5">
                                            <Checkbox
                                                checked={selectedRows.has(conv.id)}
                                                onCheckedChange={() => toggleRowSelection(conv.id)}
                                                className="rounded-[4px] border-slate-300 dark:border-slate-700"
                                            />
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">{conv.customer}</span>
                                                <span className="text-[10px] text-slate-400">{conv.customerNumber}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                                    {conv.agent.substring(0, 1)}
                                                </div>
                                                <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">{conv.agent}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5 text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                                            {conv.startTime}
                                        </td>
                                        <td className="px-5 py-2.5 text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                                            {conv.duration}
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase",
                                                conv.status === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                                conv.status === "Active" || conv.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                                                conv.status === "Queued" || conv.status === "Pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
                                                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                            )}>
                                                {conv.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex justify-center">
                                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 min-w-[24px]">
                                                    {conv.messages}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                                    >
                                                        <MoreVertical size={14} className="text-slate-400" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-xl border-slate-200 dark:border-slate-800">
                                                    <DropdownMenuItem 
                                                        onClick={() => handleViewDetails(conv)}
                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        <FileText size={13} className="text-primary" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleExportSingleAsCSV(conv)}
                                                        className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                                                    >
                                                        <Download size={13} className="text-emerald-500" />
                                                        Export CSV
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 5. Footer / Pagination Section */}
                <div className="px-5 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-transparent flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
                        <span>{logsResponse?.total || 0} results found</span>
                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                        <div className="flex items-center gap-2">
                            <span>Show</span>
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 transition-colors"
                                    onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
                                >
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{rowsPerPage}</span>
                                    <ChevronDown size={10} className="text-slate-400" />
                                </button>
                                {rowsDropdownOpen && (
                                    <div className="absolute bottom-full left-0 mb-1 z-50 w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-1">
                                        {[10, 25, 50].map(option => (
                                            <button
                                                key={option}
                                                className="w-full px-3 py-1.5 text-left hover:bg-primary/10 dark:hover:bg-primary/15 text-slate-600 dark:text-slate-300 transition-colors font-medium"
                                                onClick={() => {
                                                    setRowsPerPage(option);
                                                    setPage(1);
                                                    setRowsDropdownOpen(false);
                                                }}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mr-2">
                            <span>Page</span>
                            <span className="text-slate-900 dark:text-white">{page}</span>
                            <span>of</span>
                            <span>{totalPages || 1}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md border-slate-200 dark:border-slate-800 shadow-sm"
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                            >
                                <ChevronsLeft size={12} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md border-slate-200 dark:border-slate-800 shadow-sm"
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft size={12} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md border-slate-200 dark:border-slate-800 shadow-sm"
                                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={page === totalPages}
                            >
                                <ChevronRight size={12} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md border-slate-200 dark:border-slate-800 shadow-sm"
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                            >
                                <ChevronsRight size={12} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Details Dialog */}
            <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader className="mb-2">
                        <DialogTitle>Conversation Details</DialogTitle>
                    </DialogHeader>
                    {selectedConversation && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left side - Conversation Details */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Customer Name</label>
                                        <p className="mt-1 text-sm">{selectedConversation.customer}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Agent Name</label>
                                        <p className="mt-1 text-sm">{selectedConversation.agent}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Start Time</label>
                                        <p className="mt-1 text-sm">{selectedConversation.startTime}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Duration</label>
                                        <p className="mt-1 text-sm">{selectedConversation.duration}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Status</label>
                                        <p className="mt-1">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${selectedConversation.status === "Completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                selectedConversation.status === "Active" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                                    selectedConversation.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                                        selectedConversation.status === "Queued" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                                            selectedConversation.status === "Pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                                                selectedConversation.status === "Forwarded" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                                                    selectedConversation.status === "Expired" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                        selectedConversation.status === "Spammed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                            "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300"
                                                }`}>
                                                {selectedConversation.status}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Number of Messages</label>
                                        <p className="mt-1 text-sm">{selectedConversation.messages}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Sentiment</label>
                                        <p className="mt-1">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${selectedConversation.sentiment === "Positive" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                selectedConversation.sentiment === "Negative" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                                }`}>
                                                {selectedConversation.sentiment}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium text-foreground">Sentiment Summary</label>
                                        <p className="mt-1 text-sm">{selectedConversation.sentimentSummary}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right side - Conversation Timeline */}
                            <div className="space-y-4">
                                <h3 className="font-medium text-lg">Conversation Timeline</h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {/* Timeline Events */}
                                    <div className="relative pl-6">
                                        {/* Timeline line */}
                                        <div className="absolute left-[0.45rem] top-2 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-700"></div>

                                        {/* Timeline Events */}
                                        <div className="space-y-6">
                                            {/* Conversation Started */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Customer initiated conversation</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:30:15 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">First message received from customer</div>
                                            </div>

                                            {/* Bot Response */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Bot auto-response sent</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:30:18 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Automated greeting and initial assistance</div>
                                            </div>

                                            {/* Customer Response */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Customer replied</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:30:45 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Customer sent a reply message</div>
                                            </div>

                                            {/* Transferred to Agent */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Escalated to agent</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:31:02 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Bot escalated to human agents</div>
                                            </div>

                                            {/* Agent Joined */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Chat was assigned to agent</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:31:15 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Chat Assigned to Sarah Johnson</div>
                                            </div>

                                            {/* Agent Messages */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Agent provided assistance</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:31:20 AM to 10:34:45 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">8 messages exchanged</div>
                                            </div>

                                            {/* Issue Resolved */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Issue resolved</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:34:50 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Customer confirmed satisfaction with resolution</div>
                                            </div>

                                            {/* Conversation Completed */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Conversation completed</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:35:23 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Agent marked conversation as resolved</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal Footer */}
                    <div className="flex gap-2 justify-end mt-2">
                        <Button
                            onClick={() => setViewDetailsOpen(false)}
                            variant="outline"
                            className="border-input [border-color:hsl(var(--input))] font-normal"
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

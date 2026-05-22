import { useState, useRef, useEffect } from "react";
import { Search, RefreshCw, MoreVertical, Download, FileText } from "react-feather";
import { Calendar, ChevronsUpDown, ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, MessageSquare } from "lucide-react";
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
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Conversation Logs</h1>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-10 p-0 border hover-elevate [border-color:hsl(var(--input))]"
                            onClick={() => {
                                // Refresh logic here
                            }}
                        >
                            <RefreshCw size={16} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
            </div>

            <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Total Conversations</p>
                                <p className="text-2xl font-bold">{kpiData.totalConversations}</p>
                                <p className="text-xs text-muted-foreground">Conversations</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Queued</p>
                                <p className="text-2xl font-bold">{kpiData.queued}</p>
                                <p className="text-xs text-muted-foreground">Waiting</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Active</p>
                                <p className="text-2xl font-bold">{kpiData.active}</p>
                                <p className="text-xs text-muted-foreground">In progress</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Completed</p>
                                <p className="text-2xl font-bold">{kpiData.completed}</p>
                                <p className="text-xs text-muted-foreground">Resolved</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                        <CardContent className="pt-6">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Resolution Rate</p>
                                <p className="text-2xl font-bold">{kpiData.resolutionRate}</p>
                                <p className="text-xs text-muted-foreground">Success rate</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between gap-3">
                    {/* Left side: Search, Date Range, and Status */}
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative w-80" style={{ height: "38px" }}>
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder="Search conversations..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 text-sm w-full border border-input rounded-md bg-background focus:outline-none transition-color h-full"
                            />
                        </div>

                        {/* Date Range Preset */}
                        <Select value={dateRangePreset} onValueChange={setDateRangePreset}>
                            <SelectTrigger className="w-[160px] hover-elevate" style={{ height: "38px" }}>
                                <Calendar className="h-4 w-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)]">
                                <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                                <SelectItem value="last-14-days">Last 14 Days</SelectItem>
                                <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                                <SelectItem value="this-month">This Month</SelectItem>
                                <SelectItem value="this-quarter">This Quarter</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Custom Date Range */}
                        {dateRangePreset === "custom" && (
                            <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="gap-2 font-normal h-10 hover-elevate [border-color:hsl(var(--input))]">
                                        <Calendar className="h-4 w-4" />
                                        <span>
                                            {customDateRange
                                                ? customDateRange.to
                                                    ? `${(customDateRange.from ? format(customDateRange.from, 'dd/MMM/yyyy') : "")} - ${(customDateRange.to ? format(customDateRange.to, 'dd/MMM/yyyy') : "")}`
                                                    : (customDateRange.from ? format(customDateRange.from, 'dd/MMM/yyyy') : "")
                                                : "Select Date"}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <CalendarComponent
                                        initialFocus
                                        mode="range"
                                        defaultMonth={customDateRange?.from}
                                        selected={customDateRange}
                                        onSelect={setCustomDateRange}
                                        numberOfMonths={1}
                                    />
                                </PopoverContent>
                            </Popover>
                        )}

                        {/* Status Filter */}
                        <CustomDropdown
                            options={statusOptions}
                            selected={selectedStatus}
                            onChange={setSelectedStatus}
                            placeholder="Status"
                            width="160px"
                        />
                    </div>
                </div>

                {/* Table */}
                <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                    <CardContent className="pt-2">
                        {/* Bulk Actions Toolbar */}
                        {selectedRows.size > 0 && (
                            <div className="flex items-center gap-3 mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                                <span className="text-sm text-foreground">{selectedRows.size} selected</span>
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        onClick={handleExportSelectedAsCSV}
                                        className="p-1 hover:bg-accent dark:hover:bg-slate-700 rounded transition-colors"
                                        title="Export as CSV"
                                    >
                                        <Download size={14} className="text-blue-600 dark:text-blue-400" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`overflow-x-auto ${selectedRows.size > 0 ? 'mt-3' : 'mt-6'}`}>
                            <table className="w-full text-xs">
                                <thead className="select-none">
                                    <tr className="border-b">
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                            <Checkbox
                                                checked={selectedRows.size > 0 && selectedRows.size === getFilteredAndSortedData().length}
                                                onCheckedChange={toggleAllRows}
                                            />
                                        </th>
                                        <th
                                            className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                            onClick={() => handleColumnSort("customer")}
                                        >
                                            <div className="flex items-center gap-2">
                                                Customer
                                                {renderSortIcon("customer")}
                                            </div>
                                        </th>
                                        <th
                                            className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                            onClick={() => handleColumnSort("agent")}
                                        >
                                            <div className="flex items-center gap-2">
                                                Agent
                                                {renderSortIcon("agent")}
                                            </div>
                                        </th>
                                        <th
                                            className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                            onClick={() => handleColumnSort("startTime")}
                                        >
                                            <div className="flex items-center gap-2">
                                                Start Time
                                                {renderSortIcon("startTime")}
                                            </div>
                                        </th>
                                        <th
                                            className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                            onClick={() => handleColumnSort("duration")}
                                        >
                                            <div className="flex items-center gap-2">
                                                Duration
                                                {renderSortIcon("duration")}
                                            </div>
                                        </th>
                                        <th
                                            className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                            onClick={() => handleColumnSort("status")}
                                        >
                                            <div className="flex items-center gap-2">
                                                Status
                                                {renderSortIcon("status")}
                                            </div>
                                        </th>
                                        <th
                                            className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                            onClick={() => handleColumnSort("messages")}
                                        >
                                            <div className="flex items-center gap-2">
                                                Messages
                                                {renderSortIcon("messages")}
                                            </div>
                                        </th>
                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-8 text-muted-foreground">
                                                No results
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedData.map((conv) => (
                                            <tr key={conv.id} className="border-b hover:bg-muted/50">
                                                <td className="py-2 px-3">
                                                    <Checkbox
                                                        checked={selectedRows.has(conv.id)}
                                                        onCheckedChange={() => toggleRowSelection(conv.id)}
                                                    />
                                                </td>
                                                <td className="py-2 px-3">{conv.customer}</td>
                                                <td className="py-2 px-3">{conv.agent}</td>
                                                <td className="py-2 px-3">{conv.startTime}</td>
                                                <td className="py-2 px-3">{conv.duration}</td>
                                                <td className="py-2 px-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${conv.status === "Completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                        conv.status === "Active" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                                            conv.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                                                conv.status === "Queued" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                                                    conv.status === "Pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                                                        conv.status === "Forwarded" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                                                                            conv.status === "Expired" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                                conv.status === "Spammed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                                    "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300"
                                                        }`}>
                                                        {conv.status}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3">{conv.messages}</td>
                                                <td className="py-2 px-3 flex justify-start">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="p-1 hover:bg-muted rounded">
                                                                <MoreVertical size={14} className="text-muted-foreground" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-white dark:bg-popover">
                                                            <DropdownMenuItem onClick={() => handleViewDetails(conv)}>
                                                                <FileText size={14} className="mr-2" />
                                                                View Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleExportSingleAsCSV(conv)}>
                                                                <Download size={14} className="mr-2" />
                                                                Export Log
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <MessageSquare size={14} className="mr-2" />
                                                                Export Chat
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

                        {/* Pagination */}
                        <div className="flex items-center justify-between mt-4 text-xs">
                            <span className="text-muted-foreground">{getFilteredAndSortedData().length} results</span>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Rows per page:</span>
                                <div className="relative w-15" ref={dropdownRef}>
                                    <button
                                        type="button"
                                        className="flex items-center justify-between px-3 py-2 text-left bg-background dark:bg-background border border-input dark:border-slate-700 rounded-md shadow-sm hover:bg-accent dark:hover:bg-slate-700 focus:outline-none text-foreground transition-colors"
                                        onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
                                    >
                                        <span className="truncate text-xs font-normal">{rowsPerPage}</span>
                                        <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground" />
                                    </button>
                                    {rowsDropdownOpen && (
                                        <div className="absolute z-10 w-full mt-2 bg-background dark:bg-background rounded-md shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border border-border dark:border-slate-700 overflow-hidden">
                                            <ul className="py-1">
                                                {[10, 25, 50].map(option => (
                                                    <li
                                                        key={option}
                                                        className="px-3 py-2 text-xs cursor-pointer hover:bg-muted dark:hover:bg-slate-700"
                                                        onClick={() => {
                                                            setRowsPerPage(option);
                                                            setRowsDropdownOpen(false);
                                                            setPage(1);
                                                        }}
                                                    >
                                                        {option}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <span className="text-muted-foreground">Page {page} of {totalPages || 1}</span>
                                <div className="flex gap-1">
                                    <button
                                        className="p-1 hover:bg-muted dark:hover:bg-slate-700 rounded disabled:opacity-50 transition-colors"
                                        disabled={page === 1}
                                        onClick={() => setPage(1)}
                                    >
                                        <ChevronsLeft size={16} />
                                    </button>
                                    <button
                                        className="p-1 hover:bg-muted dark:hover:bg-slate-700 rounded disabled:opacity-50 transition-colors"
                                        disabled={page === 1}
                                        onClick={() => setPage(page - 1)}
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        className="p-1 hover:bg-muted dark:hover:bg-slate-700 rounded disabled:opacity-50 transition-colors"
                                        disabled={page === totalPages}
                                        onClick={() => setPage(page + 1)}
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                    <button
                                        className="p-1 hover:bg-muted dark:hover:bg-slate-700 rounded disabled:opacity-50 transition-colors"
                                        disabled={page === totalPages}
                                        onClick={() => setPage(totalPages)}
                                    >
                                        <ChevronsRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Customer initiated conversation</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:30:15 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">First message received from customer</div>
                                            </div>

                                            {/* Bot Response */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Bot auto-response sent</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:30:18 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Automated greeting and initial assistance</div>
                                            </div>

                                            {/* Customer Response */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Customer replied</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:30:45 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Customer sent a reply message</div>
                                            </div>

                                            {/* Transferred to Agent */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Escalated to agent</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:31:02 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Bot escalated to human agents</div>
                                            </div>

                                            {/* Agent Joined */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Chat was assigned to agent</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:31:15 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Chat Assigned to Sarah Johnson</div>
                                            </div>

                                            {/* Agent Messages */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Agent provided assistance</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:31:20 AM to 10:34:45 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">8 messages exchanged</div>
                                            </div>

                                            {/* Issue Resolved */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Issue resolved</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">10:34:50 AM</div>
                                                <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Customer confirmed satisfaction with resolution</div>
                                            </div>

                                            {/* Conversation Completed */}
                                            <div className="relative">
                                                <div className="absolute -left-6 top-0.5 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 z-10"></div>
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

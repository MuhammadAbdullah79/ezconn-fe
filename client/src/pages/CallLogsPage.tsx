import { useState, useRef, useEffect } from "react";
import { Search, RefreshCw, MoreVertical, Download, FileText } from "react-feather";
import { Calendar, ChevronsUpDown, ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, MessageSquare, Mic, Play, Pause, SkipForward, SkipBack, X } from "lucide-react";
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


interface SortEntry {
    id: string;
    column: string;
    direction: "asc" | "desc";
}

interface CallLog {
    id: string;
    contact: string;
    contactNumber: string;
    agent: string;
    agentId: string;
    direction: "Inbound" | "Outbound";
    startTime: string;
    duration: string;
    status: "Completed" | "Missed" | "Declined" | "Failed" | "In Progress";
    sentiment: string;
    sentimentSummary: string;
    recording: boolean;
}

export default function CallLogsPage() {
    const [search, setSearch] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
    const [selectedDirection, setSelectedDirection] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const { data: logsResponse, isLoading } = useQuery<{ logs: CallLog[]; total: number }>({
        queryKey: ["/api/logs/calls", { page, limit: rowsPerPage, search, direction: selectedDirection[0], status: selectedStatus[0] }],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: rowsPerPage.toString(),
                search: search
            });
            if (selectedDirection.length > 0 && selectedDirection[0]) {
                params.append('direction', selectedDirection[0]);
            }
            if (selectedStatus.length > 0 && selectedStatus[0]) {
                params.append('status', selectedStatus[0]);
            }
            const res = await apiRequest("GET", `/api/logs/calls?${params.toString()}`);
            return res.json();
        }
    });

    const { data: statsResponse } = useQuery<{ calls: any }>({
        queryKey: ["/api/logs/stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/logs/stats");
            return res.json();
        }
    });

    const callLogs = logsResponse?.logs || [];
    const stats = statsResponse?.calls || {
        total: 0,
        completed: 0,
        inbound: 0,
        outbound: 0,
        avgDuration: "0m 0s"
    };
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [dateRangePreset, setDateRangePreset] = useState("last-7-days");
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
    const [callSorts, setCallSorts] = useState<SortEntry[]>([]);
    const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);


    const [speedDropdownOpen, setSpeedDropdownOpen] = useState(false);
    const speedDropdownRef = useRef<HTMLDivElement>(null);

    // Modal State
    const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
    const [viewDetailsOpen, setViewDetailsOpen] = useState(false);

    const handleViewDetails = (call: CallLog) => {
        setSelectedCallLog(call);
        setViewDetailsOpen(true);
    };
    const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentPlayingCallId, setCurrentPlayingCallId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const directionOptions = [
        { id: "Inbound", name: "Inbound" },
        { id: "Outbound", name: "Outbound" },
    ];

    const callStatusOptions = [
        { id: "Completed", name: "Completed" },
        { id: "Missed", name: "Missed" },
        { id: "Declined", name: "Declined" },
        { id: "Failed", name: "Failed" },
        { id: "In Progress", name: "In Progress" },
    ];

    const callKpiData = {
        totalCalls: stats.total,
        completed: stats.completed,
        inboundCalls: stats.inbound,
        outboundCalls: stats.outbound,
        avgDuration: stats.avgDuration,
    };

    const getAudioUrl = (callId: string) => {
        return "https://index-tts.github.io/examples_part2/IndexTTS/Speaker_2.wav";
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
        const data = getFilteredAndSortedCallLogs();
        if (selectedRows.size === data.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(data.map(c => c.id)));
        }
    };

    const renderCallSortIcon = (column: string) => {
        const sort = callSorts.find(s => s.column === column);
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

    // Audio Player Logic
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const setAudioData = () => {
            setDuration(audio.duration);
            setCurrentTime(audio.currentTime);
        };

        const setAudioTime = () => {
            setCurrentTime(audio.currentTime);
        };
        const setAudioEnded = () => {
            setIsPlaying(false);
        };

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', setAudioEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', setAudioEnded);
        };
    }, []);

    const playAudio = (callId: string) => {
        const audio = audioRef.current;
        if (audio) {
            const url = getAudioUrl(callId);
            if (audio.src !== url) {
                audio.src = url;
                audio.load();
            }
            audio.playbackRate = playbackSpeed;
            audio.play().then(() => {
                setIsPlaying(true);
                setCurrentPlayingCallId(callId);
            }).catch(error => {
                console.error("Error playing audio:", error);
                setIsPlaying(false);
            });
        }
    };

    const pauseAudio = () => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            setIsPlaying(false);
        }
    };

    const resetPlayerState = () => {
        pauseAudio();
        setCurrentPlayingCallId(null);
        setExpandedCallId(null);
        setCurrentTime(0);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    };

    const handlePlayPauseClick = (call: CallLog) => {
        if (expandedCallId === call.id) {
            if (isPlaying) {
                pauseAudio();
            } else {
                playAudio(call.id);
            }
        } else {
            if (currentPlayingCallId) {
                resetPlayerState();
            }
            setExpandedCallId(call.id);
            playAudio(call.id);
        }
    };

    const handleNext = () => {
        const currentCallLogs = getFilteredAndSortedCallLogs();
        const currentIndex = currentCallLogs.findIndex(call => call.id === currentPlayingCallId);
        if (currentIndex !== -1 && currentIndex < currentCallLogs.length - 1) {
            const nextCall = currentCallLogs[currentIndex + 1];
            if (nextCall.recording) {
                playAudio(nextCall.id);
            } else {
                for (let i = currentIndex + 1; i < currentCallLogs.length; i++) {
                    if (currentCallLogs[i].recording) {
                        playAudio(currentCallLogs[i].id);
                        return;
                    }
                }
                pauseAudio();
                setCurrentPlayingCallId(null);
            }
        } else {
            pauseAudio();
            setCurrentPlayingCallId(null);
        }
    };

    const handlePrevious = () => {
        const currentCallLogs = getFilteredAndSortedCallLogs();
        const currentIndex = currentCallLogs.findIndex(call => call.id === currentPlayingCallId);
        if (currentIndex > 0) {
            const prevCall = currentCallLogs[currentIndex - 1];
            if (prevCall.recording) {
                playAudio(prevCall.id);
            } else {
                for (let i = currentIndex - 1; i >= 0; i--) {
                    if (currentCallLogs[i].recording) {
                        playAudio(currentCallLogs[i].id);
                        return;
                    }
                }
                pauseAudio();
                setCurrentPlayingCallId(null);
            }
        } else {
            pauseAudio();
            setCurrentPlayingCallId(null);
        }
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        if (audioRef.current) {
            audioRef.current.playbackRate = speed;
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = parseFloat(e.target.value);
            setCurrentTime(audio.currentTime);
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setRowsDropdownOpen(false);
            }
            if (speedDropdownRef.current && !speedDropdownRef.current.contains(event.target as Node)) {
                setSpeedDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCallColumnSort = (column: string) => {
        const existingSort = callSorts.find(s => s.column === column);
        if (existingSort) {
            if (existingSort.direction === "asc") {
                setCallSorts([{ id: existingSort.id, column, direction: "desc" }]);
            } else {
                setCallSorts([]);
            }
        } else {
            setCallSorts([{ id: Date.now().toString(), column, direction: "asc" }]);
        }
    };

    const getFilteredAndSortedCallLogs = () => {
        let data = [...callLogs];

        if (search) {
            data = data.filter(item =>
                item.contact.toLowerCase().includes(search.toLowerCase()) ||
                item.agent.toLowerCase().includes(search.toLowerCase())
            );
        }

        if (selectedDirection.length > 0) {
            data = data.filter(item => selectedDirection.includes(item.direction));
        }

        if (selectedStatus.length > 0) {
            data = data.filter(item => selectedStatus.includes(item.status));
        }

        const currentDate = new Date(2025, 10, 4);
        currentDate.setHours(0, 0, 0, 0);

        if (dateRangePreset !== "custom") {
            data = data.filter(item => {
                const dateStr = item.startTime.split(" ").slice(0, 1)[0];
                const itemDate = new Date(dateStr);
                itemDate.setHours(0, 0, 0, 0);

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
                const dateStr = item.startTime.split(" ").slice(0, 1)[0];
                const itemDate = new Date(dateStr);
                itemDate.setHours(0, 0, 0, 0);

                const fromDate = new Date(customDateRange.from!);
                fromDate.setHours(0, 0, 0, 0);

                const toDate = new Date(customDateRange.to!);
                toDate.setHours(23, 59, 59, 999);

                return itemDate >= fromDate && itemDate <= toDate;
            });
        }

        if (callSorts.length > 0) {
            data.sort((a, b) => {
                for (const sort of callSorts) {
                    const aVal = a[sort.column as keyof CallLog];
                    const bVal = b[sort.column as keyof CallLog];
                    let comparison = 0;
                    if (typeof aVal === "string" && typeof bVal === "string") {
                        comparison = sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    } else if (typeof aVal === "number" && typeof bVal === "number") {
                        comparison = sort.direction === "asc" ? aVal - bVal : bVal - aVal;
                    } else if (typeof aVal === "boolean" && typeof bVal === "boolean") {
                        comparison = sort.direction === "asc" ? (aVal === bVal ? 0 : aVal ? 1 : -1) : (aVal === bVal ? 0 : aVal ? -1 : 1);
                    }
                    if (comparison !== 0) return comparison;
                }
                return 0;
            });
        }

        return data;
    };

    const handleExportSelectedCallLogsAsCSV = () => {
        if (selectedRows.size === 0) return;

        const selectedCallLogs = callLogs.filter(c => selectedRows.has(c.id));

        const escapeCSV = (value: string | number | boolean) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = ["Contact Number", "Contact Name", "Started Time", "Duration", "Agent Name", "Agent ID", "Direction", "Status", "Sentiment", "Sentiment Summary", "Recording"];

        const rows = selectedCallLogs.map(call => [
            escapeCSV(call.contactNumber),
            escapeCSV(call.contact),
            escapeCSV(call.startTime),
            escapeCSV(call.duration),
            escapeCSV(call.agent),
            escapeCSV(call.agentId),
            escapeCSV(call.direction),
            escapeCSV(call.status),
            escapeCSV(call.sentiment),
            escapeCSV(call.sentimentSummary),
            escapeCSV(call.recording),
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `call_logs_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportSingleCallLogAsCSV = (call: CallLog) => {
        const escapeCSV = (value: string | number | boolean) => {
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = ["Contact Number", "Contact Name", "Started Time", "Duration", "Agent Name", "Agent ID", "Direction", "Status", "Sentiment", "Sentiment Summary", "Recording"];

        const row = [
            escapeCSV(call.contactNumber),
            escapeCSV(call.contact),
            escapeCSV(call.startTime),
            escapeCSV(call.duration),
            escapeCSV(call.agent),
            escapeCSV(call.agentId),
            escapeCSV(call.direction),
            escapeCSV(call.status),
            escapeCSV(call.sentiment),
            escapeCSV(call.sentimentSummary),
            escapeCSV(call.recording),
        ];

        const csvContent = [headers.join(","), row.join(",")].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `call_log_${call.id}_${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const paginatedCallLogs = callLogs; // Backend already paginates
    const totalPages = Math.ceil((logsResponse?.total || 0) / rowsPerPage);

    return (
        <>
            <audio ref={audioRef} className="hidden" />
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Call Logs</h1>
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
                                    <p className="text-sm text-muted-foreground">Total Calls</p>
                                    <p className="text-2xl font-bold">{callKpiData.totalCalls}</p>
                                    <p className="text-xs text-muted-foreground">All calls</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Completed</p>
                                    <p className="text-2xl font-bold">{callKpiData.completed}</p>
                                    <p className="text-xs text-muted-foreground">Successful</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Inbound Calls</p>
                                    <p className="text-2xl font-bold">{callKpiData.inboundCalls}</p>
                                    <p className="text-xs text-muted-foreground">Received</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Outbound Calls</p>
                                    <p className="text-2xl font-bold">{callKpiData.outboundCalls}</p>
                                    <p className="text-xs text-muted-foreground">Initiated</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Avg. Duration</p>
                                    <p className="text-2xl font-bold">{callKpiData.avgDuration}</p>
                                    <p className="text-xs text-muted-foreground">Per call</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center justify-between gap-3">
                        {/* Left side: Search, Date Range, Direction, Status */}
                        <div className="flex items-center gap-3 flex-1">
                            <div className="relative w-80" style={{ height: "38px" }}>
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    placeholder="Search calls..."
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

                            {/* Direction Filter */}
                            <CustomDropdown
                                options={directionOptions}
                                selected={selectedDirection}
                                onChange={setSelectedDirection}
                                placeholder="Direction"
                                width="160px"
                            />

                            {/* Status Filter */}
                            <CustomDropdown
                                options={callStatusOptions}
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
                                        <button onClick={handleExportSelectedCallLogsAsCSV} className="p-1 hover:bg-blue-100 rounded" title="Export as CSV">
                                            <Download size={14} className="text-blue-600" />
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
                                                    checked={selectedRows.size > 0 && selectedRows.size === getFilteredAndSortedCallLogs().length}
                                                    onCheckedChange={toggleAllRows}
                                                />
                                            </th>
                                            <th
                                                className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                                onClick={() => handleCallColumnSort("contact")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Contact
                                                    {renderCallSortIcon("contact")}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                                onClick={() => handleCallColumnSort("agent")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Agent
                                                    {renderCallSortIcon("agent")}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                                onClick={() => handleCallColumnSort("direction")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Direction
                                                    {renderCallSortIcon("direction")}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                                onClick={() => handleCallColumnSort("startTime")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Start Time
                                                    {renderCallSortIcon("startTime")}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                                onClick={() => handleCallColumnSort("duration")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Duration
                                                    {renderCallSortIcon("duration")}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                                onClick={() => handleCallColumnSort("status")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Status
                                                    {renderCallSortIcon("status")}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                                onClick={() => handleCallColumnSort("sentiment")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Sentiment
                                                    {renderCallSortIcon("sentiment")}
                                                </div>
                                            </th>
                                            <th
                                                className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                                                onClick={() => handleCallColumnSort("recording")}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Recording
                                                    {renderCallSortIcon("recording")}
                                                </div>
                                            </th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedCallLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="text-center py-8 text-muted-foreground">
                                                    No results
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedCallLogs.map((call) => (
                                                <React.Fragment key={call.id}>
                                                    <tr className={`${expandedCallId === call.id ? '' : 'border-b'} hover:bg-muted/50`}>
                                                        <td className="py-2 px-3">
                                                            <Checkbox
                                                                checked={selectedRows.has(call.id)}
                                                                onCheckedChange={() => toggleRowSelection(call.id)}
                                                            />
                                                        </td>
                                                        <td className="py-2 px-3">{call.contact}</td>
                                                        <td className="py-2 px-3">{call.agent}</td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-medium ${call.direction === "Inbound" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                                                }`}>
                                                                {call.direction}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">{call.startTime}</td>
                                                        <td className="py-2 px-3">{call.duration}</td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-medium ${call.status === "Completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                                call.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                                                    call.status === "Missed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                        call.status === "Declined" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                            call.status === "Failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                                "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300"
                                                                }`}>
                                                                {call.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-medium ${call.sentiment === "Positive" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                                call.sentiment === "Negative" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                                                }`}>
                                                                {call.sentiment}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${call.recording ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                                                    }`}>
                                                                    {call.recording ? "Yes" : "No"}
                                                                </span>
                                                                {call.recording && (
                                                                    <button
                                                                        className="p-1 hover:bg-muted rounded"
                                                                        onClick={() => expandedCallId === call.id ? resetPlayerState() : handlePlayPauseClick(call)}
                                                                        title={expandedCallId === call.id ? "Close Player" : "Play"}
                                                                    >
                                                                        {expandedCallId === call.id ? (
                                                                            <X size={14} className="text-muted-foreground" />
                                                                        ) : (
                                                                            <Play size={14} className="text-muted-foreground" />
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 flex justify-start">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button className="p-1 hover:bg-muted rounded">
                                                                        <MoreVertical size={14} className="text-muted-foreground" />
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-popover">
                                                                    <DropdownMenuItem onClick={() => handleViewDetails(call)}>
                                                                        <FileText size={14} className="mr-2" />
                                                                        View Details
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleExportSingleCallLogAsCSV(call)}>
                                                                        <Download size={14} className="mr-2" />
                                                                        Export Log
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem>
                                                                        <Mic size={14} className="mr-2" />
                                                                        Export Recording
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>
                                                    </tr>
                                                    {expandedCallId === call.id && (
                                                        <tr className="border-b bg-card">
                                                            <td colSpan={10} className="pb-2 px-3">
                                                                <div className="flex items-center justify-between w-full">
                                                                    <div className="flex items-center gap-4">
                                                                        <button
                                                                            onClick={handlePrevious}
                                                                            className="p-1 hover:bg-muted rounded-full disabled:opacity-50"
                                                                            disabled={
                                                                                (() => {
                                                                                    const currentCallLogs = getFilteredAndSortedCallLogs();
                                                                                    const currentIndex = currentCallLogs.findIndex(c => c.id === currentPlayingCallId);
                                                                                    if (currentIndex <= 0) return true;
                                                                                    for (let i = currentIndex - 1; i >= 0; i--) {
                                                                                        if (currentCallLogs[i].recording) return false;
                                                                                    }
                                                                                    return true;
                                                                                })()
                                                                            }
                                                                        >
                                                                            <SkipBack size={20} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handlePlayPauseClick(call)}
                                                                            className="p-1 hover:bg-muted rounded-full"
                                                                        >
                                                                            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                                                                        </button>
                                                                        <button
                                                                            onClick={handleNext}
                                                                            className="p-1 hover:bg-muted rounded-full disabled:opacity-50"
                                                                            disabled={
                                                                                (() => {
                                                                                    const currentCallLogs = getFilteredAndSortedCallLogs();
                                                                                    const currentIndex = currentCallLogs.findIndex(c => c.id === currentPlayingCallId);
                                                                                    if (currentIndex === -1 || currentIndex >= currentCallLogs.length - 1) return true;
                                                                                    for (let i = currentIndex + 1; i < currentCallLogs.length; i++) {
                                                                                        if (currentCallLogs[i].recording) return false;
                                                                                    }
                                                                                    return true;
                                                                                })()
                                                                            }
                                                                        >
                                                                            <SkipForward size={20} />
                                                                        </button>
                                                                    </div>

                                                                    <div className="flex items-center gap-4 flex-1 mx-8">
                                                                        <span className="text-sm text-muted-foreground">{formatTime(currentTime)}</span>
                                                                        <input
                                                                            type="range"
                                                                            min="0"
                                                                            max={duration}
                                                                            value={currentTime}
                                                                            onChange={handleSeek}
                                                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary slider-thumb-blue-round"
                                                                        />
                                                                        <span className="text-sm text-muted-foreground">{formatTime(duration)}</span>
                                                                    </div>

                                                                    <div className="flex items-center gap-4">
                                                                        <div className="relative w-[78px]" ref={speedDropdownRef}>
                                                                            <button
                                                                                type="button"
                                                                                className="flex items-center justify-between px-3 py-2 text-left border border-input rounded-md shadow-sm hover:bg-accent focus:outline-none text-foreground transition-colors w-full"
                                                                                onClick={() => setSpeedDropdownOpen(!speedDropdownOpen)}
                                                                            >
                                                                                <span className="truncate text-xs font-normal">{playbackSpeed}x</span>
                                                                                <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground" />
                                                                            </button>
                                                                            {speedDropdownOpen && (
                                                                                <div className="absolute z-10 w-full mt-2 rounded-md shadow-md border border-border">
                                                                                    <ul className="py-1">
                                                                                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(option => (
                                                                                            <li
                                                                                                key={option}
                                                                                                className="px-3 py-2 text-xs cursor-pointer hover:bg-muted"
                                                                                                onClick={() => {
                                                                                                    handleSpeedChange(option);
                                                                                                    setSpeedDropdownOpen(false);
                                                                                                }}
                                                                                            >
                                                                                                {option}x
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between mt-4 text-xs">
                                <span className="text-muted-foreground">{getFilteredAndSortedCallLogs().length} results</span>
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
                    <DialogContent className="max-w-md">
                        <DialogHeader className="mb-2">
                            <DialogTitle>Call Details</DialogTitle>
                        </DialogHeader>
                        {selectedCallLog && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Contact Name</label>
                                        <p className="mt-1 text-sm">{selectedCallLog.contact}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Agent Name</label>
                                        <p className="mt-1 text-sm">{selectedCallLog.agent}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Direction</label>
                                        <p className="mt-1">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCallLog.direction === "Inbound" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                                }`}>
                                                {selectedCallLog.direction}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Start Time</label>
                                        <p className="mt-1 text-sm">{selectedCallLog.startTime}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Duration</label>
                                        <p className="mt-1 text-sm">{selectedCallLog.duration}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Status</label>
                                        <p className="mt-1">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCallLog.status === "Completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                selectedCallLog.status === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                                    selectedCallLog.status === "Missed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                        selectedCallLog.status === "Declined" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                            selectedCallLog.status === "Failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                                "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300"
                                                }`}>
                                                {selectedCallLog.status}
                                            </span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-foreground">Sentiment</label>
                                        <p className="mt-1">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCallLog.sentiment === "Positive" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                                                selectedCallLog.sentiment === "Negative" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                                }`}>
                                                {selectedCallLog.sentiment}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium text-foreground">Sentiment Summary</label>
                                        <p className="mt-1 text-sm">{selectedCallLog.sentimentSummary}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium text-foreground">Call Recording</label>
                                        <div className="mt-2">
                                            {/* 50/50 chance to show available vs unavailable recording */}
                                            {Math.random() > 0 ? (
                                                <audio
                                                    controls
                                                    className="w-full h-12"
                                                    style={{ maxWidth: '100%' }}
                                                >
                                                    <source src="/api/placeholder-audio.mp3" type="audio/mpeg" />
                                                    Your browser does not support the audio element.
                                                </audio>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Call Recording Unavailable</p>
                                            )}
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
        </>
    );
}

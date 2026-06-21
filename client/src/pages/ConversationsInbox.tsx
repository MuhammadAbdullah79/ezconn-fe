import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, RefreshCw, Eye, EyeOff, Download, Send, Phone, Mail, Plus, Filter, ArrowUp, X, Image, Mic, MicOff, Paperclip, XCircle, Smile, Trash2 } from "react-feather";
import { GripVertical, MoreVertical, ChevronDown, User, ListFilter, CheckCircle, AlertOctagon, UserX, Check, CheckCheck, Clock, CornerUpLeft } from "lucide-react";
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatConversationTime, formatMessageDate, formatMessageTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Separator } from "@/components/ui/separator";
import Breadcrumb from "@/components/Breadcrumb";
import CustomDropdown from "@/components/CustomDropdown";
import { AlertCircle } from "lucide-react";
import PreviewV2 from "@/components/PreviewV2";
import { Textarea } from "@/components/ui/textarea";
import { getAvatarColor } from "@/lib/avatar-utils";
import ContactProfileSidebar from "@/components/ContactProfileSidebar";

interface Conversation {
  id: number;
  name: string;
  displayName: string;
  phoneNumber: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: string;
  assignedAgent: string | null;
  assignedAgentName: string | null;
  channel: string;
}

// WhatsApp Cloud API file-size limits (bytes)
const WA_SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,   // 5 MB
  video: 16 * 1024 * 1024,  // 16 MB
  audio: 16 * 1024 * 1024,  // 16 MB
};
const WA_DOC_LIMIT = 100 * 1024 * 1024; // 100 MB for documents

function getWaLimit(file: File): number {
  const category = file.type.split('/')[0];
  return WA_SIZE_LIMITS[category] ?? WA_DOC_LIMIT;
}

function waLimitLabel(file: File): string {
  const limit = getWaLimit(file);
  return limit >= 1024 * 1024 ? `${limit / 1024 / 1024}MB` : `${limit / 1024}KB`;
}

// Outbound delivery state for WhatsApp messages.
//   pending  : queued in backend, not yet ack'd by Meta
//   sent     : Meta accepted (single tick)
//   delivered: phone received (double grey tick)
//   read     : phone read (double blue tick)
//   failed   : send error (red warning)
type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

interface Message {
  id: number;
  from: 'agent' | 'user';
  text: string;
  time: string;
  status?: MessageStatus;
  images?: Array<{ url: string; name: string; size: number }>;
  attachments?: Array<{ url: string; name: string; size: number }>;
  video?: { url: string; name: string; size: number; thumbnail?: string };
  audio?: { url: string; name: string; size: number };
}

interface Agent {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface Team {
  id: string;
  name: string;
}

interface Filter {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface BackendConversation {
  id: number | string;
  contacts?: { full_name?: string; first_name?: string; last_name?: string; mobile_number?: string; email?: string };
  last_message_text?: string;
  updated_at?: string;
  unread_count?: number;
  status?: string;
  users?: { id?: number | string; name?: string; full_name?: string; first_name?: string; last_name?: string };
  modelable_type?: string;
}

interface BackendMessage {
  id: number;
  direction: 'OUTGOING' | 'INCOMING';
  // Per-channel tables store the body under different keys: wa_messages uses `text`,
  // older channels use `message_text`. Accept both so the mapper can fall back.
  text?: string;
  message_text?: string;
  status?: string;
  created_at: string;
}

interface SocketData {
  inbox_id: string;
  message?: { text?: string };
}

interface AgentOption {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface BasicDetails {
  displayName: string;
  number: string;
  email: string;
  gender: string;
  whatsappOptOut: string;
  address: string;
}

interface Contact {
  id: number;
  name: string;
  number: string;
  pfp?: string;
  callConsent: string;
  callsUsed?: number;
  callsMax?: number;
  renewsIn?: string;
  expiryDays?: number;
  expiryHours?: number;
}

interface Template {
  id: number;
  name: string;
  body: string;
  header?: string;
  footer?: string;
  buttons?: any[];
  variables: string[];
}

interface Emoji {
  native: string;
}


// Helper function to get display name - defaults to phone number if displayName not set
const getDisplayName = (conversation?: Conversation | null): string => {
  if (!conversation) return "Unknown";
  return conversation.displayName?.trim() || conversation.phoneNumber || conversation.name || "Unknown";
};

// WhatsApp-style delivery tick mark for outgoing messages.
//   pending   -> clock
//   sent      -> single grey ✓
//   delivered -> double grey ✓✓
//   read      -> double blue ✓✓
//   failed    -> red ⚠ (with tooltip)
const MessageStatusTick: React.FC<{ status: MessageStatus }> = ({ status }) => {
  const size = 12;
  if (status === 'pending') {
    return <Clock size={size} className="text-gray-400 dark:text-slate-500" aria-label="Sending" />;
  }
  if (status === 'sent') {
    return <Check size={size} className="text-gray-500 dark:text-slate-400" aria-label="Sent" />;
  }
  if (status === 'delivered') {
    return <CheckCheck size={size} className="text-gray-500 dark:text-slate-400" aria-label="Delivered" />;
  }
  if (status === 'read') {
    return <CheckCheck size={size} className="text-blue-500 dark:text-blue-400" aria-label="Read" />;
  }
  if (status === 'failed') {
    return <AlertCircle size={size} className="text-red-500" aria-label="Failed to send" />;
  }
  return null;
};

export default function ConversationsInbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<number | null>(() => {
    try {
      const saved = sessionStorage.getItem("inbox_selected_conv");
      return saved ? parseInt(saved, 10) : null;
    } catch { return null; }
  });

  // Persist selected conversation so page refresh restores it
  useEffect(() => {
    try {
      if (selectedConversation != null) {
        sessionStorage.setItem("inbox_selected_conv", String(selectedConversation));
      } else {
        sessionStorage.removeItem("inbox_selected_conv");
      }
    } catch {}
  }, [selectedConversation]);

  // WebSocket Integration. Pull workspace_id from the JWT-backed user_info blob
  // (set at login) instead of hardcoding 1 — otherwise multi-workspace agents see
  // events from the wrong workspace room.
  const workspaceId = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_info");
      if (!raw) return 1;
      const parsed = JSON.parse(raw);
      const wsId = parsed?.workspace_id ?? parsed?.modelable_id ?? 1;
      return Number(wsId) || 1;
    } catch {
      return 1;
    }
  }, []);
  const socket = useSocket(workspaceId);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: SocketData) => {
      const msg = data.message as any;

      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });

      if (selectedConversation && data.inbox_id === selectedConversation.toString()) {
        if (msg?.id && msg?.direction === 'OUTGOING') {
          // Outgoing: replace optimistic placeholder with real message from socket
          // (socket fires before HTTP response returns — no need to wait for API)
          queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => {
            if (!old?.messages) return old;
            const withoutOptimistic = old.messages.filter((m: any) => !String(m.id).startsWith('opt_'));
            const alreadyThere = withoutOptimistic.some((m: any) => String(m.id) === String(msg.id));
            if (alreadyThere) return { ...old, messages: withoutOptimistic };
            return {
              ...old,
              messages: [...withoutOptimistic, {
                ...msg,
                parsed_files: Array.isArray(msg.parsed_files) ? msg.parsed_files : [],
                reactions: [],
              }],
            };
          });
        } else if (msg?.id) {
          // Incoming: add directly from socket — no HTTP refetch needed
          // For media/voice, parsed_files arrive later via message_media_ready
          queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => {
            if (!old?.messages) return old;
            const alreadyThere = old.messages.some((m: any) => String(m.id) === String(msg.id));
            if (alreadyThere) return old;
            return {
              ...old,
              messages: [...old.messages, {
                ...msg,
                parsed_files: Array.isArray(msg.parsed_files) ? msg.parsed_files : [],
                reactions: msg.reactions ?? [],
              }],
            };
          });
        }
      }

      if (msg?.direction !== 'OUTGOING') {
        toast({ description: msg?.text || "New message received" });
      }
    };

    // Delivery state delta for outgoing WhatsApp messages.
    //   { wa_message_id, wamid, status: 'sent'|'delivered'|'read'|'failed' }
    // Patches the cached messages list in-place so the tick mark updates without
    // a full refetch (4 round-trips per send otherwise: pending → sent → delivered → read).
    const handleMessageStatus = (data: {
      wa_message_id?: string;
      insta_message_id?: string;
      wamid?: string;
      status: MessageStatus;
    }) => {
      if (!selectedConversation) return;
      const rawId = data.wa_message_id ?? data.insta_message_id;
      const targetId = Number(rawId);
      if (!Number.isFinite(targetId)) return;

      const key = ["/api/inbox/messages", selectedConversation];
      queryClient.setQueryData<any>(key, (prev: any) => {
        if (!prev?.messages) return prev;
        let mutated = false;
        const next = prev.messages.map((m: BackendMessage) => {
          if (Number(m.id) === targetId && m.status !== data.status) {
            mutated = true;
            return { ...m, status: data.status };
          }
          return m;
        });
        return mutated ? { ...prev, messages: next } : prev;
      });
    };

    // Another agent / another tab opening a conversation marks it read on the
    // server, which then emits `inbox_read`. Refresh the list + counts so the
    // unread badge here also clears without a manual refresh.
    const handleInboxRead = (_data: { inbox_id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
    };

    const handleMessageReaction = (data: any) => {
      if (!selectedConversation || data.inbox_id !== selectedConversation.toString()) return;
      if (data.message_id) {
        queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => {
          if (!old?.messages) return old;
          return {
            ...old,
            messages: old.messages.map((m: any) => {
              if (String(m.id) !== String(data.message_id)) return m;
              const existing: any[] = Array.isArray(m.reactions) ? m.reactions : [];
              if (data.action === 'unreact' || !data.reaction) {
                return { ...m, reactions: existing.filter((r: any) => r.direction !== 'INCOMING') };
              }
              const withoutIncoming = existing.filter((r: any) => r.direction !== 'INCOMING');
              return { ...m, reactions: [...withoutIncoming, { reaction: data.reaction, direction: 'INCOMING' }] };
            }),
          };
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
    };

    // WhatsApp media ready — patch parsed_files onto the message without full refetch
    const handleMediaReady = (data: { inbox_id: string; wa_message_id: string; parsed_files: any[] }) => {
      if (!selectedConversation || data.inbox_id !== selectedConversation.toString()) return;
      const targetId = Number(data.wa_message_id);
      if (!Number.isFinite(targetId)) return;
      queryClient.setQueryData<any>(["/api/inbox/messages", selectedConversation], (prev: any) => {
        if (!prev?.messages) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m: any) =>
            Number(m.id) === targetId ? { ...m, parsed_files: data.parsed_files } : m
          ),
        };
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_status", handleMessageStatus);
    socket.on("inbox_read", handleInboxRead);
    socket.on("message_reaction", handleMessageReaction);
    socket.on("message_media_ready", handleMediaReady);
    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_status", handleMessageStatus);
      socket.off("inbox_read", handleInboxRead);
      socket.off("message_reaction", handleMessageReaction);
      socket.off("message_media_ready", handleMediaReady);
    };
  }, [socket, selectedConversation, queryClient, toast]);

  // Phase 2/3 filter state — must declare BEFORE the inbox list query that
  // reads them, otherwise React's TDZ throws "Cannot access X before
  // initialization" on first render.
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Global tab counts — must come from a SEPARATE call (`/inbox/count`) so
  // they stay correct regardless of which tab is active. Otherwise the counts
  // shown on Read / Unread / Queue / etc. all "go to zero" the moment you
  // switch to that tab because they were computed from the page's filtered
  // result set instead of the workspace-wide totals.
  const { data: countsResponse } = useQuery<any>({
    queryKey: ["/api/inbox/count", { activeFolderId, selectedChannels }],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/inbox/count", {
        folder_id: activeFolderId ? activeFolderId : undefined,
        channel_types: selectedChannels.length ? selectedChannels : undefined,
      });
      return res.json();
    },
    refetchInterval: 30_000,
  });
  const tabCounts = useMemo(() => {
    const c = countsResponse?.counts ?? {};
    const inboxTotal = (c.inbox ?? 0) + (c.unassigned ?? 0);
    return {
      all: inboxTotal,
      read: c.read ?? 0,
      unread: c.unread ?? 0,
      queue: c.unassigned ?? 0,
      upcoming: c.future ?? 0,
      completed: c.completed ?? 0,
    };
  }, [countsResponse]);

  // Fetch inbox list. The backend list endpoint accepts the lowercase tab
  // names and maps them internally to the schema enum (ACTIVE / COMPLETED /
  // UNASSIGNED). "my_chats" is purely client-side filtering (we ask the
  // backend for "all" and then filter to assignedAgent === me).
  const { data: inboxResponse, isLoading: isLoadingInbox } = useQuery({
    queryKey: ["/api/inbox/list", { activeTab, searchQuery, activeFolderId, selectedChannels }],
    queryFn: async () => {
      // Map the replyagent tab vocab onto the backend filter params.
      // - Read / Unread → `is_read` (1 / 0)
      // - Queue          → status = 'queued' (UNASSIGNED)
      // - Upcoming       → `is_upcoming: true` (snooze > NOW)
      // - Done           → status = 'completed' (COMPLETED)
      let status: string | undefined;
      let is_read: number | undefined;
      let is_upcoming: boolean | undefined;
      if (activeTab === "queue") status = "queued";
      else if (activeTab === "completed") status = "completed";
      else if (activeTab === "read") is_read = 1;
      else if (activeTab === "unread") is_read = 0;
      else if (activeTab === "upcoming") is_upcoming = true;
      // 'all' → no status / is_read / is_upcoming filter

      const res = await apiRequest("POST", "/api/inbox/list", {
        status,
        is_read,
        is_upcoming,
        search: searchQuery,
        folder_id: activeFolderId ? activeFolderId : undefined,
        channel_types: selectedChannels.length ? selectedChannels : undefined,
      });
      return res.json();
    },
  });

  const backendConversations = inboxResponse?.inbox || [];

  // Detect channel from the polymorphic `modelable_type`. Replyagent supports
  // 6+ channel types; the previous version of this mapper only handled
  // WhatsApp + Facebook + (anything-else → Instagram), so Telegram, Z-API,
  // SMS (Twilio), and Webchat conversations were mis-labelled in the list.
  const detectChannel = (modelableType?: string): string => {
    const t = (modelableType || '').toLowerCase();
    if (t.includes('whatsapp')) return 'whatsapp';
    if (t.includes('zapi')) return 'zapi';
    if (t.includes('telegram')) return 'telegram';
    if (t.includes('insta')) return 'instagram';
    if (t.includes('messenger') || t.includes('fb') || t.includes('facebook')) return 'messenger';
    if (t.includes('twilio') || t.includes('sms')) return 'sms';
    if (t.includes('webchat') || t.includes('wc')) return 'webchat';
    return 'unknown';
  };

  // Map backend status enum (UPPERCASE in schema) to the lowercase vocab the
  // tabs/filters/badges use throughout this page. UNASSIGNED is rendered as
  // the "queue" bucket — replyagent uses the same wording.
  const mapStatus = (raw?: string): string => {
    const s = String(raw ?? '').toUpperCase();
    if (s === 'COMPLETED') return 'completed';
    if (s === 'UNASSIGNED') return 'queue';
    if (s === 'ACTIVE') return 'active';
    if (s === 'DELETED') return 'deleted';
    return s.toLowerCase() || 'active';
  };

  // Map backend conversations to frontend format
  const conversations: Conversation[] = backendConversations.map((item: BackendConversation) => {
    const rawName = item.contacts?.full_name || item.contacts?.first_name || '';
    // If the stored name is a numeric Instagram user ID (profile fetch failed), show a friendlier label
    const resolvedName = rawName && /^\d+$/.test(rawName) ? 'Instagram User' : rawName;
    return {
      id: Number(item.id),
      name: resolvedName || 'Unknown',
      displayName: resolvedName,
      phoneNumber: item.contacts?.mobile_number || '',
      email: item.contacts?.email || '',
      firstName: item.contacts?.first_name || '',
      lastName: item.contacts?.last_name || '',
      lastMessage: item.last_message_text || '',
      time: item.updated_at || new Date().toISOString(),
      unread: item.unread_count || 0,
      status: mapStatus(item.status),
      assignedAgent: item.users?.id?.toString() || null,
      assignedAgentName: item.users
        ? (item.users.full_name || `${item.users.first_name || ''} ${item.users.last_name || ''}`.trim() || item.users.name || null)
        : null,
      channel: detectChannel(item.modelable_type),
    };
  });

  // Deep-link from the Contact profile "Live Chat" link: ?contact_id=X →
  // auto-select that contact's conversation, then strip the param so a refresh
  // or back-nav doesn't re-trigger it.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current) return;
    let cid: string | null = null;
    try { cid = new URLSearchParams(window.location.search).get("contact_id"); } catch {}
    if (!cid) return;
    const match = backendConversations.find(
      (it: any) => String(it.contacts?.id) === String(cid),
    );
    if (match) {
      setSelectedConversation(Number(match.id));
      deepLinkedRef.current = true;
      try { window.history.replaceState({}, "", window.location.pathname); } catch {}
    }
  }, [backendConversations]);

  const [showContactPanel, setShowContactPanel] = useState(false);
  const [agentStatus, setAgentStatus] = useState<"available" | "away">("available");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const [isDragging, setIsDragging] = useState(false);
  const [assignedAgent, setAssignedAgent] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Filter State
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [draggedFilterId, setDraggedFilterId] = useState<string | null>(null);
  const [openFilterColumnDropdown, setOpenFilterColumnDropdown] = useState<string | null>(null);
  const [openFilterOperatorDropdown, setOpenFilterOperatorDropdown] = useState<string | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // New Header Dropdowns State
  const [selectedFilterAgents, setSelectedFilterAgents] = useState<string[]>([]);
  const [selectedFilterChannels, setSelectedFilterChannels] = useState<string[]>([]);

  const channelOptions = [
    { id: "whatsapp", name: "Whatsapp", icon: React.createElement("img", { src: "/images/automations/whatsapp.svg", alt: "WhatsApp", className: "w-3.5 h-3.5" }) },
    { id: "instagram", name: "Instagram", icon: React.createElement("img", { src: "/images/automations/instagram.svg", alt: "Instagram", className: "w-3.5 h-3.5" }) },
    { id: "messenger", name: "Messenger", icon: React.createElement("img", { src: "/images/automations/messenger.svg", alt: "Messenger", className: "w-3.5 h-3.5" }) },
  ];

  // Fetch messages for selected conversation
  const { data: messagesResponse, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["/api/inbox/messages", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return null;
      try {
        const res = await apiRequest("POST", `/api/inbox/messages/${selectedConversation}`, {}, { silentStatuses: [404] });
        return res.json();
      } catch (e: any) {
        // The selected conversation was deleted (e.g. its contact was deleted).
        // Clear the stale selection so we fall back to the empty state instead of
        // looping a scary "Inbox not found" error every refetch.
        const msg = String(e?.message ?? "");
        if (/not found/i.test(msg) || /\b404\b/.test(msg)) {
          setSelectedConversation(null);
          try { sessionStorage.removeItem("inbox_selected_conv"); } catch {}
          return null;
        }
        throw e;
      }
    },
    enabled: !!selectedConversation,
    staleTime: 0,
    refetchInterval: 3000,
  });

  // Flag to scroll only on conversation switch / initial load, not on every 5s refetch
  useEffect(() => {
    shouldScrollToBottomRef.current = true;
    setIsChatVisible(false);
  }, [selectedConversation]);

  useEffect(() => {
    const convLoaded = conversations.some((c: any) => c.id === selectedConversation);
    if (!shouldScrollToBottomRef.current || !messagesResponse || !convLoaded) return;
    const timer = setTimeout(() => {
      shouldScrollToBottomRef.current = false;
      const el = messagesEndRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      setIsChatVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [messagesResponse, conversations, selectedConversation]);

  const normalizeStatus = (s?: string): MessageStatus | undefined => {
    if (!s) return undefined;
    const k = s.toLowerCase();
    if (k === 'pending' || k === 'sent' || k === 'delivered' || k === 'read' || k === 'failed') {
      return k;
    }
    return undefined;
  };

  const messages: Message[] = (messagesResponse?.messages || []).map((m: BackendMessage) => {
    const raw = m as any;
    // Separate image vs non-image uploads from parsed_files
    const parsedFiles: Array<{ url: string; name: string; size: number; mime: string }> = raw.parsed_files || [];
    const imageFiles = parsedFiles.filter((f) => f.mime?.startsWith('image/'));
    const audioFiles = parsedFiles.filter((f) =>
      f.mime?.startsWith('audio/') || f.name?.toLowerCase().startsWith('voice-message')
    );
    const otherFiles = parsedFiles.filter((f) =>
      !f.mime?.startsWith('image/') &&
      !f.mime?.startsWith('audio/') &&
      !f.name?.toLowerCase().startsWith('voice-message')
    );

    const rawText = (m.text ?? m.message_text ?? '').toString().trim();
    const msgType = ((m as any).type ?? '').toLowerCase();
    const hasMediaContent = imageFiles.length > 0 || audioFiles.length > 0 || otherFiles.length > 0;
    const displayText = rawText ? rawText : (!hasMediaContent ? (
      msgType === 'audio' || msgType === 'voice' ? '🎤 Voice message' :
      msgType === 'image' ? '🖼 Image' :
      msgType === 'video' ? '🎥 Video' :
      msgType === 'document' ? '📄 Document' :
      msgType === 'sticker' ? '🌟 Sticker' :
      msgType === 'call' ? '📞 Missed call' :
      ''
    ) : '');

    return {
      id: m.id,
      from: m.direction === 'OUTGOING' ? 'agent' : 'user',
      text: displayText,
      time: m.created_at || new Date().toISOString(),
      status: normalizeStatus(m.status),
      images: imageFiles.length > 0 ? imageFiles : undefined,
      attachments: otherFiles.length > 0 ? otherFiles : undefined,
      audio: audioFiles.length > 0 ? { url: audioFiles[0].url, name: audioFiles[0].name, size: audioFiles[0].size } : undefined,
      reactions: Array.isArray(raw.reactions) ? raw.reactions : [],
    };
  });

  // Send message mutation
  // Mark a conversation read on the backend (mirrors replyagent's
  // `POST /inbox/seen/{inbox_id}`). Fires when the agent opens the thread so
  // the unread badge clears immediately and other tabs of the same workspace
  // see the change via the `inbox_read` socket event.
  const markSeenMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/inbox/seen/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
    },
  });

  // ─── Phase 2 dialog state + mutations ─────────────────────────────

  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState("");

  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderAt, setReminderAt] = useState("");
  const [reminderText, setReminderText] = useState("");

  // Reply / Note tab toggle for the compose area (replyagent has a Note tab
  // for internal annotations that aren't sent to the customer).
  const [composeMode, setComposeMode] = useState<"reply" | "note">("reply");

  // AI transform popover state. Selects translate/correct/expand/shorten.
  const [aiTransformOpen, setAiTransformOpen] = useState(false);

  // Which message's reaction picker is open. Only one at a time so the picker
  // doesn't double-render (and so clicking another bubble closes the previous
  // one). null = no picker shown.
  const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null);

  // "Reply to specific message" state. Replyagent shows a small reply arrow
  // next to each bubble on hover — clicking captures the message and shows a
  // mini reply-to preview above the compose input.
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // (selectedChannels + activeFolderId are declared earlier — before the
  // inbox list query that consumes them.)

  // Template-send dialog (24h-window CTA opens this) + channels chip dropdown
  // + folders CRUD modals state.
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [channelsDropdownOpen, setChannelsDropdownOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderEditing, setFolderEditing] = useState<any | null>(null);
  const [folderName, setFolderName] = useState("");

  // Approved WhatsApp templates for the template dialog.
  const { data: waTemplatesResponse } = useQuery<any>({
    queryKey: ["/api/broadcasts/templates", "inbox-template-send"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/broadcasts/templates");
      return res.json();
    },
    enabled: templateDialogOpen,
  });
  const waTemplates: any[] = waTemplatesResponse?.templates ?? [];
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const sendTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest("POST", `/api/inbox/send-message/${selectedConversation}`, {
        wa_template_id: templateId,
        type: "template",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template sent", description: "Customer can reply within 24h now." });
      setTemplateDialogOpen(false);
      setSelectedTemplateId("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
    },
    onError: (err: Error) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  const folderCreateMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/inbox/folders", { name });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Folder created" });
      setFolderModalOpen(false);
      setFolderName("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/folders"] });
    },
  });

  const folderUpdateMutation = useMutation({
    mutationFn: async (vars: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/inbox/folders/${vars.id}`, { name: vars.name });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Folder renamed" });
      setFolderModalOpen(false);
      setFolderEditing(null);
      setFolderName("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/folders"] });
    },
  });

  const folderDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/inbox/folders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Folder deleted" });
      if (activeFolderId === folderEditing?.id?.toString()) setActiveFolderId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/folders"] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async ({ id, until }: { id: number; until: string }) => {
      const res = await apiRequest("PATCH", `/api/inbox/snooze/${id}`, { until });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Snoozed", description: "Conversation snoozed." });
      setSnoozeDialogOpen(false);
      setSnoozeUntil("");
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async (vars: { inbox_id: number; schedule_at: string; text_message: string }) => {
      const res = await apiRequest("POST", "/api/inbox/reminder", vars);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reminder scheduled", description: "It will be sent at the chosen time." });
      setReminderDialogOpen(false);
      setReminderAt("");
      setReminderText("");
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't schedule", description: err.message, variant: "destructive" });
    },
  });

  const deleteInboxMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/inbox/delete/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Conversation deleted." });
      setSelectedConversation(null);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
    },
  });

  const transformAiMutation = useMutation({
    mutationFn: async (vars: { text: string; mode: string }) => {
      const res = await apiRequest("POST", "/api/inbox/transform-ai", vars);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.output) setMessageText(data.output);
      setAiTransformOpen(false);
    },
  });

  const reactMutation = useMutation({
    mutationFn: async (vars: { inboxId: number; messageId: number; reaction: string; message_type?: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/inbox/react/${vars.inboxId}/${vars.messageId}`,
        { reaction: vars.reaction, message_type: vars.message_type },
      );
      return res.json();
    },
    onMutate: async (vars) => {
      // Optimistic reaction — update cache immediately without waiting for server
      if (!selectedConversation) return;
      await queryClient.cancelQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      const prev = queryClient.getQueryData(["/api/inbox/messages", selectedConversation]);
      queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => {
        if (!old?.messages) return old;
        return {
          ...old,
          messages: old.messages.map((m: any) => {
            if (Number(m.id) !== Number(vars.messageId)) return m;
            const existing: any[] = Array.isArray(m.reactions) ? m.reactions : [];
            const outgoing = existing.find((r: any) => r.direction === 'OUTGOING');
            // Toggle off if same emoji, otherwise replace
            const newReactions = outgoing?.reaction === vars.reaction
              ? existing.filter((r: any) => r.direction !== 'OUTGOING')
              : [...existing.filter((r: any) => r.direction !== 'OUTGOING'), { reaction: vars.reaction, direction: 'OUTGOING' }];
            return { ...m, reactions: newReactions };
          }),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.prev !== undefined && selectedConversation) {
        queryClient.setQueryData(["/api/inbox/messages", selectedConversation], context.prev);
      }
    },
  });

  // Delete a single sent message (replyagent ZapiMessages deleteMessage). Gated
  // in the UI by `canDeleteMessage`. Backend: POST /api/inbox/message/delete.
  const deleteMessageMutation = useMutation({
    mutationFn: async (vars: { messageId: number; channel: string }) => {
      const res = await apiRequest("POST", `/api/inbox/message/delete`, {
        message_id: vars.messageId,
        channel: vars.channel,
      });
      return res.json();
    },
    onSuccess: () => {
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      }
      toast({ title: "Message deleted" });
    },
    onError: (err: any) =>
      toast({ title: "Couldn't delete message", description: err?.message ?? "", variant: "destructive" }),
  });

  // ─── Folders sidebar (uses already-existing /folders endpoints) ───

  const { data: foldersResponse } = useQuery<any>({
    queryKey: ["/api/inbox/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inbox/folders");
      return res.json();
    },
  });
  const folders: any[] = useMemo(() => {
    if (Array.isArray(foldersResponse)) return foldersResponse;
    if (Array.isArray(foldersResponse?.folders)) return foldersResponse.folders;
    return [];
  }, [foldersResponse]);

  // ─── Real profile data (replaces hardcoded "Support Number 0123-123") ──

  const { data: profileData, refetch: refetchProfileData } = useQuery<any>({
    queryKey: ["/api/inbox/get-profile-data", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return null;
      try {
        const res = await apiRequest("GET", `/api/inbox/get-profile-data/${selectedConversation}`, undefined, { silentStatuses: [404] });
        return res.json();
      } catch (e: any) {
        // Selected conversation deleted — swallow the not-found so it doesn't toast
        // (the messages query clears the stale selection).
        const msg = String(e?.message ?? "");
        if (/not found/i.test(msg) || /\b404\b/.test(msg)) return null;
        throw e;
      }
    },
    enabled: !!selectedConversation,
  });

  // Contact ID derived from profileData for notes / custom-field API calls
  const selectedContactId: number | null = profileData?.contact?.id ? Number(profileData.contact.id) : null;

  // Fetch notes for the selected contact
  const { data: notesResponse, refetch: refetchNotes } = useQuery<any>({
    queryKey: ["/api/notes", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return null;
      const res = await apiRequest("GET", `/api/notes/${selectedContactId}`);
      return res.json();
    },
    enabled: !!selectedContactId,
  });

  // Sync real notes into per-conversation state
  useEffect(() => {
    if (!selectedConversation || !notesResponse) return;
    const texts = (notesResponse.notes || notesResponse || []).map((n: any) => n.text || n.content || "").filter(Boolean);
    setNotesByConv((prev) => ({ ...prev, [selectedConversation]: texts }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesResponse, selectedConversation]);

  // Sync real profileData (tags + custom_fields) into per-conversation state
  // whenever the profile query resolves for the selected conversation.
  useEffect(() => {
    if (!selectedConversation || !profileData) return;

    // Workspace-defined custom fields — store full objects (including null values)
    if (Array.isArray(profileData.custom_fields)) {
      setProfileFieldsByConv((prev) => ({ ...prev, [selectedConversation]: profileData.custom_fields }));
      // Also keep manual customAttributes for non-null values (chips)
      const attrs: Record<string, string> = {};
      for (const f of profileData.custom_fields) {
        if (f.label && f.value != null) attrs[f.label] = String(f.value);
      }
      setCustomAttributesByConv((prev) => ({ ...prev, [selectedConversation]: attrs }));
    }

    // Tags → array of tag IDs (CustomDropdown uses IDs for selection state)
    if (Array.isArray(profileData.tags)) {
      const tagIds = profileData.tags.map((t: any) => String(t.id)).filter(Boolean);
      setTagsByConv((prev) => ({ ...prev, [selectedConversation]: tagIds }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData, selectedConversation]);

  useEffect(() => {
    if (!selectedConversation) return;
    const conv = conversations.find((c) => c.id === selectedConversation);
    if (conv && conv.unread > 0) {
      markSeenMutation.mutate(selectedConversation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

  // On page refresh, selectedConversation is restored from sessionStorage but
  // handleSelectConversation is never called, so assignedAgent stays null.
  // This effect re-syncs assignedAgent whenever conversations list loads/changes.
  useEffect(() => {
    if (!selectedConversation || assignedAgent !== null) return;
    const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
    if (!conv) return;
    const agentId = conv.assignedAgent || null;
    setAssignedAgent(agentId && currentUser.id && agentId === currentUser.id ? "self" : agentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, selectedConversation]);

  // Auto-clear the right-pane selection when the currently selected
  // conversation is no longer in the visible list (e.g. tab/filter switch
  // moved it out, or it was deleted). Without this the thread keeps showing
  // the previous chat with a "Unknown" header because `selectedConversation`
  // doesn't map to anything in `conversations`. Wait until the new list has
  // actually loaded before clearing — otherwise the in-flight refetch
  // momentarily looks empty and we'd kick the user out of every chat on tab
  // change.
  useEffect(() => {
    if (isLoadingInbox) return;
    if (!selectedConversation) return;
    const rows: any[] = (inboxResponse?.inbox ?? []) as any[];
    const inList = rows.some((item) => Number(item.id) === selectedConversation);
    if (!inList) {
      setSelectedConversation(null);
    }
  }, [inboxResponse, isLoadingInbox, selectedConversation]);

  const sendMessageMutation = useMutation({
    mutationFn: async (input: string | { text: string; compose_mode?: string; reply_to_message_id?: number | null; files?: File[]; audio?: Blob | null }) => {
      const hasFiles = typeof input !== "string" && ((input.files && input.files.length > 0) || input.audio);

      if (hasFiles && typeof input !== "string") {
        // Use FormData for multipart uploads
        const form = new FormData();
        form.append("message_text", input.text || "");
        form.append("compose_mode", input.compose_mode ?? "reply");
        if (input.reply_to_message_id != null) form.append("reply_to_message_id", String(input.reply_to_message_id));
        if (input.files) {
          for (const f of input.files) form.append("files", f);
        }
        if (input.audio) {
          form.append("files", new File([input.audio], "voice-message.webm", { type: "audio/webm" }));
        }
        const res = await fetch(`/api/inbox/send-message/${selectedConversation}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
          body: form,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }

      const payload =
        typeof input === "string"
          ? { message_text: input }
          : {
              message_text: input.text,
              compose_mode: input.compose_mode ?? "reply",
              reply_to_message_id: input.reply_to_message_id ?? null,
            };
      const res = await apiRequest("POST", `/api/inbox/send-message/${selectedConversation}`, payload);
      return res.json();
    },
    onMutate: async (input) => {
      // Cancel any in-flight refetch so it doesn't overwrite the optimistic message
      await queryClient.cancelQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
      const previousData = queryClient.getQueryData(["/api/inbox/messages", selectedConversation]);
      const text = typeof input === "string" ? input : (input.text || "");
      const hasFiles = typeof input !== "string" && ((input.files && input.files.length > 0) || input.audio);
      const tempId = `opt_${Date.now()}`;
      const optimisticMsg = {
        id: tempId,
        direction: "OUTGOING",
        text,
        message_text: text,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "pending",
        type: hasFiles ? (input as any).audio ? "audio" : "image" : "text",
        reactions: [],
        parsed_files: [],
      };
      if (selectedConversation && previousData) {
        queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (old: any) => ({
          ...old,
          messages: [...(old?.messages || []), optimisticMsg],
        }));
      }
      setMessageText("");
      setAttachedFiles([]);
      setRecordedAudio(null);
      return { previousData, tempId };
    },
    onSuccess: (data: any, input, context: any) => {
      const realMsg = data?.data;
      const hasFiles = typeof input !== "string" && ((input.files && input.files.length > 0) || input.audio);
      queryClient.setQueryData(["/api/inbox/messages", selectedConversation], (prev: any) => {
        if (!prev?.messages) return prev;
        // Remove optimistic placeholder (may already be gone if socket replaced it)
        const withoutOptimistic = prev.messages.filter((m: any) => m.id !== context?.tempId);
        if (realMsg) {
          // Socket may have already added the real message — skip if present
          const alreadyThere = withoutOptimistic.some((m: any) => String(m.id) === String(realMsg.id));
          if (!alreadyThere) {
            return { ...prev, messages: [...withoutOptimistic, { ...realMsg, parsed_files: realMsg.parsed_files ?? [], reactions: realMsg.reactions ?? [] }] };
          }
        }
        return { ...prev, messages: withoutOptimistic };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
    },
    onError: (err: Error, _input, context: any) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(["/api/inbox/messages", selectedConversation], context.previousData);
      }
      setMessageText(typeof _input === "string" ? _input : (_input as any).text || "");
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const res = await apiRequest("PATCH", `/api/inbox/status/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      toast({
        title: "Status updated",
        description: "Conversation status has been updated successfully.",
      });
    }
  });

  // Assign agent mutation
  const assignAgentMutation = useMutation({
    mutationFn: async ({ agentId }: { agentId: string | null }) => {
      const res = await apiRequest("PATCH", `/api/inbox/assign/${selectedConversation}`, {
        assigned_to: agentId === "null" || agentId === null ? null : (agentId === "self" ? "me" : agentId)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      toast({
        title: "Agent assigned",
        description: "The conversation has been assigned successfully.",
      });
    }
  });

  // Filter Handlers
  const addFilter = () => {
    setFilters([...filters, { id: Date.now().toString(), column: "name", operator: "contains", value: "" }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, column: string, operator: string, value: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, column, operator, value } : f));
  };

  const handleFilterDragStart = (id: string) => {
    setDraggedFilterId(id);
  };

  const handleFilterDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFilterDrop = (targetId: string) => {
    if (!draggedFilterId || draggedFilterId === targetId) return;

    const draggedIndex = filters.findIndex(f => f.id === draggedFilterId);
    const targetIndex = filters.findIndex(f => f.id === targetId);

    const newFilters = [...filters];
    [newFilters[draggedIndex], newFilters[targetIndex]] = [newFilters[targetIndex], newFilters[draggedIndex]];
    setFilters(newFilters);
    setDraggedFilterId(null);
  };

  // Current user — real identity from localStorage (set at login by auth.service).
  const currentUser = useMemo(() => {
    try {
      const info = JSON.parse(localStorage.getItem('user_info') || '{}');
      return {
        id: info.id?.toString() || null,
        name: `${info.first_name || ''} ${info.last_name || ''}`.trim() || info.name || info.email || 'Me',
      };
    } catch { return { id: null, name: 'Me' }; }
  }, []);

  // ─── Reply permission gate (replyagent MessageComposer parity) ───
  // The reply composer is shown only when the agent may message this chat:
  //   isAssigned (has `send_message` perm OR the chat is assigned to ME)
  //   || canMessageUnassignedConversations (has `message_unassigned` perm)
  // Otherwise the composer is replaced with an "assign this chat" prompt.
  // Owners hold `workspace.*`, so this is always true for them (no regression).
  const userPerms = (getUserInfo().permissions as string[] | undefined) ?? [];
  const canSendWithoutAssignment = hasAnyPerm(userPerms, ["workspace.inbox.user.can.send_message"]);
  const canMessageUnassigned = hasAnyPerm(userPerms, ["workspace.inbox.message_unassigned_conversations"]);
  const assignedToMe = !!currentUser.id && assignedAgent === currentUser.id;
  const canReply = canSendWithoutAssignment || assignedToMe || canMessageUnassigned;
  // Whether the agent may (re)assign conversations (replyagent: v-can on the
  // assign action). Owners hold `workspace.*` so this is always true for them.
  const canAssignConversations = hasAnyPerm(userPerms, ["workspace.inbox.user.can.assign_conversations"]);
  // "Block" permissions hide a folder when the agent HAS them (replyagent
  // getSystemFolders). These use an EXACT slug match — NOT hasAnyPerm — so a
  // `workspace.*` owner (who lacks the literal block slug) is never blocked.
  const blockQueueFolder = userPerms.includes("workspace.inbox.user.queue_blocked");
  const blockDoneFolder = userPerms.includes("workspace.inbox.block_done_folder");
  // Block the delete-conversation action when the agent holds this "block"
  // permission (replyagent hasBlockedDeleting). Exact match → owners aren't blocked.
  const blockDeletingChats = userPerms.includes("workspace.inbox.user.block_deleting_chats");
  // "Allow" permission — agent may delete individual sent messages (replyagent
  // ZapiMessages canDeleteMessages). Owners pass via the `workspace.*` wildcard.
  const canDeleteMessage = hasAnyPerm(userPerms, ["workspace.inbox.qr.delete_message"]);
  // "Hide" permission — when the agent HOLDS `contact.view_channel`, the contact's
  // channel info (phone/whatsapp/email) is hidden (replyagent canSeeChannels).
  // Exact match → owners (no literal slug) keep seeing channel info.
  const canSeeChannels = !userPerms.includes("workspace.inbox.contact.view_channel");
  // "Block" permission — when the agent HOLDS `contact.view_profile`, the button
  // that opens the full contact profile is hidden (replyagent: Profile button is
  // wrapped in v-if="!includes('...view_profile')"). Exact match → owners (no
  // literal slug) keep access to the full profile.
  const canViewProfile = !userPerms.includes("workspace.inbox.contact.view_profile");

  // Fetch workspace members — inbox is workspace-scoped. Workspace users lack
  // agency.users.* permission, so calling /agencies/:id/members would 403.
  const { data: membersResponse } = useQuery({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/members");
      return res.json();
    }
  });

  // Backend returns a plain array; older callers wrapped it under .users / .members.
  // Handle both shapes so future API changes don't silently empty this dropdown.
  const membersList: any[] = Array.isArray(membersResponse)
    ? membersResponse
    : (membersResponse?.users || membersResponse?.members || []);

  const agentOptions: AgentOption[] = membersList.map((m: { id: number; first_name?: string; last_name?: string; email: string }) => ({
    id: m.id.toString(),
    name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
    icon: React.createElement("div", { 
      className: `w-5 h-5 rounded-full ${getAvatarColor(m.first_name || m.email)} flex items-center justify-center text-[10px] font-semibold text-white` 
    }, (m.first_name?.[0] || m.email?.[0] || "U").toUpperCase())
  }));

  // Add "Unassigned" option if needed or handle it in the UI
  
  // Helper function to get agent name by ID
  const getAgentName = (agentId: string | null) => {
    if (!agentId) return "Unassigned";
    const agent = agentOptions.find((a: AgentOption) => a.id === agentId);
    return agent?.name || agentId;
  };

  // Toggle contact panel visibility
  const handleToggleContactPanel = () => {
    const newShowState = !showContactPanel;
    setShowContactPanel(newShowState);

    if (selectedConversation) {
      const closedProfiles = JSON.parse(localStorage.getItem('closed_contact_profiles') || '[]');
      if (!newShowState) {
        // User closed it, remember this
        if (!closedProfiles.includes(selectedConversation)) {
          closedProfiles.push(selectedConversation);
          localStorage.setItem('closed_contact_profiles', JSON.stringify(closedProfiles));
        }
      } else {
        // User opened it, remove from closed list
        const newClosedProfiles = closedProfiles.filter((id: number) => id !== selectedConversation);
        localStorage.setItem('closed_contact_profiles', JSON.stringify(newClosedProfiles));
      }
    }
  };

  // Restore profile state when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      const closedProfiles = JSON.parse(localStorage.getItem('closed_contact_profiles') || '[]');
      // Default is OPEN (true), so if it's in the closed list, set to false.
      setShowContactPanel(!closedProfiles.includes(selectedConversation));
    } else {
      setShowContactPanel(false);
    }
  }, [selectedConversation]);

  // Calculate pending messages count
  const getPendingMessagesCount = (conv: Conversation): number => {
    // We can use unread_count from the backend conversation object
    return conv.unread || 0;
  };

  // Filter and sort conversations
  const getFilteredConversations = (): Conversation[] => {
    let filtered: Conversation[] = conversations;

    // Tab filtering is handled server-side — backend already returns the correct
    // subset for each tab (read/unread/queue/upcoming/completed). Local filtering
    // here was incorrectly matching conv.status === "read" etc. which never worked.

    // Filter by search query — name, phone, email, first/last name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((conv: Conversation) =>
        getDisplayName(conv).toLowerCase().includes(q) ||
        (conv.phoneNumber || '').toLowerCase().includes(q) ||
        (conv.email || '').toLowerCase().includes(q) ||
        (conv.firstName || '').toLowerCase().includes(q) ||
        (conv.lastName || '').toLowerCase().includes(q)
      );
    }

    // Filter by Select Agents Dropdown
    if (selectedFilterAgents.length > 0) {
      filtered = filtered.filter((conv: Conversation) => selectedFilterAgents.includes(conv.assignedAgent || ""));
    }

    // Filter by Select Channels Dropdown
    if (selectedFilterChannels.length > 0) {
      filtered = filtered.filter((conv: Conversation) => selectedFilterChannels.includes(conv.channel || ""));
    }

    // Advanced Filters
    if (filters.length > 0) {
      filtered = filtered.filter((conv: Conversation) => {
        return filters.every((filter: Filter) => {
          let itemValue = "";
          if (filter.column === "name") {
            itemValue = getDisplayName(conv);
          } else if (filter.column === "firstName") {
            itemValue = conv.firstName || "";
          } else if (filter.column === "lastName") {
            itemValue = conv.lastName || "";
          } else if (filter.column === "phoneNumber") {
            itemValue = conv.phoneNumber || "";
          } else if (filter.column === "email") {
            itemValue = conv.email || "";
          } else if (filter.column === "tags") {
            const tags = tagsByConv[conv.id] || [];
            itemValue = tags.join(" ");
          }

          const filterValue = (filter.value || "").toLowerCase();
          const checkValue = itemValue.toLowerCase();

          switch (filter.operator) {
            case "contains": return checkValue.includes(filterValue);
            case "does not contain": return !checkValue.includes(filterValue);
            case "is": return checkValue === filterValue;
            case "is not": return checkValue !== filterValue;
            case "is empty": return !itemValue || itemValue.trim() === "";
            case "is not empty": return itemValue && itemValue.trim() !== "";
            default: return true;
          }
        });
      });
    }

    // Filter by teams (Legacy/Existing)
    if (filterTeams.length > 0) {
      filtered = filtered.filter((conv: Conversation) => {
        const convTeams = involvedTeamsByConv[conv.id] || [];
        return filterTeams.some(teamId => convTeams.includes(teamId));
      });
    }

    // Filter by agents (Legacy/Existing - usually superceded by Select Agents above)
    if (filterAgents.length > 0) {
      filtered = filtered.filter((conv: Conversation) => {
        return filterAgents.includes(conv.assignedAgent || "");
      });
    }

    // Sort by time
      filtered.sort((a: Conversation, b: Conversation) => {
      // Get dynamic time from messages if available, relative to NOW.
      // Note: We use the *latest* message time.
      const getLastTime = (con: Conversation) => {
        return con.time;
      };

      const timeA = getLastTime(a);
      const timeB = getLastTime(b);

      return sortOrder === "desc"
        ? new Date(timeB).getTime() - new Date(timeA).getTime()
        : new Date(timeA).getTime() - new Date(timeB).getTime();
    });

    return filtered;
  };

  // Mark messages as read when conversation is selected
  const handleSelectConversation = (convId: number) => {
    setSelectedConversation(convId);
    const conv = conversations.find((c: Conversation) => c.id === convId);
    const agentId = conv?.assignedAgent || null;
    setAssignedAgent(agentId && currentUser.id && agentId === currentUser.id ? "self" : agentId);

    apiRequest("POST", `/api/inbox/seen/${convId}`).catch(() => {});
  };

  // Handle assignment - changes status to active and assigns agent
  const handleAssignAgent = (agentId: string) => {
    if (selectedConversation) {
      assignAgentMutation.mutate({ agentId });
      setAssignedAgent(agentId === "self" || agentId === currentUser.id ? "self" : agentId);
    }
  };

  const handleExportConversations = () => {
    // Export the REAL messages of the selected conversation
    const convStatus = selectedConvObj?.status || "";
    const contactName = selectedConvObj?.displayName || selectedConvObj?.name || "Customer";

    const headers = ["Number", "Status", "Inbound/Outbound", "Sender Name", "Messages Content", "Messages Status"];
    const rows = messages.map((msg, i) => [
      i + 1,
      convStatus,
      msg.from === "agent" ? "Outbound" : "Inbound",
      msg.from === "agent" ? (assignedAgent || "Agent") : contactName,
      `"${(msg.text || "").replace(/"/g, '""')}"`, // escape quotes & wrap for commas
      "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `conversations-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newWidth = e.clientX - (document.querySelector('[data-sidebar]')?.getBoundingClientRect().left || 0);
    const minWidth = 345;
    const maxWidth = 600;

    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setSidebarWidth(newWidth);
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);
  const [customAttributesByConv, setCustomAttributesByConv] = useState<Record<number, Record<string, string>>>({});
  const [profileFieldsByConv, setProfileFieldsByConv] = useState<Record<number, any[]>>({});

  // Basic details EDIT BUFFER per conversation (starts empty — real values come from the conversation's contact)
  const [basicDetailsByConv, setBasicDetailsByConv] = useState<Record<number, BasicDetails>>({});

  // Real contact details for the selected conversation; the edit buffer wins once the user changes something.
  const selectedConvObj = conversations.find((c: Conversation) => c.id === selectedConversation);
  const currentBasicDetails: BasicDetails =
    (selectedConversation != null && basicDetailsByConv[selectedConversation]) || {
      displayName: selectedConvObj?.displayName || selectedConvObj?.name || "",
      number: selectedConvObj?.phoneNumber || "",
      email: "",
      gender: "",
      whatsappOptOut: "No",
      address: "",
    };

  // Involved teams state per conversation
  const [involvedTeamsByConv, setInvolvedTeamsByConv] = useState<Record<number, string[]>>({});

  // Team options
  // Real teams (replaces hardcoded options)
  const { data: teamsData } = useQuery({
    queryKey: ["/api/teams/get-all"],
    queryFn: async () => (await apiRequest("GET", "/api/teams/get-all")).json(),
  });
  const teamOptions = (Array.isArray(teamsData) ? teamsData : []).map((t: any) => ({ id: String(t.id), name: t.name }));

  // Tags state per conversation (keyed by conv id, values are tag names)
  const [tagsByConv, setTagsByConv] = useState<Record<number, string[]>>({});

  // Tag options
  // Real tags (replaces hardcoded options)
  const { data: tagsData } = useQuery({
    queryKey: ["/api/tags/list"],
    queryFn: async () => (await apiRequest("GET", "/api/tags/list")).json(),
  });
  const tagOptions = (tagsData?.tags || []).map((t: any) => ({ id: String(t.id), name: t.name }));

  // WhatsApp templates from broadcasts endpoint
  const { data: templatesData } = useQuery({
    queryKey: ["/api/broadcasts/templates"],
    queryFn: async () => (await apiRequest("GET", "/api/broadcasts/templates")).json(),
  });
  const broadcastTemplates: Template[] = useMemo(() => {
    const raw: any[] = templatesData?.templates || [];
    return raw.map((t: any, idx: number) => {
      const components: any[] = Array.isArray(t.components) ? t.components : [];
      const headerComp = components.find((c: any) => c.type === "HEADER");
      const bodyComp = components.find((c: any) => c.type === "BODY");
      const footerComp = components.find((c: any) => c.type === "FOOTER");
      const buttonsComp = components.find((c: any) => c.type === "BUTTONS");
      const bodyText: string = bodyComp?.text || "";
      const varMatches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)];
      const variables = varMatches.map((m) => m[1]);
      const buttons = (buttonsComp?.buttons || []).map((b: any, bi: number) => {
        if (b.type === "QUICK_REPLY") return { id: bi + 1, type: "quick-reply", buttonText: b.text };
        if (b.type === "URL") return { id: bi + 1, type: "visit-website", buttonText: b.text, websiteUrl: b.url };
        if (b.type === "PHONE_NUMBER") return { id: bi + 1, type: "call-phone", buttonText: b.text, phoneNumber: b.phone_number };
        return { id: bi + 1, type: b.type?.toLowerCase() || "quick-reply", buttonText: b.text };
      });
      return {
        id: idx + 1,
        name: t.name,
        header: headerComp?.text || "",
        body: bodyText,
        footer: footerComp?.text || "",
        variables,
        buttons,
      } as Template;
    });
  }, [templatesData]);

  // Notes state per conversation
  const [notesByConv, setNotesByConv] = useState<Record<number, string[]>>({});

  // Update handlers for ContactProfileSidebar
  const handleUpdateBasicDetails = (details: BasicDetails) => {
    if (selectedConversation) {
      setBasicDetailsByConv({ ...basicDetailsByConv, [selectedConversation]: details });
      const contactId = (profileData as any)?.contact?.id;
      if (contactId) {
        apiRequest("PATCH", `/api/contacts/${contactId}`, {
          full_name: details.displayName,
          email: details.email,
          address: details.address,
          gender: details.gender,
        }).catch(() => {});
      }
    }
  };

  const handleUpdateInvolvedTeams = (teams: string[]) => {
    if (selectedConversation) {
      setInvolvedTeamsByConv({ ...involvedTeamsByConv, [selectedConversation]: teams });
    }
  };

  const handleUpdateTags = async (newTags: string[]) => {
    if (!selectedConversation) return;
    const current = tagsByConv[selectedConversation] || [];
    const added = newTags.filter((t) => !current.includes(t));
    const removed = current.filter((t) => !newTags.includes(t));

    // Optimistic update (IDs)
    setTagsByConv({ ...tagsByConv, [selectedConversation]: newTags });

    // Backend profile-action expects tag NAME — resolve from tagOptions
    for (const tagId of added) {
      const tagName = tagOptions.find((t) => t.id === tagId)?.name;
      if (!tagName) continue;
      try {
        await apiRequest("POST", `/api/inbox/profile-action/${selectedConversation}`, { action: "apply_tag", tag: tagName });
      } catch (e) {
        console.error("Failed to apply tag:", tagName, e);
      }
    }
    for (const tagId of removed) {
      const tagName = tagOptions.find((t) => t.id === tagId)?.name;
      if (!tagName) continue;
      try {
        await apiRequest("POST", `/api/inbox/profile-action/${selectedConversation}`, { action: "remove_tag", tag: tagName });
      } catch (e) {
        console.error("Failed to remove tag:", tagName, e);
      }
    }
  };

  const handleUpdateCustomAttributes = (attributes: Record<string, string>) => {
    if (selectedConversation) {
      setCustomAttributesByConv({ ...customAttributesByConv, [selectedConversation]: attributes });
    }
  };

  const handleSaveCustomFieldValue = async (fieldId: string, value: string) => {
    const contactId = (profileData as any)?.contact?.id;
    if (!contactId) return;
    try {
      await apiRequest('POST', `/api/custom-fields/contact/${contactId}/value`, { field_id: fieldId, value });
      refetchProfileData();
    } catch (_e) {}
  };

  const handleUpdateNotes = async (notes: string[]) => {
    if (!selectedConversation) return;
    const current = notesByConv[selectedConversation] || [];
    const added = notes.filter((n) => !current.includes(n));

    // Optimistic update
    setNotesByConv({ ...notesByConv, [selectedConversation]: notes });

    // Persist new notes via POST /api/notes/chat
    const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
    for (const text of added) {
      if (!text.trim()) continue;
      try {
        await apiRequest("POST", "/api/notes/chat", {
          text,
          contact_id: selectedContactId,
          modelable_type: (profileData?.inbox?.modelable_type) ?? null,
          modelable_id: (profileData?.inbox?.modelable_id) ? Number(profileData.inbox.modelable_id) : null,
        });
        refetchNotes();
      } catch (e) {
        console.error("Failed to save note:", e);
      }
    }
  };

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterTeams, setFilterTeams] = useState<string[]>([]);
  const [filterAgents, setFilterAgents] = useState<string[]>([]);
  const [selectedTeamsForModal, setSelectedTeamsForModal] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Add conversation modals
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isMakeCallModalOpen, setIsMakeCallModalOpen] = useState(false);
  const [isTemplateMessageModalOpen, setIsTemplateMessageModalOpen] = useState(false);
  const [makeCallTab, setMakeCallTab] = useState<"make-call" | "search-contacts">("make-call");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callPermissionChecked, setCallPermissionChecked] = useState(false);
  const [hasCallPermission, setHasCallPermission] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [searchContactsQuery, setSearchContactsQuery] = useState("");
  const [limitReached, setLimitReached] = useState(false);

  // Contacts search for "Make a Call" modal — declared after searchContactsQuery state
  const { data: callContactsData } = useQuery({
    queryKey: ["/api/contacts", searchContactsQuery],
    queryFn: async () => {
      const params = searchContactsQuery.trim() ? `?search=${encodeURIComponent(searchContactsQuery)}` : "";
      return (await apiRequest("GET", `/api/contacts${params}`)).json();
    },
    enabled: isMakeCallModalOpen,
  });
  const callContacts: any[] = callContactsData?.contacts || callContactsData || [];

  // Template message state
  const [templatePhoneNumbers, setTemplatePhoneNumbers] = useState<string[]>([""]); // Start with just one empty input

  // Message input state
  const [messageText, setMessageText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = useRef(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Close filter popout when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilter(false);
      }
    };

    if (showFilter) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilter]);

  // Handle emoji selection from emoji-mart
  const handleEmojiSelect = (emoji: Emoji) => {
    setMessageText(messageText + emoji.native);
    setShowEmojiPicker(false);
  };

  // Handle file attachment
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      const isInstagram = selectedConvObj?.channel === 'instagram';
      const isWhatsApp = selectedConvObj?.channel === 'whatsapp';

      if (isInstagram) {
        const unsupported = Array.from(files).filter((f) => {
          const m = f.type;
          return !m.startsWith('image/') && !m.startsWith('video/') && !m.startsWith('audio/');
        });
        if (unsupported.length > 0) {
          toast({ title: 'Instagram does not support document files. Only images, videos, and audio can be sent.', variant: 'destructive' });
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }

      if (isWhatsApp) {
        const tooBig = Array.from(files).filter(f => f.size > getWaLimit(f));
        const valid = Array.from(files).filter(f => f.size <= getWaLimit(f));
        if (tooBig.length > 0) {
          const labels = tooBig.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB — limit ${waLimitLabel(f)})`).join(', ');
          toast({ title: `File size limit exceeded: ${labels}`, variant: 'destructive' });
        }
        if (valid.length > 0) setAttachedFiles(prev => [...prev, ...valid]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setAttachedFiles([...attachedFiles, ...Array.from(files)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle image attachment
  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      const isWhatsApp = selectedConvObj?.channel === 'whatsapp';

      if (isWhatsApp) {
        const tooBig = Array.from(files).filter(f => f.size > getWaLimit(f));
        const valid = Array.from(files).filter(f => f.size <= getWaLimit(f));
        if (tooBig.length > 0) {
          const labels = tooBig.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB — limit ${waLimitLabel(f)})`).join(', ');
          toast({ title: `File size limit exceeded: ${labels}`, variant: 'destructive' });
        }
        if (valid.length > 0) setAttachedFiles(prev => [...prev, ...valid]);
        if (imageInputRef.current) imageInputRef.current.value = '';
        return;
      }

      setAttachedFiles([...attachedFiles, ...Array.from(files)]);
    }
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // Handle voice recording
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  // Handle stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Handle send message. Wraps the bare text + the composer's mode/reply
  // context so the backend can persist this as a real reply, an internal note
  // (Note tab), or a reply-quoted message.
  const handleSendMessage = () => {
    const hasContent = messageText.trim() || attachedFiles.length > 0 || recordedAudio;
    if (!hasContent) return;
    sendMessageMutation.mutate({
      text: messageText,
      compose_mode: composeMode,
      reply_to_message_id: replyingTo?.id ?? null,
      files: attachedFiles.length > 0 ? attachedFiles : undefined,
      audio: recordedAudio ?? undefined,
    } as any);
    setReplyingTo(null);
  };

  // Remove attached file
  const removeAttachedFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  // Call UI state
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callPhoneNumber, setCallPhoneNumber] = useState("");
  const [callContactName, setCallContactName] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // Call timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCallActive]);

  // Format call duration
  const formatCallDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };


  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  // Helper to split text by newlines and insert <br /> tags
  const splitByNewlines = (text: string, startKey: number) => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      // Check if line starts with "- " for bullet points
      if (line.trim().startsWith('- ')) {
        const bulletText = line.replace(/^\s*-\s/, '');
        result.push(
          <span key={startKey + index * 2}>
            <span className="inline-block mr-1">•</span>
            {bulletText}
          </span>
        );
      } else {
        result.push(<span key={startKey + index * 2}>{line}</span>);
      }

      if (index < lines.length - 1) {
        result.push(<br key={startKey + index * 2 + 1} />);
      }
    });

    return result;
  };

  // WhatsApp-style text formatter with nested formatting support
  const formatWhatsAppText = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // Process text character by character to handle WhatsApp formatting
    // WhatsApp uses: *bold*, _italic_, ~strikethrough~
    const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const beforeText = text.substring(currentIndex, match.index);
        parts.push(...splitByNewlines(beforeText, key));
        key += beforeText.split('\n').length;
      }

      const matchedText = match[0];
      const innerText = matchedText.substring(1, matchedText.length - 1);
      const formatChar = matchedText[0];

      // Recursively format the inner text to support nested formatting
      const formattedInner = formatWhatsAppText(innerText);

      // Apply formatting based on WhatsApp syntax
      if (formatChar === '*') {
        parts.push(<strong key={key++}>{formattedInner}</strong>);
      } else if (formatChar === '_') {
        parts.push(<em key={key++}>{formattedInner}</em>);
      } else if (formatChar === '~') {
        parts.push(<s key={key++}>{formattedInner}</s>);
      }

      currentIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      parts.push(...splitByNewlines(remainingText, key));
    }

    return parts.length > 0 ? parts : text;
  };

  // Handle sending template message
  const handleSendTemplateMessage = () => {
    if (!selectedTemplate || templatePhoneNumbers.filter(p => p.trim()).length === 0) {
      return;
    }

    // Check if all variables are filled
    if (selectedTemplate.variables && selectedTemplate.variables.length > 0) {
      const allVariablesFilled = selectedTemplate.variables.every(
        (variable: string) => templateVariables[variable]?.trim()
      );
      if (!allVariablesFilled) {
        return;
      }
    }

    // Get valid phone numbers
    const validPhoneNumbers = templatePhoneNumbers.filter(p => p.trim());

    // Create a new conversation for each phone number
    const newConversations = validPhoneNumbers.map((phoneNumber, index) => {
      const newId = Math.max(...conversations.map((c: Conversation) => c.id), 0) + index + 1;

      // Replace variables in template body
      let messageText = selectedTemplate.body;
      selectedTemplate.variables.forEach((variable: string) => {
        messageText = messageText.replace(`{{${variable}}}`, templateVariables[variable] || `{{${variable}}}`);
      });

      return {
        id: newId,
        phoneNumber: phoneNumber,
        displayName: "", // Will default to phoneNumber via getDisplayName()
        lastMessage: messageText,
        time: new Date().toISOString(),
        unread: 0,
        channel: "whatsapp",
        status: "queued",
        assignedAgent: null
      };
    });

    // Add phone numbers to basic details
    const newBasicDetails = { ...basicDetailsByConv };
    newConversations.forEach(conv => {
      newBasicDetails[conv.id] = { displayName: conv.displayName, number: conv.phoneNumber, email: "", gender: "", whatsappOptOut: "No", address: "" };
    });
    setBasicDetailsByConv(newBasicDetails);

    // Reset form and close modal
    setTemplatePhoneNumbers([""]);
    setSelectedTemplate(null);
    setTemplateVariables({});
    setIsTemplateMessageModalOpen(false);

    // Select the first new conversation
    if (newConversations.length > 0) {
      setSelectedConversation(newConversations[0].id);
    }
  };


  const handleCheckPermission = async () => {
    if (!phoneNumber.trim()) return;
    setCallPermissionChecked(false);
    try {
      const res = await apiRequest("GET", `/api/contacts?search=${encodeURIComponent(phoneNumber.trim())}`);
      const data = await res.json();
      const contacts: any[] = data?.contacts || data || [];
      const match = contacts.find((c: any) => {
        const num = (c.full_mobile_number || c.mobile_number || "").replace(/\s+/g, "");
        return num === phoneNumber.replace(/\s+/g, "") || num.endsWith(phoneNumber.replace(/\D/g, "").slice(-8));
      });
      const name = match
        ? (match.full_name || `${match.first_name || ""} ${match.last_name || ""}`.trim() || phoneNumber)
        : phoneNumber;
      setHasCallPermission(!!match);
      setSelectedContact(match ? {
        id: Number(match.id),
        name,
        number: phoneNumber,
        callConsent: "Active",
      } : null);
    } catch {
      setHasCallPermission(false);
      setSelectedContact(null);
    }
    setCallPermissionChecked(true);
  };

  // Helper to handle file downloads
  const handleDownload = async (url: string, filename: string) => {
    toast({
      description: "Downloading...",
      duration: 2000,
    });

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback
      window.open(url, '_blank');
    }
  };

  // Function to check if there are any agent messages in the current conversation
  const hasAgentMessages = () => {
    return (messages || []).some((msg: Message) => msg.from === "agent");
  };

  // Handle scroll to message from Contact Profile Sidebar
  const handleScrollToMessage = (messageId: number) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const container = element.closest('[data-radix-scroll-area-viewport]') || element.closest('.overflow-y-auto');

      if (container && container instanceof HTMLElement) {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top;
        const currentScroll = container.scrollTop;
        const targetScroll = currentScroll + relativeTop - (container.clientHeight / 2) + (element.clientHeight / 2);

        container.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
      }

      element.style.transition = 'background-color 0.5s';
      element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');

      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  };

  const [quickReplies, setQuickReplies] = useState([
    "Hi, how can I help you?",
    "What is your order number?",
    "Can I assist you with anything else?",
    "Thank you for contacting us.",
  ]);

  return (
    <div className="h-full flex flex-col font-sans" data-testid="conversations-inbox">

      <div className="flex-1 flex gap-0 px-6 py-6 max-h-full">
        {/* Left Sidebar */}
        <div className="relative group h-full" data-sidebar>
          <Card className="flex flex-col border-r rounded-r-none h-full" style={{ width: `${sidebarWidth}px` }}>
            <CardHeader className="px-3 space-y-3 pb-3 flex-shrink-0">
              {/* Tabs — replyagent left-nav set, exact order + counts.
                  All / Read / Unread / Queue / Upcoming / Done.
                  Counts come from /inbox/count (workspace-global) so they
                  don't change when you switch tabs. */}
              <div className="px-3 flex justify-between border-b pb-0 w-full">
                {[
                  { key: "all",       label: "All",       count: tabCounts.all },
                  { key: "read",      label: "Read",      count: tabCounts.read },
                  { key: "unread",    label: "Unread",    count: tabCounts.unread },
                  { key: "queue",     label: "Queue",     count: tabCounts.queue },
                  { key: "upcoming",  label: "Upcoming",  count: tabCounts.upcoming },
                  { key: "completed", label: "Done",      count: tabCounts.completed },
                ].filter(({ key }) =>
                  !(key === "queue" && blockQueueFolder) &&
                  !(key === "completed" && blockDoneFolder)
                ).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex flex-col items-center flex-1 px-1.5 py-2 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === key
                        ? "border-b-primary text-foreground"
                        : "border-b-transparent text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <span className="whitespace-nowrap">{label}</span>
                    <span className="text-[10px] opacity-60">{count}</span>
                  </button>
                ))}
              </div>

              {/* Search and Action Buttons */}
              <div className="flex gap-1 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    placeholder="Search"
                    className="pl-10 border-input h-9 text-xs"
                    data-testid="input-search"
                    onFocus={() => setIsSearchFocused(true)}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {!isSearchFocused && (
                  <>
                    {/* Select Agents Dropdown */}
                    <div className="relative">
                      <CustomDropdown
                        options={agentOptions.map((a: Agent) => ({ id: a.id, name: a.name, icon: a.icon }))}
                        selected={selectedFilterAgents}
                        onChange={setSelectedFilterAgents}
                        placeholder="Agents"
                        width="auto"
                        className="h-9 w-9 px-[0.5rem] justify-center bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700"
                        triggerContent={<User size={16} />}
                        popoutWidth="200px"
                        popoutAlign="left"
                      />
                    </div>

                    {/* Select Channels Dropdown */}
                    <div className="relative">
                      <CustomDropdown
                        options={channelOptions}
                        selected={selectedFilterChannels}
                        onChange={setSelectedFilterChannels}
                        placeholder="Channels"
                        width="auto"
                        className="h-9 w-9 px-[0.5rem] justify-center bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700"
                        triggerContent={<ListFilter size={16} />}
                        popoutWidth="200px"
                        popoutAlign="right"
                      />
                    </div>

                    {/* Advanced Filter Popout */}
                    <div className="relative" ref={filterDropdownRef}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-9 w-9 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 ${showFilter ? 'bg-accent dark:bg-slate-700' : ''}`}
                            onClick={() => setShowFilter(!showFilter)}
                          >
                            <Filter size={16} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Filter</TooltipContent>
                      </Tooltip>

                      {/* Filter Popover Content */}
                      {showFilter && (
                        <div className="absolute z-[10] bg-white dark:bg-background border border-border dark:border-slate-700 rounded-md shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] p-3 top-full mt-2 left-0" style={{
                          minWidth: '320px',
                          marginLeft: '-140px' // Center align somewhat or adjust to keep on screen
                        }}>
                          {/* Channels chip section (replyagent's "6 Canais"). */}
                          <div className="mb-3 pb-3 border-b border-border/60">
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Channels</p>
                            <div className="flex flex-wrap gap-1">
                              {(["whatsapp","zapi","telegram","messenger","instagram","sms","webchat"] as const).map((ch) => {
                                const isOn = selectedChannels.includes(ch);
                                return (
                                  <button
                                    key={ch}
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                      isOn
                                        ? "bg-primary/10 border-primary/30 text-primary"
                                        : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-primary/30"
                                    }`}
                                    onClick={() =>
                                      setSelectedChannels((prev) =>
                                        isOn ? prev.filter((c) => c !== ch) : [...prev, ch],
                                      )
                                    }
                                  >
                                    {ch}
                                  </button>
                                );
                              })}
                              {selectedChannels.length > 0 && (
                                <button
                                  className="text-[10px] text-muted-foreground hover:text-red-500 ml-1"
                                  onClick={() => setSelectedChannels([])}
                                >
                                  clear
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Folders chip section. "+" creates; right-click renames/deletes. */}
                          <div className="mb-3 pb-3 border-b border-border/60">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Folders</p>
                              <button
                                className="text-[10px] font-bold text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setFolderEditing(null);
                                  setFolderName("");
                                  setFolderModalOpen(true);
                                }}
                                title="Create folder"
                              >
                                + New
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <button
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  activeFolderId === null
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "border-slate-200 dark:border-slate-700 text-muted-foreground"
                                }`}
                                onClick={() => setActiveFolderId(null)}
                              >
                                All folders
                              </button>
                              {folders.map((f: any) => (
                                <button
                                  key={String(f.id)}
                                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                    activeFolderId === String(f.id)
                                      ? "bg-primary/10 border-primary/30 text-primary"
                                      : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-primary/30"
                                  }`}
                                  onClick={() => setActiveFolderId(String(f.id))}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    setFolderEditing(f);
                                    setFolderName(f.name ?? "");
                                    setFolderModalOpen(true);
                                  }}
                                  title={`${f.name} — right-click to rename/delete`}
                                >
                                  {f.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {filters.length === 0 ? (
                            <div className="text-center py-6">
                              <h3 className="font-semibold text-sm mb-1">No filters applied</h3>
                              <p className="text-xs text-muted-foreground mb-4">Add filters to refine your rows.</p>
                              <Button onClick={addFilter} className="btn-outline-primary" variant="outline">Add filter</Button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filters.map((filter) => (
                                <div
                                  key={filter.id}
                                  className="flex gap-2 items-center"
                                  draggable
                                  onDragStart={() => handleFilterDragStart(filter.id)}
                                  onDragOver={handleFilterDragOver}
                                  onDrop={() => handleFilterDrop(filter.id)}
                                >
                                  <div className="relative flex-1">
                                    <button
                                      type="button"
                                      onClick={() => setOpenFilterColumnDropdown(openFilterColumnDropdown === filter.id ? null : filter.id)}
                                      className="w-[140px] flex items-center justify-between px-3 py-2 text-left bg-white dark:bg-background border border-input dark:border-slate-700 rounded-md shadow-sm hover:bg-accent dark:hover:bg-slate-700 focus:outline-none text-foreground dark:text-white transition-colors w-full"
                                    >
                                      <span className="truncate text-sm font-normal">{
                                        filter.column === "name" ? "Full Name" :
                                        filter.column === "firstName" ? "First Name" :
                                        filter.column === "lastName" ? "Last Name" :
                                        filter.column === "phoneNumber" ? "Phone Number" :
                                        filter.column === "email" ? "Email" :
                                        "Tags"
                                      }</span>
                                      <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground" />
                                    </button>
                                    {openFilterColumnDropdown === filter.id && (
                                      <div className="absolute z-10 w-full mt-2 bg-white dark:bg-background rounded-md shadow-md border border-border dark:border-slate-700">
                                        <ul className="py-1">
                                          {[
                                            { key: "name", label: "Full Name" },
                                            { key: "firstName", label: "First Name" },
                                            { key: "lastName", label: "Last Name" },
                                            { key: "phoneNumber", label: "Phone Number" },
                                            { key: "email", label: "Email" },
                                            { key: "tags", label: "Tags" },
                                          ].map(({ key, label }) => {
                                            const isCurrentOption = key === filter.column;
                                            return (
                                              <li
                                                key={key}
                                                className={`px-3 py-2 text-sm ${isCurrentOption ? "opacity-40 text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-muted"}`}
                                                onClick={() => {
                                                  if (!isCurrentOption) {
                                                    updateFilter(filter.id, key, filter.operator, filter.value);
                                                    setOpenFilterColumnDropdown(null);
                                                  }
                                                }}
                                              >
                                                {label}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setOpenFilterOperatorDropdown(openFilterOperatorDropdown === filter.id ? null : filter.id)}
                                      className="w-[170px] flex items-center justify-between px-3 py-2 text-left bg-white dark:bg-background border border-input dark:border-slate-700 rounded-md shadow-sm hover:bg-accent dark:hover:bg-slate-700 focus:outline-none text-foreground dark:text-white transition-colors"
                                    >
                                      <span className="truncate text-sm font-normal">{filter.operator}</span>
                                      <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground" />
                                    </button>
                                    {openFilterOperatorDropdown === filter.id && (
                                      <div className="absolute z-10 w-full mt-2 bg-white dark:bg-background rounded-md shadow-md border border-border dark:border-slate-700">
                                        <ul className="py-1">
                                          {["contains", "does not contain", "is", "is not", "is empty", "is not empty"].map(option => (
                                            <li
                                              key={option}
                                              className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                                              onClick={() => {
                                                updateFilter(filter.id, filter.column, option, filter.value);
                                                setOpenFilterOperatorDropdown(null);
                                              }}
                                            >
                                              {option}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Value..."
                                    value={filter.value}
                                    onChange={(e) => updateFilter(filter.id, filter.column, filter.operator, e.target.value)}
                                    className="px-3 py-2 text-sm border border-input rounded-md flex-1 focus:outline-none transition-colors bg-card"
                                  />
                                  <button onClick={() => removeFilter(filter.id)} className="p-2 hover:bg-muted rounded"><Trash2 size={14} /></button>
                                  <GripVertical size={14} className="text-muted-foreground cursor-grab" />
                                </div>
                              ))}
                              <div className="flex gap-2 pt-2 border-t">
                                <Button onClick={addFilter} className="btn-outline-primary flex-1" variant="outline">Add filter</Button>
                                <Button onClick={() => setFilters([])} variant="outline" className="flex-1 border-input [border-color:hsl(var(--input))]">Reset</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700"
                          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                        >
                          <ArrowUp size={16} style={{ transform: sortOrder === "asc" ? "rotate(0deg)" : "rotate(180deg)" }} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Sort by time</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {isSearchFocused ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700"
                        onClick={() => {
                          setSearchQuery("");
                          setIsSearchFocused(false);
                        }}
                      >
                        <X size={16} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear Search</TooltipContent>
                  </Tooltip>
                ) : (
                  <DropdownMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700">
                            <Plus size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Call or Message</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                      <DropdownMenuItem onClick={() => {
                        setIsMakeCallModalOpen(true);
                        setIsAddMenuOpen(false);
                      }}>
                        Make Call
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setIsTemplateMessageModalOpen(true);
                        setIsAddMenuOpen(false);
                      }}>
                        Send Template Message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>

            <ScrollArea className="flex-1 overflow-auto">
              <div className="space-y-1 px-2 pb-4">
                {getFilteredConversations().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No conversations found</p>
                  </div>
                ) : (
                  getFilteredConversations().map((conv: Conversation) => (
                    <div
                      key={conv.id}
                      className={`p-3 rounded-md cursor-pointer transition-colors ${selectedConversation === conv.id ? "bg-accent" : "hover:bg-muted/50"
                        }`}
                      onClick={() => handleSelectConversation(conv.id)}
                      data-testid={`conversation-${conv.id}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 relative">
                          <Avatar className="absolute">
                            <AvatarFallback className={getAvatarColor(getDisplayName(conv))}>
                              {(() => {
                                const displayName = getDisplayName(conv);
                                const parts = displayName.trim().split(/\s+/).filter((p: string) => p.length > 0);
                                if (parts.length === 0) return "U";
                                if (parts.length === 1) return parts[0][0].toUpperCase();
                                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                              })()}
                            </AvatarFallback>
                          </Avatar>
                          {/* Channel Icon Badge */}
                          <span className="absolute bottom-0 -right-1 block">
                            {conv.channel === "whatsapp" && (
                              <img src="/images/automations/whatsapp.svg" alt="WhatsApp" className="w-4 h-4" />
                            )}
                            {conv.channel === "instagram" && (
                              <img src="/images/automations/instagram.svg" alt="Instagram" className="w-4 h-4" />
                            )}
                            {conv.channel === "messenger" && (
                              <img src="/images/automations/messenger.svg" alt="Messenger" className="w-4 h-4" />
                            )}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm truncate ${getPendingMessagesCount(conv) > 0 ? "font-bold" : " font-semibold"}`}>{getDisplayName(conv)}</span>
                              {activeTab === "all" && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs flex-shrink-0 ${conv.status === "queued" ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800" :
                                    conv.status === "active" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" :
                                      conv.status === "completed" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" :
                                        "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                                    }`}
                                >
                                  {conv.status}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">{formatConversationTime(conv.time)}</span>
                          </div>
                          <p className="text-sm truncate mb-1 font-normal text-muted-foreground" style={{ maxWidth: `${sidebarWidth - 96}px` }}>{conv.lastMessage}</p>
                          {conv.assignedAgent && (
                            <p className="text-xs text-muted-foreground">Assigned to: <span className="font-medium">{conv.assignedAgentName || getAgentName(conv.assignedAgent)}</span></p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Resize Handle Pill */}
          <button
            onMouseDown={handleMouseDown}
            className={`absolute top-1/2 flex items-center justify-center py-3 rounded-full transition-all z-10 ${isDragging
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
              }`}
            style={{ cursor: "col-resize", right: "-8px", top: "50%", transform: "translateY(-50%)" }}
            title="Drag to resize sidebar"
          >
            <GripVertical size={16} />
          </button>
        </div>

        {/* Main Content Area */}
        {
          selectedConversation ? (
            isLoadingInbox && !selectedConvObj ? (
              // Conversations still loading after refresh — show skeleton to avoid "Unknown" flash
              <Card className="flex-1 flex flex-col border-l-0 rounded-none items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </Card>
            ) : (
            <Card className="flex-1 flex flex-col border-l-0 rounded-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className={getAvatarColor(getDisplayName(conversations.find((c: Conversation) => c.id === selectedConversation)))}>
                      {(() => {
                        const name = getDisplayName(conversations.find((c: Conversation) => c.id === selectedConversation));
                        const parts = name.trim().split(/\s+/).filter((p: string) => p.length > 0);
                        if (parts.length === 0) return "U";
                        if (parts.length === 1) return parts[0][0].toUpperCase();
                        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                      })()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-sm font-semibold">{getDisplayName(conversations.find((c: Conversation) => c.id === selectedConversation))}</h3>
                    <p className="text-xs text-muted-foreground">Active now</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover-elevate"
                        data-testid="button-refresh"
                        onClick={() => {
                          // Refresh BOTH the chat thread + the list + the tab
                          // counts so anything written by another agent shows
                          // up immediately without a full page reload.
                          if (selectedConversation) {
                            queryClient.invalidateQueries({ queryKey: ["/api/inbox/messages", selectedConversation] });
                          }
                          queryClient.invalidateQueries({ queryKey: ["/api/inbox/list"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/inbox/count"] });
                        }}
                      >
                        <RefreshCw size={18} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh chat</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="hover-elevate" onClick={handleToggleContactPanel} data-testid="button-view-contact">
                        {showContactPanel ? <EyeOff size={18} /> : <Eye size={18} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{showContactPanel ? "Hide" : "Show"} contact profile</TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover-elevate" data-testid="button-export">
                            <Download size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Export</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                      <DropdownMenuItem onClick={handleExportConversations}>Export as CSV</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Mark as Done / Move to Inbox toggle — mirrors replyagent behaviour:
                      active/unassigned → "Mark as done" (COMPLETED)
                      completed         → "Move to Inbox" (ACTIVE)         */}
                  {selectedConversation && (() => {
                    const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                    const isDone = conv?.status === "completed";
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={isDone
                              ? "hover-elevate gap-1.5 text-slate-500 dark:text-slate-400"
                              : "hover-elevate gap-1.5 text-emerald-600 dark:text-emerald-400"}
                            disabled={updateStatusMutation.isPending}
                            onClick={() => {
                              if (isDone) {
                                updateStatusMutation.mutate({ id: selectedConversation, status: "active" });
                              } else {
                                updateStatusMutation.mutate({ id: selectedConversation, status: "completed" });
                                setAssignedAgent(null);
                              }
                            }}
                            data-testid="button-mark-done"
                          >
                            {isDone ? <CornerUpLeft size={16} /> : <CheckCircle size={16} />}
                            <span className="text-xs font-medium">{isDone ? "Move to Inbox" : "Mark as done"}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isDone ? "Reopen this conversation" : "Close this conversation"}</TooltipContent>
                      </Tooltip>
                    );
                  })()}

                  {selectedConversation && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover-elevate" data-testid="button-more-options">
                          <MoreVertical size={18} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                        {/* Unassign — read current user from auth instead of the
                            broken `=== "self"` sentinel. Available when the chat
                            is assigned to me. */}
                        {(() => {
                          const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                          // Compare by user ID (assignedAgent now stores the user's numeric ID string)
                          const isMine = !!currentUser.id && conv?.assignedAgent === currentUser.id;
                          return (
                            <DropdownMenuItem
                              onClick={() => {
                                if (selectedConversation) {
                                  assignAgentMutation.mutate({ agentId: "null" });
                                  setAssignedAgent(null);
                                }
                              }}
                              disabled={!isMine}
                              className={!isMine ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              <UserX size={16} className="mr-2" />
                              Unassign Chat
                            </DropdownMenuItem>
                          );
                        })()}
                        <DropdownMenuSeparator />

                        {/* Snooze — opens datetime picker dialog */}
                        <DropdownMenuItem
                          onClick={() => setSnoozeDialogOpen(true)}
                        >
                          <Clock size={16} className="mr-2" />
                          Snooze conversation
                        </DropdownMenuItem>

                        {/* Schedule Reminder — opens reminder dialog */}
                        <DropdownMenuItem
                          onClick={() => setReminderDialogOpen(true)}
                        >
                          <Clock size={16} className="mr-2" />
                          Schedule reminder
                        </DropdownMenuItem>

                        {/* Delete conversation (soft delete) — hidden when the agent
                            holds `block_deleting_chats` (replyagent parity). */}
                        {!blockDeletingChats && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                if (selectedConversation) {
                                  deleteInboxMutation.mutate(selectedConversation);
                                }
                              }}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 size={16} className="mr-2" />
                              Delete conversation
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <Separator />



              <div ref={messagesEndRef} className={`flex-1 min-h-0 p-4 overflow-y-auto transition-opacity duration-150 ${isChatVisible ? "opacity-100" : "opacity-0"}`}>
                <div className="space-y-4">
                  {(messages || []).map((msg: Message, index: number, allMessages: Message[]) => {
                    const showDateDivider = index === 0 || formatMessageDate(msg.time) !== formatMessageDate(allMessages[index - 1].time);
                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="flex justify-center my-4">
                            <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">{formatMessageDate(msg.time)}</span>
                          </div>
                        )}
                        <div className={`group/msg flex items-center gap-2 ${msg.from === "agent" ? "justify-end" : "justify-start"}`}>
                          {/* Action icons (reply arrow + emoji react) — appear
                              OUTSIDE the bubble on hover, on the side opposite
                              to the bubble (left of agent, right of user) so
                              they don't overlap content. The emoji picker uses
                              Radix Popover so it (a) renders in a portal at
                              document.body (escapes the ScrollArea's overflow
                              clipping) and (b) flips to the opposite side
                              automatically when there isn't room. */}
                          {msg.from === "agent" && selectedConversation && (
                            <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplyingTo(msg);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform"
                                title="Reply to this message"
                                data-testid={`button-reply-${msg.id}`}
                              >
                                <CornerUpLeft size={13} className="text-muted-foreground" />
                              </button>
                              <Popover
                                open={reactionPickerFor === msg.id}
                                onOpenChange={(open) => setReactionPickerFor(open ? msg.id : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform"
                                    title="Add reaction"
                                    data-testid={`button-react-${msg.id}`}
                                  >
                                    <Smile size={13} className="text-muted-foreground" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="top"
                                  align="end"
                                  sideOffset={8}
                                  collisionPadding={16}
                                  className="p-0 border-0 bg-transparent shadow-none w-auto"
                                >
                                  <Picker
                                    data={data}
                                    onEmojiSelect={(emoji: any) => {
                                      reactMutation.mutate({
                                        inboxId: selectedConversation,
                                        messageId: msg.id,
                                        reaction: emoji.native,
                                      });
                                      setReactionPickerFor(null);
                                    }}
                                    theme="light"
                                    previewPosition="none"
                                    skinTonePosition="search"
                                    maxFrequentRows={1}
                                    perLine={8}
                                    set="native"
                                  />
                                </PopoverContent>
                              </Popover>
                              {canDeleteMessage && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ch = conversations.find((c: Conversation) => c.id === selectedConversation)?.channel || "whatsapp";
                                    deleteMessageMutation.mutate({ messageId: msg.id, channel: ch });
                                  }}
                                  className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform"
                                  title="Delete message"
                                  data-testid={`button-delete-${msg.id}`}
                                >
                                  <Trash2 size={13} className="text-muted-foreground" />
                                </button>
                              )}
                            </div>
                          )}

                          <div id={`message-${msg.id}`} className={`relative max-w-[70%] rounded-lg p-3 ${msg.from === "user" ? "bg-blue-100 dark:bg-blue-900/30 dark:text-blue-100" : "bg-gray-200 text-gray-900 dark:bg-slate-700 dark:text-slate-100"}`} data-testid={`message-${msg.id}`}>
                            {msg.text && <p className="text-sm">{msg.text}</p>}

                            {/* Images */}
                            {msg.images && msg.images.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {msg.images.map((image: { url: string; name: string; size: number }, idx: number) => (
                                  <div key={idx} className="space-y-1">
                                    <img
                                      src={image.url}
                                      alt={image.name}
                                      className="max-w-full h-auto rounded max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setPreviewImage(image.url)}
                                    />
                                    <div className="flex items-center justify-between gap-2 text-xs bg-black/10 dark:bg-white/10 rounded p-2">
                                      <div className="flex items-center gap-1 flex-1 min-w-0">
                                        <span className="truncate">{image.name}</span>
                                        <span className="opacity-70 flex-shrink-0">({(image.size / 1024).toFixed(1)}KB)</span>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownload(image.url, image.name);
                                        }}
                                        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                        title="Download image"
                                      >
                                        <Download size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Attachments */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {msg.attachments.map((attachment: { url: string; name: string; size: number }, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-2 text-xs bg-black/10 dark:bg-white/10 rounded p-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Paperclip size={12} className="flex-shrink-0" />
                                      <span className="truncate">{attachment.name}</span>
                                      <span className="opacity-70 flex-shrink-0">({(attachment.size / 1024).toFixed(1)}KB)</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(attachment.url, attachment.name);
                                      }}
                                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                      title="Download file"
                                    >
                                      <Download size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Video */}
                            {msg.video && (
                              <div className="mt-2 text-xs bg-black/10 dark:bg-white/10 rounded overflow-hidden">
                                <video src={msg.video!.url} controls className="p-1 w-full max-h-64 object-contain bg-black/5" poster={msg.video!.thumbnail} />
                                <div className="flex items-center gap-2 p-2">
                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                    <div className="p-1 bg-black/10 rounded-full">
                                      <div className="ml-0.5 w-0 h-0 border-t-[3px] border-t-transparent border-l-[6px] border-l-current border-b-[3px] border-b-transparent"></div>
                                    </div>
                                    <span className="truncate">{msg.video!.name}</span>
                                    <span className="opacity-70 flex-shrink-0">({(msg.video!.size / 1024 / 1024).toFixed(1)}MB)</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Voice message */}
                            {msg.audio && (
                              <div className="mt-2 space-y-2">
                                <div className="bg-black/10 dark:bg-white/10 rounded p-3 max-w-sm">
                                  <audio
                                    controls
                                    className="h-12 rounded"
                                    style={{
                                      accentColor: "hsl(var(--primary))",
                                    }}
                                    controlsList="nodownload"
                                  >
                                    <source src={msg.audio!.url} type={msg.audio!.url?.includes('.m4a') ? 'audio/mp4' : msg.audio!.url?.includes('.mp4') ? 'video/mp4' : 'audio/webm'} />
                                    Your browser does not support the audio element.
                                  </audio>
                                  <div className="flex items-center justify-between mt-2">
                                    <p className="text-xs font-medium">Voice message</p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(msg.audio!.url, msg.audio!.name || `voice-message-${msg.id}`);
                                      }}
                                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                      title="Download voice message"
                                    >
                                      <Download size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <p className={`text-xs mt-1 flex items-center gap-1 flex-wrap ${msg.from === "agent" ? "justify-end text-gray-700 dark:text-slate-400" : "justify-end text-gray-600 dark:text-slate-500"}`}>
                              <span>{formatMessageTime(msg.time)}</span>
                              {msg.from === "agent" && msg.status && (
                                <MessageStatusTick status={msg.status} />
                              )}
                              {Array.isArray((msg as any).reactions) && (msg as any).reactions.map((r: any, ri: number) => (
                                <span key={ri} className="text-base leading-none">{r.reaction ?? r.emoji ?? ''}</span>
                              ))}
                            </p>
                          </div>

                          {/* Action icons for INCOMING (user) bubbles —
                              positioned to the RIGHT of the bubble. Picker
                              uses Radix Popover (portal + auto collision
                              flip) so it never gets clipped by the scroll
                              area, regardless of where the message sits. */}
                          {msg.from === "user" && selectedConversation && (
                            <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplyingTo(msg);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform"
                                title="Reply to this message"
                                data-testid={`button-reply-${msg.id}`}
                              >
                                <CornerUpLeft size={13} className="text-muted-foreground" />
                              </button>
                              <Popover
                                open={reactionPickerFor === msg.id}
                                onOpenChange={(open) => setReactionPickerFor(open ? msg.id : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform"
                                    title="Add reaction"
                                    data-testid={`button-react-${msg.id}`}
                                  >
                                    <Smile size={13} className="text-muted-foreground" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="top"
                                  align="start"
                                  sideOffset={8}
                                  collisionPadding={16}
                                  className="p-0 border-0 bg-transparent shadow-none w-auto"
                                >
                                  <Picker
                                    data={data}
                                    onEmojiSelect={(emoji: any) => {
                                      reactMutation.mutate({
                                        inboxId: selectedConversation,
                                        messageId: msg.id,
                                        reaction: emoji.native,
                                      });
                                      setReactionPickerFor(null);
                                    }}
                                    theme="light"
                                    previewPosition="none"
                                    skinTonePosition="search"
                                    maxFrequentRows={1}
                                    perLine={8}
                                    set="native"
                                  />
                                </PopoverContent>
                              </Popover>
                              {canDeleteMessage && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ch = conversations.find((c: Conversation) => c.id === selectedConversation)?.channel || "whatsapp";
                                    deleteMessageMutation.mutate({ messageId: msg.id, channel: ch });
                                  }}
                                  className="h-7 w-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform"
                                  title="Delete message"
                                  data-testid={`button-delete-${msg.id}`}
                                >
                                  <Trash2 size={13} className="text-muted-foreground" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <Separator />

              {/* Message Input or Assignment Prompt — gated by reply permission
                  (replyagent: isAssigned || canMessageUnassignedConversations) */}
              {canReply ? (
                <div className="p-4 flex-shrink-0 relative">
                  {/* Attached files preview */}
                  {(attachedFiles.length > 0 || recordedAudio) && (
                    <div className="mb-3 p-3 bg-muted rounded-lg space-y-2">
                      {attachedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Paperclip size={14} className="text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-foreground">{file.name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024).toFixed(1)}KB)</span>
                          </div>
                          <button
                            onClick={() => removeAttachedFile(index)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      {recordedAudio && (
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 flex-1">
                            <Mic size={14} className="text-muted-foreground" />
                            <span className="text-foreground">Voice message</span>
                            <span className="text-xs text-muted-foreground">({(recordedAudio.size / 1024).toFixed(1)}KB)</span>
                          </div>
                          <button
                            onClick={() => setRecordedAudio(null)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Replies */}
                  {selectedConversation && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {quickReplies.map((reply, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs h-7 bg-slate-200/75 dark:bg-slate-800"
                          onClick={() => setMessageText(reply)}
                        >
                          {reply}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* WhatsApp 24h-window CTA. Meta only allows free-form
                      replies within 24h of the last INCOMING message; outside
                      that window agents must send an approved template. We
                      look at the most recent inbound message timestamp and
                      show the template CTA when > 24h have passed (and only
                      for WhatsApp conversations). */}
                  {(() => {
                    const conv = conversations.find((c: Conversation) => c.id === selectedConversation);
                    if (!conv || conv.channel !== 'whatsapp') return null;
                    const lastInbound = [...(messages ?? [])]
                      .reverse()
                      .find((m: Message) => m.from === 'user');
                    if (!lastInbound) return null;
                    const hoursSince = (Date.now() - new Date(lastInbound.time).getTime()) / (1000 * 60 * 60);
                    if (hoursSince <= 24) return null;
                    return (
                      <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md flex items-center gap-2">
                        <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 flex-1">
                          Last interaction was {Math.floor(hoursSince)}h ago. WhatsApp requires an approved template to reach this contact now.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-amber-300 hover:bg-amber-100"
                          onClick={() => setTemplateDialogOpen(true)}
                          data-testid="button-send-template"
                        >
                          Send Template
                        </Button>
                      </div>
                    );
                  })()}

                  {/* Reply-to preview banner — shows when a specific message
                      was selected via the reply-arrow button. Click X to
                      cancel. The selected message snippet is sent along with
                      the next outbound so the recipient sees a reply quote. */}
                  {replyingTo && (
                    <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-800/50 border-l-4 border-primary rounded-r flex items-start gap-2">
                      <CornerUpLeft size={14} className="text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-primary">
                          Replying to {replyingTo.from === "agent" ? "your message" : "this message"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{replyingTo.text || "(media)"}</p>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        title="Cancel reply"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Reply / Note tabs (mirrors replyagent). Note mode tags
                      the outgoing record with type='note' so it shows on the
                      thread as an internal annotation without sending to the
                      customer. */}
                  <div className="flex items-center gap-4 border-b mb-2 pb-1 text-xs font-medium">
                    {(["reply", "note"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setComposeMode(m)}
                        className={`pb-1 transition-colors ${
                          composeMode === m
                            ? "border-b-2 border-primary text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`tab-compose-${m}`}
                      >
                        {m === "reply" ? "Reply" : "Note"}
                      </button>
                    ))}
                    {composeMode === "note" && (
                      <span className="text-[10px] text-amber-600 ml-auto">
                        Internal — not sent to customer
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder={composeMode === "note" ? "Write an internal note..." : "Type a message..."}
                      className={`flex-1 ${composeMode === "note" ? "bg-amber-50 dark:bg-amber-900/10" : ""}`}
                      data-testid="input-message"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!sendMessageMutation.isPending) handleSendMessage();
                        }
                      }}
                    />

                    {/* AI Transform — translate / correct / expand / shorten */}
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 [border-color:hsl(var(--input))]"
                        title="AI text helper"
                        disabled={!messageText.trim() || transformAiMutation.isPending}
                        onClick={() => setAiTransformOpen((v) => !v)}
                      >
                        {transformAiMutation.isPending ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <span className="text-xs font-bold">AI</span>
                        )}
                      </Button>
                      {aiTransformOpen && (
                        <div className="absolute bottom-12 right-0 z-50 bg-white dark:bg-slate-900 border rounded-md shadow-lg p-1 w-40">
                          {["correct", "translate", "expand", "shorten"].map((m) => (
                            <button
                              key={m}
                              onClick={() => transformAiMutation.mutate({ text: messageText, mode: m })}
                              className="w-full text-left text-xs px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            >
                              {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 [border-color:hsl(var(--input))]"
                        title="Add emoji"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      >
                        <Smile size={18} />
                      </Button>
                      {showEmojiPicker && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute bottom-12 right-0 z-50"
                        >
                          <Picker
                            data={data}
                            onEmojiSelect={handleEmojiSelect}
                            theme="light"
                            previewPosition="none"
                            skinTonePosition="none"
                            maxFrequentRows={1}
                            perLine={8}
                            set="native"
                          />
                        </div>
                      )}
                    </div>

                    {/* File attachment */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileAttach}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 [border-color:hsl(var(--input))]"
                      title="Attach file"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip size={18} />
                    </Button>

                    {/* Image attachment */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageAttach}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 [border-color:hsl(var(--input))]"
                      title="Send picture"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Image size={18} />
                    </Button>

                    {/* Voice message */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-9 w-9 [border-color:hsl(var(--input))] ${isRecording ? "bg-red-100 text-red-600" : ""}`}
                      title={isRecording ? "Stop recording" : "Send voice message"}
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                    >
                      <Mic size={18} />
                    </Button>

                    {/* Send button */}
                    <Button
                      size="icon"
                      data-testid="button-send"
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() && attachedFiles.length === 0 && !recordedAudio}
                    >
                      <Send size={18} color="white" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-6 flex-shrink-0 bg-muted/30 flex flex-col items-center justify-center gap-3">
                  <AlertCircle className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">To send messages, please assign this chat to an agent.</p>
                    <p className="text-xs text-muted-foreground mt-1">Use the assignment options in the contact profile to get started</p>
                  </div>
                </div>
              )}
            </Card>
            )
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center border-l-0 rounded-none">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                <p className="text-sm text-muted-foreground">Choose a conversation from the list to start messaging</p>
              </div>
            </Card>
          )
        }

        {/* Image Preview Modal */}
        <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="[&>button]:hidden w-auto h-auto max-w-none p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
            {previewImage && (
              <div className="relative">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="max-w-[80vw] max-h-[80vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                />
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {
          showContactPanel && (
            <ContactProfileSidebar
              conversation={conversations.find((c: Conversation) => c.id === selectedConversation)}
              conversations={conversations}
              basicDetails={currentBasicDetails}
              onUpdateBasicDetails={handleUpdateBasicDetails}
              assignedAgent={assignedAgent}
              onAssignAgent={handleAssignAgent}
              canAssignConversations={canAssignConversations}
              canSeeChannels={canSeeChannels}
              canViewProfile={canViewProfile}
              agentOptions={agentOptions}
              involvedTeams={involvedTeamsByConv[selectedConversation || 0]}
              onUpdateInvolvedTeams={handleUpdateInvolvedTeams}
              teamOptions={teamOptions}
              tags={tagsByConv[conversations.find((c: Conversation) => c.id === selectedConversation)?.id || 0] || []}
              onUpdateTags={handleUpdateTags}
              tagOptions={tagOptions}
              profileCustomFields={profileFieldsByConv[selectedConversation || 0] || []}
              onSaveCustomFieldValue={handleSaveCustomFieldValue}
              customAttributes={customAttributesByConv[conversations.find((c: Conversation) => c.id === selectedConversation)?.id || 0] || {}}
              onUpdateCustomAttributes={handleUpdateCustomAttributes}
              notes={notesByConv[conversations.find((c: Conversation) => c.id === selectedConversation)?.id || 0] || []}
              onUpdateNotes={handleUpdateNotes}
              messages={messages || []}
              onScrollToMessage={handleScrollToMessage}
              profileData={profileData}
              onRefreshProfile={() => refetchProfileData()}
            />
          )
        }







        {/* Filter Modal */}
        <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="mb-2">
              <DialogTitle>Filter Conversations</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Team</label>
                <CustomDropdown
                  options={teamOptions}
                  selected={filterTeams}
                  onChange={setFilterTeams}
                  placeholder="Select teams"
                  width="100%"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Agent</label>
                <CustomDropdown
                  options={agentOptions}
                  selected={filterAgents}
                  onChange={setFilterAgents}
                  placeholder="Select agents"
                  width="100%"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <CustomDropdown
                  options={[]}
                  selected={filterStatus}
                  onChange={setFilterStatus}
                  placeholder="Select status"
                  width="100%"
                />
              </div>
            </div>

            <DialogFooter className="mt-2">
              <Button variant="ghost" onClick={() => setIsFilterModalOpen(false)} className="bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 font-normal">
                Cancel
              </Button>
              <Button onClick={() => setIsFilterModalOpen(false)} className="btn-outline-primary font-normal" variant="outline">
                Apply Filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Make Outbound Call Modal */}
        <Dialog open={isMakeCallModalOpen} onOpenChange={setIsMakeCallModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader className="mb-2">
              <DialogTitle>Make Outbound Call</DialogTitle>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex gap-4 border-b">
              <button
                onClick={() => {
                  setMakeCallTab("make-call");
                }}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${makeCallTab === "make-call"
                  ? "border-b-primary text-foreground"
                  : "border-b-transparent text-muted-foreground hover:text-foreground"
                  }`}
              >
                Make Call
              </button>
              <button
                onClick={() => setMakeCallTab("search-contacts")}
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${makeCallTab === "search-contacts"
                  ? "border-b-primary text-foreground"
                  : "border-b-transparent text-muted-foreground hover:text-foreground"
                  }`}
              >
                Search Contacts
              </button>
            </div>

            {/* Make Call Tab */}
            {makeCallTab === "make-call" && (
              <div>
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Search for a customer or enter a phone number to place an outbound call using the WhatsApp Business API. Please note that outbound calls are chargeable as per{" "}
                    <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">
                      Meta's pricing policies
                    </a>
                  </p>
                </div>

                {!(hasCallPermission && selectedContact) && (
                  <div>
                    <label className="text-sm font-medium">Enter phone number</label>
                    <div className="flex gap-2 mt-1 mb-4">
                      <Input
                        placeholder="+1 (555) 000-0000"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="border-input w-full"
                      />

                      <Button onClick={handleCheckPermission} className="h-9 btn-outline-primary font-normal" variant="outline" disabled={!phoneNumber.trim()}>
                        Check Permission
                      </Button>
                    </div>
                  </div>
                )}

                {callPermissionChecked && (
                  <div className="space-y-4">
                    {hasCallPermission && selectedContact ? (
                      <div className="border border-input rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className={getAvatarColor(selectedContact.name)}>
                                {selectedContact.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{selectedContact.name}</p>
                              <p className="text-xs text-muted-foreground">{selectedContact.number}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-green-600">Contact Found</p>
                          </div>
                        </div>
                      </div>
                    ) : (

                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/30 dark:border-red-800">
                        <p className="text-sm text-red-800 dark:text-red-300">
                          <strong>Contact Not Found</strong> - No contact with this number exists in your workspace.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setPhoneNumber("");
                    setCallPermissionChecked(false);
                    setHasCallPermission(false);
                    setSelectedContact(null);
                    setLimitReached(false);
                  }} className="[border-color:hsl(var(--input))]">
                    Clear
                  </Button>
                  <Button
                    disabled={!hasCallPermission || !callPermissionChecked || limitReached}
                    onClick={() => {
                      setIsCallActive(true);
                      setCallPhoneNumber(selectedContact?.number || phoneNumber);
                      setCallContactName(selectedContact?.name || "");
                      setCallDuration(0);
                      setIsMuted(false);
                      setIsSpeakerOn(false);
                      setIsMakeCallModalOpen(false);
                    }}
                    className="btn-outline-primary font-normal" variant="outline"
                  >
                    Call
                  </Button>
                </div>
              </div>
            )}

            {/* Search Contacts Tab */}
            {makeCallTab === "search-contacts" && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchContactsQuery}
                    onChange={(e) => setSearchContactsQuery(e.target.value)}
                    className="border-input pl-9"
                  />
                </div>

                <ScrollArea className="h-64 border border-input rounded-lg">
                  <div className="space-y-2 p-3">
                    {callContacts.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {searchContactsQuery.trim() ? "No contacts found" : "Type to search contacts"}
                      </p>
                    )}
                    {callContacts.map((contact: any) => {
                        const name = contact.full_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unknown";
                        const number = contact.full_mobile_number || contact.mobile_number || "";
                        const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                        return (
                        <div
                          key={contact.id}
                          onClick={() => {
                            setSelectedContact({ id: Number(contact.id), name, number, callConsent: "Active" });
                            setPhoneNumber(number);
                            setCallPermissionChecked(true);
                            setHasCallPermission(true);
                          }}
                          className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedContact?.id === Number(contact.id)
                            ? "border-primary bg-primary/10"
                            : "border-input"
                            }`}
                        >
                          <div className="flex gap-2">
                            {/* Left: Avatar */}
                            <Avatar className="h-11 w-11 flex-shrink-0">
                              <AvatarFallback className={getAvatarColor(name)}>
                                {initials}
                              </AvatarFallback>
                            </Avatar>

                            {/* Right: Name/Badge and Tries/Expires */}
                            <div className="flex-1 space-y-1">
                              {/* Row 1: Name and Badge */}
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{name}</p>
                                <div className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                  Found
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{number || "No number on file"}</p>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                  </div>
                </ScrollArea>

                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setPhoneNumber("");
                    setCallPermissionChecked(false);
                    setHasCallPermission(false);
                    setSelectedContact(null);
                    setSearchContactsQuery("");
                    setLimitReached(false);
                  }} className="[border-color:hsl(var(--input))]">
                    Clear
                  </Button>
                  <Button
                    disabled={!selectedContact}
                    onClick={() => {
                      if (selectedContact) {
                        setIsCallActive(true);
                        setCallPhoneNumber(selectedContact.number);
                        setCallContactName(selectedContact.name);
                        setCallDuration(0);
                        setIsMuted(false);
                        setIsSpeakerOn(false);
                        setIsMakeCallModalOpen(false);
                      }
                    }}
                    className="btn-outline-primary font-normal" variant="outline"
                  >
                    Call
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Send Template Message Modal */}
        <Dialog open={isTemplateMessageModalOpen} onOpenChange={setIsTemplateMessageModalOpen}>
          <DialogContent className="sm:max-w-3xl flex flex-col">
            <DialogHeader className="mb-2">
              <DialogTitle>Send Template Message</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto -ml-1">
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Phone Numbers and Template Selection */}
                <div className="space-y-4 pl-1">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Recipients (up to 5)<span className="text-red-500 pl-0.5">*</span></label>
                    <div className="space-y-2">
                      {templatePhoneNumbers.map((phone, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder={`+1 (555) 000-${String(index).padStart(4, "0")}`}
                            value={phone}
                            onChange={(e) => {
                              const newNumbers = [...templatePhoneNumbers];
                              newNumbers[index] = e.target.value;
                              setTemplatePhoneNumbers(newNumbers);
                            }}
                            className="border-input flex-1"
                          />
                          {templatePhoneNumbers.length > 1 && (
                            <button
                              onClick={() => {
                                const newNumbers = templatePhoneNumbers.filter((_, i) => i !== index);
                                setTemplatePhoneNumbers(newNumbers);
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors border-[]"
                            >
                              <X size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add another recipient button */}
                    {templatePhoneNumbers.length < 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        disabled={templatePhoneNumbers.some(p => p.trim() === "")}
                        onClick={() => {
                          setTemplatePhoneNumbers([...templatePhoneNumbers, ""]);
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        Add another recipient
                      </Button>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">WhatsApp Template<span className="text-red-500 pl-0.5">*</span></label>
                    <div className="space-y-3">
                      <CustomDropdown
                        options={broadcastTemplates.map(t => ({ id: String(t.id), name: t.name }))}
                        selected={selectedTemplate ? [String(selectedTemplate.id)] : []}
                        onChange={(selected) => {
                          if (selected.length > 0) {
                            const template = broadcastTemplates.find(t => String(t.id) === selected[0]);
                            if (template) {
                              setSelectedTemplate(template);
                              setTemplateVariables({});
                            }
                          }
                        }}
                        placeholder="Select a template"
                        width="100%"
                        showSelectedOption={true}
                      />
                      {broadcastTemplates.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          You don't have any templates yet. Create one to send messages.{" "}
                          <a
                            href="/template-manager"
                            className="text-primary underline hover:no-underline"
                          >
                            Go to Template Manager
                          </a>
                          {" "}to create one.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Variable inputs */}
                  {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                    <div>
                      <label className="text-sm font-medium block pt-2">Customize Variables</label>
                      <div className="space-y-2">
                        {selectedTemplate.variables.map((variable: string, index: number) => (
                          <div key={index} className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">{variable}</label>
                            <Input
                              placeholder={`Enter ${variable}...`}
                              value={templateVariables[variable] || ""}
                              onChange={(e) => {
                                setTemplateVariables({
                                  ...templateVariables,
                                  [variable]: e.target.value
                                });
                              }}
                              className="border-input text-sm h-9"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Template Preview */}
                <div className="flex flex-col items-center">
                  <label className="text-sm font-medium mb-3 block self-start">Template Preview</label>
                  <div className="h-full max-h-[62vh] w-full max-w-[31vh]">
                    <PreviewV2
                      mode="chat"
                      headerText={selectedTemplate?.header || ""}
                      bodyText={selectedTemplate?.body || ""}
                      footerText={selectedTemplate?.footer || ""}
                      templateButtons={selectedTemplate?.buttons || []}
                      variableSamples={templateVariables}
                      placeholderText="Select a template to see preview..."
                    />
                  </div>
                  <p className="text-[10px] py-1">Preview may not reflect the exact WhatsApp interface</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 px-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Message rates apply. See{" "}
                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  WhatsApp pricing
                </a>
                {" "}for details.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsTemplateMessageModalOpen(false);
                    setTemplatePhoneNumbers([""]);
                    setSelectedTemplate(null);
                    setTemplateVariables({});
                  }}
                  className="[border-color:hsl(var(--input))]"
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    !selectedTemplate ||
                    templatePhoneNumbers.some(p => p.trim() === "") ||
                    (selectedTemplate?.variables && selectedTemplate.variables.length > 0 &&
                      !selectedTemplate.variables.every((v: string) => templateVariables[v]?.trim()))
                  }
                  onClick={handleSendTemplateMessage}
                  className="btn-outline-primary font-normal" variant="outline"
                >
                  Send Message
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Call UI Overlay */}
        {
          isCallActive && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 space-y-6">
                {/* Avatar */}
                <div className="flex justify-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                    <Phone size={48} className="text-white" />
                  </div>
                </div>

                {/* Contact Info */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Calling</p>
                  {callContactName && <p className="text-2xl font-bold">{callContactName}</p>}
                  <p className="text-lg font-semibold text-muted-foreground">{callPhoneNumber}</p>
                </div>

                {/* Call Duration */}
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary font-mono">{formatCallDuration(callDuration)}</p>
                </div>

                {/* Call Controls */}
                <div className="flex items-center justify-center gap-4">
                  {/* Mute Button */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted
                      ? "bg-red-100 hover:bg-red-200"
                      : "bg-muted hover:bg-muted/80"
                      }`}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <MicOff size={20} className={isMuted ? "text-red-600" : "text-foreground"} />
                    ) : (
                      <Mic size={20} className="text-foreground" />
                    )}
                  </button>

                  {/* Speaker Button */}
                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isSpeakerOn
                      ? "bg-primary/15 hover:bg-primary/25"
                      : "bg-muted hover:bg-muted/80"
                      }`}
                    title={isSpeakerOn ? "Speaker off" : "Speaker on"}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isSpeakerOn ? "text-primary" : "text-foreground"}>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a6.5 6.5 0 0 1 0 9.07"></path>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                    </svg>
                  </button>

                  {/* End Call Button */}
                  <button
                    onClick={() => {
                      setIsCallActive(false);
                      setCallDuration(0);
                      setCallPhoneNumber("");
                      setCallContactName("");
                      setIsMuted(false);
                      setIsSpeakerOn(false);
                      setIsMakeCallModalOpen(false);
                    }}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                    title="End call"
                  >
                    <Phone size={20} className="text-white rotate-135" />
                  </button>
                </div>

                {/* Call Status */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Connected</p>
                </div>
              </div>
            </div>
          )
        }

      </div>

      {/* Snooze dialog — pick a future datetime; sending empty unsnoozes. */}
      <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Snooze conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Pick a future time. The conversation will move out of your inbox and reappear at the chosen moment.
            </p>
            <Input
              type="datetime-local"
              value={snoozeUntil}
              onChange={(e) => setSnoozeUntil(e.target.value)}
              data-testid="input-snooze-until"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedConversation &&
                snoozeMutation.mutate({
                  id: selectedConversation,
                  until: new Date(snoozeUntil).toISOString(),
                })
              }
              disabled={!snoozeUntil || snoozeMutation.isPending}
            >
              {snoozeMutation.isPending ? "Snoozing…" : "Snooze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template-send dialog (WhatsApp 24h-window CTA). Lists workspace's
          approved templates from /api/broadcasts/templates and POSTs to the
          existing send endpoint with type='template' + wa_template_id. */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send WhatsApp Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Pick an approved template to reach this contact outside the 24-hour reply window.
            </p>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template…" />
              </SelectTrigger>
              <SelectContent>
                {waTemplates.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-muted-foreground">No approved templates</div>
                ) : (
                  waTemplates.map((t: any) => (
                    <SelectItem key={String(t.id)} value={String(t.id)}>
                      {t.name} <span className="text-muted-foreground">({t.language})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendTemplateMutation.mutate(selectedTemplateId)}
              disabled={!selectedTemplateId || sendTemplateMutation.isPending}
            >
              {sendTemplateMutation.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder create / rename / delete dialog. Reuses the same modal for
          both flows — when folderEditing is set, we're renaming; otherwise
          we're creating. Delete button only shows in the rename mode. */}
      <Dialog open={folderModalOpen} onOpenChange={setFolderModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{folderEditing ? "Rename folder" : "New folder"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              maxLength={30}
            />
          </div>
          <DialogFooter className="flex items-center justify-between">
            {folderEditing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => folderDeleteMutation.mutate(String(folderEditing.id))}
              >
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setFolderModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  folderEditing
                    ? folderUpdateMutation.mutate({ id: String(folderEditing.id), name: folderName })
                    : folderCreateMutation.mutate(folderName)
                }
                disabled={!folderName.trim()}
              >
                {folderEditing ? "Save" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder dialog — schedule a future outbound reminder. Backend writes
          remind_at on a pending message row; existing cron picks it up. */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Reminders are supported on WhatsApp, Telegram, and Z-API conversations only.
            </p>
            <div>
              <label className="text-xs font-medium">When</label>
              <Input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                data-testid="input-reminder-at"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Message</label>
              <Textarea
                placeholder="Reminder text…"
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                rows={3}
                data-testid="input-reminder-text"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedConversation &&
                reminderMutation.mutate({
                  inbox_id: selectedConversation,
                  schedule_at: new Date(reminderAt).toISOString(),
                  text_message: reminderText,
                })
              }
              disabled={!reminderAt || !reminderText.trim() || reminderMutation.isPending}
            >
              {reminderMutation.isPending ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import {
  Film, Folder, Plus, Search, Grid, List, FileText,
  Image as ImageIcon, Mic, Video, UploadCloud, Check, X,
  Pencil, Trash2, Upload, AlertCircle, Download, Eye,
  MoreHorizontal, ArrowLeft, Filter, Loader2, Link as LinkIcon,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTheme } from "@/contexts/ThemeContext";

interface MediaGallerySectionProps {
  onSelect?: (file: any) => void;
}

export default function MediaGallerySection({ onSelect }: MediaGallerySectionProps) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "h-11 rounded-xl text-[13px] font-bold transition-all px-4",
    "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const primaryBtn =
    "h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const outlineBtn = cn(
    "h-10 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("All files");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  const queryClient = useQueryClient();

  const { data: galleryData, isLoading } = useQuery({
    queryKey: ["/api/gallery/listings", { object_id: parentId }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/gallery/listings${parentId ? `?object_id=${parentId}` : ""}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/gallery/media/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: "Deleted", description: "File removed." });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      await apiRequest("PATCH", `/api/gallery/rename/${id}`, { object_name: newName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: "Renamed", description: "File name updated." });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/gallery/folder", { name, parent_id: parentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: "Created", description: "Folder created." });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => { await apiRequest("POST", "/api/gallery/upload", formData); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: "Uploaded", description: "Files uploaded successfully." });
    },
  });

  const copyUrl = async (rawUrl: string) => {
    if (!rawUrl || rawUrl === "#") return;
    const url = resolveMediaUrl(rawUrl);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({ title: "Copied", description: "Link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy link.", variant: "destructive" });
    }
  };

  // Resolve a stored media path (e.g. "/uploads/xyz.jpg") to a loadable URL.
  // Prod/direct mode: prepend the backend origin (frontend host has no /uploads).
  // Local proxy mode (empty base): keep relative — Vite proxies /uploads -> backend.
  const resolveMediaUrl = (url: string) => {
    if (!url || url === "#") return "";
    if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
    const raw = (import.meta.env.VITE_API_BASE_URL || "").trim();
    if (raw) {
      const origin = raw.replace(/\/api\/?$/i, "").replace(/\/$/, "");
      return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
    }
    return url.startsWith("/") ? url : `/${url}`;
  };

  const previewFile = (item: any) => {
    if (item && item.type !== "folder") setPreviewItem(item);
  };

  const navigatePreview = (dir: 1 | -1) => {
    const files = filteredMedia.filter((m: any) => m.type !== "folder");
    if (!previewItem || files.length === 0) return;
    const idx = files.findIndex((m: any) => m.id === previewItem.id);
    if (idx === -1) return;
    const next = (idx + dir + files.length) % files.length;
    setPreviewItem(files[next]);
  };

  const formatAddedDate = (val: any) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-US", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const mediaItems = useMemo(() => {
    if (!galleryData) return [];
    const folders = (galleryData.folders || []).map((f: any) => ({
      id: f.object_id || f.id.toString(),
      name: f.object_name,
      type: "folder",
      media_type: "FOLDER",
      size: "—",
      url: "#",
    }));
    const files = (galleryData.file_folders?.data || []).map((f: any) => ({
      id: f.object_id || f.id.toString(),
      name: f.object_name,
      type: f.media_type?.toLowerCase() || "file",
      media_type: f.media_type?.toUpperCase() || "FILE",
      size: `${(f.file_size / 1024).toFixed(1)} KB`,
      url: f.file_url,
      added: f.created_at || f.added_on || f.createdAt || "",
    }));
    return [...folders, ...files];
  }, [galleryData]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    if (parentId) formData.append("parent_id", parentId);
    Array.from(files).forEach((file) => formData.append("files", file));
    uploadMutation.mutate(formData);
    setUploadDialogOpen(false);
  };

  const filteredMedia = mediaItems.filter((item: any) => {
    const matchesFilter =
      filter === "All files" ||
      (filter === "Audios" && item.media_type === "AUDIO") ||
      (filter === "Images" && item.media_type === "IMAGE") ||
      (filter === "Files" && (item.media_type === "PDF" || item.media_type === "DOCUMENT" || item.media_type === "FILE")) ||
      (filter === "Videos" && item.media_type === "VIDEO") ||
      (filter === "Folders" && item.media_type === "FOLDER");
    return matchesFilter && item.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getIcon = (type: string, size = "w-8 h-8") => {
    const t = type?.toUpperCase();
    switch (t) {
      case "AUDIO":  return <Mic className={cn(size, "text-emerald-500")} />;
      case "PDF":    return <FileText className={cn(size, "text-rose-500")} />;
      case "IMAGE":  return <ImageIcon className={cn(size, "text-blue-500")} />;
      case "VIDEO":  return <Video className={cn(size, "text-amber-500")} />;
      case "FOLDER": return <Folder className={cn(size, "text-primary fill-primary/20")} />;
      default:       return <FileText className={cn(size, "text-slate-400")} />;
    }
  };

  return (
    <>
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", dark ? "bg-primary/15" : "bg-primary/10")}>
              <Film className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>Media Gallery</h1>
              <p className={cn("text-[11px] font-bold mt-0.5 opacity-60", sub)}>
                Efficiently manage and organize the Workspace media right here.
              </p>
            </div>
          </div>
          <button onClick={() => setUploadDialogOpen(true)} className={primaryBtn}>
            <Upload size={12} /> Upload
          </button>
        </div>

        {/* Toolbar */}
        <div className={cn("px-6 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-3", softBorder)}>
            <div className="flex items-center gap-3 flex-wrap">
              {parentId ? (
                <button onClick={() => setParentId(null)} className={outlineBtn}>
                  <ArrowLeft size={12} /> Back
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 h-10">
                  <Folder size={14} className="text-primary" />
                  <span className={cn("text-[11px] font-black uppercase tracking-widest", sub)}>Root</span>
                </div>
              )}

              {isCreatingFolder ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                  <Input
                    autoFocus
                    value={newFolderName}
                    placeholder="Folder name..."
                    className={cn(inputCls, "h-10 w-44")}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim()) {
                        createFolderMutation.mutate(newFolderName.trim());
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      } else if (e.key === "Escape") {
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newFolderName.trim()) {
                        createFolderMutation.mutate(newFolderName.trim());
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      }
                    }}
                    className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all shadow-md shadow-primary/20"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => { setIsCreatingFolder(false); setNewFolderName(""); }}
                    className={cn("h-10 w-10 rounded-xl border flex items-center justify-center", softBorder, dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsCreatingFolder(true)} className={outlineBtn}>
                  <Plus size={12} /> New Folder
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(inputCls, "pl-9 h-10 w-56")}
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ borderColor: dark ? "rgb(30 41 59)" : "rgb(226 232 240)" }}>
                {[
                  { v: "grid" as const, icon: Grid },
                  { v: "list" as const, icon: List },
                ].map((m) => (
                  <button
                    key={m.v}
                    onClick={() => setViewMode(m.v)}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      viewMode === m.v
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : dark ? "text-slate-500 hover:text-primary" : "text-slate-500 hover:text-primary"
                    )}
                  >
                    <m.icon size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className={cn("px-6 py-3 border-b flex items-center gap-2 overflow-x-auto", softBorder)}>
            <Filter size={12} className="text-slate-400 shrink-0" />
            {["All files", "Folders", "Images", "Videos", "Audios", "Files"].map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                    active
                      ? "bg-primary/10 text-primary"
                      : dark ? "text-slate-500 hover:text-primary hover:bg-slate-900/40" : "text-slate-500 hover:text-primary hover:bg-slate-100/60"
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="p-6 min-h-[400px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className={cn("text-[11px] font-bold opacity-60 uppercase tracking-widest", sub)}>Loading files...</p>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Film className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className={cn("text-[13px] font-black uppercase tracking-widest", text)}>No Files Found</p>
                  <p className={cn("text-[11px] font-medium opacity-60 max-w-xs", sub)}>
                    Upload your first file to get started.
                  </p>
                </div>
                <button onClick={() => setUploadDialogOpen(true)} className={primaryBtn}>
                  <Upload size={12} /> Upload File
                </button>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredMedia.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === "folder") setParentId(item.id);
                      else if (onSelect) onSelect(item);
                    }}
                    className="group relative flex flex-col gap-2 cursor-pointer"
                  >
                    <div className={cn(
                      "aspect-square rounded-[1.25rem] border overflow-hidden transition-all relative",
                      "group-hover:shadow-md group-hover:border-primary/40",
                      softBg,
                      softBorder
                    )}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        {getIcon(item.type, "w-10 h-10")}
                      </div>

                      {/* Hover overlay — single 3-dots menu (matches Byte) */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="w-8 h-8 rounded-lg bg-white text-primary flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                            >
                              <MoreHorizontal size={14} strokeWidth={2.5} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className={cn("rounded-xl p-1.5 min-w-[150px]", dark ? "bg-[#0f1829] border-slate-800" : "")}>
                            {item.type !== "folder" && (
                              <>
                                <DropdownMenuItem
                                  className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
                                  onClick={(e) => { e.stopPropagation(); previewFile(item); }}
                                >
                                  <Eye size={12} /> Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
                                  onClick={(e) => { e.stopPropagation(); copyUrl(item.url); }}
                                >
                                  <LinkIcon size={12} /> Copy URL
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingId(item.id);
                                setRenameValue(item.name);
                              }}
                            >
                              <Pencil size={12} /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="rounded-lg py-2 cursor-pointer gap-2 font-bold text-[11px] text-rose-500"
                              onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                            >
                              <Trash2 size={12} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="px-1 space-y-1">
                      <p className={cn("text-[12px] font-black truncate", text)}>{item.name}</p>
                      <div className="flex items-center justify-between gap-1">
                        <Badge variant="outline" className="h-4 px-1.5 rounded-md border-primary/20 bg-primary/5 text-primary text-[8px] font-black uppercase tracking-tight">
                          {item.media_type}
                        </Badge>
                        <span className={cn("text-[10px] font-bold opacity-40", sub)}>{item.size}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <Table>
                  <TableHeader>
                    <TableRow className={cn("border-b hover:bg-transparent", softBorder)}>
                      <TableHead className={cn("py-4 px-6 text-[10px] font-black uppercase tracking-widest", sub)}>Name</TableHead>
                      <TableHead className={cn("py-4 px-6 text-[10px] font-black uppercase tracking-widest", sub)}>Type</TableHead>
                      <TableHead className={cn("py-4 px-6 text-[10px] font-black uppercase tracking-widest", sub)}>Size</TableHead>
                      <TableHead className={cn("py-4 px-6 text-[10px] font-black uppercase tracking-widest text-right", sub)}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMedia.map((item: any) => (
                      <TableRow
                        key={item.id}
                        className={cn("group border-b last:border-0 transition-colors cursor-pointer", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/60")}
                        onClick={() => { if (item.type === "folder") setParentId(item.id); }}
                      >
                        <TableCell className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", dark ? "bg-slate-900/60" : "bg-white")}>
                              {getIcon(item.type, "w-4 h-4")}
                            </div>
                            <span className={cn("text-[12px] font-black truncate", text)}>{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-6">
                          <Badge variant="outline" className="h-5 px-2 rounded-md border-primary/20 bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest">
                            {item.media_type}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("py-3 px-6 text-[11px] font-bold opacity-60", sub)}>{item.size}</TableCell>
                        <TableCell className="py-3 px-6 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.type !== "folder" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const link = document.createElement("a");
                                  link.href = item.url;
                                  link.download = item.name;
                                  link.click();
                                }}
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-primary/10 text-slate-400 hover:text-primary" : "hover:bg-primary/10 text-slate-500 hover:text-primary")}
                              >
                                <Download size={12} />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setRenamingId(item.id); setRenameValue(item.name); }}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-primary/10 text-slate-400 hover:text-primary" : "hover:bg-primary/10 text-slate-500 hover:text-primary")}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-rose-500/10 text-slate-400 hover:text-rose-500" : "hover:bg-rose-500/10 text-slate-500 hover:text-rose-500")}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <AlertDialog open={renamingId !== null} onOpenChange={(open) => !open && setRenamingId(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Pencil size={16} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Rename File</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>Update the file name</p>
              </div>
            </div>
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className={inputCls}
            />
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (renamingId && renameValue.trim()) renameMutation.mutate({ id: renamingId, newName: renameValue.trim() });
                  setRenamingId(null);
                }}
                className={primaryBtn}
              >
                Save
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Delete File?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  This action cannot be undone. The file will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Dialog */}
      <AlertDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-lg overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud size={16} />
                </div>
                <div>
                  <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Upload Files</h2>
                  <p className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>Drag and drop or browse</p>
                </div>
              </div>
              <button
                onClick={() => setUploadDialogOpen(false)}
                className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", dark ? "hover:bg-slate-900 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
              >
                <X size={14} />
              </button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
              className={cn(
                "border-2 border-dashed rounded-[1.5rem] p-10 transition-all flex flex-col items-center text-center gap-3 relative cursor-pointer",
                isDragging
                  ? "bg-primary/10 border-primary"
                  : cn(softBg, "border-slate-300 dark:border-slate-700 hover:border-primary/50")
              )}
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Upload size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p className={cn("text-[12px] font-black uppercase tracking-widest", text)}>Drop files here</p>
                <p className={cn("text-[11px] font-medium opacity-60 mt-1", sub)}>
                  or <span className="text-primary font-black">browse</span> to choose files
                </p>
              </div>
              <input
                type="file"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                Maximum file size: <span className="font-black">25 MB</span> per file.
              </p>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Preview Lightbox ── */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent
          className={cn(
            "p-0 overflow-hidden rounded-[1.5rem] border max-w-2xl gap-0 [&>button]:hidden",
            dark ? "bg-[#0f1829] border-slate-800" : "bg-white border-slate-200"
          )}
        >
          {/* Header */}
          <div className={cn("flex items-center justify-between px-5 py-3 border-b", softBorder)}>
            <p className={cn("text-[13px] font-black truncate pr-4", text)}>{previewItem?.name}</p>
            <button
              onClick={() => setPreviewItem(null)}
              className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Image / preview body */}
          <div className={cn("relative flex items-center justify-center p-6 min-h-[340px]", dark ? "bg-slate-950/40" : "bg-slate-50/60")}>
            {/* Prev */}
            <button
              onClick={() => navigatePreview(-1)}
              className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110", dark ? "bg-slate-800 text-slate-200" : "bg-white text-slate-600")}
              title="Previous"
            >
              <ChevronLeft size={18} />
            </button>

            {previewItem?.media_type === "IMAGE" ? (
              <img
                src={resolveMediaUrl(previewItem?.url)}
                alt={previewItem?.name}
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden"); }}
              />
            ) : previewItem?.media_type === "VIDEO" ? (
              <video src={resolveMediaUrl(previewItem?.url)} controls className="max-h-[60vh] max-w-full rounded-lg" />
            ) : previewItem?.media_type === "AUDIO" ? (
              <audio src={resolveMediaUrl(previewItem?.url)} controls className="w-full" />
            ) : (
              <div className="flex flex-col items-center gap-4">
                {getIcon(previewItem?.media_type || "FILE", "w-16 h-16")}
                <a href={resolveMediaUrl(previewItem?.url)} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
                  Open file
                </a>
              </div>
            )}
            {previewItem?.media_type === "IMAGE" && (
              <div className="hidden flex-col items-center gap-2 text-center">
                {getIcon("IMAGE", "w-16 h-16")}
                <p className={cn("text-[12px] font-bold", sub)}>Preview unavailable — file not found on this server.</p>
              </div>
            )}

            {/* Next */}
            <button
              onClick={() => navigatePreview(1)}
              className={cn("absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110", dark ? "bg-slate-800 text-slate-200" : "bg-white text-slate-600")}
              title="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Footer */}
          <div className={cn("flex items-center justify-between px-5 py-3 border-t text-[11px] font-bold", softBorder, sub)}>
            <span>Size: {previewItem?.size}</span>
            {previewItem?.added && <span>Added on: {formatAddedDate(previewItem.added)}</span>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

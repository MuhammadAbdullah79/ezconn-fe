import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Edit2,
  Trash2,
  Copy,
  Database,
  ChevronDown,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  ArrowDownAZ,
  ArrowUpAZ,
  Filter,
  X,
  Folder,
  FolderTree,
  FolderInput,
  Pencil,
  ListChecks,
  CircleDot,
  PenLine,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

// Toggle ON when backend exposes /api/custom-fields/folder/* endpoints
const FOLDERS_ENABLED = true;

const CONTENT_TYPE_OPTIONS = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Phone" },
  { value: "DATE", label: "Date" },
  { value: "DATETIME", label: "Datetime" },
  { value: "URL", label: "URL" },
  { value: "COUNTRY", label: "Country" },
  { value: "CURRENCY", label: "Currency" },
  { value: "JSON", label: "JSON" },
];

const formatInputType = (input: string | undefined | null) => {
  if (!input) return "";
  if (input === "select") return "Single Choice";
  if (input === "multiselect") return "Multi Choice";
  return input.charAt(0).toUpperCase() + input.slice(1);
};

export default function CustomFieldsSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isCreateFieldOpen, setIsCreateFieldOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<any>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    systemName: "",
    description: "",
    dataType: "",
    inputType: "text" as "text" | "select" | "multiselect",
    minLength: "",
    maxLength: "",
    options: [""] as string[],
  });

  const [optionsTab, setOptionsTab] = useState<"create" | "upload">("create");
  const [pasteContent, setPasteContent] = useState("");
  const [pasteDelimiter, setPasteDelimiter] = useState<"" | "comma" | "newline" | "semicolon" | "colon" | "equal">("");

  const delimMap: Record<string, string> = {
    comma: ",",
    newline: "\n",
    semicolon: ";",
    colon: ":",
    equal: "=",
  };

  const handleDelimiterChange = (delim: string) => {
    setPasteDelimiter(delim as any);
    if (!delim || !pasteContent.trim()) return;
    const sep = delimMap[delim];
    const parsed = pasteContent
      .split(sep)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parsed.length) return;
    setFormData({ ...formData, options: parsed });
    setPasteContent("");
    setPasteDelimiter("");
    setOptionsTab("create");
    toast({ title: "Imported", description: `${parsed.length} options added.` });
  };

  const [contentTypeFilter, setContentTypeFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [contentTypeOpen, setContentTypeOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteRandomCode, setDeleteRandomCode] = useState("");

  // Folder state
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<"root" | "all" | { id: any; name: string }>("root");
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderForm, setFolderForm] = useState<{ id: any; name: string }>({ id: null, name: "" });
  const [folderToDelete, setFolderToDelete] = useState<{ id: any; name: string } | null>(null);
  const [changeFolderOpen, setChangeFolderOpen] = useState(false);
  const [changeFolderField, setChangeFolderField] = useState<any>(null);
  const [changeFolderTargetId, setChangeFolderTargetId] = useState<any>(null);

  // Edit field state
  const [editingField, setEditingField] = useState<any>(null);

  useEffect(() => {
    if (fieldToDelete) {
      setDeleteRandomCode(String(Math.floor(Math.random() * 90000) + 10000));
      setDeleteConfirmText("");
    }
  }, [fieldToDelete]);

  const handleCopy = async (val: string) => {
    if (!val) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(val);
      } else {
        const ta = document.createElement("textarea");
        ta.value = val;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({ title: "Copied", description: "Field ID copied." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  // ── Design tokens ─────────────────────────────────────────
  const card       = dark ? "bg-[#0f1829]"    : "bg-white";
  const border     = dark ? "border-slate-800" : "border-slate-200";
  const text       = dark ? "text-white"      : "text-slate-900";
  const sub        = dark ? "text-slate-500"  : "text-slate-400";
  const softBg     = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const selectCls = cn(
    inputCls,
    "appearance-none cursor-pointer pr-10 bg-no-repeat",
    dark
      ? "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]"
      : "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
    "[background-position:right_1rem_center]"
  );

  const textareaCls = cn(
    "w-full rounded-xl text-[13px] font-medium transition-all px-4 py-3 border outline-none resize-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
  );

  const outlineBtn = cn(
    "h-11 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
    dark ? "border-slate-800 text-slate-300 hover:border-primary/40 hover:text-primary" : "border-slate-200 text-slate-700 hover:border-primary/40 hover:text-primary"
  );

  const primaryOutlineBtn = cn(
    "h-10 px-6 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
    "border-primary text-primary hover:bg-primary hover:text-white"
  );

  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center gap-2";

  const labelCls = cn("block text-[10px] font-black uppercase tracking-widest", sub);

  const { data, isLoading } = useQuery<{ fields: any[]; folders: any[] }>({
    queryKey: ["/api/custom-fields"],
  });

  const fields = data?.fields || [];
  const folders: any[] = data?.folders || [];

  const displayedFields = useMemo(() => {
    let list = [...fields];
    if (contentTypeFilter) {
      list = list.filter((f: any) => f.content_type === contentTypeFilter);
    }
    if (selectedFolder !== "all") {
      if (selectedFolder === "root") {
        list = list.filter((f: any) => !f.folder_id);
      } else {
        list = list.filter((f: any) => f.folder_id === (selectedFolder as any).id);
      }
    }
    list.sort((a: any, b: any) => {
      const cmp = String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base" });
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [fields, contentTypeFilter, sortOrder, selectedFolder]);

  const folderLabel =
    selectedFolder === "root"
      ? "Root"
      : selectedFolder === "all"
        ? "All"
        : (selectedFolder as any).name;

  const contentTypeFilterLabel =
    CONTENT_TYPE_OPTIONS.find((o) => o.value === contentTypeFilter)?.label || "Content Type";

  const createMutation = useMutation({
    mutationFn: async (newField: any) => {
      const res = await apiRequest("POST", "/api/custom-fields/field", newField);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Success", description: "Custom field created successfully" });
      closeFieldModal();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      await apiRequest("DELETE", `/api/custom-fields/field/${slug}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Success", description: "Custom field deleted successfully" });
      setFieldToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (payload: { slug: string; body: any }) => {
      const res = await apiRequest("PUT", `/api/custom-fields/field/${payload.slug}`, payload.body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Updated", description: "Custom field updated successfully" });
      setEditingField(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const folderSaveMutation = useMutation({
    mutationFn: async (body: { id: any; name: string }) => {
      const res = await apiRequest("POST", "/api/custom-fields/folder/create", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Saved", description: "Folder saved." });
      setFolderModalOpen(false);
      setFolderForm({ id: null, name: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const folderDeleteMutation = useMutation({
    mutationFn: async (id: any) => {
      await apiRequest("DELETE", `/api/custom-fields/folder/delete/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Deleted", description: "Folder removed." });
      if (typeof selectedFolder === "object" && folderToDelete && (selectedFolder as any).id === folderToDelete.id) {
        setSelectedFolder("root");
      }
      setFolderToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const changeFolderMutation = useMutation({
    mutationFn: async (body: { tag_id: any; folder_id: any }) => {
      const res = await apiRequest("POST", "/api/custom-fields/folder/change", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({ title: "Moved", description: "Field moved to folder." });
      setChangeFolderOpen(false);
      setChangeFolderField(null);
      setChangeFolderTargetId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedRows(new Set(fields.map((f) => f.id)));
    else setSelectedRows(new Set());
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedRows);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedRows(next);
  };

  const buildValidation = () => {
    const ct = formData.dataType.toUpperCase();
    if (["TEXT", "NUMBER"].includes(ct) && formData.inputType === "text") {
      const v: any = {};
      if (formData.minLength !== "") v.min_length = Number(formData.minLength);
      if (formData.maxLength !== "") v.max_length = Number(formData.maxLength);
      return Object.keys(v).length ? v : undefined;
    }
    return undefined;
  };

  const buildProperties = () => {
    if (formData.inputType !== "select" && formData.inputType !== "multiselect") return undefined;
    const cleaned = formData.options.map((s) => s.trim()).filter(Boolean);
    if (!cleaned.length) return undefined;
    return cleaned.map((name) => ({ name, value: name }));
  };

  const handleCreateField = () => {
    if (!formData.displayName.trim() || !formData.dataType) return;
    const validation = buildValidation();
    const properties = buildProperties();
    if (editingField) {
      editMutation.mutate({
        slug: editingField.slug,
        body: {
          label: formData.displayName,
          description: formData.description,
          content_type: formData.dataType.toUpperCase(),
          input_type: formData.inputType,
          ...(validation ? { validation } : {}),
          ...(properties ? { properties } : {}),
        },
      });
    } else {
      if (!formData.systemName.trim()) return;
      createMutation.mutate({
        label: formData.displayName,
        system_name: formData.systemName,
        description: formData.description,
        content_type: formData.dataType.toUpperCase(),
        input_type: formData.inputType,
        creating_for: "CONTACT",
        ...(validation ? { validation } : {}),
        ...(properties ? { properties } : {}),
      });
    }
  };

  const closeFieldModal = () => {
    setIsCreateFieldOpen(false);
    setEditingField(null);
    setFormData({
      displayName: "",
      systemName: "",
      description: "",
      dataType: "",
      inputType: "text",
      minLength: "",
      maxLength: "",
      options: [""],
    });
    setOptionsTab("create");
    setPasteContent("");
    setPasteDelimiter("");
  };

  const isAllSelected = selectedRows.size === fields.length && fields.length > 0;

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>Custom Fields</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Manage custom fields and link them to Contacts, Companies, or Opportunities.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setIsCreateFieldOpen(true)} className={primaryOutlineBtn}>
                <Plus size={12} /> Add New
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
              {/* Toolbar */}
              <div className={cn("px-6 py-4 border-b flex items-center justify-between gap-4", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                <div className="flex items-center gap-2">
                  {FOLDERS_ENABLED ? (
                  <Popover open={folderDropdownOpen} onOpenChange={setFolderDropdownOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded-md transition-colors text-[10px] font-black uppercase tracking-widest",
                          dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-700",
                        )}
                      >
                        <FolderTree size={12} className="opacity-70" />
                        <span>{folderLabel}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <ChevronDown size={11} className="opacity-60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className={cn("w-64 p-0 rounded-xl border shadow-2xl", card, border)}>
                      <Command className="bg-transparent">
                        <CommandInput placeholder="Search folder..." className="text-[11px] font-bold" />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty className="text-[11px] font-bold py-4 text-center opacity-60">
                            No folder
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="root"
                              onSelect={() => {
                                setSelectedFolder("root");
                                setFolderDropdownOpen(false);
                              }}
                              className="text-[11px] font-bold cursor-pointer flex items-center justify-between"
                            >
                              <span>Root folder</span>
                              {selectedFolder === "root" && <Check size={13} className="text-primary" />}
                            </CommandItem>
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                setSelectedFolder("all");
                                setFolderDropdownOpen(false);
                              }}
                              className="text-[11px] font-bold cursor-pointer flex items-center justify-between"
                            >
                              <span>All folders</span>
                              {selectedFolder === "all" && <Check size={13} className="text-primary" />}
                            </CommandItem>
                          </CommandGroup>
                          {folders.length > 0 && (
                            <CommandGroup heading="Folders">
                              {folders.map((f: any) => {
                                const active = typeof selectedFolder === "object" && (selectedFolder as any).id === f.id;
                                return (
                                  <CommandItem
                                    key={f.id}
                                    value={f.name}
                                    onSelect={() => {
                                      setSelectedFolder({ id: f.id, name: f.name });
                                      setFolderDropdownOpen(false);
                                    }}
                                    className="text-[11px] font-bold cursor-pointer flex items-center justify-between gap-2"
                                  >
                                    <span className="flex items-center gap-2 truncate flex-1">
                                      <Folder size={12} className="opacity-70 shrink-0" />
                                      <span className="truncate">{f.name}</span>
                                      {active && <Check size={13} className="text-primary shrink-0" />}
                                    </span>
                                    <span className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFolderForm({ id: f.id, name: f.name });
                                          setFolderModalOpen(true);
                                          setFolderDropdownOpen(false);
                                        }}
                                        className={cn("w-6 h-6 rounded-md flex items-center justify-center", dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
                                        title="Rename"
                                      >
                                        <Pencil size={10} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFolderToDelete({ id: f.id, name: f.name });
                                          setFolderDropdownOpen(false);
                                        }}
                                        className={cn("w-6 h-6 rounded-md flex items-center justify-center", dark ? "hover:bg-rose-500/10 text-rose-400" : "hover:bg-rose-50 text-rose-500")}
                                        title="Delete"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  ) : (
                    <span className={cn("flex items-center gap-2 px-2 py-1 text-[10px] font-black uppercase tracking-widest", sub)}>
                      <FolderTree size={12} className="opacity-70" />
                      Root
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                  )}
                  {FOLDERS_ENABLED && (
                    <button
                      onClick={() => {
                        setFolderForm({ id: null, name: "" });
                        setFolderModalOpen(true);
                      }}
                      className={cn("ml-1 w-7 h-7 rounded-md flex items-center justify-center transition-colors", dark ? "hover:bg-slate-800 text-slate-400 hover:text-primary" : "hover:bg-slate-100 text-slate-500 hover:text-primary")}
                      title="Add new folder"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", sub)}>
                    {fields.length} of 50
                  </span>

                  {/* Content Type filter */}
                  <Popover open={contentTypeOpen} onOpenChange={setContentTypeOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors",
                          softBorder,
                          contentTypeFilter
                            ? "border-primary/40 text-primary"
                            : dark
                              ? "hover:border-primary/40 text-slate-400 hover:text-primary"
                              : "hover:border-primary/40 text-slate-500 hover:text-primary",
                        )}
                      >
                        <Filter size={11} />
                        {contentTypeFilterLabel}
                        {contentTypeFilter && (
                          <X
                            size={11}
                            className="opacity-70 hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setContentTypeFilter(null);
                            }}
                          />
                        )}
                        <ChevronDown size={12} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className={cn("w-56 p-0 rounded-xl border shadow-2xl", card, border)}>
                      <Command className="bg-transparent">
                        <CommandInput placeholder="Filter..." className="text-[11px] font-bold" />
                        <CommandList className="max-h-[260px]">
                          <CommandEmpty className="text-[11px] font-bold py-4 text-center opacity-60">
                            None
                          </CommandEmpty>
                          <CommandGroup heading="Content Type">
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                setContentTypeFilter(null);
                                setContentTypeOpen(false);
                              }}
                              className="text-[11px] font-bold cursor-pointer flex items-center justify-between"
                            >
                              <span>All</span>
                              {!contentTypeFilter && <Check size={13} className="text-primary" />}
                            </CommandItem>
                            {CONTENT_TYPE_OPTIONS.map((opt) => (
                              <CommandItem
                                key={opt.value}
                                value={opt.label}
                                onSelect={() => {
                                  setContentTypeFilter(opt.value);
                                  setContentTypeOpen(false);
                                }}
                                className="text-[11px] font-bold cursor-pointer flex items-center justify-between"
                              >
                                <span>{opt.label}</span>
                                {contentTypeFilter === opt.value && <Check size={13} className="text-primary" />}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Sort order */}
                  <Popover open={sortOpen} onOpenChange={setSortOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors",
                          softBorder,
                          dark ? "hover:border-primary/40 text-slate-400 hover:text-primary" : "hover:border-primary/40 text-slate-500 hover:text-primary",
                        )}
                      >
                        {sortOrder === "asc" ? <ArrowDownAZ size={11} /> : <ArrowUpAZ size={11} />}
                        {sortOrder === "asc" ? "Ascending" : "Descending"}
                        <ChevronDown size={12} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className={cn("w-44 p-0 rounded-xl border shadow-2xl", card, border)}>
                      <Command className="bg-transparent">
                        <CommandList>
                          <CommandGroup heading="Order">
                            <CommandItem
                              value="asc"
                              onSelect={() => {
                                setSortOrder("asc");
                                setSortOpen(false);
                              }}
                              className="text-[11px] font-bold cursor-pointer flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2"><ArrowDownAZ size={12} /> Ascending</span>
                              {sortOrder === "asc" && <Check size={13} className="text-primary" />}
                            </CommandItem>
                            <CommandItem
                              value="desc"
                              onSelect={() => {
                                setSortOrder("desc");
                                setSortOpen(false);
                              }}
                              className="text-[11px] font-bold cursor-pointer flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2"><ArrowUpAZ size={12} /> Descending</span>
                              {sortOrder === "desc" && <Check size={13} className="text-primary" />}
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                      <th className="px-6 py-4 text-left w-10">
                        <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="rounded accent-[hsl(var(--primary))]" />
                      </th>
                      <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Name</th>
                      <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>ID</th>
                      <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Content Type</th>
                      <th className={cn("px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest", sub)}>Data Format</th>
                      <th className={cn("px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest", sub)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                        </td>
                      </tr>
                    ) : displayedFields.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                              <Database className="w-7 h-7 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <h3 className={cn("text-[13px] font-black", text)}>
                                {fields.length === 0 ? "No custom fields yet" : "No matches found"}
                              </h3>
                              <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                                {fields.length === 0
                                  ? "Create your first custom field to get started."
                                  : "Try adjusting the filter."}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedFields.map((field: any) => (
                        <tr
                          key={field.id}
                          className={cn("border-b transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(field.id.toString())}
                              onChange={(e) => handleSelectRow(field.id.toString(), e.target.checked)}
                              className="rounded accent-[hsl(var(--primary))]"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[13px] font-black text-primary">{field.label}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <code className={cn("text-[11px] font-bold", sub)}>{field.slug}</code>
                              <button
                                onClick={() => handleCopy(field.slug)}
                                className={cn("w-6 h-6 rounded-md flex items-center justify-center transition-colors", dark ? "hover:bg-slate-800 text-slate-500 hover:text-primary" : "hover:bg-slate-100 text-slate-400 hover:text-primary")}
                                title="Copy ID"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          </td>
                          <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>{field.content_type}</td>
                          <td className={cn("px-6 py-4 text-[12px] font-bold", sub)}>{formatInputType(field.input_type)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {FOLDERS_ENABLED && (
                                <button
                                  onClick={() => {
                                    setChangeFolderField(field);
                                    setChangeFolderTargetId(field.folder_id ?? null);
                                    setChangeFolderOpen(true);
                                  }}
                                  className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                  title="Move to folder"
                                >
                                  <FolderInput size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingField(field);
                                  const v = field.validation || {};
                                  const it = (field.input_type === "select" || field.input_type === "multiselect") ? field.input_type : "text";
                                  const props = Array.isArray(field.properties) ? field.properties : [];
                                  const opts = props.length > 0 ? props.map((p: any) => p?.name || p?.value || "") : [""];
                                  setFormData({
                                    displayName: field.label || "",
                                    systemName: field.slug || "",
                                    description: field.description || "",
                                    dataType: (field.content_type || "").toLowerCase(),
                                    inputType: it,
                                    minLength: v.min_length != null ? String(v.min_length) : "",
                                    maxLength: v.max_length != null ? String(v.max_length) : "",
                                    options: opts,
                                  });
                                  setIsCreateFieldOpen(true);
                                }}
                                className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}
                                title="Edit"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setFieldToDelete(field)}
                                className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-rose-500/40 hover:text-rose-500 text-slate-400" : "border-slate-200 hover:border-rose-500/40 hover:text-rose-500 text-slate-500")}
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className={cn("px-6 py-3 border-t text-[10px] font-black uppercase tracking-widest", softBorder, sub, dark ? "bg-slate-900/40" : "bg-white/60")}>
                Showing {displayedFields.length} of {fields.length} custom fields
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Create / Edit Field Modal ── */}
      <Dialog open={isCreateFieldOpen} onOpenChange={(o) => { if (!o) closeFieldModal(); else setIsCreateFieldOpen(true); }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-lg max-h-[90vh] overflow-y-auto", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Database size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[13px] font-black uppercase tracking-widest", text)}>
                    {editingField ? "Edit Custom Field" : "Create Custom Field"}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {editingField ? "Update this field's details." : "Define a new field to collect data."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={labelCls}>Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className={inputCls}
                  placeholder="Enter display name"
                  maxLength={60}
                />
              </div>

              {!editingField && (
                <div className="space-y-2">
                  <label className={labelCls}>System Name</label>
                  <input
                    type="text"
                    value={formData.systemName}
                    onChange={(e) => setFormData({ ...formData, systemName: e.target.value })}
                    className={inputCls}
                    placeholder="Enter system name"
                    maxLength={250}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className={labelCls}>Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={textareaCls}
                  placeholder="Enter description"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label className={labelCls}>What type of data you want to collect?</label>
                <select
                  value={formData.dataType}
                  onChange={(e) => setFormData({ ...formData, dataType: e.target.value })}
                  className={cn(selectCls, editingField && "opacity-60 cursor-not-allowed")}
                  disabled={!!editingField}
                >
                  <option value="">Select data type</option>
                  <option value="text">Text</option>
                  <option value="number">Numbers</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Phone</option>
                  <option value="date">Date</option>
                  <option value="datetime">Datetime</option>
                  <option value="url">URL</option>
                  <option value="country">Country</option>
                  <option value="currency">Currency</option>
                  <option value="json">JSON</option>
                </select>
              </div>

              {/* How to present? */}
              {formData.dataType && (
                <div className="space-y-2">
                  <label className={labelCls}>How to present a custom field?</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "multiselect", label: "Choice (Multiple)", Icon: ListChecks },
                      { id: "select", label: "Choice (single)", Icon: CircleDot },
                      { id: "text", label: "Single line", Icon: PenLine },
                    ].map((opt) => {
                      const active = formData.inputType === (opt.id as any);
                      const IconComp = opt.Icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, inputType: opt.id as any })}
                          className={cn(
                            "relative p-4 rounded-xl border text-[11px] font-bold transition-all text-center flex flex-col items-center gap-2",
                            active
                              ? "border-primary/60 bg-primary/10 text-primary shadow-sm"
                              : dark
                                ? "border-slate-800 hover:border-primary/40 text-slate-400"
                                : "border-slate-200 hover:border-primary/40 text-slate-600",
                          )}
                        >
                          {active && (
                            <span className="absolute top-1.5 right-1.5">
                              <Check size={12} />
                            </span>
                          )}
                          <span
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center border",
                              active
                                ? "border-primary/40 bg-white/60 dark:bg-slate-950/40 text-primary"
                                : dark
                                  ? "border-slate-700 text-slate-400"
                                  : "border-slate-200 text-slate-500",
                            )}
                          >
                            <IconComp size={18} />
                          </span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* List options — for Choice (single) / Choice (Multiple) */}
              {(formData.inputType === "select" || formData.inputType === "multiselect") && (
                <div className="space-y-3">
                  {/* Tabs */}
                  <div className={cn("flex items-center gap-6 border-b", softBorder)}>
                    {[
                      { id: "create", label: "Create or select options" },
                      { id: "upload", label: "Upload or Copy" },
                    ].map((t) => {
                      const active = optionsTab === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setOptionsTab(t.id as any)}
                          className={cn(
                            "relative pb-2 text-[11px] font-black uppercase tracking-widest transition-colors",
                            active
                              ? "text-primary"
                              : dark
                                ? "text-slate-500 hover:text-slate-300"
                                : "text-slate-500 hover:text-slate-700",
                          )}
                        >
                          {t.label}
                          {active && (
                            <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-primary rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {optionsTab === "create" ? (
                    <div className="space-y-2">
                      {formData.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const next = [...formData.options];
                              next[idx] = e.target.value;
                              setFormData({ ...formData, options: next });
                            }}
                            className={inputCls}
                            placeholder="Enter the text"
                            maxLength={120}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = formData.options.filter((_, i) => i !== idx);
                              setFormData({ ...formData, options: next.length ? next : [""] });
                            }}
                            className={cn(
                              "w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-colors",
                              dark ? "hover:bg-slate-800 text-slate-500 hover:text-rose-400" : "hover:bg-slate-100 text-slate-400 hover:text-rose-500",
                            )}
                            title="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, options: [...formData.options, ""] })}
                        className="text-[11px] font-black uppercase tracking-widest text-primary hover:opacity-80 flex items-center gap-1.5 mt-1"
                      >
                        <Plus size={12} /> Add another option
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className={cn("text-[11px] font-medium opacity-70 leading-relaxed", sub)}>
                        Copy existing table data from a spreadsheet (like an Excel or Google Sheets) and paste it in the field below.
                      </p>
                      <textarea
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                        className={textareaCls}
                        placeholder="Paste here"
                        rows={5}
                      />
                      <select
                        value={pasteDelimiter}
                        onChange={(e) => handleDelimiterChange(e.target.value)}
                        className={selectCls}
                      >
                        <option value="">Select delimiter</option>
                        <option value="comma">Comma</option>
                        <option value="newline">New line</option>
                        <option value="semicolon">Semicolon</option>
                        <option value="colon">Colon</option>
                        <option value="equal">Equal Sign</option>
                      </select>
                      {!pasteContent.trim() && pasteDelimiter && (
                        <p className={cn("text-[10px] font-bold opacity-60", sub)}>
                          Paste content first, then choose a delimiter.
                        </p>
                      )}
                      {formData.options.filter((o) => o.trim()).length > 0 && (
                        <p className={cn("text-[10px] font-bold opacity-60", sub)}>
                          {formData.options.filter((o) => o.trim()).length} option(s) currently added.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Validations — shown when Single line input is selected (matches Byte) */}
              {formData.inputType === "text" && formData.dataType && (
                <div className="space-y-2">
                  <label className={labelCls}>Validations</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className={cn("text-[10px] font-bold opacity-60", sub)}>
                        {formData.dataType === "number" ? "Minimum number" : "Minimum length"}
                      </span>
                      <input
                        type="number"
                        value={formData.minLength}
                        onChange={(e) => setFormData({ ...formData, minLength: e.target.value })}
                        className={inputCls}
                        placeholder={formData.dataType === "number" ? "Min" : "Min length"}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className={cn("text-[10px] font-bold opacity-60", sub)}>
                        {formData.dataType === "number" ? "Maximum number" : "Maximum length"}
                      </span>
                      <input
                        type="number"
                        value={formData.maxLength}
                        onChange={(e) => setFormData({ ...formData, maxLength: e.target.value })}
                        className={inputCls}
                        placeholder={formData.dataType === "number" ? "Max" : "Max length"}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={closeFieldModal} className={outlineBtn}>
                Cancel
              </button>
              <button
                onClick={handleCreateField}
                disabled={
                  !formData.displayName.trim() ||
                  (!editingField && !formData.systemName.trim()) ||
                  !formData.dataType ||
                  createMutation.isPending ||
                  editMutation.isPending
                }
                className={primaryBtn}
              >
                {(createMutation.isPending || editMutation.isPending) && <Loader2 size={12} className="animate-spin" />}
                {editingField ? <><Pencil size={12} /> Update</> : <><Plus size={12} /> Add</>}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Folder Create / Rename Modal ── */}
      <Dialog open={folderModalOpen} onOpenChange={(o) => { setFolderModalOpen(o); if (!o) setFolderForm({ id: null, name: "" }); }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <FolderTree size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[13px] font-black uppercase tracking-widest", text)}>
                    {folderForm.id ? "Rename Folder" : "Create New Folder"}
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    {folderForm.id ? "Update the folder name." : "Group custom fields into folders."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Folder Name</label>
              <input
                type="text"
                value={folderForm.name}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                className={inputCls}
                placeholder="e.g. Onboarding"
                maxLength={60}
                autoFocus
              />
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button
                onClick={() => { setFolderModalOpen(false); setFolderForm({ id: null, name: "" }); }}
                className={outlineBtn}
              >
                Cancel
              </button>
              <button
                onClick={() => folderSaveMutation.mutate(folderForm)}
                disabled={!folderForm.name.trim() || folderSaveMutation.isPending}
                className={primaryBtn}
              >
                {folderSaveMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Folder Delete Confirm ── */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(o) => !o && setFolderToDelete(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Delete Folder?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{folderToDelete?.name}</span> will be removed. Fields inside will move to Root.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={folderDeleteMutation.isPending}
                onClick={() => folderDeleteMutation.mutate(folderToDelete!.id)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                {folderDeleteMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                <Trash2 size={12} /> Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Change Folder Modal ── */}
      <Dialog open={changeFolderOpen} onOpenChange={(o) => { setChangeFolderOpen(o); if (!o) { setChangeFolderField(null); setChangeFolderTargetId(null); } }}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <FolderInput size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[13px] font-black uppercase tracking-widest", text)}>
                    Move to Folder
                  </DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Assign <span className="text-primary font-black">{changeFolderField?.label}</span> to a folder.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Folder</label>
              <select
                value={changeFolderTargetId ?? ""}
                onChange={(e) => setChangeFolderTargetId(e.target.value === "" ? null : e.target.value)}
                className={selectCls}
              >
                <option value="">Root folder</option>
                {folders.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button
                onClick={() => { setChangeFolderOpen(false); setChangeFolderField(null); setChangeFolderTargetId(null); }}
                className={outlineBtn}
              >
                Cancel
              </button>
              <button
                onClick={() => changeFolderMutation.mutate({ tag_id: changeFolderField?.id, folder_id: changeFolderTargetId })}
                disabled={changeFolderMutation.isPending}
                className={primaryBtn}
              >
                {changeFolderMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!fieldToDelete} onOpenChange={(open) => !open && setFieldToDelete(null)}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Delete Field?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{fieldToDelete?.label || "This field"}</span> will be permanently removed.
                </p>
              </div>
            </div>

            <ul className={cn("list-disc pl-5 text-[11px] font-medium space-y-1 opacity-70", sub)}>
              <li>The field and its data on every Contact/Company/Opportunity will be lost.</li>
              <li>Automations and Smart Flows referencing this field may stop working.</li>
              <li>This action cannot be undone.</li>
            </ul>

            <div className="space-y-2">
              <label className={labelCls}>
                Type <span className="text-rose-500 font-black">{deleteRandomCode}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={inputCls}
                placeholder="Enter code"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteConfirmText !== deleteRandomCode || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(fieldToDelete.slug)}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                <Trash2 size={12} /> Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

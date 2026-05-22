import { useState } from "react";
import {
  Bot,
  Plus,
  Trash2,
  Edit2,
  MoreVertical,
  ChevronLeft,
  Smile,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface Message {
  id: string;
  title: string;
  type: "text" | "media";
  content: string;
}

interface Collection {
  id: string;
  name: string;
  visibility: "private" | "public" | "specific";
  messages: Message[];
}

const initialCollections: Collection[] = [
  { id: "1", name: "CaioTest", visibility: "public", messages: [{ id: "m1", title: "Caio", type: "text", content: "" }] },
  { id: "2", name: "Collection 2 by usman", visibility: "public", messages: [] },
  { id: "3", name: "Another collection for public.", visibility: "public", messages: [] },
  { id: "4", name: "public collection by john doe", visibility: "public", messages: [] },
  { id: "5", name: "Teste Tiago", visibility: "public", messages: [] },
  { id: "6", name: "Makar", visibility: "public", messages: [] },
];

export default function QuickRepliesSection() {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();

  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [view, setView] = useState<"list" | "create_collection" | "collection_detail" | "create_message">("list");

  const [collectionName, setCollectionName] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public" | "specific">("private");
  const [showError, setShowError] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentCollection, setCurrentCollection] = useState<Collection | null>(null);

  const [messageTitle, setMessageTitle] = useState("");
  const [messageType, setMessageType] = useState<"text" | "media">("text");
  const [messageContent, setMessageContent] = useState("");

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

  const handleCreateCollectionClick = () => {
    setView("create_collection");
    setCollectionName("");
    setVisibility("private");
    setShowError(false);
  };

  const handleCancelCreateCollection = () => {
    setView("list");
    setCollectionName("");
    setVisibility("private");
    setShowError(false);
  };

  const handleCreateCollection = () => {
    if (!collectionName.trim()) {
      setShowError(true);
      return;
    }
    setCollections([...collections, { id: Date.now().toString(), name: collectionName, visibility, messages: [] }]);
    setView("list");
    toast({ title: "Success", description: "Collection created successfully" });
  };

  const handleUpdateCollection = () => {
    if (currentCollection && collectionName.trim()) {
      setCollections(collections.map((c) => (c.id === currentCollection.id ? { ...c, name: collectionName } : c)));
      setCollectionName("");
      setCurrentCollection(null);
      setIsEditModalOpen(false);
      toast({ title: "Success", description: "Collection updated successfully" });
    }
  };

  const handleDeleteCollection = () => {
    if (currentCollection) {
      setCollections(collections.filter((c) => c.id !== currentCollection.id));
      setCurrentCollection(null);
      setIsDeleteModalOpen(false);
      toast({ title: "Success", description: "Collection deleted successfully" });
    }
  };

  const openEditModal = (collection: Collection) => {
    setCurrentCollection(collection);
    setCollectionName(collection.name);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (collection: Collection) => {
    setCurrentCollection(collection);
    setIsDeleteModalOpen(true);
  };

  const openCollectionDetail = (collection: Collection) => {
    setCurrentCollection(collection);
    setView("collection_detail");
  };

  const handleCreateMessageClick = () => {
    setView("create_message");
    setMessageTitle("");
    setMessageType("text");
    setMessageContent("");
  };

  const handleCreateMessage = () => {
    if (currentCollection && messageTitle.trim() && messageContent.trim()) {
      const newMessage: Message = { id: Date.now().toString(), title: messageTitle, type: messageType, content: messageContent };
      const updated = collections.map((c) =>
        c.id === currentCollection.id ? { ...c, messages: [...c.messages, newMessage] } : c
      );
      setCollections(updated);
      setCurrentCollection(updated.find((c) => c.id === currentCollection.id) || null);
      setView("collection_detail");
      toast({ title: "Success", description: "Message created successfully" });
    }
  };

  // Header content per view
  const headerTitle =
    view === "create_collection"
      ? "Create Collection"
      : view === "collection_detail" || view === "create_message"
        ? currentCollection?.name || "Collection"
        : "Quick Replies";

  const RadioRow = ({ value, current, onSelect, label }: { value: string; current: string; onSelect: () => void; label: string }) => (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
        current === value ? "border-primary bg-primary/5" : cn(softBorder, dark ? "bg-slate-900/40 hover:border-primary/40" : "bg-white hover:border-primary/40")
      )}
    >
      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0", current === value ? "border-primary" : sub)}>
        {current === value && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      <span className={cn("text-[12px] font-bold", text)}>{label}</span>
    </div>
  );

  return (
    <>
      <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
        <CardContent className="p-0">
          {/* Header — dynamic per view */}
          <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
            <div className="flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className={cn("text-[15px] font-black tracking-widest uppercase", text)}>{headerTitle}</h1>
                <p className={cn("text-[11px] font-bold mt-0.5 opacity-60 max-w-2xl", sub)}>
                  Create and organize quick replies for live chats with leads or contacts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {view === "list" && (
                <button onClick={handleCreateCollectionClick} className={primaryOutlineBtn}>
                  <Plus size={12} /> Add Collection
                </button>
              )}
              {view === "create_collection" && (
                <button onClick={handleCancelCreateCollection} className={outlineBtn}>
                  <ChevronLeft size={12} /> Back
                </button>
              )}
              {(view === "collection_detail" || view === "create_message") && (
                <>
                  {view === "collection_detail" && (
                    <button onClick={handleCreateMessageClick} className={primaryOutlineBtn}>
                      <Plus size={12} /> Add Message
                    </button>
                  )}
                  <button onClick={() => setView("list")} className={outlineBtn}>
                    <ChevronLeft size={12} /> Collections
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                <div className={cn("px-6 py-4 border-b flex items-center justify-between", softBorder, dark ? "bg-slate-900/40" : "bg-white/60")}>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", sub)}>Collection Name</span>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", sub)}>Action</span>
                </div>
                {collections.length === 0 ? (
                  <div className="py-16 px-8 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-7 h-7 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={cn("text-[13px] font-black", text)}>No collections found</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>Create a new one to get started.</p>
                    </div>
                  </div>
                ) : (
                  collections.map((collection) => (
                    <div
                      key={collection.id}
                      onClick={() => openCollectionDetail(collection)}
                      className={cn("flex items-center justify-between px-6 py-4 border-b last:border-0 cursor-pointer transition-colors group", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot size={14} className="text-primary" />
                        </div>
                        <span className={cn("text-[13px] font-black group-hover:text-primary transition-colors", text)}>
                          {collection.name}
                        </span>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn("w-9 h-9 rounded-lg border flex items-center justify-center transition-all", dark ? "border-slate-800 hover:border-primary/40 hover:text-primary text-slate-400" : "border-slate-200 hover:border-primary/40 hover:text-primary text-slate-500")}>
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className={cn("rounded-xl border p-1.5 w-44", card, border)}>
                            <DropdownMenuItem onClick={() => openEditModal(collection)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer">
                              <Edit2 size={13} /> Edit name
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCollectionDetail(collection)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer">
                              <Bot size={13} /> Open collection
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteModal(collection)} className="rounded-lg text-[12px] font-bold py-2 px-3 flex gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10">
                              <Trash2 size={13} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── CREATE COLLECTION ── */}
          {view === "create_collection" && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="max-w-xl space-y-6">
                  <div className="space-y-2">
                    <label className={labelCls}>Collection Name</label>
                    <input
                      value={collectionName}
                      onChange={(e) => {
                        setCollectionName(e.target.value);
                        if (e.target.value.trim()) setShowError(false);
                      }}
                      placeholder="Enter collection name"
                      className={cn(inputCls, showError && "!border-rose-500 focus:!ring-rose-500/30")}
                    />
                    {showError && <p className="text-[11px] font-bold text-rose-500">Enter collection name.</p>}
                  </div>

                  <div className="space-y-3">
                    <label className={labelCls}>Share this collection with</label>
                    <div className="space-y-2">
                      <RadioRow value="private" current={visibility} onSelect={() => setVisibility("private")} label="Private — Only you can see." />
                      <RadioRow value="public" current={visibility} onSelect={() => setVisibility("public")} label="Public — All agents can see." />
                      <RadioRow value="specific" current={visibility} onSelect={() => setVisibility("specific")} label="Specific — Share with specific agents." />
                    </div>
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={handleCancelCreateCollection} className={outlineBtn}>Cancel</button>
                  <button onClick={handleCreateCollection} className={primaryBtn}>
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── COLLECTION DETAIL ── */}
          {view === "collection_detail" && currentCollection && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border overflow-hidden", softBorder, softBg)}>
                {currentCollection.messages.length === 0 ? (
                  <div className="py-16 px-8 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-7 h-7 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className={cn("text-[13px] font-black", text)}>No messages yet</h3>
                      <p className={cn("text-[11px] font-medium opacity-60", sub)}>
                        Add a canned message to this collection.
                      </p>
                    </div>
                  </div>
                ) : (
                  currentCollection.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn("flex items-center gap-3 px-6 py-4 border-b last:border-0 cursor-pointer transition-colors", softBorder, dark ? "hover:bg-slate-900/40" : "hover:bg-white/80")}
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageSquare size={14} className="text-primary" />
                      </div>
                      <span className={cn("text-[13px] font-black", text)}>{message.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── CREATE MESSAGE ── */}
          {view === "create_message" && currentCollection && (
            <div className="p-8">
              <div className={cn("rounded-[1.5rem] border p-8 space-y-6", softBg, softBorder)}>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className={labelCls}>Message Title</label>
                    <input
                      placeholder="Enter message title"
                      value={messageTitle}
                      onChange={(e) => setMessageTitle(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className={labelCls}>Message Type</label>
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                      <RadioRow value="text" current={messageType} onSelect={() => setMessageType("text")} label="Text message" />
                      <RadioRow value="media" current={messageType} onSelect={() => setMessageType("media")} label="Media message" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelCls}>Response Text</label>
                    <div className="relative">
                      <textarea
                        placeholder="Type message..."
                        rows={6}
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value.slice(0, 2000))}
                        className={cn(textareaCls, "pr-10")}
                      />
                      <button className={cn("absolute bottom-3 right-3 transition-colors", sub, "hover:text-primary")}>
                        <Smile size={18} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <select className={cn(selectCls, "h-9 max-w-[200px] text-[11px]")}>
                        <option value="">Select field</option>
                        <option value="name">Name</option>
                        <option value="email">Email</option>
                      </select>
                      <span className={cn("text-[10px] font-black uppercase tracking-widest text-primary")}>
                        {2000 - messageContent.length} remaining
                      </span>
                    </div>
                  </div>
                </div>

                <div className={cn("flex justify-end gap-2 pt-6 border-t", softBorder)}>
                  <button onClick={() => setView("collection_detail")} className={outlineBtn}>Close</button>
                  <button
                    onClick={handleCreateMessage}
                    disabled={!messageTitle.trim() || !messageContent.trim()}
                    className={primaryBtn}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Collection Modal ── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className={cn("border p-0 overflow-hidden rounded-[2rem] max-w-md", card, border)}>
          <div className="p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Edit2 size={18} />
                </div>
                <div className="text-left">
                  <DialogTitle className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Edit Collection</DialogTitle>
                  <DialogDescription className={cn("text-[11px] font-medium opacity-60 mt-0.5", sub)}>
                    Update the collection name.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <label className={labelCls}>Collection Name</label>
              <input
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Enter collection name"
                className={inputCls}
              />
            </div>

            <div className={cn("flex justify-end gap-2 pt-4 border-t", softBorder)}>
              <button onClick={() => setIsEditModalOpen(false)} className={outlineBtn}>Cancel</button>
              <button onClick={handleUpdateCollection} disabled={!collectionName.trim()} className={primaryBtn}>
                Save Changes
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent className={cn("rounded-[2rem] border p-0 max-w-md overflow-hidden", card, border)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertCircle size={18} />
              </div>
              <div>
                <h2 className={cn("text-[13px] font-black uppercase tracking-widest", text)}>Delete Collection?</h2>
                <p className={cn("text-[11px] font-medium opacity-60 mt-0.5 leading-relaxed", sub)}>
                  <span className="text-rose-500 font-black">{currentCollection?.name || "This collection"}</span> will be permanently removed. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel className={cn(outlineBtn, "m-0")}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteCollection}
                className="h-11 px-7 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={12} /> Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

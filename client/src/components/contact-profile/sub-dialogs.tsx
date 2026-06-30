/**
 * Sub-dialogs used by the Contact Profile modal. Each one mirrors a Vue
 * sub-modal from replyagent (DeleteContact, OpportunityForm, GalleryPicker,
 * BulkActions, CreateCustomField full, etc.).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  X,
  Check,
  AlertTriangle,
  ChevronDown,
  Plus,
  Trash2,
  Folder,
  Image as ImageIcon,
  Search,
  Tag as TagIcon,
  ListChecks,
  Upload,
  Download,
  PowerOff,
  Power,
} from "lucide-react";

const apiGet = async (url: string) => (await apiRequest("GET", url)).json();
const apiPost = async (url: string, data?: any) =>
  (await apiRequest("POST", url, data)).json();
const apiDelete = async (url: string) => {
  const r = await apiRequest("DELETE", url);
  const text = await r.text();
  try {
    return text ? JSON.parse(text) : { success: true };
  } catch {
    return { success: true };
  }
};

// ─── DeleteContact with random 5-digit code ─────────────────────────

export function DeleteContactDialog({
  open,
  onOpenChange,
  contactName,
  onConfirmDelete,
  deleting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactName: string;
  onConfirmDelete: () => void;
  deleting: boolean;
}) {
  // Replyagent generates a fresh random 5-digit code each open. We use a
  // ref-equivalent state initialized when the dialog opens.
  const [code, setCode] = useState<string>("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) {
      // generate 5-digit number, range 10000..99999
      const n = Math.floor(10000 + Math.random() * 90000);
      setCode(String(n));
      setTyped("");
    }
  }, [open]);

  const matches = typed === code;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-base">
          Deleting:{" "}
          <span className="text-destructive font-semibold">{contactName}</span>
        </DialogTitle>
        <DialogDescription className="text-sm">
          This will permanently affect the contact's data. Please review the
          impact below.
        </DialogDescription>
        <ul className="list-disc pl-5 text-xs space-y-1">
          <li>
            <strong>{contactName}</strong>'s profile will be moved to trash.
          </li>
          <li>All linked conversations will be detached from this contact.</li>
          <li>
            Tasks, opportunities and bookings tied to this contact will remain
            but lose their contact reference.
          </li>
          <li>Automation flows running against this contact will stop.</li>
          <li className="text-destructive">
            Deleted contacts cannot be restored from the UI.
          </li>
        </ul>
        <div className="mt-3">
          <Label className="text-xs">
            Type{" "}
            <span className="font-mono font-bold bg-muted px-1 py-0.5 rounded">
              {code}
            </span>{" "}
            to confirm
          </Label>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Enter code"
            className="mt-1"
            inputMode="numeric"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!matches || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirmDelete}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Opportunity Form (pipeline + step + status + probability + agent) ───

export function OpportunityFormDialog({
  open,
  onOpenChange,
  contactId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string | null;
  initial?: any;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [closingDate, setClosingDate] = useState("");
  const [probability, setProbability] = useState(50);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [status, setStatus] = useState("ACTIVE");
  const [lostReason, setLostReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setPipelineId(null);
      setStepId(null);
      setTitle("");
      setValue("");
      setCurrency("USD");
      setClosingDate("");
      setProbability(50);
      setAgentId(null);
      setStatus("ACTIVE");
      setLostReason("");
      setNote("");
    } else if (initial) {
      setPipelineId(initial.pipeline_id ?? null);
      setStepId(initial.step_id ?? null);
      setTitle(initial.title ?? "");
      setValue(String(initial.value ?? ""));
      setCurrency(initial.currency ?? "USD");
      setClosingDate(initial.closing_date ?? "");
      setProbability(Number(initial.probability ?? 50));
      setAgentId(initial.assign_to ?? null);
      setStatus(initial.status ?? "ACTIVE");
      setLostReason(initial.lost_reason ?? "");
      setNote(initial.note?.text ?? "");
    }
  }, [open, initial]);

  const { data: pipelinesResp } = useQuery({
    queryKey: ["/api/pipelines"],
    queryFn: () => apiGet("/api/pipelines"),
    enabled: open,
  });
  const pipelines: any[] = useMemo(
    () => pipelinesResp?.pipelines ?? pipelinesResp ?? [],
    [pipelinesResp],
  );
  const steps: any[] = useMemo(
    () =>
      pipelines.find((p) => String(p.id) === String(pipelineId))?.steps ?? [],
    [pipelines, pipelineId],
  );

  const { data: usersResp } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => apiGet("/api/users"),
    enabled: open,
  });
  const users: any[] = useMemo(
    () => usersResp?.users ?? usersResp ?? [],
    [usersResp],
  );

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/pipelines/opportunities", {
        pipeline_id: pipelineId,
        step_id: stepId,
        contact_id: contactId,
        title,
        value: value ? Number(value) : 0,
        currency,
        closing_date: closingDate || null,
        probability,
        assign_to: agentId,
        status,
        lost_reason: status === "LOST" ? lostReason : null,
        note: note ? { text: note } : null,
      }),
    onSuccess: () => {
      toast({ title: "Opportunity saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{initial ? "Edit opportunity" : "New opportunity"}</DialogTitle>
        <DialogDescription>
          Track a deal through your sales pipeline.
        </DialogDescription>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div>
            <Label>Pipeline</Label>
            <Select
              value={pipelineId ?? ""}
              onValueChange={(v) => {
                setPipelineId(v);
                setStepId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Step</Label>
            <Select
              value={stepId ?? ""}
              onValueChange={setStepId}
              disabled={!pipelineId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose step" />
              </SelectTrigger>
              <SelectContent>
                {steps.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <Label>Value</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{currency}</span>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["USD", "EUR", "GBP", "PKR", "INR", "BRL", "AED"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Closing date</Label>
            <Input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Probability ({probability}%)</Label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <Label>Assigned to</Label>
            <Select value={agentId ?? ""} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name ?? u.name ?? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ?? `User ${u.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="WON">Won</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "LOST" && (
            <div className="col-span-2">
              <Label>Lost reason</Label>
              <Input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Why was it lost?"
              />
            </div>
          )}

          <div className="col-span-2">
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!pipelineId || !stepId || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Gallery Picker ────────────────────────────────────────────────
//
// Replyagent-parity media picker used by image / audio / video / document
// activity fields in the smart-flow builder. Three things must work:
//   1. List existing workspace media (filtered by mediaType when set)
//   2. Upload a fresh file from the picker itself ("Add files")
//   3. Enter a direct URL as fallback when the asset lives elsewhere
//
// Earlier bug: this dialog read `data.media`/`data.data` from
// /api/gallery/listings, but the backend actually returns
// `{ folders, file_folders: { data: [...] } }`. Reading the right key is
// what makes the gallery stop showing "No media yet" for workspaces that
// already have uploads.

export function GalleryPickerDialog({
  open,
  onOpenChange,
  onPick,
  mediaType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (media: { id: string; url: string; object_name: string }) => void;
  mediaType?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [urlInput, setUrlInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/gallery/listings", mediaType],
    queryFn: () =>
      apiGet(
        `/api/gallery/listings${mediaType ? `?media_type=${mediaType}` : ""}`,
      ),
    enabled: open,
  });

  // Backend shape: { folders, file_folders: { data, total, ... } }.
  // Be defensive — also accept legacy `media` / top-level `data` so an
  // older API contract still works.
  const items: any[] = useMemo(() => {
    return (
      data?.file_folders?.data ??
      data?.media ??
      (Array.isArray(data?.data) ? data.data : []) ??
      []
    );
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!mediaType) return items;
    const want = mediaType.toUpperCase();
    return items.filter((m: any) => {
      const t = (m.media_type ?? "").toString().toUpperCase();
      return !t || t === want;
    });
  }, [items, mediaType]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("files", file);
      const res = await apiRequest("POST", "/api/gallery/upload", fd);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gallery/listings"] });
      toast({ title: "Uploaded", description: "Media added to gallery." });
    },
    onError: (err: any) =>
      toast({
        title: "Upload failed",
        description: err?.message ?? "Try again",
        variant: "destructive",
      }),
  });

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    onPick({ id: "", url, object_name: url.split("/").pop() ?? url });
    setUrlInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>Gallery</DialogTitle>
        <DialogDescription>
          Pick an image from your gallery, upload a new one, or enter a URL.
        </DialogDescription>

        {/* Action bar — upload + URL fallback */}
        <div className="flex items-center gap-2 border-b pb-3">
          <label className="inline-flex">
            <input
              type="file"
              accept={mediaType === "image" ? "image/*" : undefined}
              className="hidden"
              onChange={handleFileInput}
              disabled={uploadMutation.isPending}
            />
            <span className="inline-flex items-center gap-2 cursor-pointer text-xs px-3 py-1.5 rounded border bg-white hover:bg-muted">
              <ImageIcon className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? "Uploading…" : "Add files"}
            </span>
          </label>

          <div className="flex-1 flex items-center gap-2">
            <Input
              type="url"
              placeholder="Or paste a direct URL (https://…)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
            >
              Use URL
            </Button>
          </div>
        </div>

        <ScrollArea className="h-96">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              Loading…
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              No media yet. Click "Add files" above to upload, or paste a
              direct URL.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-3 p-2">
              {filteredItems.map((m: any) => {
                const id = String(m.object_id ?? m.id ?? "");
                const url = m.file_url ?? m.url ?? "";
                const thumb = m.thumb_200 ?? m.thumbnail ?? url;
                return (
                  <button
                    key={id || url}
                    type="button"
                    className="border rounded overflow-hidden hover:ring-2 hover:ring-primary text-left"
                    onClick={() =>
                      onPick({
                        id,
                        url,
                        object_name: m.object_name ?? "",
                      })
                    }
                  >
                    {url ? (
                      <img
                        src={thumb}
                        alt={m.object_name}
                        className="w-full h-24 object-cover bg-muted"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-muted">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs truncate p-1">{m.object_name}</p>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Full Create Custom Field — 12 content types ─────────────────────

export function CreateCustomFieldDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [systemName, setSystemName] = useState("");
  const [systemNameTouched, setSystemNameTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState("TEXT");
  const [inputType, setInputType] = useState("text");
  const [properties, setProperties] = useState<
    { value: string; label?: string }[]
  >([]);
  const [availability, setAvailability] = useState<"unknown" | "ok" | "taken" | "checking">("unknown");

  const slugFromLabel = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  useEffect(() => {
    if (!systemNameTouched) {
      setSystemName(slugFromLabel(label));
    }
  }, [label, systemNameTouched]);

  // Live system_name availability check (debounced)
  useEffect(() => {
    if (!systemName || !open) {
      setAvailability("unknown");
      return;
    }
    setAvailability("checking");
    const t = setTimeout(async () => {
      try {
        const resp = await apiGet(
          `/api/custom-fields/check-availability?system_name=${encodeURIComponent(systemName)}`,
        );
        setAvailability(resp.is_available ? "ok" : "taken");
      } catch {
        setAvailability("unknown");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [systemName, open]);

  useEffect(() => {
    if (!open) {
      setLabel("");
      setSystemName("");
      setSystemNameTouched(false);
      setDescription("");
      setContentType("TEXT");
      setInputType("text");
      setProperties([]);
      setAvailability("unknown");
    }
  }, [open]);

  // Auto-adjust input type when content type changes.
  useEffect(() => {
    if (contentType === "DATE") setInputType("date");
    else if (contentType === "DATETIME") setInputType("datetime");
    else if (contentType === "NUMBER" || contentType === "CURRENCY") setInputType("number");
    else if (contentType === "PHONE") setInputType("text");
    else if (contentType === "URL") setInputType("text");
    else if (contentType === "EMAIL") setInputType("email");
    else setInputType("text");
  }, [contentType]);

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/custom-fields/field", {
        label,
        system_name: systemName,
        slug: systemName,
        description,
        content_type: contentType,
        input_type: inputType,
        entity_type: "Contact",
        properties: properties.filter((p) => p.value),
      }),
    onSuccess: () => {
      toast({ title: "Custom field created" });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({
        title: "Create failed",
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  const showProperties = ["select", "multiselect", "radio"].includes(inputType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>New custom field</DialogTitle>
        <DialogDescription>
          Add a custom data field for contacts. Choose the content type that
          matches the value you'll store.
        </DialogDescription>

        <div className="space-y-3 py-2">
          <div>
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Date of Birth"
              maxLength={60}
            />
          </div>
          <div>
            <Label>System name (slug)</Label>
            <div className="relative">
              <Input
                value={systemName}
                onChange={(e) => {
                  setSystemNameTouched(true);
                  setSystemName(e.target.value.toLowerCase());
                }}
                placeholder="date_of_birth"
                maxLength={250}
                className="pr-8"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {availability === "checking" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                {availability === "ok" && (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                )}
                {availability === "taken" && (
                  <X className="h-3.5 w-3.5 text-destructive" />
                )}
              </div>
            </div>
            {availability === "taken" && (
              <p className="text-xs text-destructive mt-1">
                This system name is already used in this workspace.
              </p>
            )}
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Content type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">Text</SelectItem>
                  <SelectItem value="NUMBER">Number</SelectItem>
                  <SelectItem value="CURRENCY">Currency</SelectItem>
                  <SelectItem value="DATE">Date</SelectItem>
                  <SelectItem value="DATETIME">Date &amp; time</SelectItem>
                  <SelectItem value="PHONE">Phone</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="URL">URL</SelectItem>
                  <SelectItem value="FIXED">Fixed value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Input type</Label>
              <Select value={inputType} onValueChange={setInputType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Single line</SelectItem>
                  <SelectItem value="textarea">Multi line</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="date">Date picker</SelectItem>
                  <SelectItem value="datetime">Date &amp; time</SelectItem>
                  <SelectItem value="select">Single select</SelectItem>
                  <SelectItem value="multiselect">Multi select</SelectItem>
                  <SelectItem value="radio">Radio buttons</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showProperties && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Options</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProperties([...properties, { value: "", label: "" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add option
                </Button>
              </div>
              {properties.map((p, idx) => (
                <div key={idx} className="flex gap-2 mb-1">
                  <Input
                    value={p.value}
                    onChange={(e) => {
                      const next = [...properties];
                      next[idx] = { ...p, value: e.target.value };
                      setProperties(next);
                    }}
                    placeholder="Value"
                  />
                  <Input
                    value={p.label ?? ""}
                    onChange={(e) => {
                      const next = [...properties];
                      next[idx] = { ...p, label: e.target.value };
                      setProperties(next);
                    }}
                    placeholder="Label (optional)"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setProperties(properties.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !label ||
              !systemName ||
              availability === "taken" ||
              submit.isPending
            }
            onClick={() => submit.mutate()}
          >
            {submit.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Note-add dropdown with 6 channels ──────────────────────────────

export function NoteAddDropdown({
  contactId,
  onAdded,
}: {
  contactId: string | null;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string | null>(null);
  const [text, setText] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/notes", {
        contact_id: contactId,
        note: text,
        type: channel === "internal" ? "text" : "channel",
        channel: channel === "internal" ? null : channel,
      }),
    onSuccess: () => {
      toast({ title: "Note added" });
      setOpen(false);
      setText("");
      setChannel(null);
      onAdded();
    },
  });

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add note
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0">
          {[
            { k: "internal", l: "Internal note" },
            { k: "sms", l: "SMS" },
            { k: "whatsapp", l: "WhatsApp" },
            { k: "messenger", l: "Messenger" },
            { k: "instagram", l: "Instagram" },
            { k: "telegram", l: "Telegram" },
            { k: "email", l: "Email" },
          ].map((opt) => (
            <button
              key={opt.k}
              type="button"
              className="w-full text-left text-sm px-3 py-2 hover:bg-muted/50"
              onClick={() => {
                setChannel(opt.k);
                setOpen(true);
              }}
            >
              {opt.l}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>
            {channel === "internal"
              ? "Internal note"
              : `${channel?.[0]?.toUpperCase()}${channel?.slice(1)} note`}
          </DialogTitle>
          <DialogDescription>
            This will appear in the activity timeline.
          </DialogDescription>
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your note…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!text || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Bulk Actions Popup — 10 actions ────────────────────────────────

export type BulkAction =
  | "add_tag"
  | "remove_tag"
  | "add_cf_value"
  | "remove_cf_value"
  | "activate"
  | "delete"
  | "delete_all"
  | "import"
  | "export"
  | "export_psid";

export function BulkActionsPopup({
  selectedIds,
  onAction,
}: {
  selectedIds: string[];
  onAction: (action: BulkAction) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={selectedIds.length === 0}
        >
          Bulk actions ({selectedIds.length})
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        {(
          [
            { k: "add_tag", l: "Add tag", icon: TagIcon },
            { k: "remove_tag", l: "Remove tag", icon: X },
            { k: "add_cf_value", l: "Set custom field", icon: ListChecks },
            { k: "remove_cf_value", l: "Clear custom field", icon: ListChecks },
            { k: "activate", l: "Activate contacts", icon: Power },
            { k: "delete", l: "Delete contacts", icon: Trash2 },
            { k: "delete_all", l: "Delete all (filtered)", icon: Trash2 },
            { k: "import", l: "Import contacts", icon: Upload },
            { k: "export", l: "Export contacts", icon: Download },
            { k: "export_psid", l: "Export PSID", icon: Download },
          ] as { k: BulkAction; l: string; icon: any }[]
        ).map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.k}
              type="button"
              className="w-full text-left text-sm px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
              onClick={() => onAction(opt.k)}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {opt.l}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ─── Add Lead (new contact in company) ──────────────────────────────

export function AddLeadDialog({
  open,
  onOpenChange,
  companyId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (!open) {
      setFirst("");
      setLast("");
      setEmail("");
      setPhone("");
      setTimezone("UTC");
    }
  }, [open]);

  const submit = useMutation({
    mutationFn: () =>
      apiPost("/api/contacts", {
        first_name: first,
        last_name: last,
        email: email || undefined,
        phone: phone || undefined,
        timezone,
        company_id: companyId,
      }),
    onSuccess: () => {
      toast({ title: "Contact created" });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({
        title: "Create failed",
        description: err?.message ?? "",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Add contact</DialogTitle>
        <DialogDescription>
          Create a new contact{" "}
          {companyId ? "in this company" : "in this workspace"}.
        </DialogDescription>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>First name</Label>
              <Input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                maxLength={30}
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                maxLength={30}
              />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={(!first && !last) || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

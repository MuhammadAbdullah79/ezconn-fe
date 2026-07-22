/**
 * Modals — replyagent parity for the Smart Flow builder's dialogs:
 *   - TriggersModal: trigger-type picker grid (search + category filter)
 *   - SelectAutomationPopup: another-automation picker (used by
 *     StartAutomation / RemoveFromSmartFlow action editors)
 *   - CommentModal: per-step comment edit
 *   - LoopRectificationDialog: shown when publish detects a loop; user
 *     must check the acknowledgement box before publishing anyway
 *   - QueueContactsModal: shown when publishing with contacts in flight;
 *     radio between Clear / Requeue / Add tag
 *   - ConfirmDeleteStep + ConfirmFlushQueue: simple confirm prompts
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  X,
  AlertTriangle,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  TRIGGER_SCHEMAS,
  TRIGGER_CATEGORIES,
  type TriggerSchema,
} from "./trigger-schemas";

const apiGet = async (url: string) => (await apiRequest("GET", url)).json();

// ─── TriggersModal ─────────────────────────────────────────────────────
//
// Replyagent groups triggers like this:
//   1. "Events" section — lifecycle / CRM triggers (Contact Added, Tag
//      applied, Tag removed, Custom field updated, System field updated,
//      Date & Time changed, Default, Conversation Marked as Done).
//   2. One section per connected channel account (e.g. WhatsApp number,
//      Telegram bot, Messenger page) listing the channel-specific
//      triggers (Start URL, Keywords, Ad clicked, etc.).
//
// We fetch the connected accounts for each channel and synthesize a card
// per (account × channel-trigger). Each card shows ONLY an icon + label —
// no event slug — to match replyagent's chrome exactly.

const EVENT_SECTION_EVENTS = [
  "contact_added",
  "date_field_changed",
  "tag_applied",
  "tag_removed",
  "custom_field_changed",
  "system_field_changed",
  "default_url",
  "conversation_marked_as_done",
];

// Channel-event triplets that get spawned per connected account.
const CHANNEL_TRIGGER_TEMPLATES: Array<{
  channel: string;
  startUrl?: string;
  keyword?: string;
  refStart?: string;
  adClicked?: string;
}> = [
  { channel: "whatsapp", startUrl: "whatsapp_url", keyword: "wa_keyword", refStart: "wa_ref_start", adClicked: "wa_ad_clicked" },
  { channel: "telegram", startUrl: "telegram_url", keyword: "tg_keyword" },
  { channel: "messenger", refStart: "fb_messenger_ref_start", keyword: "fb_keyword" },
  { channel: "instagram", refStart: "ig_ref_start", keyword: "ig_keyword" },
  { channel: "webchat", startUrl: "webchat_url", keyword: "wc_keyword" },
  { channel: "evolution", startUrl: "evolution_url", keyword: "evolution_keyword" },
  { channel: "zapi", startUrl: "zapi_url", keyword: "zapi_keyword" },
];

interface ChannelAccount {
  id: string | number;
  name: string;
  channel: string;
}

export function useConnectedAccounts(enabled: boolean): ChannelAccount[] {
  // Different EZCONN endpoints wrap their list under different keys —
  //   WhatsApp:  { wa: [...] }
  //   Telegram:  { bots: [...] }
  //   Messenger: { pages: [...] }
  //   etc.
  // Accept any of the documented keys, then fall back to the first array
  // value on the object (so any future endpoint shape still works).
  const fetcher = (url: string, listKeys: string[]) =>
    enabled
      ? apiGet(url)
          .then((r: any) => {
            if (Array.isArray(r)) return r;
            for (const key of listKeys) {
              if (Array.isArray(r?.[key])) return r[key];
            }
            if (r && typeof r === "object") {
              for (const v of Object.values(r)) {
                if (Array.isArray(v)) return v;
              }
            }
            return [];
          })
          .catch(() => [])
      : Promise.resolve([]);

  // Realtime refresh — replyagent uses Pusher Echo to listen for
  // `.channel.created/updated/deleted` and re-fetches integrations. Without
  // a Pusher channel set up on EZCONN, we poll every 30 s while the modal
  // is open so a newly-connected channel appears within half a minute.
  const refetchInterval = enabled ? 30_000 : false;
  // `onboard_platform=all` — /whatsapp/accounts defaults to Business API only
  // (replyagent parity); automations fire on Coexistence numbers too.
  const wa = useQuery({ queryKey: ["/api/whatsapp/accounts"], queryFn: () => fetcher("/api/whatsapp/accounts?onboard_platform=all", ["wa", "accounts"]), enabled, retry: false, refetchInterval });
  const tg = useQuery({ queryKey: ["/api/telegram/bots"], queryFn: () => fetcher("/api/telegram/bots", ["bots"]), enabled, retry: false, refetchInterval });
  const fb = useQuery({ queryKey: ["/api/messenger/pages"], queryFn: () => fetcher("/api/messenger/pages", ["pages"]), enabled, retry: false, refetchInterval });
  const ig = useQuery({ queryKey: ["/api/instagram/pages"], queryFn: () => fetcher("/api/instagram/pages", ["pages"]), enabled, retry: false, refetchInterval });
  const wc = useQuery({ queryKey: ["/api/webchat/instances"], queryFn: () => fetcher("/api/webchat/instances", ["instances"]), enabled, retry: false, refetchInterval });
  const ev = useQuery({ queryKey: ["/api/evolution/instances"], queryFn: () => fetcher("/api/evolution/instances", ["instances"]), enabled, retry: false, refetchInterval });
  const zp = useQuery({ queryKey: ["/api/zapi/instances"], queryFn: () => fetcher("/api/zapi/instances", ["instances"]), enabled, retry: false, refetchInterval });

  return useMemo(() => {
    const acc: ChannelAccount[] = [];
    const push = (data: any, channel: string) => {
      if (!Array.isArray(data)) return;
      for (const row of data) {
        acc.push({
          id: row.id ?? row.uuid ?? row.slug ?? Math.random().toString(36),
          name: row.name ?? row.display_name ?? row.title ?? row.phone_number ?? `#${row.id ?? "?"}`,
          channel,
        });
      }
    };
    push(wa.data, "whatsapp");
    push(tg.data, "telegram");
    push(fb.data, "messenger");
    push(ig.data, "instagram");
    push(wc.data, "webchat");
    push(ev.data, "evolution");
    push(zp.data, "zapi");
    return acc;
  }, [wa.data, tg.data, fb.data, ig.data, wc.data, ev.data, zp.data]);
}

// ─── Icon mapping per trigger event (replyagent parity) ────────────────
import {
  User as UserIcon,
  Clock as ClockIcon,
  Tag,
  Database,
  Cog,
  Link2,
  KeyRound,
  Hand,
  CheckCircle2,
  Bell,
  MessageSquare as MessageSquareIcon,
  ImagePlay,
} from "lucide-react";

function TriggerIcon({ event }: { event: string }) {
  const map: Record<string, React.ReactNode> = {
    contact_added: <UserIcon className="h-5 w-5" />,
    contact_deleted: <UserIcon className="h-5 w-5" />,
    date_field_changed: <ClockIcon className="h-5 w-5" />,
    tag_applied: <Tag className="h-5 w-5" />,
    tag_removed: <Tag className="h-5 w-5" />,
    custom_field_changed: <Database className="h-5 w-5" />,
    system_field_changed: <Cog className="h-5 w-5" />,
    default_url: (
      <span className="h-6 w-6 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold">
        N
      </span>
    ),
    conversation_marked_as_done: <CheckCircle2 className="h-5 w-5" />,
    conversation_assigned: <UserIcon className="h-5 w-5" />,
    broadcast: <Bell className="h-5 w-5" />,
    subscribed_to_flow: <Bell className="h-5 w-5" />,
    unsubscribed_from_flow: <Bell className="h-5 w-5" />,
    api_trigger: <Link2 className="h-5 w-5" />,
    // Channel URL triggers
    whatsapp_url: <Link2 className="h-5 w-5" />,
    telegram_url: <Link2 className="h-5 w-5" />,
    webchat_url: <Link2 className="h-5 w-5" />,
    evolution_url: <Link2 className="h-5 w-5" />,
    zapi_url: <Link2 className="h-5 w-5" />,
    fb_messenger_ref_start: <Link2 className="h-5 w-5" />,
    ig_ref_start: <Link2 className="h-5 w-5" />,
    wa_ref_start: <Link2 className="h-5 w-5" />,
    // Keyword triggers
    wa_keyword: <KeyRound className="h-5 w-5" />,
    tg_keyword: <KeyRound className="h-5 w-5" />,
    ig_keyword: <KeyRound className="h-5 w-5" />,
    fb_keyword: <KeyRound className="h-5 w-5" />,
    wc_keyword: <KeyRound className="h-5 w-5" />,
    twilio_keyword: <KeyRound className="h-5 w-5" />,
    evolution_keyword: <KeyRound className="h-5 w-5" />,
    zapi_keyword: <KeyRound className="h-5 w-5" />,
    // Special
    wa_ad_clicked: <Hand className="h-5 w-5" />,
    ig_story_mention: <ImagePlay className="h-5 w-5" />,
    ig_comment_reply: <MessageSquareIcon className="h-5 w-5" />,
    fb_comment: <MessageSquareIcon className="h-5 w-5" />,
    fb_topic_subscribed: <MessageSquareIcon className="h-5 w-5" />,
    fb_topic_sent: <MessageSquareIcon className="h-5 w-5" />,
    fb_topic_limit_reach: <MessageSquareIcon className="h-5 w-5" />,
    opportunity_stage_moved: <UserIcon className="h-5 w-5" />,
  };
  return <span className="text-slate-700">{map[event] ?? <Bell className="h-5 w-5" />}</span>;
}

function channelEmojiIcon(channel: string): React.ReactNode {
  switch (channel) {
    case "whatsapp":
    case "zapi":
    case "evolution":
      return <span className="text-emerald-600">●</span>;
    case "telegram":
      return <span className="text-sky-500">●</span>;
    case "messenger":
      return <span className="text-blue-600">●</span>;
    case "instagram":
      return <span className="text-fuchsia-600">●</span>;
    case "webchat":
      return <span className="text-orange-500">●</span>;
    default:
      return <span className="text-muted-foreground">●</span>;
  }
}

interface PickerCard {
  event: string;
  label: string;
  schema: TriggerSchema;
  // Optional pre-applied payload (used when the card represents a
  // channel-account-specific trigger so the user doesn't have to pick the
  // channel account again afterwards).
  prefill?: Record<string, any>;
}

interface PickerSection {
  title: string;
  icon: React.ReactNode;
  cards: PickerCard[];
}

export function TriggersModal({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (event: string, schema: TriggerSchema, prefill?: Record<string, any>) => void;
}) {
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const accounts = useConnectedAccounts(open);

  useEffect(() => {
    if (!open) {
      setCategory("All");
      setSearch("");
    }
  }, [open]);

  // Build the structured sections.
  const sections: PickerSection[] = useMemo(() => {
    const out: PickerSection[] = [];

    // 1. EVENTS section — lifecycle / CRM triggers.
    const eventsCards: PickerCard[] = EVENT_SECTION_EVENTS
      .map((ev) => {
        const schema = TRIGGER_SCHEMAS[ev];
        if (!schema) return null;
        return { event: ev, label: schema.label, schema };
      })
      .filter(Boolean) as PickerCard[];
    out.push({ title: "Events", icon: <Bell className="h-4 w-4 text-slate-500" />, cards: eventsCards });

    // 2. Per-channel-account sections.
    for (const acc of accounts) {
      const template = CHANNEL_TRIGGER_TEMPLATES.find((t) => t.channel === acc.channel);
      if (!template) continue;
      const cards: PickerCard[] = [];
      const prefill = { channel_account_id: String(acc.id) };
      if (template.startUrl && TRIGGER_SCHEMAS[template.startUrl])
        cards.push({ event: template.startUrl, label: "Start URL", schema: TRIGGER_SCHEMAS[template.startUrl], prefill });
      if (template.refStart && TRIGGER_SCHEMAS[template.refStart])
        cards.push({ event: template.refStart, label: "Start URL", schema: TRIGGER_SCHEMAS[template.refStart], prefill });
      if (template.keyword && TRIGGER_SCHEMAS[template.keyword])
        cards.push({ event: template.keyword, label: "Keywords", schema: TRIGGER_SCHEMAS[template.keyword], prefill });
      if (template.adClicked && TRIGGER_SCHEMAS[template.adClicked])
        cards.push({ event: template.adClicked, label: "Ad clicked", schema: TRIGGER_SCHEMAS[template.adClicked], prefill });
      out.push({
        title: acc.name,
        icon: channelEmojiIcon(acc.channel),
        cards,
      });
    }

    return out;
  }, [accounts]);

  // Apply search + category filter on top of the structured sections.
  const filtered = useMemo(() => {
    return sections
      .map((sec) => ({
        ...sec,
        cards: sec.cards.filter((c) => {
          if (category !== "All" && c.schema.category !== category) return false;
          if (search) {
            const q = search.toLowerCase();
            if (
              !c.label.toLowerCase().includes(q) &&
              !c.schema.category.toLowerCase().includes(q) &&
              !c.event.toLowerCase().includes(q) &&
              !sec.title.toLowerCase().includes(q)
            )
              return false;
          }
          return true;
        }),
      }))
      .filter((sec) => sec.cards.length > 0);
  }, [sections, category, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {/* Replyagent has no visible title / subtitle — just the controls
            row. We keep an sr-only DialogTitle for a11y. */}
        <DialogTitle className="sr-only">Select trigger</DialogTitle>

        <div className="flex gap-2 items-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {TRIGGER_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-7 h-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[28rem] mt-2 -mx-2 px-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              No triggers match.
            </p>
          ) : (
            filtered.map((sec) => (
              <div key={sec.title} className="mb-5">
                <div className="flex items-center gap-2 px-1 mb-2 text-slate-500">
                  {sec.icon}
                  <span className="text-sm font-medium">{sec.title}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {sec.cards.map((c) => (
                    <button
                      key={`${sec.title}-${c.event}`}
                      type="button"
                      className="border rounded-lg p-4 hover:bg-muted/40 flex flex-col items-center justify-center gap-2 transition"
                      onClick={() => {
                        onPick(c.event, c.schema, c.prefill);
                        onOpenChange(false);
                      }}
                    >
                      <TriggerIcon event={c.event} />
                      <span className="text-sm text-center">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── SelectAutomationPopup ─────────────────────────────────────────────

export function SelectAutomationPopup({
  open,
  onOpenChange,
  onPick,
  excludeAutomationId,
  statusFilter,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (automation: any) => void;
  excludeAutomationId?: string;
  statusFilter?: string;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const { data } = useQuery({
    queryKey: ["/api/automations", { search, status: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      return apiGet(`/api/automations?${params.toString()}`);
    },
    enabled: open,
  });

  const automations: any[] = useMemo(() => {
    const list = data?.automations ?? data ?? [];
    return list.filter(
      (a: any) =>
        !excludeAutomationId || String(a.id) !== String(excludeAutomationId),
    );
  }, [data, excludeAutomationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Select automation</DialogTitle>
        <DialogDescription>
          Pick an automation to reference from this step.
        </DialogDescription>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
        />
        <ScrollArea className="h-80">
          {automations.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              Nothing found.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Runs</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {automations.map((a: any) => (
                  <tr key={a.id} className="border-t hover:bg-muted/30">
                    <td className="px-2 py-2 truncate max-w-[260px]">{a.name}</td>
                    <td className="px-2 py-2">{a.total_runs ?? 0}</td>
                    <td className="px-2 py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {String(a.status ?? "draft").toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onPick(a);
                          onOpenChange(false);
                        }}
                      >
                        Select
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── CommentModal ──────────────────────────────────────────────────────

export function CommentModal({
  open,
  onOpenChange,
  initialComment,
  onSave,
  onDelete,
  readOnly = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialComment: string;
  onSave: (next: string) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(initialComment ?? "");
  useEffect(() => {
    if (open) setText(initialComment ?? "");
  }, [open, initialComment]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Step comment</DialogTitle>
        <DialogDescription>
          Notes are visible to anyone editing this flow. Comments don't affect
          execution.
        </DialogDescription>
        <Textarea
          value={text}
          readOnly={readOnly}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Add a comment…"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!readOnly && onDelete && initialComment && (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          )}
          {!readOnly && (
            <Button
              onClick={() => {
                onSave(text);
                onOpenChange(false);
              }}
            >
              Save
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── LoopRectificationDialog ───────────────────────────────────────────

export function LoopRectificationDialog({
  open,
  onOpenChange,
  loops,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loops: Array<{ from: string; to: string }>;
  onConfirm: () => void;
  loading?: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    if (!open) setAcknowledged(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          Possible loop detected
        </DialogTitle>
        <DialogDescription>
          This flow has connections that could cause an infinite loop. Review
          them below and acknowledge before publishing.
        </DialogDescription>
        <div className="border rounded bg-amber-50 dark:bg-amber-950/30 p-3 max-h-40 overflow-auto">
          {loops.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No specific loop edges identified.
            </p>
          ) : (
            <ul className="space-y-1 text-xs font-mono">
              {loops.map((l, i) => (
                <li key={i}>
                  {l.from} → {l.to}
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>
            I understand the loop risk and accept responsibility for monitoring
            this automation.
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!acknowledged || loading}
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Publish anyway
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── QueueContactsModal ────────────────────────────────────────────────

export type QueueAction = "clear" | "requeue" | "tag";

export function QueueContactsModal({
  open,
  onOpenChange,
  inFlightCount,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  inFlightCount: number;
  onConfirm: (action: QueueAction, tagName?: string) => void;
  loading?: boolean;
}) {
  const [action, setAction] = useState<QueueAction>("requeue");
  const [tagName, setTagName] = useState("");

  useEffect(() => {
    if (!open) {
      setAction("requeue");
      setTagName("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Contacts in flight</DialogTitle>
        <DialogDescription>
          {inFlightCount} contact{inFlightCount === 1 ? "" : "s"} are currently
          running this automation. Choose what to do with them before
          publishing.
        </DialogDescription>
        <div className="space-y-2">
          {(
            [
              {
                value: "requeue" as const,
                title: "Requeue contacts at the start",
                desc: "Existing runs are reset to the trigger step.",
              },
              {
                value: "clear" as const,
                title: "Clear in-flight runs",
                desc: "Contacts mid-flow are removed from this automation.",
              },
              {
                value: "tag" as const,
                title: "Tag and clear",
                desc: "Apply a tag to in-flight contacts, then clear them.",
              },
            ]
          ).map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2 border rounded p-3 cursor-pointer ${
                action === opt.value ? "border-primary bg-primary/5" : ""
              }`}
            >
              <input
                type="radio"
                name="queue-action"
                checked={action === opt.value}
                onChange={() => setAction(opt.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{opt.title}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {action === "tag" && (
          <Input
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Tag name (created if new)"
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={loading || (action === "tag" && !tagName)}
            onClick={() => onConfirm(action, tagName || undefined)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Publish
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ConfirmDeleteStep ─────────────────────────────────────────────────

export function ConfirmDeleteStep({
  open,
  onOpenChange,
  stepTitle,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stepTitle: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete step?</AlertDialogTitle>
          <AlertDialogDescription>
            "{stepTitle}" and any connections going through it will be removed.
            You can undo with Ctrl+Z until you save.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground"
            onClick={onConfirm}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── ConfirmFlushQueue ─────────────────────────────────────────────────

export function ConfirmFlushQueue({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear automation queue?</AlertDialogTitle>
          <AlertDialogDescription>
            All in-flight contact runs for this automation will be removed.
            This is intended for resetting a broken flow — don't run it during
            normal operation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground"
            onClick={onConfirm}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Clear queue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

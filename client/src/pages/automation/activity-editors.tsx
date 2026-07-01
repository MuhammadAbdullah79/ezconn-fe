/**
 * Activity-list pattern editors — replyagent's exact data model:
 *
 *   node.data.activities = [
 *     { slug, event, properties: { type, ...fields }, order, children: [] }
 *   ]
 *
 * The main sidebar shows the LIST. Clicking a row opens the SecondaryBar
 * with the type-specific form. Saving updates the activity. Replyagent
 * stores ONE node = potentially MANY activities, e.g. a WhatsApp node can
 * stack: text → image → input → button.
 *
 * This file exports:
 *   - ChannelActivitiesPanel: the main list view for a channel node
 *     (Text/Image/Audio/Video/Document/Delay/etc. activities).
 *   - TriggerActivitiesPanel: the main list view for the trigger node
 *     (Default URL / Tag applied / Contact added / etc.).
 *   - ActivityEditorBar: secondary editor that opens for a single activity.
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Type as TypeIcon,
  Image as ImageIcon,
  Mic,
  Video as VideoIcon,
  FileText as FileTextIcon,
  Clock as ClockIcon,
  MessageSquare,
  List as ListIcon,
  FileSignature,
  MousePointerClick,
  Brain,
  HelpCircle,
  Phone,
  Trash2,
  Plus,
  GripVertical,
  Tag,
  User,
  Database,
  Cog,
  Link2,
  KeyRound,
  Hand,
  CheckCircle2,
  Bell,
} from "lucide-react";
import { SecondaryBar } from "./SecondaryBar";
import { SchemaForm } from "./editors";
import { getMessageTypes, getMessageType, CHANNEL_LABELS } from "./channel-schemas";
import { getTriggerSchema, TRIGGER_SCHEMAS } from "./trigger-schemas";

// ─── Activity type icon map (channel-side) ─────────────────────────────

const CHANNEL_TYPE_ICON: Record<string, React.ReactNode> = {
  text: <TypeIcon className="h-4 w-4 text-slate-600" />,
  input: <MessageSquare className="h-4 w-4 text-slate-600" />,
  button: <MousePointerClick className="h-4 w-4 text-slate-600" />,
  image_url: <ImageIcon className="h-4 w-4 text-slate-600" />,
  audio: <Mic className="h-4 w-4 text-slate-600" />,
  video: <VideoIcon className="h-4 w-4 text-slate-600" />,
  document: <FileTextIcon className="h-4 w-4 text-slate-600" />,
  delay: <ClockIcon className="h-4 w-4 text-slate-600" />,
  message_list: <ListIcon className="h-4 w-4 text-slate-600" />,
  message_template: <FileSignature className="h-4 w-4 text-slate-600" />,
  chatgpt_question: <HelpCircle className="h-4 w-4 text-slate-600" />,
  dify_question: <Brain className="h-4 w-4 text-slate-600" />,
  cta_button: <MousePointerClick className="h-4 w-4 text-slate-600" />,
  call: <Phone className="h-4 w-4 text-slate-600" />,
};

const WA_SEND_WINDOW_OPTIONS = [
  { value: "in_24", label: "Send Within 24 hours window" },
  { value: "template_after_24", label: "Send Template only after 24 hours window" },
  { value: "custom_after_24", label: "Send Custom Message after 24 hours window" },
];

// ─── Helpers ──────────────────────────────────────────────────────────

interface Activity {
  slug: string;
  event?: string;
  properties: { type?: string; [k: string]: any };
  order?: number;
  children?: Activity[];
}

function makeSlug() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function activitySummary(act: Activity): string {
  const t = act.properties?.type ?? "";
  const p = act.properties ?? {};
  if (t === "text") return (p.message ?? p.text ?? "").slice(0, 60) || "Empty text";
  if (t === "input") return `Ask: ${(p.message ?? "").slice(0, 50) || "Empty"}`;
  if (t === "button") return `Buttons: ${(p.choices ?? []).length}`;
  if (t === "image_url") return "Image";
  if (t === "audio") return "Audio";
  if (t === "video") return "Video";
  if (t === "document") return p.filename ?? "Document";
  if (t === "delay") return `Wait ${p.amount ?? "?"} ${p.unit ?? "min"}`;
  if (t === "message_list") return `List: ${p.button ?? "(button)"}`;
  if (t === "message_template") return p.template?.name ?? "Template";
  if (t === "chatgpt_question") return `AI: ${(p.question ?? "").slice(0, 40)}`;
  if (t === "dify_question") return `Dify: ${(p.question ?? "").slice(0, 40)}`;
  if (t === "cta_button") return `CTA: ${p.button_text ?? "?"}`;
  return t || "Activity";
}

// ─── ChannelActivitiesPanel ───────────────────────────────────────────

export function ChannelActivitiesPanel({
  channel,
  nodeData,
  onChange,
}: {
  channel: string;
  nodeData: any;
  onChange: (partial: Record<string, any>) => void;
}) {
  const activities: Activity[] = nodeData?.activities ?? [];
  const sendWindow: string = nodeData?.send_window ?? "in_24";
  const isWaFamily = ["whatsapp", "zapi", "evolution"].includes(channel);

  // Internal state for the SecondaryBar — either "launcher" (the type
  // grid) or {kind:'edit', index} (form for an existing activity).
  const [secondary, setSecondary] = useState<
    | null
    | { kind: "launcher" }
    | { kind: "edit"; index: number }
  >(null);

  // ─── Mutators ───────────────────────────────────────────────────
  const setActivities = (next: Activity[]) =>
    onChange({ activities: next });

  const addActivity = (type: string) => {
    const next = [
      ...activities,
      {
        slug: makeSlug(),
        properties: { type, ...defaultPropertiesForType(type) },
        order: activities.length + 1,
        children: [],
      },
    ];
    setActivities(next);
    setSecondary({ kind: "edit", index: next.length - 1 });
  };

  const updateActivity = (index: number, partial: Partial<Activity["properties"]>) => {
    setActivities(
      activities.map((a, i) =>
        i === index ? { ...a, properties: { ...a.properties, ...partial } } : a,
      ),
    );
  };

  const removeActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  // ─── Main list rendering ────────────────────────────────────────
  return (
    <div className="relative h-full">
      <div className="space-y-3">
        {isWaFamily && (
          <Select
            value={sendWindow}
            onValueChange={(v) => onChange({ send_window: v })}
          >
            <SelectTrigger className="h-10 bg-white">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                  W
                </span>
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {WA_SEND_WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Activities list */}
        {activities.length > 0 && (
          <div className="-mx-4 border-y divide-y">
            {activities.map((a, idx) => (
              <div
                key={a.slug}
                className="px-4 py-3 hover:bg-muted/30 flex items-center gap-3 cursor-pointer"
                onClick={() => setSecondary({ kind: "edit", index: idx })}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="shrink-0">
                  {CHANNEL_TYPE_ICON[a.properties?.type ?? ""] ?? (
                    <TypeIcon className="h-4 w-4 text-slate-600" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getMessageType(channel, a.properties?.type ?? "")?.label ?? "Activity"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {activitySummary(a)}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeActivity(idx);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* + Add activity button — replyagent uses a dashed outlined button
            that takes you straight to the launcher view. */}
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-50"
          onClick={() => setSecondary({ kind: "launcher" })}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add activity
        </Button>
      </div>

      {/* SecondaryBar overlay */}
      <SecondaryBar
        open={secondary?.kind === "launcher"}
        title="Add activity"
        onClose={() => setSecondary(null)}
      >
        <ChannelLauncherGrid
          channel={channel}
          onPick={(type) => {
            addActivity(type);
          }}
        />
      </SecondaryBar>

      <SecondaryBar
        open={secondary?.kind === "edit"}
        title={
          secondary?.kind === "edit"
            ? getMessageType(channel, activities[secondary.index]?.properties?.type ?? "")?.label ?? "Edit activity"
            : ""
        }
        onClose={() => setSecondary(null)}
        footer={
          secondary?.kind === "edit" && (
            <Button onClick={() => setSecondary(null)}>Done</Button>
          )
        }
      >
        {secondary?.kind === "edit" && activities[secondary.index] && (
          <ActivityFieldForm
            channel={channel}
            activity={activities[secondary.index]}
            onChange={(partial) => updateActivity(secondary.index, partial)}
          />
        )}
      </SecondaryBar>
    </div>
  );
}

function defaultPropertiesForType(type: string): Record<string, any> {
  if (type === "delay") return { amount: 5, unit: "minutes" };
  if (type === "input") return { accumulator_window: 10, retry_attempts: 3 };
  return {};
}

function ChannelLauncherGrid({
  channel,
  onPick,
}: {
  channel: string;
  onPick: (type: string) => void;
}) {
  const types = getMessageTypes(channel);
  return (
    <div className="grid grid-cols-2 gap-2">
      {types.map((t) => (
        <button
          key={t.type}
          type="button"
          className="border rounded-md p-3 hover:bg-muted/40 flex items-center gap-2 text-sm text-left"
          onClick={() => onPick(t.type)}
        >
          <span className="text-slate-600">
            {CHANNEL_TYPE_ICON[t.type] ?? <TypeIcon className="h-4 w-4" />}
          </span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function ActivityFieldForm({
  channel,
  activity,
  onChange,
}: {
  channel: string;
  activity: Activity;
  onChange: (partial: Record<string, any>) => void;
}) {
  const typeSchema = getMessageType(channel, activity.properties?.type ?? "");
  if (!typeSchema) {
    return (
      <p className="text-sm text-muted-foreground">
        Unknown activity type: {activity.properties?.type}
      </p>
    );
  }
  return (
    <SchemaForm
      fields={typeSchema.fields as any[]}
      value={activity.properties ?? {}}
      onChange={(next) => onChange(next)}
    />
  );
}

// ─── TriggerActivitiesPanel ───────────────────────────────────────────

const TRIGGER_EVENT_ICON: Record<string, React.ReactNode> = {
  default_url: (
    <span className="h-6 w-6 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-700">
      N
    </span>
  ),
  contact_added: <User className="h-4 w-4 text-slate-600" />,
  contact_deleted: <User className="h-4 w-4 text-slate-600" />,
  tag_applied: <Tag className="h-4 w-4 text-orange-600" />,
  tag_removed: <Tag className="h-4 w-4 text-orange-600" />,
  date_field_changed: <ClockIcon className="h-4 w-4 text-slate-600" />,
  custom_field_changed: <Database className="h-4 w-4 text-slate-600" />,
  system_field_changed: <Cog className="h-4 w-4 text-slate-600" />,
  conversation_marked_as_done: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  conversation_assigned: <User className="h-4 w-4 text-slate-600" />,
  broadcast: <Bell className="h-4 w-4 text-emerald-600" />,
  subscribed_to_flow: <Bell className="h-4 w-4 text-emerald-600" />,
  unsubscribed_from_flow: <Bell className="h-4 w-4 text-emerald-600" />,
  api_trigger: <Link2 className="h-4 w-4 text-emerald-600" />,
  whatsapp_url: <Link2 className="h-4 w-4 text-emerald-600" />,
  telegram_url: <Link2 className="h-4 w-4 text-sky-600" />,
  webchat_url: <Link2 className="h-4 w-4 text-orange-600" />,
  evolution_url: <Link2 className="h-4 w-4 text-violet-600" />,
  zapi_url: <Link2 className="h-4 w-4 text-emerald-700" />,
  fb_messenger_ref_start: <Link2 className="h-4 w-4 text-blue-600" />,
  ig_ref_start: <Link2 className="h-4 w-4 text-fuchsia-600" />,
  wa_keyword: <KeyRound className="h-4 w-4 text-emerald-600" />,
  tg_keyword: <KeyRound className="h-4 w-4 text-sky-600" />,
  ig_keyword: <KeyRound className="h-4 w-4 text-fuchsia-600" />,
  fb_keyword: <KeyRound className="h-4 w-4 text-blue-600" />,
  wc_keyword: <KeyRound className="h-4 w-4 text-orange-600" />,
  twilio_keyword: <KeyRound className="h-4 w-4 text-amber-600" />,
  evolution_keyword: <KeyRound className="h-4 w-4 text-violet-600" />,
  zapi_keyword: <KeyRound className="h-4 w-4 text-emerald-700" />,
  wa_ref_start: <Link2 className="h-4 w-4 text-emerald-600" />,
  wa_ad_clicked: <Hand className="h-4 w-4 text-emerald-600" />,
  ig_story_mention: <ImageIcon className="h-4 w-4 text-fuchsia-600" />,
  ig_comment_reply: <MessageSquare className="h-4 w-4 text-fuchsia-600" />,
  fb_comment: <MessageSquare className="h-4 w-4 text-blue-600" />,
  fb_topic_subscribed: <MessageSquare className="h-4 w-4 text-blue-600" />,
  opportunity_stage_moved: <User className="h-4 w-4 text-violet-600" />,
};

interface TriggerActivity {
  slug: string;
  event: string;
  properties?: Record<string, any>;
  order?: number;
}

/**
 * Per-event preview line — mirrors replyagent's Trigger.vue activity rows
 * that show the picked tag / keyword list / URL / field name underneath the
 * event label. The actual resolved labels (tag name, field name) require a
 * lookup we don't have synchronously available here, so we render the IDs
 * with a short prefix; the secondary editor shows the full picker on click.
 */
function triggerActivitySummary(act: TriggerActivity): string {
  const p = act.properties ?? {};
  const ev = act.event;

  // Tag triggers — show "tag #<id>" (resolved name lives in the secondary editor)
  if (ev === "tag_applied" || ev === "tag_removed") {
    if (p.tag_id) return `Tag #${p.tag_id}`;
    return "(pick a tag)";
  }

  // Custom / system field triggers
  if (ev === "custom_field_changed") {
    return p.field_id ? `Field #${p.field_id}${p.value ? ` = ${p.value}` : ""}` : "(pick a field)";
  }
  if (ev === "system_field_changed") {
    return p.field ? `${p.field}${p.value ? ` = ${p.value}` : ""}` : "(pick a field)";
  }
  if (ev === "date_field_changed") {
    if (!p.field_id) return "(pick a date field)";
    const off = p.offset_amount != null ? `${p.condition ?? "on"} ${p.offset_amount} ${p.offset_unit ?? ""}` : "";
    return `Field #${p.field_id} ${off}`.trim();
  }

  // Contact lifecycle
  if (ev === "contact_added") {
    if (p.source) return `Source: ${p.source}`;
    return "Any source";
  }
  if (ev === "contact_deleted") return "Any source";

  // URL triggers
  if (
    ev === "default_url" ||
    ev === "telegram_url" ||
    ev === "whatsapp_url" ||
    ev === "webchat_url" ||
    ev === "evolution_url" ||
    ev === "zapi_url" ||
    ev === "fb_messenger_ref_start" ||
    ev === "ig_ref_start"
  ) {
    if (p.ref) return `Ref: ${p.ref}`;
    if (p.url) return String(p.url).split("?")[0];
    return "Trigger URL";
  }

  // Keyword triggers
  if (ev.endsWith("_keyword")) {
    const kws: string[] = Array.isArray(p.keywords) ? p.keywords : [];
    if (kws.length === 0) return "(no keywords)";
    const list = kws.slice(0, 3).join(", ");
    return kws.length > 3 ? `${list}…` : list;
  }

  // Channel ref / ad
  if (ev === "wa_ref_start") return p.ref_code ? `Ref: ${p.ref_code}` : "(set ref code)";
  if (ev === "wa_ad_clicked") return p.ad_id ? `Ad #${p.ad_id}` : "Any ad";

  // FB / IG comment triggers
  if (ev === "fb_comment" || ev === "ig_comment_reply") {
    const kws: string[] = Array.isArray(p.keywords) ? p.keywords : [];
    if (kws.length) return `${kws.slice(0, 2).join(", ")}${kws.length > 2 ? "…" : ""}`;
    return p.post_id ? `Post #${p.post_id}` : "Any post / keyword";
  }

  // Conversation
  if (ev === "conversation_marked_as_done") return p.channel ? `Channel: ${p.channel}` : "Any channel";
  if (ev === "conversation_assigned") return p.user_id ? `Agent #${p.user_id}` : "Any agent";

  // Pipeline
  if (ev === "opportunity_stage_moved") {
    if (p.stage_id) return `Stage #${p.stage_id}`;
    if (p.pipeline_id) return `Pipeline #${p.pipeline_id}`;
    return "(pick pipeline)";
  }

  return "";
}

export function TriggerActivitiesPanel({
  nodeData,
  onChange,
  onOpenTriggersModal,
}: {
  nodeData: any;
  onChange: (partial: Record<string, any>) => void;
  onOpenTriggersModal: () => void;
}) {
  const activities: TriggerActivity[] = nodeData?.activities ?? [];

  // Bootstrap with a Default URL activity if the list is empty — replyagent
  // does this so the trigger node is never blank.
  const list: TriggerActivity[] = activities.length
    ? activities
    : [{ slug: "_default", event: "default_url", properties: {} }];

  const [secondary, setSecondary] = useState<
    | null
    | { kind: "edit"; index: number }
  >(null);

  const setActivities = (next: TriggerActivity[]) => onChange({ activities: next });

  const removeAt = (idx: number) =>
    setActivities(list.filter((_, i) => i !== idx));

  const updateAt = (idx: number, partial: Record<string, any>) =>
    setActivities(
      list.map((a, i) =>
        i === idx ? { ...a, properties: { ...(a.properties ?? {}), ...partial } } : a,
      ),
    );

  return (
    <div className="relative h-full">
      <div className="-mx-4 border-y divide-y">
        {list.map((act, idx) => {
          const schema = getTriggerSchema(act.event);
          const isDefault = act.event === "default_url";
          const summary = triggerActivitySummary(act);
          return (
            <div
              key={act.slug}
              className="px-4 py-3 hover:bg-muted/30 flex items-center gap-3 cursor-pointer"
              onClick={() => setSecondary({ kind: "edit", index: idx })}
            >
              <span className="shrink-0">
                {TRIGGER_EVENT_ICON[act.event] ?? (
                  <Bell className="h-4 w-4 text-slate-600" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {schema?.label ?? act.event}
                </p>
                {summary && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {summary}
                  </p>
                )}
              </div>
              {/* Delete visible on every non-Default trigger — replyagent
                  parity: a single "Tag applied" row without a Default is
                  still deletable. The Default URL row is protected because
                  the flow needs at least one entry point. */}
              {!isDefault && (
                <button
                  type="button"
                  className="text-rose-500 hover:text-rose-600 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(idx);
                  }}
                  title="Delete trigger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="pt-3">
        <Button
          type="button"
          variant="outline"
          className="w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-medium"
          onClick={onOpenTriggersModal}
        >
          Add a trigger
        </Button>
      </div>

      <SecondaryBar
        open={secondary?.kind === "edit"}
        title={
          secondary?.kind === "edit"
            ? getTriggerSchema(list[secondary.index]?.event ?? "")?.label ?? "Edit trigger"
            : ""
        }
        onClose={() => setSecondary(null)}
        footer={
          secondary?.kind === "edit" && (
            <Button onClick={() => setSecondary(null)}>Done</Button>
          )
        }
      >
        {secondary?.kind === "edit" && list[secondary.index] && (
          <TriggerFieldForm
            event={list[secondary.index].event}
            value={list[secondary.index].properties ?? {}}
            onChange={(partial) => updateAt(secondary.index, partial)}
          />
        )}
      </SecondaryBar>
    </div>
  );
}

function TriggerFieldForm({
  event,
  value,
  onChange,
}: {
  event: string;
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const schema = getTriggerSchema(event);
  if (!schema) {
    return <p className="text-sm text-muted-foreground">Unknown trigger: {event}</p>;
  }
  return (
    <SchemaForm fields={schema.fields as any[]} value={value} onChange={onChange} />
  );
}

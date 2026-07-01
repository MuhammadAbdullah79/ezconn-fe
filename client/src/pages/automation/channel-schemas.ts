/**
 * Channel message-type schemas — replyagent parity for what each channel
 * node's "Add new" dropdown offers and what fields each type's editor
 * exposes.
 *
 * Channel-by-channel inventory:
 *   WhatsApp / Zapi / Evolution — full rich messaging (text, input, button,
 *     image, audio, message_list, message_template, chatgpt_question,
 *     dify_question, cta_button)
 *   Telegram / Instagram / Messenger / Webchat — basic set (text, input,
 *     button, image, audio, chatgpt_question, dify_question)
 *   Twilio SMS — text + input only
 *   Twilio Call — call initiation
 */

import type { FieldType } from './action-schemas';

export interface MessageFieldSchema {
  key: string;
  label: string;
  type: FieldType | 'text-actions' | 'gallery-pick' | 'wa-template-pick' | 'choices-builder' | 'list-sections';
  // For text/textarea: paste interactions from TextActions floating bar.
  textActions?: string[]; // e.g. ['emoji', 'keys', 'counter']
  maxLength?: number;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  dependsOn?: { field: string; equals?: string };
  defaultValue?: any;
  options?: Array<{ value: string; label: string }>;
  // For `type: 'channel-account'` fields — which channel's connected accounts
  // to offer in the picker (e.g. 'twilio', 'whatsapp').
  channel?: string;
  // For `type: 'gallery-pick'` fields — filter the media gallery so a
  // video activity only surfaces videos, a document activity only shows
  // documents, etc. Defaults to `image` in the picker when omitted.
  mediaType?: 'image' | 'audio' | 'video' | 'document';
}

export interface MessageTypeSchema {
  type: string;
  label: string;
  icon: string; // FA icon name
  fields: MessageFieldSchema[];
}

const TEXT_BODY_FIELDS = (
  maxLen: number,
  showStyleBar: boolean = true,
): MessageFieldSchema[] => [
  {
    key: 'message',
    label: 'Message',
    type: 'textarea',
    textActions: ['emoji', 'keys', 'counter'],
    maxLength: maxLen,
    required: true,
    helpText: showStyleBar
      ? 'Tip: select text then click B / I / S / Code to format.'
      : undefined,
  },
];

const INPUT_FIELDS: MessageFieldSchema[] = [
  ...TEXT_BODY_FIELDS(4096),
  { key: 'save_to_field_id', label: 'Save reply to (custom field)', type: 'custom-field', required: true },
  {
    key: 'accumulator_enabled',
    label: 'Wait for follow-ups',
    type: 'checkbox',
    helpText: 'Combine messages received within X seconds into one reply',
  },
  {
    key: 'accumulator_window',
    label: 'Accumulator window (seconds)',
    type: 'number',
    dependsOn: { field: 'accumulator_enabled', equals: 'true' },
    defaultValue: 10,
    helpText: 'Min 5, max 20',
  },
  { key: 'retry_enabled', label: 'Retry on invalid reply', type: 'checkbox' },
  {
    key: 'retry_message',
    label: 'Retry message',
    type: 'textarea',
    textActions: ['emoji', 'keys', 'counter'],
    maxLength: 250,
    dependsOn: { field: 'retry_enabled', equals: 'true' },
  },
  {
    key: 'retry_with_results',
    label: 'Retry message with matching result',
    type: 'textarea',
    textActions: ['emoji', 'keys', 'counter'],
    maxLength: 250,
    dependsOn: { field: 'retry_enabled', equals: 'true' },
    helpText: 'Use {{matching_result}} to show what was understood',
  },
  {
    key: 'retry_attempts',
    label: 'Max retry attempts (0-5)',
    type: 'number',
    dependsOn: { field: 'retry_enabled', equals: 'true' },
    defaultValue: 3,
  },
  { key: 'expiry_enabled', label: 'Stop waiting after', type: 'checkbox' },
  {
    key: 'expiry_amount',
    label: 'Expiry amount',
    type: 'number',
    dependsOn: { field: 'expiry_enabled', equals: 'true' },
  },
  {
    key: 'expiry_unit',
    label: 'Expiry unit',
    type: 'select',
    options: [
      { value: 'seconds', label: 'Seconds' },
      { value: 'minutes', label: 'Minutes' },
      { value: 'hours', label: 'Hours' },
    ],
    dependsOn: { field: 'expiry_enabled', equals: 'true' },
    defaultValue: 'minutes',
  },
];

const CHATGPT_FIELDS: MessageFieldSchema[] = [
  { key: 'ai_agent_id', label: 'AI agent', type: 'ai-agent', required: true },
  { key: 'question', label: 'Question / prompt', type: 'textarea', textActions: ['emoji', 'keys', 'counter'], maxLength: 4096, required: true },
  { key: 'save_to_field_id', label: 'Save answer to', type: 'custom-field' },
  { key: 'smart_loop', label: 'Smart loop (retry until valid)', type: 'checkbox' },
  { key: 'wait_replies', label: 'Wait for user reply', type: 'checkbox' },
  { key: 'counter_field', label: 'Counter field', type: 'custom-field' },
  { key: 'expiry_amount', label: 'Expiry amount', type: 'number' },
  {
    key: 'expiry_unit',
    label: 'Expiry unit',
    type: 'select',
    options: [
      { value: 'seconds', label: 'Seconds' },
      { value: 'minutes', label: 'Minutes' },
      { value: 'hours', label: 'Hours' },
    ],
  },
  // ─── Vision tab (replyagent parity — separate sub-tab inside ChatGPT) ──
  { key: 'enable_vision', label: 'Enable vision', type: 'checkbox', helpText: 'Lets the agent analyse a sent image (URL or custom field)' },
  {
    key: 'vision_model',
    label: 'Vision model',
    type: 'select',
    options: [
      { value: 'gpt-4o-mini', label: 'GPT-4o mini (cheap, fast)' },
      { value: 'gpt-4o', label: 'GPT-4o (balanced)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 turbo (highest quality)' },
    ],
    dependsOn: { field: 'enable_vision', equals: 'true' },
    defaultValue: 'gpt-4o-mini',
  },
  {
    key: 'vision_prompt',
    label: 'Vision prompt',
    type: 'textarea',
    textActions: ['emoji', 'keys', 'counter'],
    maxLength: 1000,
    dependsOn: { field: 'enable_vision', equals: 'true' },
    helpText: 'Instructions for what to look for in the image',
  },
  {
    key: 'vision_custom_field',
    label: 'Image source (custom field holding URL)',
    type: 'custom-field',
    dependsOn: { field: 'enable_vision', equals: 'true' },
  },
];

const DIFY_FIELDS: MessageFieldSchema[] = [
  { key: 'dify_bot_id', label: 'Dify bot', type: 'dify-bot', required: true },
  { key: 'question', label: 'Question', type: 'textarea', textActions: ['emoji', 'keys'], maxLength: 4096, required: true },
  { key: 'save_to_field_id', label: 'Save answer to', type: 'custom-field' },
];

const IMAGE_URL_FIELDS: MessageFieldSchema[] = [
  {
    key: 'image_source',
    label: 'Source',
    type: 'select',
    options: [
      { value: 'gallery', label: 'Gallery upload' },
      { value: 'custom_field', label: 'Custom field URL' },
    ],
    defaultValue: 'gallery',
  },
  { key: 'gallery_media_id', label: 'Pick image', type: 'gallery-pick', mediaType: 'image', dependsOn: { field: 'image_source', equals: 'gallery' } },
  { key: 'custom_field_id', label: 'Custom field', type: 'custom-field', dependsOn: { field: 'image_source', equals: 'custom_field' } },
];

const AUDIO_FIELDS: MessageFieldSchema[] = [
  {
    key: 'audio_source',
    label: 'Source',
    type: 'select',
    options: [
      { value: 'gallery', label: 'Gallery upload' },
      { value: 'custom_field', label: 'Custom field URL' },
    ],
    defaultValue: 'gallery',
  },
  { key: 'gallery_media_id', label: 'Pick audio', type: 'gallery-pick', mediaType: 'audio', dependsOn: { field: 'audio_source', equals: 'gallery' } },
  { key: 'custom_field_id', label: 'Custom field', type: 'custom-field', dependsOn: { field: 'audio_source', equals: 'custom_field' } },
];

const BUTTON_FIELDS = (urlMax: number, textMax: number): MessageFieldSchema[] => [
  ...TEXT_BODY_FIELDS(4096),
  { key: 'choices', label: 'Buttons / quick replies', type: 'choices-builder' },
];

// ─── WhatsApp message types (full set) ─────────────────────────────────
const WHATSAPP_TYPES: MessageTypeSchema[] = [
  {
    type: 'text',
    label: 'Text',
    icon: 'fa-text-height',
    fields: [
      ...TEXT_BODY_FIELDS(4096),
      { key: 'presence', label: 'Show "typing…" indicator', type: 'checkbox', helpText: 'Official WhatsApp Cloud only' },
    ],
  },
  { type: 'input', label: 'Contact response', icon: 'fa-user-edit', fields: INPUT_FIELDS },
  { type: 'button', label: 'Buttons', icon: 'fa-mouse-pointer', fields: BUTTON_FIELDS(0, 20) },
  { type: 'image_url', label: 'Image', icon: 'fa-image', fields: IMAGE_URL_FIELDS },
  { type: 'audio', label: 'Audio', icon: 'fa-microphone', fields: AUDIO_FIELDS },
  {
    type: 'video',
    label: 'Video',
    icon: 'fa-video',
    fields: [
      {
        key: 'video_source',
        label: 'Source',
        type: 'select',
        options: [
          { value: 'gallery', label: 'Gallery upload' },
          { value: 'custom_field', label: 'Custom field URL' },
        ],
        defaultValue: 'gallery',
      },
      { key: 'gallery_media_id', label: 'Pick video', type: 'gallery-pick', mediaType: 'video', dependsOn: { field: 'video_source', equals: 'gallery' } },
      { key: 'custom_field_id', label: 'Custom field', type: 'custom-field', dependsOn: { field: 'video_source', equals: 'custom_field' } },
      { key: 'caption', label: 'Caption (optional)', type: 'textarea', textActions: ['emoji', 'keys', 'counter'], maxLength: 1024 },
    ],
  },
  {
    type: 'document',
    label: 'Document',
    icon: 'fa-file-alt',
    fields: [
      {
        key: 'doc_source',
        label: 'Source',
        type: 'select',
        options: [
          { value: 'gallery', label: 'Gallery upload' },
          { value: 'custom_field', label: 'Custom field URL' },
        ],
        defaultValue: 'gallery',
      },
      { key: 'gallery_media_id', label: 'Pick document', type: 'gallery-pick', mediaType: 'document', dependsOn: { field: 'doc_source', equals: 'gallery' } },
      { key: 'custom_field_id', label: 'Custom field', type: 'custom-field', dependsOn: { field: 'doc_source', equals: 'custom_field' } },
      { key: 'filename', label: 'File name (shown to recipient)', type: 'text', maxLength: 240 },
    ],
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: 'fa-clock',
    fields: [
      { key: 'amount', label: 'Wait amount', type: 'number', required: true, defaultValue: 5 },
      {
        key: 'unit',
        label: 'Unit',
        type: 'select',
        options: [
          { value: 'seconds', label: 'Seconds' },
          { value: 'minutes', label: 'Minutes' },
          { value: 'hours', label: 'Hours' },
          { value: 'days', label: 'Days' },
        ],
        defaultValue: 'seconds',
      },
    ],
  },
  {
    type: 'message_list',
    label: 'Message List',
    icon: 'fa-list-ul',
    fields: [
      { key: 'header', label: 'Header', type: 'text', maxLength: 60 },
      { key: 'body', label: 'Body', type: 'textarea', maxLength: 1024, required: true, textActions: ['emoji', 'keys', 'counter'] },
      { key: 'footer', label: 'Footer', type: 'text', maxLength: 60 },
      { key: 'button', label: 'Open list button text', type: 'text', maxLength: 20, required: true },
      { key: 'sections', label: 'Sections (max 10, options max 10 each)', type: 'list-sections' },
    ],
  },
  {
    type: 'message_template',
    label: 'Message templates',
    icon: 'fa-file-signature',
    fields: [
      { key: 'template_id', label: 'WA template', type: 'wa-template-pick', required: true },
      { key: 'template_params', label: 'Parameter values', type: 'json', helpText: 'Map of {{1}}, {{2}}, … to values or {{contact.x}} tokens' },
    ],
  },
  { type: 'chatgpt_question', label: 'AI Studio Question', icon: 'fa-brain', fields: CHATGPT_FIELDS },
  { type: 'dify_question', label: 'ChatGPT Answer', icon: 'fa-question-circle', fields: DIFY_FIELDS },
  {
    type: 'cta_button',
    label: 'CTA Button',
    icon: 'fa-bolt',
    fields: [
      { key: 'header', label: 'Header', type: 'text', maxLength: 60 },
      { key: 'body', label: 'Body', type: 'textarea', maxLength: 1024, required: true, textActions: ['emoji', 'keys', 'counter'] },
      { key: 'footer', label: 'Footer', type: 'text', maxLength: 100 },
      { key: 'button_text', label: 'Button text', type: 'text', maxLength: 24, required: true },
      { key: 'button_url', label: 'Button URL', type: 'text', required: true },
    ],
  },
];

// ─── Card Slide (Messenger / Instagram) ───────────────────────────────
// Replyagent's Messenger.vue / Instagram.vue ship a "Card slide" message
// type — a horizontally swipeable carousel where each card has a title,
// subtitle, optional image, default-action URL and stacked buttons.
const CARD_SLIDE_FIELDS: MessageFieldSchema[] = [
  {
    key: 'media_source',
    label: 'Media source',
    type: 'select',
    options: [
      { value: 'gallery', label: 'Gallery upload' },
      { value: 'url', label: 'URL' },
    ],
    defaultValue: 'gallery',
  },
  { key: 'gallery_media_id', label: 'Pick image', type: 'gallery-pick', dependsOn: { field: 'media_source', equals: 'gallery' } },
  { key: 'media_url', label: 'Image URL', type: 'text', dependsOn: { field: 'media_source', equals: 'url' } },
  { key: 'title', label: 'Card title', type: 'text', maxLength: 80, required: true },
  { key: 'subtitle', label: 'Card subtitle', type: 'text', maxLength: 80 },
  { key: 'default_action_url', label: 'Default action URL (tap to open)', type: 'text', maxLength: 1000, helpText: 'https://…' },
  { key: 'choices', label: 'Card buttons (up to 3)', type: 'choices-builder' },
];

// ─── Card Button (one button row under a Card Slide) ──────────────────
const CARD_BUTTON_FIELDS: MessageFieldSchema[] = [
  { key: 'text', label: 'Button text', type: 'text', maxLength: 20, required: true },
  { key: 'url', label: 'URL (https://)', type: 'text' },
];

// ─── Messenger OTN (One-Time Notification) ────────────────────────────
// Replyagent's Messenger.vue carries the full Meta-prescribed OTN flow:
// pick a topic that the contact has subscribed to, choose between in_24h
// (regular message) or out_24h (template or tag-based broadcast), respect
// 5/day, 10/week, 1/per-topic-week caps.
const OTN_FIELDS: MessageFieldSchema[] = [
  {
    key: 'window',
    label: 'Send within',
    type: 'select',
    options: [
      { value: 'in_24', label: 'In 24-hour window' },
      { value: 'out_24', label: 'Outside 24-hour window (OTN topic)' },
    ],
    defaultValue: 'in_24',
    helpText: 'Meta limits: 5/day, 10/week, 1/topic/week',
  },
  { key: 'topic_name', label: 'Topic name', type: 'text', maxLength: 60, required: true },
  { key: 'topic_description', label: 'Topic description', type: 'text', maxLength: 100 },
  { key: 'topic_token', label: 'OTN token (auto if blank)', type: 'text', dependsOn: { field: 'window', equals: 'out_24' } },
  {
    key: 'media_source',
    label: 'Media (optional)',
    type: 'select',
    options: [
      { value: 'none', label: 'None' },
      { value: 'gallery', label: 'Gallery upload' },
      { value: 'url', label: 'URL' },
    ],
    defaultValue: 'none',
  },
  { key: 'gallery_media_id', label: 'Pick image', type: 'gallery-pick', dependsOn: { field: 'media_source', equals: 'gallery' } },
  { key: 'media_url', label: 'Media URL', type: 'text', dependsOn: { field: 'media_source', equals: 'url' } },
  { key: 'message', label: 'Notification text', type: 'textarea', textActions: ['emoji', 'keys', 'counter'], maxLength: 1000, required: true },
];

// ─── Quick Reply Button (Messenger only — distinct from buttons[]) ────
const QUICK_REPLY_FIELDS: MessageFieldSchema[] = [
  { key: 'text', label: 'Button text', type: 'text', maxLength: 20, required: true },
  { key: 'payload', label: 'Payload (sent to handler)', type: 'text' },
];

// Telegram / Webchat — reduced set (no card/otn — only Messenger + Instagram have those)
const REDUCED_TYPES: MessageTypeSchema[] = [
  { type: 'text', label: 'Text', icon: 'fa-text-height', fields: TEXT_BODY_FIELDS(4096) },
  { type: 'input', label: 'Contact response', icon: 'fa-user-edit', fields: INPUT_FIELDS },
  {
    type: 'button',
    label: 'Buttons',
    icon: 'fa-mouse-pointer',
    fields: [
      ...TEXT_BODY_FIELDS(4096),
      { key: 'choices', label: 'Buttons', type: 'choices-builder' },
      { key: 'button_url', label: 'URL (optional, https://)', type: 'text', helpText: 'Telegram / Webchat only' },
    ],
  },
  { type: 'image_url', label: 'Image', icon: 'fa-image', fields: IMAGE_URL_FIELDS },
  { type: 'audio', label: 'Audio', icon: 'fa-microphone', fields: AUDIO_FIELDS },
  { type: 'chatgpt_question', label: 'ChatGPT question', icon: 'fa-brain', fields: CHATGPT_FIELDS },
  { type: 'dify_question', label: 'Dify question', icon: 'fa-question-circle', fields: DIFY_FIELDS },
];

// Messenger — REDUCED + Card Slide + Card Button + OTN + Quick Reply Button
const MESSENGER_TYPES: MessageTypeSchema[] = [
  ...REDUCED_TYPES,
  { type: 'card_slide', label: 'Card slide', icon: 'fa-images', fields: CARD_SLIDE_FIELDS },
  { type: 'card_button', label: 'Card button', icon: 'fa-mouse-pointer', fields: CARD_BUTTON_FIELDS },
  { type: 'otn', label: 'One-Time Notification', icon: 'fa-bell', fields: OTN_FIELDS },
  { type: 'quick_reply_button', label: 'Quick reply button', icon: 'fa-reply', fields: QUICK_REPLY_FIELDS },
];

// Instagram — REDUCED + Card Slide + Card Button (no OTN, no Quick Reply)
const INSTAGRAM_TYPES: MessageTypeSchema[] = [
  ...REDUCED_TYPES,
  { type: 'card_slide', label: 'Card slide', icon: 'fa-images', fields: CARD_SLIDE_FIELDS },
  { type: 'card_button', label: 'Card button', icon: 'fa-mouse-pointer', fields: CARD_BUTTON_FIELDS },
];

// Twilio SMS — text + input only
const TWILIO_SMS_TYPES: MessageTypeSchema[] = [
  {
    type: 'text',
    label: 'Text',
    icon: 'fa-text-height',
    fields: [
      { key: 'sender_id', label: 'Twilio number', type: 'channel-account', channel: 'twilio', required: true },
      ...TEXT_BODY_FIELDS(1600, false),
      {
        key: 'receiver_type',
        label: 'Send to',
        type: 'select',
        options: [
          { value: 'system', label: 'Contact primary phone' },
          { value: 'custom', label: 'Custom field' },
        ],
        defaultValue: 'system',
      },
      { key: 'receiver_field_id', label: 'Custom phone field', type: 'custom-field', dependsOn: { field: 'receiver_type', equals: 'custom' } },
    ],
  },
  {
    type: 'input',
    label: 'Ask question',
    icon: 'fa-user-edit',
    fields: [
      { key: 'sender_id', label: 'Twilio number', type: 'channel-account', channel: 'twilio', required: true },
      ...INPUT_FIELDS,
    ],
  },
];

// Twilio Call — call only
const TWILIO_CALL_TYPES: MessageTypeSchema[] = [
  {
    type: 'call',
    label: 'Initiate call',
    icon: 'fa-phone',
    fields: [
      { key: 'sender_id', label: 'Twilio number', type: 'channel-account', channel: 'twilio', required: true },
      {
        key: 'receiver_type',
        label: 'Call to',
        type: 'select',
        options: [
          { value: 'system', label: 'Contact primary phone' },
          { value: 'custom', label: 'Custom field' },
        ],
        defaultValue: 'system',
      },
      { key: 'receiver_field_id', label: 'Custom phone field', type: 'custom-field', dependsOn: { field: 'receiver_type', equals: 'custom' } },
      { key: 'twiml_url', label: 'TwiML URL', type: 'text', helpText: 'URL serving TwiML XML for call instructions' },
    ],
  },
];

export const CHANNEL_MESSAGE_TYPES: Record<string, MessageTypeSchema[]> = {
  whatsapp: WHATSAPP_TYPES,
  zapi: WHATSAPP_TYPES, // full parity
  evolution: WHATSAPP_TYPES, // full parity
  telegram: REDUCED_TYPES,
  instagram: INSTAGRAM_TYPES, // REDUCED + card_slide + card_button
  messenger: MESSENGER_TYPES, // REDUCED + card_slide + card_button + otn + quick_reply_button
  webchat: REDUCED_TYPES,
  twilio_sms: TWILIO_SMS_TYPES,
  twilio_call: TWILIO_CALL_TYPES,
};

export function getMessageTypes(channel: string): MessageTypeSchema[] {
  return CHANNEL_MESSAGE_TYPES[channel] ?? [];
}

export function getMessageType(
  channel: string,
  type: string,
): MessageTypeSchema | null {
  return getMessageTypes(channel).find((t) => t.type === type) ?? null;
}

export const CHANNEL_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', icon: 'fa-whatsapp', color: 'text-emerald-600' },
  telegram: { label: 'Telegram', icon: 'fa-telegram', color: 'text-sky-600' },
  messenger: { label: 'Messenger', icon: 'fa-facebook-messenger', color: 'text-blue-600' },
  instagram: { label: 'Instagram', icon: 'fa-instagram', color: 'text-fuchsia-600' },
  webchat: { label: 'Webchat', icon: 'fa-comment', color: 'text-orange-600' },
  twilio_sms: { label: 'SMS', icon: 'fa-comment', color: 'text-amber-600' },
  twilio_call: { label: 'Call', icon: 'fa-phone', color: 'text-rose-600' },
  zapi: { label: 'Z-API', icon: 'fa-whatsapp', color: 'text-emerald-700' },
  evolution: { label: 'Evolution', icon: 'fa-whatsapp', color: 'text-violet-600' },
};

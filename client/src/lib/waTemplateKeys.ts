/**
 * "Map keys" merge tags for WhatsApp template variables — mirrors replyagent's
 * `ManageTemplate.vue` `state.keys` seed (gateway-frontend line 2502-2557).
 *
 * replyagent does not let you type a free sample string for a template
 * variable — each `{{n}}` is mapped, via a dropdown, to one of these tokens.
 * The token itself IS the Meta example value (sanitized) AND the literal
 * substituted into the message at send time (`ContactHelper::replaceKeys`,
 * `broadcast-processor.service.ts` `resolveTokens` on the EZCONN side).
 *
 * EZCONN's composer additionally allows a free-text sample (useful when no
 * merge tag fits), so this list augments rather than replaces that input.
 */
export interface WaTemplateKey {
  value: string;
  label: string;
  type: "system" | "custom" | "agent";
}

export const SYSTEM_KEYS: WaTemplateKey[] = [
  { value: "[CONTACT_FIRST_NAME]", label: "First Name", type: "system" },
  { value: "[CONTACT_LAST_NAME]", label: "Last Name", type: "system" },
  { value: "[CONTACT_FULL_NAME]", label: "Full name", type: "system" },
  { value: "[CONTACT_TITLE]", label: "Title", type: "system" },
  { value: "[CREATED_AT]", label: "Registered on", type: "system" },
  { value: "[CURRENT_DATETIME]", label: "Current Datetime", type: "system" },
];

/** Agent-notification-only keys — replyagent's Agent Template mode. */
export const AGENT_KEYS: WaTemplateKey[] = [
  { value: "[AGENT_NAME]", label: "Agent name", type: "agent" },
  { value: "[CONTACT_NAME]", label: "Contact name", type: "agent" },
  { value: "[CONTACT_ID]", label: "Contact ID", type: "agent" },
];

/** Build the full key list for the given template mode, folding in the workspace's custom fields. */
export function waTemplateKeysFor(
  mode: "template" | "carousel" | "notification",
  customFields: Array<{ slug: string; label: string }> = [],
): WaTemplateKey[] {
  const custom: WaTemplateKey[] = customFields.map((f) => ({
    value: `[${f.slug}]`,
    label: f.label,
    type: "custom",
  }));
  if (mode === "notification") return AGENT_KEYS;
  return [...SYSTEM_KEYS, ...custom];
}

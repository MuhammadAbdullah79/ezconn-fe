/**
 * WhatsApp message-template languages, exactly the set replyagent's template
 * screens offer (gateway-frontend `ManageTemplate.vue` / `WhatsappTemplates.vue`).
 *
 * `slug` is the Meta locale code and is what gets submitted — Meta rejects
 * anything else, which is why the old six-entry "English / French / German…"
 * picker produced templates Meta refused. replyagent's own list contains a
 * duplicate `nl` entry; it is dropped here so React keys stay unique.
 */
export interface WaTemplateLanguage {
  slug: string;
  name: string;
}

export const WA_TEMPLATE_LANGUAGES: WaTemplateLanguage[] = [
  { slug: "af", name: "Afrikaans" },
  { slug: "sq", name: "Albanian" },
  { slug: "ar", name: "Arabic" },
  { slug: "az", name: "Azerbaijani" },
  { slug: "bn", name: "Bengali" },
  { slug: "bg", name: "Bulgarian" },
  { slug: "ca", name: "Catalan" },
  { slug: "zh_CN", name: "Chinese (CHN)" },
  { slug: "zh_HK", name: "Chinese (HKG)" },
  { slug: "zh_TW", name: "Chinese (TAI)" },
  { slug: "hr", name: "Croatian" },
  { slug: "cs", name: "Czech" },
  { slug: "da", name: "Danish" },
  { slug: "nl", name: "Dutch" },
  { slug: "en", name: "English" },
  { slug: "en_GB", name: "English (UK)" },
  { slug: "en_US", name: "English (US)" },
  { slug: "et", name: "Estonian" },
  { slug: "fil", name: "Filipino" },
  { slug: "fi", name: "Finnish" },
  { slug: "fr", name: "French" },
  { slug: "ka", name: "Georgian" },
  { slug: "de", name: "German" },
  { slug: "el", name: "Greek" },
  { slug: "gu", name: "Gujarati" },
  { slug: "ha", name: "Hausa" },
  { slug: "he", name: "Hebrew" },
  { slug: "hi", name: "Hindi" },
  { slug: "hu", name: "Hungarian" },
  { slug: "id", name: "Indonesian" },
  { slug: "ga", name: "Irish" },
  { slug: "it", name: "Italian" },
  { slug: "ja", name: "Japanese" },
  { slug: "kn", name: "Kannada" },
  { slug: "kk", name: "Kazakh" },
  { slug: "rw_RW", name: "Kinyarwanda" },
  { slug: "ko", name: "Korean" },
  { slug: "ky_KG", name: "Kyrgyz (Kyrgyzstan)" },
  { slug: "lo", name: "Lao" },
  { slug: "lv", name: "Latvian" },
  { slug: "lt", name: "Lithuanian" },
  { slug: "mk", name: "Macedonian" },
  { slug: "ms", name: "Malay" },
  { slug: "ml", name: "Malayalam" },
  { slug: "mr", name: "Marathi" },
  { slug: "nb", name: "Norwegian" },
  { slug: "fa", name: "Persian" },
  { slug: "pl", name: "Polish" },
  { slug: "pt_BR", name: "Portuguese (BR)" },
  { slug: "pt_PT", name: "Portuguese (POR)" },
  { slug: "pa", name: "Punjabi" },
  { slug: "ro", name: "Romanian" },
  { slug: "ru", name: "Russian" },
  { slug: "sr", name: "Serbian" },
  { slug: "sk", name: "Slovak" },
  { slug: "sl", name: "Slovenian" },
  { slug: "es", name: "Spanish" },
  { slug: "es_AR", name: "Spanish (ARG)" },
  { slug: "es_ES", name: "Spanish (SPA)" },
  { slug: "es_MX", name: "Spanish (MEX)" },
  { slug: "sw", name: "Swahili" },
  { slug: "sv", name: "Swedish" },
  { slug: "ta", name: "Tamil" },
  { slug: "te", name: "Telugu" },
  { slug: "th", name: "Thai" },
  { slug: "tr", name: "Turkish" },
  { slug: "uk", name: "Ukrainian" },
  { slug: "ur", name: "Urdu" },
  { slug: "uz", name: "Uzbek" },
  { slug: "vi", name: "Vietnamese" },
  { slug: "zu", name: "Zulu" },
];

/** `en_US` → "English (US)"; unknown codes render as-is. */
export function waLanguageLabel(slug: string): string {
  return WA_TEMPLATE_LANGUAGES.find((l) => l.slug === slug)?.name ?? slug;
}

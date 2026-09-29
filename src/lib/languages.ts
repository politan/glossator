import type { PromptProfileId } from './prompts/profile-id';

export type LanguageCode = string;

interface LanguageInfo {
  /** Name used in prompts. */
  english: string;
  /** Code TranslateGemma expects, when it differs from Glossa's. */
  translateGemmaCode?: string;
}

// From the Hy-MT2 model card; names are the ones the model was trained with.
const HY_MT: Record<LanguageCode, LanguageInfo> = {
  zh: { english: 'Chinese' },
  en: { english: 'English' },
  fr: { english: 'French' },
  pt: { english: 'Portuguese' },
  es: { english: 'Spanish' },
  ja: { english: 'Japanese' },
  tr: { english: 'Turkish' },
  ru: { english: 'Russian' },
  ar: { english: 'Arabic' },
  ko: { english: 'Korean' },
  th: { english: 'Thai' },
  it: { english: 'Italian' },
  de: { english: 'German' },
  vi: { english: 'Vietnamese' },
  ms: { english: 'Malay' },
  id: { english: 'Indonesian' },
  tl: { english: 'Filipino', translateGemmaCode: 'fil' },
  hi: { english: 'Hindi' },
  'zh-Hant': { english: 'Traditional Chinese', translateGemmaCode: 'zh-TW' },
  pl: { english: 'Polish' },
  cs: { english: 'Czech' },
  nl: { english: 'Dutch' },
  km: { english: 'Khmer' },
  my: { english: 'Burmese' },
  fa: { english: 'Persian' },
  gu: { english: 'Gujarati' },
  ur: { english: 'Urdu' },
  te: { english: 'Telugu' },
  mr: { english: 'Marathi' },
  he: { english: 'Hebrew' },
  bn: { english: 'Bengali' },
  ta: { english: 'Tamil' },
  uk: { english: 'Ukrainian' },
  bo: { english: 'Tibetan' },
  kk: { english: 'Kazakh' },
  mn: { english: 'Mongolian' },
  ug: { english: 'Uyghur' },
  yue: { english: 'Cantonese' },
};

// European languages general-purpose models handle well but HY-MT does not cover.
const EUROPEAN_EXTRAS: Record<LanguageCode, LanguageInfo> = {
  bg: { english: 'Bulgarian' },
  da: { english: 'Danish' },
  el: { english: 'Greek' },
  et: { english: 'Estonian' },
  fi: { english: 'Finnish' },
  hr: { english: 'Croatian' },
  hu: { english: 'Hungarian' },
  lt: { english: 'Lithuanian' },
  lv: { english: 'Latvian' },
  nb: { english: 'Norwegian', translateGemmaCode: 'no' },
  ro: { english: 'Romanian' },
  sk: { english: 'Slovak' },
  sl: { english: 'Slovenian' },
  sr: { english: 'Serbian' },
  sv: { english: 'Swedish' },
};

// Further languages TranslateGemma was evaluated on (WMT24++, tech report arXiv 2601.09012).
const TRANSLATEGEMMA_EXTRAS: Record<LanguageCode, LanguageInfo> = {
  ca: { english: 'Catalan' },
  is: { english: 'Icelandic' },
  kn: { english: 'Kannada' },
  ml: { english: 'Malayalam' },
  pa: { english: 'Punjabi' },
  sw: { english: 'Swahili' },
  zu: { english: 'Zulu' },
};

const ALL: Record<LanguageCode, LanguageInfo> = {
  ...HY_MT,
  ...EUROPEAN_EXTRAS,
  ...TRANSLATEGEMMA_EXTRAS,
};

// prettier-ignore
const TRANSLATEGEMMA_CODES: readonly LanguageCode[] = [
  'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fr', 'gu',
  'he', 'hi', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'nb',
  'nl', 'pa', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tl',
  'tr', 'uk', 'ur', 'vi', 'zh', 'zh-Hant', 'zu',
];

const CODES_BY_PROFILE: Record<PromptProfileId, readonly LanguageCode[]> = {
  'hy-mt': Object.keys(HY_MT),
  translategemma: TRANSLATEGEMMA_CODES,
  generic: Object.keys(ALL),
};

const PINNED: readonly LanguageCode[] = ['pl', 'en'];

export interface Language {
  code: LanguageCode;
  /** Name in the UI locale. */
  name: string;
}

export function languagesFor(profile: PromptProfileId, uiLocale: string): Language[] {
  const names = new Intl.DisplayNames([uiLocale], { type: 'language', fallback: 'code' });
  const collator = new Intl.Collator(uiLocale);
  const all = CODES_BY_PROFILE[profile].map((code) => ({ code, name: names.of(code) ?? code }));
  const pinned = PINNED.flatMap((code) => all.filter((l) => l.code === code));
  const rest = all
    .filter((l) => !PINNED.includes(l.code))
    .sort((a, b) => collator.compare(a.name, b.name));
  return [...pinned, ...rest];
}

export function isSupported(profile: PromptProfileId, code: LanguageCode): boolean {
  return CODES_BY_PROFILE[profile].includes(code);
}

export function englishName(code: LanguageCode): string {
  return ALL[code]?.english ?? code;
}

export function translateGemmaCode(code: LanguageCode): string {
  return ALL[code]?.translateGemmaCode ?? code;
}

export function languageName(code: LanguageCode, uiLocale: string): string {
  return new Intl.DisplayNames([uiLocale], { type: 'language', fallback: 'code' }).of(code) ?? code;
}

/** Maps a detector result such as `pt-BR` onto a code Glossa knows, or null. */
export function normalizeDetected(code: string): LanguageCode | null {
  if (code in ALL) return code;
  const base = code.split('-')[0]?.toLowerCase() ?? '';
  if (base === 'no' || base === 'nn') return 'nb';
  if (base === 'fil') return 'tl';
  return base in ALL ? base : null;
}

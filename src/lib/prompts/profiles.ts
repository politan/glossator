import type { Term } from '../glossary';
import { englishName, translateGemmaCode, type LanguageCode } from '../languages';
import type { PromptProfileId } from './profile-id';

export type { PromptProfileId } from './profile-id';
export { PROMPT_PROFILES } from './profile-id';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface TranslationPrompt {
  text: string;
  source: LanguageCode | null;
  target: LanguageCode;
  /** Surrounding Context, only present when the user opted in. */
  context?: string;
  /** Glossary terms that occur in the text. */
  terms?: readonly Term[];
  /** Description of the Style, e.g. "formal"; absent for automatic. */
  style?: string;
}

export function resolvePromptProfile(
  model: string,
  override: PromptProfileId | 'auto',
): PromptProfileId {
  if (override !== 'auto') return override;
  if (/hy-mt|hunyuan-mt/i.test(model)) return 'hy-mt';
  if (/translategemma/i.test(model)) return 'translategemma';
  return 'generic';
}

export function profileOf(provider: {
  model: string;
  promptProfile: PromptProfileId | 'auto';
}): PromptProfileId {
  return resolvePromptProfile(provider.model, provider.promptProfile);
}

export function buildMessages(profile: PromptProfileId, prompt: TranslationPrompt): ChatMessage[] {
  switch (profile) {
    case 'hy-mt':
      return hyMt(prompt);
    case 'translategemma':
      return translateGemma(prompt);
    case 'generic':
      return generic(prompt);
  }
}

// Templates from the Hy-MT2 model card. The model has no system prompt.
// Each feature has its own template on the Hy-MT2 model card; used alone,
// the prompt matches the card exactly. The card has no combined template, so
// combinations stack the parts: terms, background, instruction, text.
function hyMt({ text, target, context, terms = [], style }: TranslationPrompt): ChatMessage[] {
  const targetName = englishName(target);
  const parts: string[] = [];
  if (terms.length > 0) {
    const lines = terms.map((t) => `${t.source} translates to ${t.target}`);
    parts.push(`Reference the following translations:\n${lines.join('\n')}`);
  }
  if (context) parts.push(`[Background Information]\n${context}`);
  const styleNote = style
    ? ` Note that the translation style must strictly conform to [${style}]`
    : '';
  if (context) {
    parts.push(
      `Please translate the following text into ${targetName}, taking the provided background information into consideration.${styleNote ? `${styleNote}.` : ''}\n\n[Source Text]\n${text}`,
    );
  } else if (style) {
    parts.push(`Please translate the following text into ${targetName}.${styleNote}:\n\n${text}`);
  } else if (terms.length > 0) {
    parts.push(
      `Translate the following text into ${targetName}. Note that you must ONLY output the translated result without any additional explanation:\n\n${text}`,
    );
  } else {
    parts.push(
      `Translate the following text into ${targetName}. Note that you should only output the translated result without any additional explanation:\n\n${text}`,
    );
  }
  return [{ role: 'user', content: parts.join('\n\n') }];
}

// Template from https://ollama.com/library/translategemma (two blank lines
// before the text are intentional). The model only accepts user turns and has
// no template for context, so Surrounding Context is not sent.
function translateGemma({ text, source, target }: TranslationPrompt): ChatMessage[] {
  const to = englishName(target);
  const toCode = translateGemmaCode(target);
  if (!source) {
    // The model card has no variant without a source language; keep its wording otherwise.
    return [
      {
        role: 'user',
        content: `You are a professional translator into ${to} (${toCode}). Your goal is to accurately convey the meaning and nuances of the original text while adhering to ${to} grammar, vocabulary, and cultural sensitivities.\nProduce only the ${to} translation, without any additional explanations or commentary. Please translate the following text into ${to}:\n\n\n${text.trim()}\n`,
      },
    ];
  }
  const from = englishName(source);
  const fromCode = translateGemmaCode(source);
  return [
    {
      role: 'user',
      content: `You are a professional ${from} (${fromCode}) to ${to} (${toCode}) translator. Your goal is to accurately convey the meaning and nuances of the original ${from} text while adhering to ${to} grammar, vocabulary, and cultural sensitivities.\nProduce only the ${to} translation, without any additional explanations or commentary. Please translate the following ${from} text into ${to}:\n\n\n${text.trim()}\n`,
    },
  ];
}

function generic({
  text,
  source,
  target,
  context,
  terms = [],
  style,
}: TranslationPrompt): ChatMessage[] {
  const targetName = englishName(target);
  const direction = source
    ? `from ${englishName(source)} into ${targetName}`
    : `into ${targetName}`;
  const lines = [
    `You are a professional translator. Translate the user's message ${direction}.`,
    'Reply with only the translation: no explanations, notes, quotation marks or preamble.',
    style
      ? `Keep the original formatting and line breaks, and write the translation in this style: ${style}.`
      : 'Keep the original formatting, line breaks and tone.',
  ];
  if (terms.length > 0) {
    lines.push(
      '',
      'Always translate these terms exactly as given:',
      ...terms.map((t) => `- ${t.source} → ${t.target}`),
    );
  }
  if (context) {
    lines.push(
      '',
      'The message comes from the passage below. Use it only to choose the right meaning; do not translate it.',
      `<passage>\n${context}\n</passage>`,
    );
  }
  return [
    { role: 'system', content: lines.join('\n') },
    { role: 'user', content: text },
  ];
}

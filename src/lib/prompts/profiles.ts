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
function hyMt({ text, target, context }: TranslationPrompt): ChatMessage[] {
  const targetName = englishName(target);
  const content = context
    ? `[Background Information]\n${context}\n\nPlease translate the following text into ${targetName}, taking the provided background information into consideration.\n\n[Source Text]\n${text}`
    : `Translate the following text into ${targetName}. Note that you should only output the translated result without any additional explanation:\n\n${text}`;
  return [{ role: 'user', content }];
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

function generic({ text, source, target, context }: TranslationPrompt): ChatMessage[] {
  const targetName = englishName(target);
  const direction = source
    ? `from ${englishName(source)} into ${targetName}`
    : `into ${targetName}`;
  const lines = [
    `You are a professional translator. Translate the user's message ${direction}.`,
    'Reply with only the translation: no explanations, notes, quotation marks or preamble.',
    'Keep the original formatting, line breaks and tone.',
  ];
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

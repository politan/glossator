export const STYLES = ['auto', 'formal', 'casual', 'technical', 'custom'] as const;

export type StyleId = (typeof STYLES)[number];

const DESCRIPTIONS: Record<Exclude<StyleId, 'auto' | 'custom'>, string> = {
  formal: 'formal',
  casual: 'casual, conversational',
  technical: 'technical, precise',
};

/** What the model is told about the Style, or undefined to leave it to the model. */
export function styleDescription(style: StyleId, custom: string): string | undefined {
  if (style === 'auto') return undefined;
  if (style === 'custom') return custom.trim() || undefined;
  return DESCRIPTIONS[style];
}

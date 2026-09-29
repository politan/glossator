export const PROMPT_PROFILES = ['hy-mt', 'translategemma', 'generic'] as const;

export type PromptProfileId = (typeof PROMPT_PROFILES)[number];

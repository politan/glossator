export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const OPENROUTER_ATTRIBUTION = {
  'HTTP-Referer': 'https://github.com/politan/glossator',
  'X-Title': 'Glossator',
};

// Google also operates these upstreams; open-weights Google models are routed
// to independent hosts so no Selection reaches Google.
const GOOGLE_UPSTREAMS = ['google-vertex', 'google-ai-studio'];

export interface OpenRouterModel {
  id: string;
  /** Short note shown next to the model name in Settings. */
  noteKey: 'modelNoteDefault' | 'modelNoteSmaller' | 'modelNoteCheapest' | 'modelNoteGemma';
  ignoreUpstreams?: readonly string[];
}

// The curated list never contains models that send text to Google.
export const OPENROUTER_MODELS: readonly OpenRouterModel[] = [
  { id: 'tencent/hy-mt2-30b-a3b', noteKey: 'modelNoteDefault' },
  { id: 'tencent/hy-mt2-7b', noteKey: 'modelNoteSmaller' },
  { id: 'tencent/hy-mt2-1.8b', noteKey: 'modelNoteCheapest' },
  { id: 'google/gemma-4-31b-it', noteKey: 'modelNoteGemma', ignoreUpstreams: GOOGLE_UPSTREAMS },
];

export const DEFAULT_OPENROUTER_MODEL = 'tencent/hy-mt2-30b-a3b';

export function upstreamsToIgnore(model: string): readonly string[] {
  return OPENROUTER_MODELS.find((m) => m.id === model)?.ignoreUpstreams ?? [];
}

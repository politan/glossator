import type { PresetId } from './types';

export interface Preset {
  id: PresetId;
  label: string;
  baseUrl: string;
  hintKey:
    | 'presetOllamaHint'
    | 'presetLmStudioHint'
    | 'presetLlamaCppHint'
    | 'presetJanHint'
    | 'presetCustomHint';
}

const OLLAMA: Preset = {
  id: 'ollama',
  label: 'Ollama',
  baseUrl: 'http://127.0.0.1:11434/v1',
  hintKey: 'presetOllamaHint',
};

export const PRESETS: readonly Preset[] = [
  OLLAMA,
  {
    id: 'lm-studio',
    label: 'LM Studio',
    baseUrl: 'http://127.0.0.1:1234/v1',
    hintKey: 'presetLmStudioHint',
  },
  {
    id: 'llama-cpp',
    label: 'llama.cpp',
    baseUrl: 'http://127.0.0.1:8080/v1',
    hintKey: 'presetLlamaCppHint',
  },
  { id: 'jan', label: 'Jan', baseUrl: 'http://127.0.0.1:1337/v1', hintKey: 'presetJanHint' },
  { id: 'custom', label: '', baseUrl: 'http://127.0.0.1:8000/v1', hintKey: 'presetCustomHint' },
];

/** Models worth suggesting for local use, smallest first. */
export const RECOMMENDED_LOCAL_MODELS = [
  'translategemma:4b',
  'translategemma:12b',
  'hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M',
  'hf.co/tencent/Hy-MT2-30B-A3B-GGUF:Q4_K_M',
];

export function presetById(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? OLLAMA;
}

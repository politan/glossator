import type { PromptProfileId } from '../prompts/profile-id';

export type PromptProfileSetting = PromptProfileId | 'auto';

export interface CloudProvider {
  kind: 'cloud';
  id: 'openrouter';
  apiKey: string;
  model: string;
  promptProfile: PromptProfileSetting;
  /** Strict Privacy Routing. */
  strictPrivacy: boolean;
}

export type PresetId = 'ollama' | 'lm-studio' | 'llama-cpp' | 'jan' | 'custom';

export interface LocalProvider {
  kind: 'local';
  id: string;
  name: string;
  preset: PresetId;
  /** OpenAI-compatible base URL, e.g. `http://127.0.0.1:11434/v1`. */
  baseUrl: string;
  apiKey: string;
  model: string;
  promptProfile: PromptProfileSetting;
}

export type Provider = CloudProvider | LocalProvider;

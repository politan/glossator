import { describe, expect, it } from 'vitest';
import { buildMessages, resolvePromptProfile } from './profiles';

describe('resolvePromptProfile', () => {
  it.each([
    ['tencent/hy-mt2-30b-a3b', 'hy-mt'],
    ['hf.co/tencent/Hy-MT2-7B-GGUF:Q4_K_M', 'hy-mt'],
    ['demonbyron/HY-MT1.5-7B', 'hy-mt'],
    ['huihui_ai/hunyuan-mt-abliterated', 'hy-mt'],
    ['translategemma:4b', 'translategemma'],
    ['google/translategemma-12b-it', 'translategemma'],
    ['google/gemma-4-31b-it', 'generic'],
    ['qwen3.5:9b', 'generic'],
  ] as const)('picks a profile for %s from its name', (model, profile) => {
    expect(resolvePromptProfile(model, 'auto')).toBe(profile);
  });

  it('respects a manual override', () => {
    expect(resolvePromptProfile('tencent/hy-mt2-7b', 'generic')).toBe('generic');
  });
});

describe('HY-MT profile', () => {
  it('uses the model card template as a single user message', () => {
    expect(buildMessages('hy-mt', { text: 'Good morning', source: 'en', target: 'pl' })).toEqual([
      {
        role: 'user',
        content:
          'Translate the following text into Polish. Note that you should only output the translated result without any additional explanation:\n\nGood morning',
      },
    ]);
  });

  it('uses the context-aware template when Surrounding Context is given', () => {
    expect(
      buildMessages('hy-mt', {
        text: 'bank',
        source: 'en',
        target: 'pl',
        context: 'We sat on the river bank.',
      }),
    ).toEqual([
      {
        role: 'user',
        content:
          '[Background Information]\nWe sat on the river bank.\n\nPlease translate the following text into Polish, taking the provided background information into consideration.\n\n[Source Text]\nbank',
      },
    ]);
  });
});

describe('Generic profile', () => {
  it('instructs through a system message and sends the Selection alone as the user message', () => {
    const messages = buildMessages('generic', { text: 'Dzień dobry', source: 'pl', target: 'sv' });
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('from Polish into Swedish');
    expect(messages[0]?.content).toContain('only the translation');
    expect(messages[1]).toEqual({ role: 'user', content: 'Dzień dobry' });
  });

  it('asks the model to identify the language when the source is unknown', () => {
    const [system] = buildMessages('generic', { text: 'Hola', source: null, target: 'pl' });
    expect(system?.content).toContain('into Polish');
    expect(system?.content).not.toContain('from ');
  });

  it('passes Surrounding Context as reference that must not be translated', () => {
    const [system, user] = buildMessages('generic', {
      text: 'bank',
      source: 'en',
      target: 'pl',
      context: 'We sat on the river bank.',
    });
    expect(system?.content).toContain('We sat on the river bank.');
    expect(user).toEqual({ role: 'user', content: 'bank' });
  });
});

describe('TranslateGemma profile', () => {
  it('uses the template from the Ollama library page as a single user message', () => {
    expect(
      buildMessages('translategemma', { text: 'Good morning', source: 'en', target: 'pl' }),
    ).toEqual([
      {
        role: 'user',
        content:
          'You are a professional English (en) to Polish (pl) translator. Your goal is to accurately convey the meaning and nuances of the original English text while adhering to Polish grammar, vocabulary, and cultural sensitivities.\nProduce only the Polish translation, without any additional explanations or commentary. Please translate the following English text into Polish:\n\n\nGood morning\n',
      },
    ]);
  });

  it('uses the codes TranslateGemma knows for Filipino, Norwegian and Traditional Chinese', () => {
    const [message] = buildMessages('translategemma', {
      text: 'x',
      source: 'tl',
      target: 'zh-Hant',
    });
    expect(message?.content).toContain('Filipino (fil) to Traditional Chinese (zh-TW)');
    const [norwegian] = buildMessages('translategemma', { text: 'x', source: 'nb', target: 'en' });
    expect(norwegian?.content).toContain('(no) to English (en)');
  });

  it('still asks for the target language alone when the source is unknown', () => {
    const [message] = buildMessages('translategemma', { text: 'Hola', source: null, target: 'pl' });
    expect(message?.content).toContain('into Polish');
    expect(message?.content).toContain('\n\n\nHola\n');
    expect(message?.content).not.toContain('null');
  });

  it('leaves Surrounding Context out, since the model has no template for it', () => {
    const [message] = buildMessages('translategemma', {
      text: 'bank',
      source: 'en',
      target: 'pl',
      context: 'We sat on the river bank.',
    });
    expect(message?.content).not.toContain('river');
  });
});

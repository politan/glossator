import { describe, expect, it } from 'vitest';
import { languagesFor } from './languages';

const codes = (profile: Parameters<typeof languagesFor>[0], locale = 'en') =>
  languagesFor(profile, locale).map((l) => l.code);

describe('languagesFor', () => {
  it('offers the 38 HY-MT languages with Polish and English pinned on top', () => {
    const list = codes('hy-mt');
    expect(list).toHaveLength(38);
    expect(list.slice(0, 5)).toEqual(['pl', 'en', 'ar', 'bn', 'my']);
    expect(list).toContain('yue');
    expect(list).not.toContain('sv');
  });

  it('sorts by the language names of the UI locale', () => {
    const list = languagesFor('hy-mt', 'pl');
    expect(list.slice(0, 3).map((l) => l.name)).toEqual(['polski', 'angielski', 'arabski']);
  });

  it('adds the European languages HY-MT lacks for general models', () => {
    const list = codes('generic');
    expect(list.slice(0, 2)).toEqual(['pl', 'en']);
    expect(list).toEqual(expect.arrayContaining(['sv', 'fi', 'el', 'hu', 'ro', 'sk', 'lt', 'hr']));
    expect(list).toEqual(expect.arrayContaining(['yue', 'zh-Hant']));
  });

  it('offers the TranslateGemma languages, including ones HY-MT lacks', () => {
    const list = codes('translategemma');
    expect(list.slice(0, 2)).toEqual(['pl', 'en']);
    expect(list).toEqual(expect.arrayContaining(['sw', 'zu', 'is', 'ca', 'sv', 'zh-Hant', 'tl']));
    expect(list).not.toContain('yue');
    expect(list).not.toContain('bo');
  });
});

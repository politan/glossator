import { describe, expect, it } from 'vitest';
import { originRules } from './origin-rule';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

describe('originRules', () => {
  it('rewrites Origin to the server itself, only for requests Glossator makes to that server', () => {
    expect(originRules(['http://127.0.0.1:11434/v1'], EXTENSION_ID)).toEqual([
      {
        id: 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [{ header: 'origin', operation: 'set', value: 'http://127.0.0.1:11434' }],
        },
        condition: {
          urlFilter: '|http://127.0.0.1:11434/',
          initiatorDomains: [EXTENSION_ID],
          resourceTypes: ['xmlhttprequest', 'other'],
        },
      },
    ]);
  });

  it('creates one rule per distinct server with stable ids', () => {
    const rules = originRules(
      ['http://127.0.0.1:11434/v1', 'http://192.168.1.20:1234/v1', 'http://127.0.0.1:11434/api'],
      EXTENSION_ID,
    );
    expect(rules.map((r) => [r.id, r.condition.urlFilter])).toEqual([
      [1, '|http://127.0.0.1:11434/'],
      [2, '|http://192.168.1.20:1234/'],
    ]);
  });

  it('skips addresses that are not valid http(s) URLs', () => {
    expect(originRules(['nonsense', 'ftp://host/'], EXTENSION_ID)).toEqual([]);
  });
});

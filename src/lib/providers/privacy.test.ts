import { describe, expect, it } from 'vitest';
import { privacyOf } from './privacy';

describe('privacyOf', () => {
  it('treats OpenRouter as cloud', () => {
    expect(privacyOf({ kind: 'cloud' })).toBe('cloud');
  });

  it.each([
    'http://localhost:11434/v1',
    'http://127.0.0.1:1234/v1',
    'http://127.8.9.10:8080/v1',
    'http://[::1]:8080/v1',
    'http://10.0.0.5:11434/v1',
    'http://172.16.0.1/v1',
    'http://172.31.255.254/v1',
    'http://192.168.1.20:11434/v1',
    'http://homelab.local:11434/v1',
  ])('treats %s as local', (baseUrl) => {
    expect(privacyOf({ kind: 'local', baseUrl })).toBe('local');
  });

  it.each([
    'https://llm.example.com/v1',
    'http://172.32.0.1/v1',
    'http://8.8.8.8/v1',
    'https://localhost.example.com/v1',
  ])('treats %s as self-hosted', (baseUrl) => {
    expect(privacyOf({ kind: 'local', baseUrl })).toBe('self-hosted');
  });

  it('treats an unparseable address as self-hosted rather than claiming it is local', () => {
    expect(privacyOf({ kind: 'local', baseUrl: 'not a url' })).toBe('self-hosted');
  });
});

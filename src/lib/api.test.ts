import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from '@/lib/api';

describe('resolveApiBaseUrl', () => {
  it('keeps the configured API URL for regular hosts', () => {
    expect(resolveApiBaseUrl('https://api.example.com/', { hostname: 'app.example.com' })).toBe('https://api.example.com');
  });

  it('keeps localhost when the app also runs on localhost', () => {
    expect(resolveApiBaseUrl('http://localhost:8080/', { hostname: 'localhost' })).toBe('http://localhost:8080');
  });

  it('uses the browser LAN hostname when the configured API host is localhost', () => {
    expect(resolveApiBaseUrl('http://localhost:8080/', { hostname: '192.168.1.50' })).toBe('http://192.168.1.50:8080');
  });

  it('uses the browser LAN hostname when the configured API host is 127.0.0.1', () => {
    expect(resolveApiBaseUrl('http://127.0.0.1:8080/', { hostname: '192.168.1.50' })).toBe('http://192.168.1.50:8080');
  });
});

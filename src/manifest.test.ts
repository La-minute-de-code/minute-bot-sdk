import { describe, expect, test } from 'vitest';
import { parseManifest } from './manifest';

const valid = {
  name: 'example-plugin',
  version: '1.0.0',
  author: 'Community',
  description: 'Plugin exemple',
  apiVersion: '^1.0.0',
  main: 'src/index.ts',
  permissions: ['commands', 'events'],
};

describe('parseManifest', () => {
  test('accepts a valid manifest', () => {
    const result = parseManifest(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.name).toBe('example-plugin');
      expect(result.manifest.permissions).toEqual(['commands', 'events']);
    }
  });

  test('defaults permissions to an empty list', () => {
    const { permissions, ...withoutPermissions } = valid;
    const result = parseManifest(withoutPermissions);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.permissions).toEqual([]);
  });

  test('rejects an unknown permission', () => {
    const result = parseManifest({ ...valid, permissions: ['filesystem'] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('permissions');
  });

  test.each([
    ['a bare two-part version', '2.0'],
    ['a tilde range', '~1.0.0'],
    ['a wildcard', '*'],
    ['a prerelease suffix', '1.0.0-beta.1'],
    ['an empty string', ''],
  ])('rejects a malformed apiVersion (%s)', (_label, apiVersion) => {
    const result = parseManifest({ ...valid, apiVersion });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('apiVersion');
  });

  test('accepts an exact-pin apiVersion', () => {
    expect(parseManifest({ ...valid, apiVersion: '1.0.0' }).ok).toBe(true);
  });

  test('accepts an apiVersion the running SDK does not itself satisfy — that check is isApiVersionCompatible, not parseManifest', () => {
    expect(parseManifest({ ...valid, apiVersion: '^2.0.0' }).ok).toBe(true);
  });

  test('accepts a manifest without the optional sdk field', () => {
    expect(parseManifest(valid).ok).toBe(true);
  });

  test('accepts a valid sdk range', () => {
    expect(parseManifest({ ...valid, sdk: '^0.2.0' }).ok).toBe(true);
  });

  test('rejects a malformed sdk range', () => {
    const result = parseManifest({ ...valid, sdk: '~0.2.0' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('sdk');
  });

  test('failure carries structured issues alongside the joined error string', () => {
    const result = parseManifest({ ...valid, apiVersion: 'nope', name: 'Also Bad' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      expect(result.issues.some((issue) => issue.path === 'apiVersion')).toBe(true);
      expect(result.issues.some((issue) => issue.path === 'name')).toBe(true);
      for (const issue of result.issues) {
        expect(issue.message).not.toMatch(/[\r\n]/);
      }
    }
  });

  test('rejects a name that is not kebab-case', () => {
    const result = parseManifest({ ...valid, name: 'Example Plugin' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('name');
  });

  test('rejects a non-object input', () => {
    expect(parseManifest('nope').ok).toBe(false);
  });

  test('rejects an unknown top-level key', () => {
    const result = parseManifest({ ...valid, permision: ['discord:send'] });
    expect(result.ok).toBe(false);
  });

  test('deduplicates permissions', () => {
    const result = parseManifest({
      ...valid,
      permissions: ['commands', 'commands', 'events'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.permissions).toEqual(['commands', 'events']);
  });

  test('rejects an oversized permission list', () => {
    const result = parseManifest({
      ...valid,
      permissions: Array.from({ length: 10_000 }, () => 'commands'),
    });
    expect(result.ok).toBe(false);
  });

  test.each([
    ['a parent-directory escape', '../../../../etc/passwd'],
    ['a nested parent-directory escape', 'src/../../secrets.js'],
    ['a posix absolute path', '/home/bot/.env.js'],
    ['a windows absolute path', 'C:/Users/bot/.ssh/id_rsa.js'],
    ['a backslash path', '..\\..\\evil.js'],
    ['a remote url', 'https://evil.tld/payload.js'],
    ['a data url', 'data:text/javascript,console.log(1)'],
    ['a null byte', 'index.js\u0000.txt'],
    ['a non-script extension', 'README.md'],
  ])('rejects a main entrypoint with %s', (_label, main) => {
    const result = parseManifest({ ...valid, main });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('main');
  });

  test('accepts a relative main entrypoint', () => {
    expect(parseManifest({ ...valid, main: 'dist/index.js' }).ok).toBe(true);
  });

  test.each([
    ['name', 'a'.repeat(65)],
    ['author', 'a'.repeat(129)],
    ['description', 'a'.repeat(513)],
    ['version', `1.0.0-${'a'.repeat(65)}`],
  ])('rejects an oversized %s', (field, value) => {
    expect(parseManifest({ ...valid, [field]: value }).ok).toBe(false);
  });

  test.each([
    ['apiVersion', `^${'9'.repeat(40)}.0.0`],
    ['sdk', `^${'9'.repeat(40)}.0.0`],
  ])('rejects an oversized %s even when otherwise well-formed', (field, value) => {
    const result = parseManifest({ ...valid, [field]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(field);
  });

  test('rejects a reserved name', () => {
    const result = parseManifest({ ...valid, name: 'core' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('reserved');
  });

  test('accepts a semver prerelease', () => {
    expect(parseManifest({ ...valid, version: '1.0.0-beta.1' }).ok).toBe(true);
  });

  test('returns a single-line, bounded error message', () => {
    const result = parseManifest({ ...valid, author: `evil\n[ERROR] forged log line` });
    // author is a valid string here, so force a failure on another field too
    const injected = parseManifest({ ...valid, apiVersion: '2.0', author: 'x\ny' });
    expect(result.ok).toBe(true);
    expect(injected.ok).toBe(false);
    if (!injected.ok) {
      expect(injected.error).not.toMatch(/[\r\n]/);
      expect(injected.error.length).toBeLessThanOrEqual(500);
    }
  });
});

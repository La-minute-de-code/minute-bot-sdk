import { describe, expect, test } from 'vitest';
import { isApiVersionCompatible, isValidVersionRange } from './version';

describe('isValidVersionRange', () => {
  test.each([['1.0.0'], ['^1.0.0'], ['0.0.0'], ['^12.34.56']])(
    'accepts %s',
    (range) => {
      expect(isValidVersionRange(range)).toBe(true);
    },
  );

  test.each([
    ['a bare two-part version', '1.0'],
    ['a v-prefixed version', 'v1.0.0'],
    ['a tilde range', '~1.0.0'],
    ['a prerelease suffix', '1.0.0-beta.1'],
    ['a leading caret with space', '^ 1.0.0'],
    ['an empty string', ''],
    ['a wildcard', '*'],
  ])('rejects %s (%s)', (_label, range) => {
    expect(isValidVersionRange(range)).toBe(false);
  });
});

describe('isApiVersionCompatible', () => {
  test('exact-pin range matches the identical version', () => {
    expect(isApiVersionCompatible('1.0.0', '1.0.0')).toBe(true);
  });

  test('exact-pin range rejects a different version, even a higher patch', () => {
    expect(isApiVersionCompatible('1.0.0', '1.0.1')).toBe(false);
  });

  test('caret range accepts the exact floor version', () => {
    expect(isApiVersionCompatible('^1.0.0', '1.0.0')).toBe(true);
  });

  test('caret range accepts a higher patch on the same minor', () => {
    expect(isApiVersionCompatible('^1.0.0', '1.0.5')).toBe(true);
  });

  test('caret range accepts a higher minor on the same major', () => {
    expect(isApiVersionCompatible('^1.0.0', '1.3.0')).toBe(true);
  });

  test('caret range rejects a lower patch than the floor', () => {
    expect(isApiVersionCompatible('^1.2.3', '1.2.2')).toBe(false);
  });

  test('caret range rejects a lower minor than the floor', () => {
    expect(isApiVersionCompatible('^1.2.0', '1.1.9')).toBe(false);
  });

  test('caret range rejects a different major, even higher', () => {
    expect(isApiVersionCompatible('^1.0.0', '2.0.0')).toBe(false);
  });

  test('caret range rejects a lower major', () => {
    expect(isApiVersionCompatible('^2.0.0', '1.9.9')).toBe(false);
  });

  test('a malformed range is never compatible', () => {
    expect(isApiVersionCompatible('~1.0.0', '1.0.0')).toBe(false);
    expect(isApiVersionCompatible('not-a-range', '1.0.0')).toBe(false);
    expect(isApiVersionCompatible('', '1.0.0')).toBe(false);
  });

  test('a malformed actual version is never compatible', () => {
    expect(isApiVersionCompatible('^1.0.0', 'not-a-version')).toBe(false);
    expect(isApiVersionCompatible('^1.0.0', '1.0')).toBe(false);
  });
});

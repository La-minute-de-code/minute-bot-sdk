import { expect, test } from 'vitest';
import { SDK_API_VERSION } from './index';

test('sdk exposes its api version', () => {
  expect(SDK_API_VERSION).toBe('1.0.0');
});

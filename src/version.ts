/**
 * A bare `1.2.3` pins that exact version. A `^1.2.3` prefix accepts any
 * version with the same major and a minor.patch at or above the floor —
 * standard npm caret semantics, deliberately not the full semver range
 * grammar (no `~`, no `x`, no comparator chains): a plugin only ever needs
 * to express "this exact contract" or "this contract or a compatible later
 * one", and a narrow grammar is one a plugin author already knows from
 * package.json and one this SDK can parse without a dependency on `semver`.
 */
const RANGE_PATTERN = /^(\^)?(\d+)\.(\d+)\.(\d+)$/;
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function isValidVersionRange(range: string): boolean {
  return RANGE_PATTERN.test(range);
}

/**
 * Whether `actual` (a plain version, e.g. the running `SDK_API_VERSION`)
 * satisfies `range` (a plugin's declared `apiVersion`). Never throws — a
 * malformed range or a malformed actual version is simply incompatible,
 * so a caller can gate on the boolean without a try/catch.
 */
export function isApiVersionCompatible(range: string, actual: string): boolean {
  const rangeMatch = RANGE_PATTERN.exec(range);
  const actualMatch = VERSION_PATTERN.exec(actual);
  if (!rangeMatch || !actualMatch) return false;

  // Non-null: a successful match against these patterns always populates
  // every group below — only the caret group (index 1) is genuinely optional.
  const caret = rangeMatch[1];
  const rMajor = rangeMatch[2]!;
  const rMinor = rangeMatch[3]!;
  const rPatch = rangeMatch[4]!;
  const aMajor = actualMatch[1]!;
  const aMinor = actualMatch[2]!;
  const aPatch = actualMatch[3]!;

  if (rMajor !== aMajor) return false;
  if (!caret) return rMinor === aMinor && rPatch === aPatch;

  if (aMinor !== rMinor) return Number(aMinor) > Number(rMinor);
  return Number(aPatch) >= Number(rPatch);
}

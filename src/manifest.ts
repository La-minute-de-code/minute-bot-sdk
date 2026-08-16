import { z } from 'zod';
import { isValidVersionRange } from './version.js';

export const PERMISSIONS = [
  'commands',
  'events',
  'tasks',
  'discord:read',
  'discord:send',
  'discord:roles',
  'discord:moderate',
  'network',
  'http-server',
  'database',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Plugin names the bot keeps for itself — a plugin may not claim one. */
export const RESERVED_PLUGIN_NAMES = [
  'admin',
  'bot',
  'core',
  'internal',
  'node-modules',
  'plugin',
  'plugins',
  'sdk',
  'system',
] as const;

/** Longest error string parseManifest will ever return. */
const MAX_ERROR_LENGTH = 500;

const SEMVER =
  /^\d+\.\d+\.\d+(?:-[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

/**
 * Entrypoint path, relative to the plugin directory.
 *
 * Every rule here exists to keep `main` from escaping that directory: the
 * loader resolves it against the plugin folder and imports it, so an
 * unconstrained value is arbitrary code execution outside the sandbox.
 * The loader must still realpath the resolved file and confirm it stays
 * inside the plugin directory — symlinks defeat any string-level check.
 */
const mainPath = z
  .string()
  .min(1)
  .max(255)
  .refine((p) => !p.includes('\0'), 'main must not contain null bytes')
  .refine((p) => !p.includes('\\'), 'main must use forward slashes')
  .refine((p) => !/^[a-zA-Z]:/.test(p), 'main must not be an absolute path')
  .refine((p) => !p.startsWith('/'), 'main must not be an absolute path')
  .refine((p) => !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p), 'main must not be a URL')
  .refine((p) => {
    const segments = p.split('/');
    return segments.every((s) => s !== '' && s !== '.' && s !== '..');
  }, 'main must stay inside the plugin directory')
  .refine((p) => /\.(js|mjs|cjs|ts|mts)$/.test(p), 'main must point to a JS/TS entrypoint');

export const manifestSchema = z
  .object({
    name: z
      .string()
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'name must be kebab-case')
      .refine(
        (n) => !(RESERVED_PLUGIN_NAMES as readonly string[]).includes(n),
        'name is reserved by the bot',
      ),
    version: z.string().max(64).regex(SEMVER, 'version must be semver'),
    author: z.string().min(1).max(128),
    description: z.string().max(512).default(''),
    // Enforced: the loader refuses to enable a plugin whose range does not
    // cover the bot's running SDK_API_VERSION, via isApiVersionCompatible().
    apiVersion: z
      .string()
      .max(32)
      .refine(isValidVersionRange, 'apiVersion must be a version or caret range, e.g. "1.0.0" or "^1.0.0"'),
    // Informational only: records which SDK release a plugin was written
    // against. Not checked against anything — apiVersion is the contract
    // that is actually enforced. Useful for a human or a future tool
    // diagnosing "written for an old SDK" independently of API compatibility.
    sdk: z
      .string()
      .max(32)
      .refine(isValidVersionRange, 'sdk must be a version or caret range, e.g. "0.2.0" or "^0.2.0"')
      .optional(),
    main: mainPath,
    permissions: z
      .array(z.enum(PERMISSIONS))
      .max(PERMISSIONS.length, 'permissions contains more entries than there are permissions')
      .default([])
      .transform((list) => [...new Set(list)]),
  })
  .strict();

export type PluginManifest = z.infer<typeof manifestSchema>;

/** One rejected field, for a caller that wants to react to a specific failure (e.g. a distinct "incompatible" state for apiVersion) rather than parse the joined `error` string. */
export interface ManifestIssue {
  readonly path: string;
  readonly message: string;
}

export type ManifestResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; error: string; issues: readonly ManifestIssue[] };

export function parseManifest(raw: unknown): ManifestResult {
  const parsed = manifestSchema.safeParse(raw);
  if (parsed.success) return { ok: true, manifest: parsed.data };

  // Issue messages can echo manifest values back; keep them from forging log
  // lines, on each issue individually — `issues` is public, a caller may log
  // one without going through the joined `error` string below.
  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.join('.') || '<root>',
    message: issue.message.replace(/[\r\n]+/g, ' ').slice(0, MAX_ERROR_LENGTH),
  }));

  const error = issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join('; ')
    .slice(0, MAX_ERROR_LENGTH);
  return { ok: false, error, issues };
}

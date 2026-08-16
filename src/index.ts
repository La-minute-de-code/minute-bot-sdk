/**
 * The plugin-facing contract's own version — full semver, bumped by hand
 * only when PluginContext, the manifest schema or the permission set
 * actually change shape. Deliberately not tied to this package's npm
 * version: a patch or feature release of @la_minute_code/sdk that does not
 * touch the plugin contract does not bump this. Compare a plugin's declared
 * `apiVersion` range against this value with isApiVersionCompatible().
 */
export const SDK_API_VERSION = '1.0.0';

export * from './manifest.js';
export * from './types.js';
export * from './context.js';
export * from './plugin.js';
export * from './version.js';

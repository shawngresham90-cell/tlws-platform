/**
 * Test-only shim. The real `server-only` package throws on import outside a
 * React Server Component — exactly what we want in the app, and exactly what
 * the Node-based validation suites must bypass. Aliased in via esbuild:
 *   --alias:server-only=./scripts/shims/server-only.ts
 */
export {};

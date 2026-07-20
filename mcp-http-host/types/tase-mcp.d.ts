/**
 * tase-mcp ships no type declarations (its tsconfig does not emit .d.ts, and
 * dist/tools.d.ts is absent). Every other package declares its own types.
 *
 * This shim keeps the host's `strict` build honest without touching the
 * published package.
 */
declare module '@skills-il/tase-mcp/dist/tools.js' {
  export function registerTools(server: any): void;
}

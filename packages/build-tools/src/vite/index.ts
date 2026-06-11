/**
 * Vite integration for Vertesia build tools.
 *
 * - `vertesiaDevServerPlugin` — transforms `?skill` / `?raw` / `?prompt` /
 *   `?template` (and `?skills` / `?templates`) imports on the fly during
 *   `vite dev`. Same transformer set as the `vertesia-build` CLI used at
 *   build time, so source files behave identically in both modes.
 *
 * - `apiServerPlugin` — mounts a Hono tool server as Vite middleware under
 *   `/api`, with `vertesiaDevServerPlugin` already included so the tool
 *   server's query-style imports work without extra wiring.
 */

export { type ApiServerPluginOptions, apiServerPlugin } from './api-server.js';
export { type VertesiaDevServerPluginOptions, vertesiaDevServerPlugin } from './dev-server.js';

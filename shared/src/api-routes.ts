/**
 * REST endpoints — the single list both server (route registration) and web (fetch URLs) use.
 * `:id` is a model id; fill it with `withModelId()` on the client.
 */
export const API_PREFIX = '/api';

export const API_ROUTES = {
  info: `${API_PREFIX}/info`,
  models: `${API_PREFIX}/models`,
  model: `${API_PREFIX}/models/:id`,
  modelExport: `${API_PREFIX}/models/:id/export`,
  modelImport: `${API_PREFIX}/models/import`,
  modelLayout: `${API_PREFIX}/models/:id/layout`,
  active: `${API_PREFIX}/active`,
  status: `${API_PREFIX}/status`,
} as const;

export function withModelId(route: string, id: string): string {
  return route.replace(':id', encodeURIComponent(id));
}

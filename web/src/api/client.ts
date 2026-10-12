import type {
  ActiveResponse,
  ApiError,
  Layout,
  LayoutResponse,
  Model,
  ModelInput,
  ModelSummary,
  ProbeResult,
  ServerInfo,
} from '@ugv/shared';

/** Error with the server's validation issues attached, so forms can show them per field. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: NonNullable<ApiError['issues']> = [],
  ) {
    super(message);
  }
}

/** Local backend answers in ms; the slowest call is /api/probe (6 s RTSP timeout server-side). */
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApiRequestError(
      (err as Error).name === 'TimeoutError'
        ? 'ugv-cams не відповідає. Спробуйте ще раз або перезапустіть програму.'
        : 'Немає звʼязку з ugv-cams. Перевірте, що програма запущена.',
      0,
    );
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as T & Partial<ApiError>;
  if (!res.ok) throw new ApiRequestError(data.error ?? `HTTP ${res.status}`, res.status, data.issues);
  return data;
}

export const api = {
  info: () => request<ServerInfo>('GET', '/api/info'),

  listModels: () => request<ModelSummary[]>('GET', '/api/models'),
  getModel: (id: string) => request<Model>('GET', `/api/models/${id}`),
  createModel: (input: ModelInput) => request<Model>('POST', '/api/models', input),
  updateModel: (id: string, input: ModelInput) => request<Model>('PUT', `/api/models/${id}`, input),
  deleteModel: (id: string) => request<void>('DELETE', `/api/models/${id}`),
  importModel: (raw: unknown) => request<Model>('POST', '/api/models/import', raw),
  exportUrl: (id: string) => `/api/models/${id}/export`,

  getActive: () => request<ActiveResponse>('GET', '/api/active'),
  setActive: (modelId: string | null) => request<ActiveResponse>('PUT', '/api/active', { modelId }),

  getLayout: (modelId: string) => request<LayoutResponse>('GET', `/api/models/${modelId}/layout`),
  saveLayout: (modelId: string, layout: Layout | null) =>
    request<LayoutResponse>('PUT', `/api/models/${modelId}/layout`, { layout }),

  probe: (url: string) => request<ProbeResult>('POST', '/api/probe', { url }),
};

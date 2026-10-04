/**
 * Requests to the library's HTTP API. A failed request throws a `RequestError`
 * with the server's message and status.
 */

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
}

export const requestJson = async <T>(
  fetchImpl: typeof fetch,
  url: string,
  { method = 'GET', body, token }: RequestOptions = {}
): Promise<T> => {
  const response = await fetchImpl(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new RequestError(data.error ?? response.statusText, response.status);
  return data as T;
};

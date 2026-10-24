/**
 * Where a space's library routes are: the HTTP API at `<baseUrl>/api`, and the
 * socket at `<baseUrl's path>/socket.io` unless set otherwise. In a browser, a
 * relative base URL is resolved against the page.
 */

export interface Endpoints {
  /** The URL of an API path, such as `/tokens` */
  api: (path: string) => string;
  socketOrigin: string;
  socketPath: string;
}

const currentPage = () => (globalThis as { location?: { href: string } }).location?.href;

export const resolveEndpoints = (baseUrl = '', socketPath?: string): Endpoints => {
  let url: URL;
  try {
    url = new URL(baseUrl || '/', currentPage());
  } catch {
    throw new Error(`baseUrl must be an absolute URL outside a browser, not "${baseUrl}"`);
  }
  const prefix = url.pathname.replace(/\/+$/, '');
  return {
    api: path => `${url.origin}${prefix}/api${path}`,
    socketOrigin: url.origin,
    socketPath: socketPath ?? `${prefix}/socket.io`,
  };
};

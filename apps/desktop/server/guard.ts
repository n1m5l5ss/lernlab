// Web dev mode listens on 127.0.0.1, but any website open in the same browser can still send it requests
// (cross-site POST) or, after DNS rebinding, read its answers. Only this page itself gets through:
// the Host must be this server, a browser's Origin (when sent) must be this server too, and API calls
// must be JSON, which a page on another origin can't send without a preflight that we never answer.

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** Host header names this server: localhost, 127.0.0.1 or [::1] on our port. */
export function isLocalHost(host: string | undefined, port: number): boolean {
  return !!host && LOCAL_HOSTS.some((h) => host.toLowerCase() === `${h}:${port}`);
}

/** Whether a request may reach this server. */
export function allowRequest(
  req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined> },
  port: number,
): boolean {
  const host = req.headers.host as string | undefined;
  if (!isLocalHost(host, port)) return false;
  const origin = req.headers.origin as string | undefined;
  if (origin !== undefined && origin.toLowerCase() !== `http://${host!.toLowerCase()}`) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const type = String(req.headers['content-type'] ?? '').toLowerCase();
    if (!type.startsWith('application/json')) return false;
  }
  return true;
}

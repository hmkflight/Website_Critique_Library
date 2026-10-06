/** Small fetch wrapper for the app's JSON routes. Returns a readable error. */
export async function send<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const { json, ...rest } = init;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fields = Array.isArray(body.fields) ? " " + body.fields.map((f: { path: string; message: string }) => `${f.path}: ${f.message}`).join("; ") : "";
      return { ok: false, error: (body.error ?? `Request failed (${res.status}).`) + fields, status: res.status };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "Could not reach the local server.", status: 0 };
  }
}

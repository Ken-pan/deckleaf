// Keep this build-time branch beside the import so local builds omit the browser backend.
export async function jsonRequest<T = any>(url: string, method = 'GET', body?: unknown, transport: typeof fetch = fetch, options:{minimal?:boolean} = {}): Promise<T> {
  if (import.meta.env?.VITE_DECK_RUNTIME === 'browser') { const value=await (await import('./web/api')).browserJson(url,method,body);return options.minimal?undefined as T:value; }
  const response = await transport(url, {method, headers: {...(body ? {'Content-Type': 'application/json'} : {}),...(options.minimal?{Prefer:'return=minimal'}:{})}, body: body ? JSON.stringify(body) : undefined});
  if(response.ok&&options.minimal){await response.body?.cancel();return undefined as T;}
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Could not complete the action. Try again.'), {status: response.status});
  return data;
}

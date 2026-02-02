export const API_BASE = import.meta.env.VITE_API_BASE || '';
export const API_AUTH_BASE = import.meta.env.VITE_API_AUTH_BASE || API_BASE;
export const API_UPLOAD_BASE = import.meta.env.VITE_API_UPLOAD_BASE || API_BASE;
export const API_METADATA_BASE = import.meta.env.VITE_API_METADATA_BASE || API_BASE;
export const API_MINT_BASE = import.meta.env.VITE_API_MINT_BASE || API_BASE;
export const API_VOTING_BASE = import.meta.env.VITE_API_VOTING_BASE || API_BASE;
export const API_MARKETPLACE_BASE = import.meta.env.VITE_API_MARKETPLACE_BASE || 'http://localhost:4006';

function getToken() {
  try {
    return localStorage.getItem('aetheria_token');
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, base: string = API_BASE): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init?.headers || {})
  };
  const token = getToken();
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  // Normalize URL: remove trailing slash from base and leading slash from path
  const normalizedBase = base.replace(/\/+$/, ''); // Remove trailing slashes
  const normalizedPath = path.replace(/^\/+/, ''); // Remove leading slashes
  const url = path.startsWith('http') ? path : `${normalizedBase}/${normalizedPath}`;

  // Validate URL before making request
  if (!url || url === path) {
    throw new Error(`Invalid API URL: base is empty. Check VITE_API_* environment variables.`);
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  // Increased timeout for blockchain transactions (minting can take 30-60 seconds)
  const timeoutMs = path.includes('/mint') ? 60000 : 10000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const contentType = res.headers.get('content-type') || '';
      const isHTML = contentType.includes('text/html');
      const text = await res.text().catch(() => '');

      // If we got HTML back, it means we hit the wrong server (likely frontend dev server)
      if (isHTML && text.includes('<!DOCTYPE html>')) {
        const serviceName = base.includes('auth') ? 'auth' : base.includes('voting') ? 'voting' : 'API';
        throw new Error(
          `Received HTML response instead of JSON. The API endpoint may not exist or the base URL is incorrect. ` +
          `Expected API URL: ${url}. ` +
          `Check that VITE_API_${serviceName.toUpperCase()}_BASE is set correctly and the ${serviceName} service is running.`
        );
      }

      // Try to parse as JSON, otherwise use text
      let errorMsg = text;
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || text;
      } catch {
        // Not JSON, use text as-is
      }

      throw new Error(errorMsg || `Request failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeoutSeconds = timeoutMs / 1000;
      throw new Error(`Request timeout: API at ${url} did not respond within ${timeoutSeconds} seconds. Is the service running?`);
    }
    if (error.message) {
      throw error;
    }
    throw new Error(`Network error: ${error.message || 'Failed to connect to API'}`);
  }
}

export async function apiUpload<T>(path: string, formData: FormData, init?: RequestInit, base: string = API_UPLOAD_BASE) {
  const headers: HeadersInit = { ...(init?.headers || {}) };
  const token = getToken();
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const res = await fetch(url, { method: 'POST', body: formData, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Upload failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const authGet = <T>(p: string, init?: RequestInit) => apiFetch<T>(p, init, API_AUTH_BASE);
export const authPost = <T>(p: string, body: any, init?: RequestInit) => apiFetch<T>(p, { method: 'POST', body: JSON.stringify(body), ...(init || {}) }, API_AUTH_BASE);
export const votingPost = <T>(p: string, body: any, init?: RequestInit) => apiFetch<T>(p, { method: 'POST', body: JSON.stringify(body), ...(init || {}) }, API_VOTING_BASE);
export const votingGet = <T>(p: string, init?: RequestInit) => apiFetch<T>(p, init, API_VOTING_BASE);
export const mintPost = <T>(p: string, body: any, init?: RequestInit) => apiFetch<T>(p, { method: 'POST', body: JSON.stringify(body), ...(init || {}) }, API_MINT_BASE);
export const marketplaceGet = <T>(p: string, init?: RequestInit) => apiFetch<T>(p, init, API_MARKETPLACE_BASE);
export const marketplacePost = <T>(p: string, body: any, init?: RequestInit) => apiFetch<T>(p, { method: 'POST', body: JSON.stringify(body), ...(init || {}) }, API_MARKETPLACE_BASE);

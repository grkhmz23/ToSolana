export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("adminKey") ?? "";
}

export function clearAdminKey(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("adminKey");
}

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  headers.set("x-admin-key", getAdminKey());
  return fetch(input, { ...init, headers });
}

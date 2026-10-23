// Minimal session storage for the first slice. Stores the JWT + admin info in
// localStorage. (We can move to a more secure store later if needed.)

export type Admin = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

const TOKEN_KEY = "celitix_cms_token";
const ADMIN_KEY = "celitix_cms_admin";

export function saveSession(token: string, admin: Admin): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdmin(): Admin | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Admin;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

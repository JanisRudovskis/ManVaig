const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";
const TOKEN_KEY = "manvaig_token";

export interface AuthResponse {
  token: string;
  expiresAt: string;
  userId: string;
  email: string;
  displayName: string;
  emailConfirmed: boolean;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401) throw new Error("invalid_credentials");
    throw new Error("generic_error");
  }

  return res.json();
}

export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });

  if (!res.ok) {
    if (res.status === 400) {
      const body = await res.json();
      throw new Error(body.errors?.[0] ?? "registration_failed");
    }
    throw new Error("generic_error");
  }

  return res.json();
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function confirmEmail(
  userId: string,
  token: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/v1/auth/confirm-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, token }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "confirmation_failed");
  }

  return res.json();
}

export async function resendConfirmation(): Promise<{ message: string }> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/auth/resend-confirmation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "resend_failed");
  }

  return res.json();
}

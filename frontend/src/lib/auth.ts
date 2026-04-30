const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";
const TOKEN_KEY = "manvaig_token";

export interface AuthResponse {
  token: string;
  expiresAt: string;
  userId: string;
  email: string;
  displayName: string;
  emailConfirmed: boolean;
  avatarUrl: string | null;
}

export async function login(
  login: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
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
  displayName: string,
  language?: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName, language }),
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

// === Authenticated fetch wrapper ===
// Auto-logout on 401 responses (expired/invalid token)

export async function authFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    logout();
    window.dispatchEvent(new Event("auth:logout"));
    // Don't throw — let callers handle the response naturally
  }

  return res;
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

export async function resendConfirmation(language?: string): Promise<{ message: string }> {
  const params = language ? `?language=${language}` : "";
  const res = await authFetch(`${API_URL}/api/v1/auth/resend-confirmation${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "resend_failed");
  }

  return res.json();
}

// --- Username availability check ---

export async function checkDisplayName(
  name: string
): Promise<{ available: boolean; reason: string | null }> {
  const res = await fetch(
    `${API_URL}/api/v1/auth/check-name?name=${encodeURIComponent(name)}`
  );
  if (!res.ok) return { available: false, reason: null };
  return res.json();
}

// --- Forgot / Reset Password ---

export async function forgotPassword(email: string, language?: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, language }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "forgot_password_failed");
  }

  return res.json();
}

export async function resetPassword(
  userId: string,
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, token, newPassword }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "reset_password_failed");
  }

  return res.json();
}

// --- Email management ---

export async function changeEmail(
  newEmail: string,
  password: string,
  language?: string
): Promise<AuthResponse> {
  const res = await authFetch(`${API_URL}/api/v1/auth/change-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newEmail, password, language }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const err = new Error("RATE_LIMITED");
      (err as Error & { retryAfter?: number }).retryAfter = body.retryAfter;
      throw err;
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "change_email_failed");
  }

  return res.json();
}

export async function resendConfirmationWithRateLimit(
  language?: string
): Promise<{ message: string }> {
  const params = language ? `?language=${language}` : "";
  const res = await authFetch(
    `${API_URL}/api/v1/auth/resend-confirmation${params}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!res.ok) {
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const err = new Error("RATE_LIMITED");
      (err as Error & { retryAfter?: number }).retryAfter = body.retryAfter;
      throw err;
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "resend_failed");
  }

  return res.json();
}

// --- Profile API ---

export interface Badge {
  id: number;
  key: string;
  name: string;
  iconUrl: string | null;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string | null;
  emailConfirmed: boolean | null;
  phone: string | null;
  phoneVerified: boolean | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  isProfilePublic: boolean;
  enabledChannels: number;
  memberSince: string;
  displayedBadges: Badge[];
}

export interface UpdateProfileData {
  bio?: string;
  location?: string;
  phone?: string;
  isProfilePublic?: boolean;
  enabledChannels?: number;
  displayedBadgeIds?: number[];
}

export async function getMyProfile(): Promise<UserProfile> {
  const res = await authFetch(`${API_URL}/api/v1/profile`);

  if (!res.ok) throw new Error("profile_fetch_failed");
  return res.json();
}

export async function updateProfile(
  data: UpdateProfileData
): Promise<UserProfile> {
  const res = await authFetch(`${API_URL}/api/v1/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "profile_update_failed");
  }
  return res.json();
}

export async function uploadAvatar(
  file: File
): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authFetch(`${API_URL}/api/v1/profile/avatar`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "avatar_upload_failed");
  }
  return res.json();
}

export async function getPublicProfile(
  displayName: string
): Promise<UserProfile> {
  const res = await fetch(
    `${API_URL}/api/v1/users/${encodeURIComponent(displayName)}`
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error("profile_not_found");
    throw new Error("profile_fetch_failed");
  }
  return res.json();
}

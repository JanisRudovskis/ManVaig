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
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("profile_fetch_failed");
  return res.json();
}

export async function updateProfile(
  data: UpdateProfileData
): Promise<UserProfile> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/profile/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
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

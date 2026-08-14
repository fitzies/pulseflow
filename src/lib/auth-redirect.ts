export const DEFAULT_AUTH_REDIRECT = "/automations";

export function getSafeAuthRedirect(
  value: string | string[] | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://pulseflow.local");
    if (
      parsed.origin !== "https://pulseflow.local" ||
      parsed.pathname.startsWith("/auth")
    ) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function withAuthRedirect(path: string, redirectUrl: string) {
  const params = new URLSearchParams({ redirect_url: redirectUrl });
  return `${path}?${params.toString()}`;
}

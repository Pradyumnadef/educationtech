const routeKey = (userId: string) => `english-tech:last-route:${userId}`;

function defaultPath(user: any) {
  if (user.role === "admin") return "/admin";
  return user.onboarding ? "/app" : "/onboarding";
}

export function resumePath(user: any) {
  if (!user) return "/";
  if (user.role !== "admin" && !user.onboarding) return "/onboarding";
  if (typeof window === "undefined") return defaultPath(user);
  try {
    const saved = localStorage.getItem(routeKey(user.id)) || "";
    const allowed =
      user.role === "admin"
        ? /^\/admin(?:\/|$)/.test(saved)
        : /^\/app(?:\/|$)/.test(saved);
    return allowed && saved.length <= 2048 ? saved : defaultPath(user);
  } catch {
    return defaultPath(user);
  }
}

export function postSignInPath(user: any, requested?: unknown) {
  if (!user) return "/";
  if (user.role !== "admin" && !user.onboarding) return "/onboarding";
  if (typeof requested !== "string" || requested.length > 2048)
    return resumePath(user);
  const allowed =
    user.role === "admin"
      ? /^\/admin(?:\/|\?|$)/.test(requested)
      : /^\/app(?:\/|\?|$)/.test(requested);
  return allowed ? requested : resumePath(user);
}

export function rememberWorkspaceRoute(
  user: any,
  pathname: string,
  search = "",
) {
  if (!user || typeof window === "undefined") return;
  const allowed =
    user.role === "admin"
      ? /^\/admin(?:\/|$)/.test(pathname)
      : /^\/app(?:\/|$)/.test(pathname);
  if (!allowed) return;
  const route = `${pathname}${search}`;
  if (route.length > 2048) return;
  try {
    localStorage.setItem(routeKey(user.id), route);
  } catch {}
}

// Website entry and every successful sign-in start at the role's Overview.
// New students still complete their mandatory registration details first.
export function resumePath(user: any) {
  if (!user) return "/";
  if (user.role === "admin") return "/admin";
  return user.onboarding ? "/app" : "/onboarding";
}

export function postSignInPath(user: any, _requested?: unknown) {
  return resumePath(user);
}

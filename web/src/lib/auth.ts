import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/** Team console sign-in; failures come back as /admin?error=<code>. */
export function signInWithGoogle() {
  return authClient.signIn.social({ provider: "google", callbackURL: "/admin", errorCallbackURL: "/admin" });
}

/** Resident sign-in from the public site; returns to the current page. */
export function residentGoogleSignIn() {
  const here = location.pathname + location.search;
  return authClient.signIn.social({ provider: "google", callbackURL: here, errorCallbackURL: location.pathname });
}

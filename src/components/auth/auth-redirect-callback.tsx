"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

import { Spinner } from "@/components/ui/spinner";
import { withAuthRedirect } from "@/lib/auth-redirect";

type AuthRedirectCallbackProps = {
  redirectUrl: string;
};

export function AuthRedirectCallback({
  redirectUrl,
}: AuthRedirectCallbackProps) {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-4 text-foreground">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Finishing authentication…
      </div>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl={withAuthRedirect(
          "/auth/sign-in",
          redirectUrl,
        )}
        signUpFallbackRedirectUrl={withAuthRedirect(
          "/auth/sign-up",
          redirectUrl,
        )}
      />
    </div>
  );
}

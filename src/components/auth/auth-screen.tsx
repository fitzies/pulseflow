"use client";

import { SignIn, SignUp, useClerk } from "@clerk/nextjs";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import {
  ArrowLeft,
  BadgeCheck,
  KeyRound,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import Logo from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { withAuthRedirect } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";
type AuthView =
  | "chooser"
  | "email"
  | "factor-choice"
  | "email-code"
  | "password"
  | "continuation";
type WalletProvider = "metamask" | "coinbase" | "base" | "okx";

type AuthScreenProps = {
  mode: AuthMode;
  redirectUrl: string;
};

const SSO_CALLBACK_URL = "/auth/sso-callback";

const walletOptions: Array<{
  id: WalletProvider;
  name: string;
  icon: string;
}> = [
  { id: "metamask", name: "MetaMask", icon: "/icons/auth/metamask.svg" },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "/icons/auth/coinbase.svg",
  },
  { id: "base", name: "Base Wallet", icon: "/icons/auth/base.svg" },
  { id: "okx", name: "OKX Wallet", icon: "/icons/auth/okx.svg" },
];

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (
      error as {
        errors?: Array<{ longMessage?: string; message?: string }>;
      }
    ).errors;
    const message = errors?.[0]?.longMessage ?? errors?.[0]?.message;
    if (message) return message;
  }

  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function WalletMark({ provider }: { provider: WalletProvider }) {
  const option = walletOptions.find((wallet) => wallet.id === provider)!;

  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md",
        provider === "okx" && "bg-white p-1",
      )}
      aria-hidden="true"
    >
      <Image
        src={option.icon}
        alt=""
        width={24}
        height={24}
        className="size-6 object-contain"
      />
    </span>
  );
}

function AuthHeader({ mode, redirectUrl }: AuthScreenProps) {
  const otherMode = mode === "sign-in" ? "sign-up" : "sign-in";

  return (
    <header className="border-b px-4 md:px-6">
      <div className="flex h-16 items-center justify-between">
        <Link href="/" aria-label="Pulseflow home">
          <Logo />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {mode === "sign-in"
              ? "New to Pulseflow?"
              : "Already have an account?"}
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link href={withAuthRedirect(`/auth/${otherMode}`, redirectUrl)}>
              {mode === "sign-in" ? "Create account" : "Sign in"}
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Close authentication"
          >
            <Link href="/">
              <X />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function ClerkContinuation({ mode, redirectUrl }: AuthScreenProps) {
  const sharedProps = {
    routing: "path" as const,
    fallbackRedirectUrl: redirectUrl,
    appearance: {
      elements: {
        rootBox: "w-full",
        cardBox: "w-full shadow-none",
        card: "w-full border-0 bg-transparent p-0 shadow-none",
        headerTitle: "text-foreground font-semibold tracking-tight",
        headerSubtitle: "text-muted-foreground",
        socialButtonsBlockButton:
          "border-border bg-background text-foreground shadow-xs hover:bg-accent",
        formButtonPrimary:
          "bg-primary text-primary-foreground shadow-none hover:bg-primary/90",
        formFieldInput:
          "border-input bg-transparent text-foreground shadow-xs focus:border-ring focus:ring-ring/50",
        footerActionLink: "text-foreground hover:text-foreground",
        dividerLine: "bg-border",
        dividerText: "text-muted-foreground",
      },
    },
  };

  return mode === "sign-in" ? (
    <SignIn
      {...sharedProps}
      path="/auth/sign-in"
      signUpUrl={withAuthRedirect("/auth/sign-up", redirectUrl)}
    />
  ) : (
    <SignUp
      {...sharedProps}
      path="/auth/sign-up"
      signInUrl={withAuthRedirect("/auth/sign-in", redirectUrl)}
    />
  );
}

export function AuthScreen({ mode, redirectUrl }: AuthScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const clerk = useClerk();
  const signInState = useSignIn();
  const signUpState = useSignUp();

  const [view, setView] = useState<AuthView>("chooser");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [emailCodeAddressId, setEmailCodeAddressId] = useState<string | null>(
    null,
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLoaded = signInState.isLoaded && signUpState.isLoaded;
  const isSignUp = mode === "sign-up";

  const activateSession = async (
    sessionId: string | null,
    setActive: typeof signInState.setActive | typeof signUpState.setActive,
  ) => {
    if (!sessionId || !setActive) {
      setView("continuation");
      return;
    }

    await setActive({
      session: sessionId,
      navigate: ({ decorateUrl }) => {
        const destination = decorateUrl(redirectUrl);
        if (destination.startsWith("http")) {
          window.location.href = destination;
          return;
        }
        router.push(destination);
      },
    });
  };

  const runAction = async (name: string, action: () => Promise<void>) => {
    setError(null);
    setBusyAction(name);
    try {
      await action();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setBusyAction(null);
    }
  };

  const authenticateWithWallet = (provider: WalletProvider) => {
    void runAction(provider, async () => {
      const options = {
        redirectUrl,
        signUpContinueUrl: withAuthRedirect("/auth/sign-up", redirectUrl),
      };

      switch (provider) {
        case "metamask":
          await clerk.authenticateWithMetamask(options);
          break;
        case "coinbase":
          await clerk.authenticateWithCoinbaseWallet(options);
          break;
        case "base":
          await clerk.authenticateWithBase(options);
          break;
        case "okx":
          await clerk.authenticateWithOKXWallet(options);
          break;
      }
    });
  };

  const authenticateWithGoogle = () => {
    if (!isLoaded) return;

    void runAction("google", async () => {
      const redirectOptions = {
        strategy: "oauth_google" as const,
        redirectUrl: withAuthRedirect(SSO_CALLBACK_URL, redirectUrl),
        redirectUrlComplete: redirectUrl,
      };

      if (isSignUp) {
        await signUpState.signUp.authenticateWithRedirect(redirectOptions);
      } else {
        await signInState.signIn.authenticateWithRedirect(redirectOptions);
      }
    });
  };

  const handleEmailSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || !email.trim()) return;

    void runAction("email", async () => {
      if (isSignUp) {
        const result = await signUpState.signUp.create({
          emailAddress: email.trim(),
        });

        if (result.status === "complete") {
          await activateSession(result.createdSessionId, signUpState.setActive);
          return;
        }

        await result.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        setCode("");
        setView("email-code");
        return;
      }

      const result = await signInState.signIn.create({
        identifier: email.trim(),
      });
      const emailCodeFactor = result.supportedFirstFactors?.find(
        (factor) => factor.strategy === "email_code",
      );

      const hasPassword = result.supportedFirstFactors?.some(
        (factor) => factor.strategy === "password",
      );

      if (emailCodeFactor?.strategy === "email_code" && hasPassword) {
        setEmailCodeAddressId(emailCodeFactor.emailAddressId);
        setView("factor-choice");
        return;
      }

      if (emailCodeFactor?.strategy === "email_code") {
        await result.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailCodeFactor.emailAddressId,
        });
        setCode("");
        setView("email-code");
        return;
      }

      if (hasPassword) {
        setPassword("");
        setView("password");
        return;
      }

      setView("continuation");
    });
  };

  const chooseEmailCode = () => {
    if (!isLoaded || !emailCodeAddressId) return;

    void runAction("email-code", async () => {
      await signInState.signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailCodeAddressId,
      });
      setCode("");
      setView("email-code");
    });
  };

  const handleCodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || !code.trim()) return;

    void runAction("code", async () => {
      if (isSignUp) {
        const result = await signUpState.signUp.attemptEmailAddressVerification(
          {
            code: code.trim(),
          },
        );
        if (result.status === "complete") {
          await activateSession(result.createdSessionId, signUpState.setActive);
        } else {
          setView("continuation");
        }
        return;
      }

      const result = await signInState.signIn.attemptFirstFactor({
        strategy: "email_code",
        code: code.trim(),
      });
      if (result.status === "complete") {
        await activateSession(result.createdSessionId, signInState.setActive);
      } else {
        setView("continuation");
      }
    });
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || !password) return;

    void runAction("password", async () => {
      const result = await signInState.signIn.attemptFirstFactor({
        strategy: "password",
        password,
      });
      if (result.status === "complete") {
        await activateSession(result.createdSessionId, signInState.setActive);
      } else {
        setView("continuation");
      }
    });
  };

  const resetToChooser = () => {
    setError(null);
    setCode("");
    setPassword("");
    setEmailCodeAddressId(null);
    setView("chooser");
    router.replace(withAuthRedirect(`/auth/${mode}`, redirectUrl));
  };

  const authBasePath = `/auth/${mode}`;
  const isNestedAuthStep =
    pathname.startsWith(`${authBasePath}/`) && pathname !== authBasePath;
  const pendingClerkFlow =
    view === "chooser" &&
    (isNestedAuthStep ||
      (isSignUp &&
        signUpState.isLoaded &&
        signUpState.signUp.status === "missing_requirements"));

  const showContinuation = view === "continuation" || pendingClerkFlow;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AuthHeader mode={mode} redirectUrl={redirectUrl} />
      <main className="grid min-h-[calc(100svh-4rem)] place-items-center px-4 py-6 sm:px-6">
        <section
          className="w-full max-w-[380px]"
          aria-labelledby={showContinuation ? undefined : "auth-title"}
        >
          {showContinuation ? (
            <Card className="gap-0 p-6 shadow-sm">
              <ClerkContinuation mode={mode} redirectUrl={redirectUrl} />
            </Card>
          ) : view === "chooser" ? (
            <>
              <div className="mb-4 text-center">
                <h1
                  id="auth-title"
                  className="text-xl font-semibold tracking-tight"
                >
                  {isSignUp ? "Create your account" : "Welcome back"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a wallet or continue with email.
                </p>
              </div>

              <Card className="gap-0 overflow-hidden py-0 shadow-sm">
                {walletOptions.map((wallet, index) => {
                  const isPrimary = wallet.id === "metamask";
                  const isBusy = busyAction === wallet.id;
                  return (
                    <Button
                      key={wallet.id}
                      type="button"
                      variant="ghost"
                      className={cn(
                        "h-12 w-full justify-start rounded-none px-3 text-left",
                        index > 0 && "border-t",
                        isPrimary && "bg-accent/30 hover:bg-accent/50",
                      )}
                      disabled={busyAction !== null || !isLoaded}
                      onClick={() => authenticateWithWallet(wallet.id)}
                    >
                      <WalletMark provider={wallet.id} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {wallet.name}
                      </span>
                      {isBusy ? (
                        <Spinner className="text-muted-foreground" />
                      ) : isPrimary ? (
                        <Badge
                          variant="secondary"
                          className="ml-auto px-1.5 py-0 text-[9px]"
                        >
                          Recommended
                        </Badge>
                      ) : null}
                    </Button>
                  );
                })}
              </Card>

              <div className="my-4 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  Traditional account
                </span>
                <Separator className="flex-1" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyAction !== null || !isLoaded}
                  onClick={authenticateWithGoogle}
                >
                  {busyAction === "google" ? (
                    <Spinner />
                  ) : (
                    <Image
                      src="/icons/auth/google.svg"
                      alt=""
                      width={16}
                      height={16}
                      className="size-4"
                    />
                  )}
                  Google
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busyAction !== null || !isLoaded}
                  onClick={() => {
                    setError(null);
                    setView("email");
                  }}
                >
                  <Mail />
                  Email
                </Button>
              </div>

              {error ? (
                <div
                  id="auth-error"
                  role="alert"
                  className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-foreground"
                >
                  {error}
                </div>
              ) : null}

              <div id="clerk-captcha" className="mt-4" />

              <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0" />
                Never share your recovery phrase.
              </div>
            </>
          ) : (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-3 -ml-3 text-muted-foreground"
                onClick={resetToChooser}
              >
                <ArrowLeft />
                All sign-in options
              </Button>

              <Card className="gap-5 p-6 shadow-sm">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-secondary text-secondary-foreground">
                  {view === "password" || view === "factor-choice" ? (
                    <KeyRound />
                  ) : view === "email-code" ? (
                    <BadgeCheck />
                  ) : (
                    <Mail />
                  )}
                </div>
                <div>
                  <h1
                    id="auth-title"
                    className="text-xl font-semibold tracking-tight"
                  >
                    {view === "email"
                      ? isSignUp
                        ? "Create an account with email"
                        : "Continue with email"
                      : view === "factor-choice"
                        ? "Choose how to sign in"
                        : view === "email-code"
                          ? "Check your inbox"
                          : "Enter your password"}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {view === "email"
                      ? "We’ll use this email to find or create your Pulseflow account."
                      : view === "factor-choice"
                        ? `Select a sign-in method for ${email}.`
                        : view === "email-code"
                          ? `Enter the verification code sent to ${email}.`
                          : `Enter the password for ${email}.`}
                  </p>
                </div>

                {view === "email" ? (
                  <form className="space-y-4" onSubmit={handleEmailSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="auth-email">Email address</Label>
                      <Input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={busyAction !== null}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "auth-error" : undefined}
                        required
                        autoFocus
                      />
                    </div>
                    <Button
                      className="w-full"
                      type="submit"
                      disabled={busyAction !== null || !email.trim()}
                    >
                      {busyAction === "email" ? <Spinner /> : <Mail />}
                      Continue with email
                    </Button>
                    {isSignUp ? <div id="clerk-captcha" /> : null}
                  </form>
                ) : view === "factor-choice" ? (
                  <div className="space-y-2">
                    <Button
                      className="w-full justify-start"
                      type="button"
                      disabled={busyAction !== null}
                      onClick={chooseEmailCode}
                    >
                      {busyAction === "email-code" ? <Spinner /> : <Mail />}
                      Email me a verification code
                    </Button>
                    <Button
                      className="w-full justify-start"
                      type="button"
                      variant="outline"
                      disabled={busyAction !== null}
                      onClick={() => {
                        setError(null);
                        setPassword("");
                        setView("password");
                      }}
                    >
                      <KeyRound />
                      Use my password
                    </Button>
                  </div>
                ) : view === "email-code" ? (
                  <form className="space-y-4" onSubmit={handleCodeSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="auth-code">Verification code</Label>
                      <Input
                        id="auth-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter code"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        disabled={busyAction !== null}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "auth-error" : undefined}
                        required
                        autoFocus
                      />
                    </div>
                    <Button
                      className="w-full"
                      type="submit"
                      disabled={busyAction !== null || !code.trim()}
                    >
                      {busyAction === "code" ? <Spinner /> : <BadgeCheck />}
                      Verify email
                    </Button>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handlePasswordSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="auth-password">Password</Label>
                      <Input
                        id="auth-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={busyAction !== null}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "auth-error" : undefined}
                        required
                        autoFocus
                      />
                    </div>
                    <Button
                      className="w-full"
                      type="submit"
                      disabled={busyAction !== null || !password}
                    >
                      {busyAction === "password" ? <Spinner /> : <KeyRound />}
                      Sign in
                    </Button>
                    <Button
                      className="w-full"
                      type="button"
                      variant="link"
                      onClick={() => setView("continuation")}
                    >
                      Forgot your password?
                    </Button>
                  </form>
                )}

                {error ? (
                  <div
                    id="auth-error"
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-foreground"
                  >
                    {error}
                  </div>
                ) : null}
              </Card>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

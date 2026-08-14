import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";

type SignInPageProps = {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const redirectUrl = getSafeAuthRedirect(params.redirect_url);

  if (await currentUser()) redirect(redirectUrl);

  return <AuthScreen mode="sign-in" redirectUrl={redirectUrl} />;
}

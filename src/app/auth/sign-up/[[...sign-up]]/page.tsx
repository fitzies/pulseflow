import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";

type SignUpPageProps = {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const redirectUrl = getSafeAuthRedirect(params.redirect_url);

  if (await currentUser()) redirect(redirectUrl);

  return <AuthScreen mode="sign-up" redirectUrl={redirectUrl} />;
}

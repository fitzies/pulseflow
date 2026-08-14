import { AuthRedirectCallback } from "@/components/auth/auth-redirect-callback";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";

type SsoCallbackPageProps = {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
};

export default async function SsoCallbackPage({
  searchParams,
}: SsoCallbackPageProps) {
  const params = await searchParams;
  const redirectUrl = getSafeAuthRedirect(params.redirect_url);

  return <AuthRedirectCallback redirectUrl={redirectUrl} />;
}

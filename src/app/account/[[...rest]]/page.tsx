"use client";

import { UserProfile } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AccountPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/auth/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <main className="min-h-[90vh] flex items-center justify-center bg-background p-6">
        <p>Loading...</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <main className="min-h-[90vh] flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-4xl">
        <UserProfile
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-lg",
            },
          }}
        />
      </div>
    </main>
  );
}

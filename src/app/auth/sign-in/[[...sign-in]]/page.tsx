import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignIn
        routing="path"
        path="/auth/sign-in"
        redirectUrl="/"
        signUpUrl="/auth/sign-up"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}

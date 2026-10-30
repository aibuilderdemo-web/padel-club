import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { AuthForm } from "@/app/auth/auth-form";

export default function SignUpPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <AuthForm action={signUp} signup />
      <p className="mt-4">
        Already a member? <Link href="/login" className="underline">Log in</Link>
      </p>
    </main>
  );
}

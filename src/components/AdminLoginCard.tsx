"use client";

import { useState } from "react";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "@/src/lib/firebase/client";
import { useToast } from "../hooks/useToast";
import { Eye, EyeClosed, Loader2 } from "lucide-react";
import Image from "next/image";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

type Props = {
  onSuccess?: () => void;
};

export default function AdminLoginCard({ onSuccess }: Props) {
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isOpenEye, setIsOpenEye] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [isSendingForgotPass, setIsSendingForgotPass] = useState(false);

  const canResetPassword =
    email.trim().length > 0 && !isSendingForgotPass && !loading;

  async function onForgotPassword() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      showToast({
        message: "Email required",
        type: "danger",
        description: "Please enter your email address to reset your password.",
      });
      return;
    }

    try {
      setIsSendingForgotPass(true);

      await sendPasswordResetEmail(auth, trimmedEmail);

      showToast({
        message: "Reset email sent",
        type: "success",
        description:
          "Check your inbox (and Spam). We sent you a link to reset your password.",
      });
    } catch (error: any) {
      let errorMessage = "Failed to send reset email.";
      let descriptionMessage = "Please try again later.";

      switch (error?.code) {
        case "auth/user-not-found":
          errorMessage = "No account found";
          descriptionMessage =
            "There is no account associated with this email.";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email";
          descriptionMessage = "Please enter a valid email address.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many requests";
          descriptionMessage = "Please wait a few minutes before trying again.";
          break;
      }

      showToast({
        message: errorMessage,
        type: "danger",
        description: descriptionMessage,
      });
    } finally {
      setIsSendingForgotPass(false);
    }
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return; // ✅ prevent double submit

    setErr(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const token = await cred.user.getIdTokenResult(true);
      const isAdmin = Boolean(token.claims.admin);

      if (!isAdmin) {
        await auth.signOut();
        setErr("Access denied. This account is not an admin.");
        return;
      }

      // ✅ update lastSignIn in Firestore
      await updateDoc(doc(db, "admins", cred.user.uid), {
        lastSignIn: serverTimestamp(),
      });

      onSuccess?.();
    } catch (error: any) {
      let errorMessage = "An error occurred. Please try again.";
      let descriptionMessage =
        "Something went wrong. Check your credentials carefully and try again.";

      switch (error?.code) {
        case "auth/user-not-found":
          errorMessage = "No account found with this email.";
          descriptionMessage = "We couldn’t find an account with this email.";
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          errorMessage = "Incorrect credentials. Please try again.";
          descriptionMessage =
            "That doesn’t seem right. Try again carefully or reset your password.";
          break;
        case "auth/invalid-email":
          errorMessage = "The email address is invalid.";
          descriptionMessage =
            "That email doesn’t look correct. Please check for typos.";
          break;
        case "auth/user-disabled":
          errorMessage = "This account has been disabled.";
          descriptionMessage =
            "This account is currently disabled. Contact support if needed.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many attempts. Please try again later.";
          descriptionMessage = "Please wait a few minutes and try again.";
          break;
      }

      showToast({
        message: errorMessage,
        type: "danger",
        description: descriptionMessage,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Admin Panel
        </h1>
        <p className="text-sm text-gray-500">Sign in to continue</p>
      </div>

      <form onSubmit={onLogin} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-button focus:border-app-button transition disabled:opacity-60"
            placeholder="admin@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1 relative">
          <label className="text-sm font-medium text-gray-700">Password</label>
          <input
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-button focus:border-app-button pr-10 transition disabled:opacity-60"
            placeholder="••••••••"
            type={isOpenEye ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button
            type="button"
            disabled={loading}
            className="absolute top-8 right-2 p-1 rounded-md hover:bg-gray-100 disabled:opacity-50"
            onClick={() => setIsOpenEye((v) => !v)}
            aria-label={isOpenEye ? "Hide password" : "Show password"}
          >
            {isOpenEye ? (
              <EyeClosed className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onForgotPassword}
          disabled={!canResetPassword}
          className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {isSendingForgotPass ? "Sending..." : "Forgot password?"}
        </button>

        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        <button
          disabled={loading}
          type="submit"
          className="w-full rounded-lg bg-app-button text-white py-2.5 text-sm font-medium hover:bg-app-buttonHover active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>

      <div className="flex justify-center gap-2">
        <Image src="/logo.png" alt="Logo" width={20} height={20} />
        <p className="text-xs text-center text-gray-400">
          KalikaScan Admin Panel
        </p>
      </div>
    </div>
  );
}

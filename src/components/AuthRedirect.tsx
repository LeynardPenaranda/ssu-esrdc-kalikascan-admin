// src/components/AuthRedirect.tsx
"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/src/app/providers";

// Optional: if you already have a Spinner component, replace this with yours.
function Loader() {
  return (
    <div className="h-10 w-10 rounded-full border-4 border-black/10 border-t-app-button animate-spin" />
  );
}

export default function AuthRedirect() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const shouldRedirect = useMemo(() => {
    if (loading) return false;
    return Boolean(user && isAdmin && pathname === "/");
  }, [user, isAdmin, pathname, loading]);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace("/admin");
  }, [shouldRedirect, router]);

  // Show full-screen loader + message ONLY while deciding or redirecting
  if (loading || shouldRedirect) {
    return (
      <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/80 px-8 py-6 shadow-xl border border-black/10">
          <Loader />
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900">
              Redirecting...
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Taking you to the admin dashboard
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

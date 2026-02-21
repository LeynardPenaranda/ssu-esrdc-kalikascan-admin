"use client";

import AdminsTable, {
  type AdminRole,
  type AdminRow,
} from "@/src/components/tables/AdminsTable";
import RegisterAdminModal from "@/src/components/modals/RegisterModal";

import { DEFAULT_ADMIN_AVATAR } from "@/src/constant";
import { useToast } from "@/src/hooks/useToast";
import { auth, db } from "@/src/lib/firebase/client";
import { RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";

function tsToIso(ts: any): string | null {
  if (!ts) return null;
  try {
    // Firestore Timestamp
    if (typeof ts.toDate === "function")
      return (ts as Timestamp).toDate().toISOString();
    // Date
    if (ts instanceof Date) return ts.toISOString();
    // already string
    if (typeof ts === "string") return ts;
    return String(ts);
  } catch {
    return null;
  }
}

export default function CreateAdminPage() {
  const { showToast } = useToast();

  // create admin form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [role, setRole] = useState<AdminRole>("admin");
  const [loadingCreate, setLoadingCreate] = useState(false);

  // admins list
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // modal
  const [openCreate, setOpenCreate] = useState(false);

  // ✅ for "You" badge
  const [myUid, setMyUid] = useState<string | null>(null);

  // ✅ keep unsubscribe ref for Firestore listener
  const unsubAdminsRef = useRef<null | (() => void)>(null);

  function resetCreateForm() {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setRole("admin");
  }

  function openCreateModal() {
    resetCreateForm();
    setOpenCreate(true);
  }

  function closeCreateModal() {
    setOpenCreate(false);
  }

  async function resolveMyRoleAndUid(currentUid: string) {
    setMyUid(currentUid);

    // superadmin claim (your existing logic)
    const token = await auth.currentUser?.getIdTokenResult(true);
    setIsSuperAdmin(Boolean(token?.claims?.superadmin));
    setRole("admin");
  }

  // ✅ LIVE subscribe to /admins so photoURL updates instantly
  function subscribeAdmins() {
    setLoadingAdmins(true);

    // cleanup previous listener if any
    if (unsubAdminsRef.current) {
      unsubAdminsRef.current();
      unsubAdminsRef.current = null;
    }

    const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: AdminRow[] = snap.docs.map((d) => {
          const data = d.data() as any;

          return {
            uid: data.uid ?? d.id,
            email: data.email ?? null,
            displayName: data.displayName ?? null,
            photoURL: data.photoURL ?? null,
            disabled: Boolean(data.disabled),
            role: (data.role ?? "admin") as AdminRole,
            createdAt: tsToIso(data.createdAt),
            lastSignIn: tsToIso(data.lastSignIn),
          };
        });

        setAdmins(rows);
        setLoadingAdmins(false);
      },
      (err) => {
        console.error("Admins subscription error:", err);
        setLoadingAdmins(false);
        showToast({
          type: "danger",
          message: "Failed to load admins",
          description: err?.message ?? "Something went wrong",
        });
      },
    );

    unsubAdminsRef.current = unsub;
  }

  // keep your API fetch (manual refresh button can still use it)
  async function fetchAdmins() {
    try {
      setLoadingAdmins(true);

      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");

      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/list-admins", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to fetch admins");

      setAdmins(Array.isArray(data?.admins) ? data.admins : []);
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Failed to load admins",
        description: e?.message ?? "Something went wrong",
      });
    } finally {
      setLoadingAdmins(false);
    }
  }

  useEffect(() => {
    // ✅ wait for auth to be ready
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      await resolveMyRoleAndUid(user.uid);

      // ✅ start realtime updates (this fixes old avatar issue)
      subscribeAdmins();

      // optional: also do initial API fetch once (not required)
      // await fetchAdmins();
    });

    return () => {
      unsubAuth();
      if (unsubAdminsRef.current) {
        unsubAdminsRef.current();
        unsubAdminsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoadingCreate(true);

    try {
      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");

      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
          displayName,
          photoURL: DEFAULT_ADMIN_AVATAR,
          role: isSuperAdmin ? role : "admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");

      showToast({
        type: "success",
        message: "Admin created successfully",
        description: `${displayName || email} can now log in using the temporary password.`,
      });

      closeCreateModal();
      resetCreateForm();

      // ✅ no need to fetch, onSnapshot will update automatically
      // but keeping this won't hurt:
      // fetchAdmins();
    } catch (e: any) {
      let msg = "Failed to create admin";
      let description = e?.message ?? "Something went wrong";

      if (description.includes("email-already-exists"))
        description = "An account with this email already exists.";
      if (description.includes("invalid-email"))
        description = "Please enter a valid email address.";
      if (description.includes("weak-password"))
        description = "Password should be at least 6 characters.";

      showToast({ type: "danger", message: msg, description });
    } finally {
      setLoadingCreate(false);
    }
  }

  async function safeReadJson(res: Response) {
    const text = await res.text();
    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { json: null as any, text };
    }
  }

  async function onDisableAdmin(admin: AdminRow) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");
      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/toggle-disabled", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: admin.uid, disabled: !admin.disabled }),
      });

      const { json } = await safeReadJson(res);

      if (!res.ok) {
        const msg =
          json?.error ??
          `Request failed (${res.status}). Received non-JSON response.`;
        throw new Error(msg);
      }

      showToast({
        type: "success",
        message: admin.disabled ? "Admin enabled" : "Admin disabled",
        description: admin.email || admin.uid,
      });

      // ✅ realtime listener will reflect updates; no fetch needed
      // fetchAdmins();
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Action failed",
        description: e?.message ?? "Something went wrong",
      });
    }
  }

  async function onDeleteAdmin(admin: AdminRow) {
    try {
      const ok = window.confirm(`Delete admin: ${admin.email || admin.uid}?`);
      if (!ok) return;

      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");
      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/delete-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: admin.uid }),
      });

      const { json } = await safeReadJson(res);
      if (!res.ok) throw new Error(json?.error ?? "Failed");

      showToast({
        type: "success",
        message: "Admin deleted",
        description: admin.email || admin.uid,
      });

      // ✅ realtime listener will reflect deletion; no fetch needed
      // fetchAdmins();
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Delete failed",
        description: e?.message ?? "Something went wrong",
      });
    }
  }

  return (
    <div className="w-full h-[100dvh] overflow-hidden p-4">
      <div className="w-full h-full bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 sm:px-8 pt-6 pb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-app-headerText">
              KalikaScan Admins
            </h2>
            <p className="text-sm text-app-text mt-1">
              Manage admins for the KalikaScan Admin Panel.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-lg bg-app-button text-white px-3 py-2 text-sm font-medium hover:brightness-110 active:scale-[0.99] transition"
            >
              Register New Admin
            </button>

            <button
              type="button"
              onClick={fetchAdmins} // manual refresh still works
              disabled={loadingAdmins}
              className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh admins"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingAdmins ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Table */}
        <div className="flex-1 min-h-0 px-6 sm:px-8 py-5 overflow-hidden">
          <AdminsTable
            admins={admins}
            loading={loadingAdmins}
            isSuperAdmin={isSuperAdmin}
            myUid={myUid}
            onDisableAdmin={onDisableAdmin}
            onDeleteAdmin={onDeleteAdmin}
          />
        </div>
      </div>

      {/* Create Admin Modal */}
      <RegisterAdminModal
        open={openCreate}
        disableClose={loadingCreate}
        isSuperAdmin={isSuperAdmin}
        loading={loadingCreate}
        role={role}
        displayName={displayName}
        email={email}
        password={password}
        onChangeRole={setRole}
        onChangeDisplayName={setDisplayName}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        onClose={() => {
          if (!loadingCreate) closeCreateModal();
        }}
        onSubmit={onCreate}
      />
    </div>
  );
}

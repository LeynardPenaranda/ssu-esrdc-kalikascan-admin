"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { auth } from "@/src/lib/firebase/client";
import { useToast } from "@/src/hooks/useToast";
import UsersTable, {
  type AppUserRow,
  type AppUserRole,
} from "@/src/components/tables/UsersTable";
import BanUserModal from "@/src/components/modals/BanUserModal";

export default function KalikaScanUsersPage() {
  const { showToast } = useToast();

  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [myUid, setMyUid] = useState<string | null>(null);
  const [q, setQ] = useState("");

  //  Ban modal state
  const [banOpen, setBanOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<AppUserRow | null>(null);
  const [banLoading, setBanLoading] = useState(false);
  const [banMode, setBanMode] = useState<"ban" | "unban">("ban");

  async function safeReadJson(res: Response) {
    const text = await res.text();
    try {
      return { json: JSON.parse(text), text };
    } catch {
      return { json: null as any, text };
    }
  }

  async function resolveMyUid() {
    const current = auth.currentUser;
    if (!current) return;
    setMyUid(current.uid);
  }

  async function fetchUsers() {
    try {
      setLoading(true);

      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");

      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/users/list", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const { json } = await safeReadJson(res);
      if (!res.ok) throw new Error(json?.error ?? "Failed to fetch users");

      setUsers(Array.isArray(json?.users) ? json.users : []);
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Failed to load users",
        description: e?.message ?? "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    resolveMyUid();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const hay = [
        u.uid,
        u.email ?? "",
        u.displayName ?? "",
        u.username ?? "",
        u.role ?? "",
        u.banned ? "banned" : "active",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [users, q]);

  //  Open ban modal from table
  function openBanModal(user: AppUserRow) {
    setBanTarget(user);
    setBanMode(user.banned ? "unban" : "ban");
    setBanOpen(true);
  }

  function closeBanModal() {
    if (banLoading) return;
    setBanOpen(false);
    setBanTarget(null);
  }

  async function confirmBan(payload: { reason: string | null }) {
    if (!banTarget) return;

    try {
      setBanLoading(true);

      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");
      const token = await current.getIdToken(true);

      const nextBanned = banMode === "ban";

      const res = await fetch("/api/admin/users/toggle-ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: banTarget.uid,
          banned: nextBanned,
          bannedReason: nextBanned ? payload.reason : null,
        }),
      });

      const { json } = await safeReadJson(res);
      if (!res.ok) throw new Error(json?.error ?? "Request failed");

      showToast({
        type: "success",
        message: nextBanned ? "User banned" : "User unbanned",
        description: banTarget.email || banTarget.uid,
      });

      closeBanModal();
      fetchUsers();
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Action failed",
        description: e?.message ?? "Something went wrong",
      });
    } finally {
      setBanLoading(false);
    }
  }

  async function onDeleteUser(user: AppUserRow) {
    try {
      const ok = window.confirm(
        `Delete user account and /users doc?\n${user.email || user.uid}`,
      );
      if (!ok) return;

      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");
      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: user.uid }),
      });

      const { json } = await safeReadJson(res);
      if (!res.ok) throw new Error(json?.error ?? "Failed");

      showToast({
        type: "success",
        message: "User deleted",
        description: user.email || user.uid,
      });

      fetchUsers();
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Delete failed",
        description: e?.message ?? "Something went wrong",
      });
    }
  }

  async function onChangeRole(user: AppUserRow, role: AppUserRole) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error("Not logged in");
      const token = await current.getIdToken(true);

      const res = await fetch("/api/admin/users/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: user.uid, role }),
      });

      const { json } = await safeReadJson(res);
      if (!res.ok) throw new Error(json?.error ?? "Failed");

      showToast({
        type: "success",
        message: "Role updated",
        description: `${user.email || user.uid} → ${role}`,
      });

      fetchUsers();
    } catch (e: any) {
      showToast({
        type: "danger",
        message: "Role change failed",
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
              KalikaScan Users
            </h2>
            <p className="text-sm text-app-text mt-1">
              Loaded from Firestore <span className="font-mono">/users</span>{" "}
              collection.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Refresh users"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 sm:px-8 pb-4">
          <div className="max-w-xl w-full">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 bg-white">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email, name, username, uid, role..."
                className="w-full outline-none text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Table */}
        <div className="flex-1 min-h-0 px-6 sm:px-8 py-5 overflow-hidden">
          <UsersTable
            users={filtered}
            loading={loading}
            myUid={myUid}
            onOpenBanModal={openBanModal}
            onDeleteUser={onDeleteUser}
            onChangeRole={onChangeRole}
          />
        </div>
      </div>

      {/*  Ban / Unban Modal */}
      <BanUserModal
        open={banOpen}
        loading={banLoading}
        mode={banMode}
        userLabel={
          banTarget?.displayName ||
          banTarget?.username ||
          banTarget?.email ||
          banTarget?.uid ||
          "User"
        }
        defaultReason={banTarget?.bannedReason ?? null}
        onCancel={closeBanModal}
        onConfirm={confirmBan}
      />
    </div>
  );
}

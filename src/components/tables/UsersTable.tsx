"use client";

import { useEffect, useMemo, useState } from "react";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { formatDateTime } from "@/src/utils/formatDate";
import DeleteUserModal from "@/src/components/modals/DeleteUserModal";

export type AppUserRole = "regular" | "expert";

export type AppUserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
  imageUrl: string | null;

  role: AppUserRole;
  isExpert: boolean;

  banned: boolean;
  bannedReason: string | null;

  createdAt: string | null;
  lastActiveAt: string | null;
  updatedAt: string | null;
};

function initials(nameOrEmail?: string | null) {
  const s = (nameOrEmail ?? "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function roleBadge(role: AppUserRole) {
  return role === "expert"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-gray-50 text-gray-700 border-gray-200";
}

function statusBadge(banned: boolean) {
  return banned
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-green-50 text-green-700 border-green-200";
}

const PAGE_SIZE = 10;

export default function UsersTable({
  users,
  loading,
  myUid,
  onOpenBanModal,
  onDeleteUser,
  onChangeRole,
}: {
  users: AppUserRow[];
  loading: boolean;
  myUid: string | null;
  onOpenBanModal: (u: AppUserRow) => void;
  onDeleteUser: (u: AppUserRow) => void | Promise<void>;
  onChangeRole: (u: AppUserRow, role: AppUserRole) => void | Promise<void>;
}) {
  const [page, setPage] = useState(1);

  //  delete modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  //  row-level busy state (for disabling dropdown while acting)
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    "change_role" | "toggle_ban" | "delete" | null
  >(null);

  function openDeleteModal(u: AppUserRow) {
    setDeleteTarget(u);
    setDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  async function confirmDelete(u: AppUserRow) {
    setBusyUid(u.uid);
    setBusyAction("delete");
    setDeleteLoading(true);

    try {
      //  no alerts here; parent can show toast if you want
      await Promise.resolve(onDeleteUser(u));
      setDeleteOpen(false);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
      setBusyUid(null);
      setBusyAction(null);
    }
  }

  async function handleChangeRole(u: AppUserRow, role: AppUserRole) {
    setBusyUid(u.uid);
    setBusyAction("change_role");
    try {
      await Promise.resolve(onChangeRole(u, role));
    } finally {
      setBusyUid(null);
      setBusyAction(null);
    }
  }

  function handleOpenBan(u: AppUserRow) {
    // ban/unban is handled by your own modal; just open it
    onOpenBanModal(u);
  }

  //  reset to page 1 when list changes (search/refresh)
  useEffect(() => {
    setPage(1);
  }, [users]);

  const total = users.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return users.slice(start, start + PAGE_SIZE);
  }, [users, page]);

  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  return (
    <div className="w-full h-full overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs text-gray-500">
          {total === 0 ? (
            <>
              Showing <span className="font-medium text-gray-700">0</span> users
            </>
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-gray-700">
                {showingFrom}-{showingTo}
              </span>{" "}
              of <span className="font-medium text-gray-700">{total}</span>
            </>
          )}
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={loading || page <= 1}
            className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>

          <div className="text-xs text-gray-600">
            Page <span className="font-medium">{page}</span> /{" "}
            <span className="font-medium">{totalPages}</span>
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={loading || page >= totalPages}
            className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left border-b border-gray-100">
              <th className="px-4 py-3 font-medium text-gray-600">User</th>
              <th className="px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">
                Last Active
              </th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">
                Manage
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  Loading...
                </td>
              </tr>
            ) : total === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  No users found.
                </td>
              </tr>
            ) : (
              pagedUsers.map((u) => {
                const isMe = myUid === u.uid;
                const avatar = u.photoURL || u.imageUrl;

                const rowBusy = busyUid === u.uid;
                const deleting = rowBusy && busyAction === "delete";

                const items: MenuProps["items"] = [
                  {
                    key: "role_regular",
                    label: "Set role: Regular",
                    disabled: isMe || rowBusy || u.role === "regular",
                  },
                  {
                    key: "role_expert",
                    label: "Set role: Expert",
                    disabled: isMe || rowBusy || u.role === "expert",
                  },
                  { type: "divider" },
                  {
                    key: "toggle_ban",
                    label: u.banned ? "Unban user" : "Ban user",
                    disabled: isMe || rowBusy,
                  },
                  {
                    key: "delete",
                    label: <span className="text-red-600">Delete user</span>,
                    disabled: isMe || rowBusy,
                  },
                ];

                const onClick: MenuProps["onClick"] = ({ key }) => {
                  if (isMe || rowBusy) return;

                  if (key === "role_regular") handleChangeRole(u, "regular");
                  if (key === "role_expert") handleChangeRole(u, "expert");
                  if (key === "toggle_ban") handleOpenBan(u);
                  if (key === "delete") openDeleteModal(u);
                };

                return (
                  <tr
                    key={u.uid}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 ${
                      rowBusy ? "opacity-90" : ""
                    }`}
                  >
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover border border-black/5"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-gray-100 border border-black/5 flex items-center justify-center text-xs font-semibold text-gray-600">
                            {initials(u.displayName || u.email || u.username)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900 truncate">
                              {u.displayName ||
                                u.username ||
                                u.email ||
                                "Unnamed"}
                            </div>

                            {isMe && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600">
                                You
                              </span>
                            )}

                            {deleting ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-500">
                                Deleting...
                              </span>
                            ) : null}
                          </div>

                          <div className="text-xs text-gray-500 truncate">
                            {u.email || "No email"} ·{" "}
                            <span className="font-mono">{u.uid}</span>
                          </div>

                          {u.banned && u.bannedReason ? (
                            <div className="text-xs text-red-600 mt-1 truncate">
                              Reason: {u.bannedReason}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full border text-xs ${roleBadge(
                          u.role,
                        )}`}
                      >
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full border text-xs ${statusBadge(
                          u.banned,
                        )}`}
                      >
                        {u.banned ? "Banned" : "Active"}
                      </span>
                    </td>

                    {/* Last Active */}
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateTime(u.lastActiveAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <Dropdown menu={{ items, onClick }} trigger={["click"]}>
                        <button
                          type="button"
                          className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 active:scale-[0.98] transition cursor-pointer inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isMe || rowBusy}
                          title={
                            isMe
                              ? "You can’t manage your own account"
                              : rowBusy
                                ? "Please wait..."
                                : "Manage user"
                          }
                        >
                          {rowBusy ? "Working..." : "Manage"}
                          <DownOutlined className="text-[10px]" />
                        </button>
                      </Dropdown>

                      {isMe ? (
                        <div className="text-[11px] text-gray-400 mt-1">
                          You can’t manage your own account
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom pagination */}
      {total > PAGE_SIZE ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={loading || page <= 1}
            className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <div className="text-xs text-gray-600">
            Page <span className="font-medium">{page}</span> /{" "}
            <span className="font-medium">{totalPages}</span>
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={loading || page >= totalPages}
            className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      ) : null}

      {/*  Delete confirmation modal */}
      <DeleteUserModal
        open={deleteOpen}
        user={deleteTarget}
        loading={deleteLoading}
        onCancel={closeDeleteModal}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

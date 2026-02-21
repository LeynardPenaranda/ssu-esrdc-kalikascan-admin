"use client";

import { useEffect, useMemo, useState } from "react";
import { Dropdown, message } from "antd";
import type { MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { formatDateTime } from "@/src/utils/formatDate";
import Avatar from "../ui/Avatar";
import DeleteAdminModal from "../modals/DeleteAdminModal";

export type AdminRole = "admin" | "superadmin";

export type AdminRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  disabled: boolean;
  createdAt: string | null;
  lastSignIn: string | null;
  role: AdminRole;
};

function roleBadge(role: AdminRole) {
  return role === "superadmin"
    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
    : "bg-gray-50 text-gray-700 border-gray-200";
}

function statusBadge(disabled: boolean) {
  return disabled
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-green-50 text-green-700 border-green-200";
}

const PAGE_SIZE = 10;

export default function AdminsTable({
  admins,
  loading,
  isSuperAdmin,
  myUid,
  onDisableAdmin,
  onDeleteAdmin,
}: {
  admins: AdminRow[];
  loading: boolean;
  isSuperAdmin: boolean;
  myUid: string | null;
  onDisableAdmin: (admin: AdminRow) => void | Promise<void>;
  onDeleteAdmin: (admin: AdminRow) => void | Promise<void>;
}) {
  const [page, setPage] = useState(1);

  //  search
  const [q, setQ] = useState("");

  //  row-level busy state (for UI/disable buttons)
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    "toggle_disabled" | "delete" | null
  >(null);

  //  delete modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  //  AntD message: ONLY for enable/disable (NOT for delete)
  const [messageApi, contextHolder] = message.useMessage();

  // reset to page 1 when list changes
  useEffect(() => {
    setPage(1);
  }, [admins]);

  //  reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [q]);

  const filteredAdmins = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return admins;

    return admins.filter((a) => {
      const name = (a.displayName ?? "").toLowerCase();
      const email = (a.email ?? "").toLowerCase();
      const uid = (a.uid ?? "").toLowerCase();
      const role = (a.role ?? "").toLowerCase();
      const status = (a.disabled ? "disabled" : "active").toLowerCase();

      return (
        name.includes(query) ||
        email.includes(query) ||
        uid.includes(query) ||
        role.includes(query) ||
        status.includes(query)
      );
    });
  }, [admins, q]);

  const total = filteredAdmins.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pagedAdmins = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAdmins.slice(start, start + PAGE_SIZE);
  }, [filteredAdmins, page]);

  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function openDeleteModal(admin: AdminRow) {
    setDeleteTarget(admin);
    setDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  //  Delete: confirmed via your DeleteAdminModal; NO alert/toast here
  async function confirmDelete(admin: AdminRow) {
    setBusyUid(admin.uid);
    setBusyAction("delete");
    setDeleteLoading(true);

    try {
      await Promise.resolve(onDeleteAdmin(admin));
      setDeleteOpen(false);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
      setBusyUid(null);
      setBusyAction(null);
    }
  }

  //  Enable/Disable: show feedback
  async function handleToggleDisabled(admin: AdminRow) {
    setBusyUid(admin.uid);
    setBusyAction("toggle_disabled");

    const willDisable = !admin.disabled;
    const key = `toggle-${admin.uid}`;

    messageApi.open({
      key,
      type: "loading",
      content: willDisable ? "Disabling admin..." : "Enabling admin...",
      duration: 0,
    });

    try {
      await Promise.resolve(onDisableAdmin(admin));
      messageApi.open({
        key,
        type: "success",
        content: willDisable ? "Admin disabled." : "Admin enabled.",
        duration: 2,
      });
    } catch (e: any) {
      messageApi.open({
        key,
        type: "error",
        content: e?.message ? `Action failed: ${e.message}` : "Action failed.",
        duration: 3,
      });
    } finally {
      setBusyUid(null);
      setBusyAction(null);
    }
  }

  return (
    <div className="w-full h-full overflow-hidden flex flex-col">
      {contextHolder}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs text-gray-500">
          {total === 0 ? (
            <>
              Showing <span className="font-medium text-gray-700">0</span>{" "}
              admins
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
          {q.trim() ? (
            <span className="ml-2 text-gray-400">
              (filtered by “{q.trim()}”)
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/*  Search input */}
          <div className="hidden sm:block">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, uid, role..."
              className="w-[280px] rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none bg-white  transition"
            />
          </div>

          {q.trim() ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 active:scale-[0.98] transition"
              title="Clear search"
            >
              Clear
            </button>
          ) : null}

          {/* Pagination */}
          <button
            type="button"
            onClick={goPrev}
            disabled={loading || page <= 1}
            className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/*  Mobile search row */}
      <div className="sm:hidden mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search admins..."
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none bg-white focus:ring-2 focus:ring-app-button focus:border-app-button transition"
        />
        {q.trim() ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white hover:bg-gray-50 active:scale-[0.98] transition"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left border-b border-gray-100">
              <th className="px-4 py-3 font-medium text-gray-600">Admin</th>
              <th className="px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">
                Last Sign In
              </th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">
                {isSuperAdmin ? "Manage" : ""}
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
                  {q.trim() ? "No matching admins found." : "No admins found."}
                </td>
              </tr>
            ) : (
              pagedAdmins.map((a) => {
                const isMe = myUid === a.uid;
                const showManage = isSuperAdmin;
                const canManageRow = showManage && !isMe && a.role === "admin";

                const rowBusy = busyUid === a.uid;

                const disableBusy = rowBusy && busyAction === "toggle_disabled";
                const deleteBusy = rowBusy && busyAction === "delete";

                const items: MenuProps["items"] = [
                  {
                    key: "toggle_disabled",
                    label: a.disabled ? "Enable admin" : "Disable admin",
                    disabled: !canManageRow || rowBusy,
                  },
                  { type: "divider" },
                  {
                    key: "delete",
                    label: (
                      <span
                        className={rowBusy ? "text-gray-400" : "text-red-600"}
                      >
                        Delete admin
                      </span>
                    ),
                    disabled: !canManageRow || rowBusy,
                  },
                ];

                const onClick: MenuProps["onClick"] = ({ key }) => {
                  if (!canManageRow || rowBusy) return;
                  if (key === "toggle_disabled") handleToggleDisabled(a);
                  if (key === "delete") openDeleteModal(a);
                };

                return (
                  <tr
                    key={a.uid}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 ${
                      rowBusy ? "opacity-90" : ""
                    }`}
                  >
                    {/* Admin */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={a.photoURL}
                          name={a.displayName}
                          email={a.email}
                          size="sm"
                          ring={!a.disabled}
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900 truncate">
                              {a.displayName || a.email || "Admin"}
                            </div>

                            {isMe && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-600">
                                You
                              </span>
                            )}

                            {disableBusy ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-500">
                                Updating...
                              </span>
                            ) : null}

                            {deleteBusy ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-white text-gray-500">
                                Deleting...
                              </span>
                            ) : null}
                          </div>

                          <div className="text-xs text-gray-500 truncate">
                            {a.email || "No email"} ·{" "}
                            <span className="font-mono">{a.uid}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full border text-xs ${roleBadge(
                          a.role,
                        )}`}
                      >
                        {a.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full border text-xs ${statusBadge(
                          a.disabled,
                        )}`}
                      >
                        {a.disabled ? "Disabled" : "Active"}
                      </span>
                    </td>

                    {/* Last sign in */}
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateTime(a.lastSignIn)}
                    </td>

                    {/* Manage */}
                    <td className="px-4 py-3 text-right">
                      {showManage ? (
                        <>
                          <Dropdown
                            menu={{ items, onClick }}
                            trigger={["click"]}
                            placement="bottomRight"
                          >
                            <button
                              type="button"
                              className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 bg-white hover:bg-gray-50 active:scale-[0.98] transition cursor-pointer inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={!canManageRow || rowBusy}
                              title={
                                !canManageRow
                                  ? isMe
                                    ? "You can’t manage your own account"
                                    : a.role === "superadmin"
                                      ? "You can’t manage another superadmin"
                                      : "You don’t have permission"
                                  : rowBusy
                                    ? "Please wait..."
                                    : "Manage admin"
                              }
                            >
                              {rowBusy ? "Working..." : "Manage"}
                              <DownOutlined className="text-[10px]" />
                            </button>
                          </Dropdown>

                          {!canManageRow && isMe ? (
                            <div className="text-[11px] text-gray-400 mt-1">
                              You can’t manage your own account
                            </div>
                          ) : null}

                          {!canManageRow && !isMe && a.role === "superadmin" ? (
                            <div className="text-[11px] text-gray-400 mt-1">
                              Superadmins can’t be managed here
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
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

      {/* Delete modal */}
      <DeleteAdminModal
        open={deleteOpen}
        admin={deleteTarget}
        loading={deleteLoading}
        onCancel={closeDeleteModal}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

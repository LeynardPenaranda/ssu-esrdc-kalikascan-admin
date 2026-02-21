"use client";

import { Modal } from "antd";
import type { AppUserRow } from "../tables/UsersTable";

type Props = {
  open: boolean;
  user: AppUserRow | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (user: AppUserRow) => Promise<void> | void;
};

export default function DeleteUserModal({
  open,
  user,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  async function handleConfirm() {
    if (!user) return;
    await onConfirm(user);
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={handleConfirm}
      confirmLoading={loading}
      okText="Delete"
      cancelText="Cancel"
      okButtonProps={{
        danger: true,
        disabled: !user,
      }}
      title="Delete user?"
      centered
    >
      <div className="text-sm text-gray-700">
        {user ? (
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {user.displayName || user.username || user.email || "this user"}
            </span>
            ?
            <div className="text-xs text-gray-500 mt-2">
              This action cannot be undone.
            </div>
          </>
        ) : (
          "No user selected."
        )}
      </div>
    </Modal>
  );
}

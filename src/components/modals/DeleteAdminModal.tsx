"use client";

import { Modal } from "antd";
import { AdminRow } from "../tables/AdminsTable";

type Props = {
  open: boolean;
  admin: AdminRow | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (admin: AdminRow) => Promise<void> | void;
};

export default function DeleteAdminModal({
  open,
  admin,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  async function handleConfirm() {
    if (!admin) return;
    await onConfirm(admin);
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
        disabled: !admin,
      }}
      title="Delete admin?"
      centered
    >
      <div className="text-sm text-gray-700">
        {admin ? (
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {admin.displayName || admin.email || "this admin"}
            </span>
            ?
            <div className="text-xs text-gray-500 mt-2">
              This action cannot be undone.
            </div>
          </>
        ) : (
          "No admin selected."
        )}
      </div>
    </Modal>
  );
}

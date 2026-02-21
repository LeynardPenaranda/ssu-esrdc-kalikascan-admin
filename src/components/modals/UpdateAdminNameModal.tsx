"use client";

import React, { useEffect, useState } from "react";
import { Modal, Input } from "antd";

export default function UpdateAdminNameModal({
  open,
  loading,
  initialName,
  onClose,
  onSave,
}: {
  open: boolean;
  loading: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (newName: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);

  // keep input synced when opening
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= 60;

  return (
    <Modal
      title="Update name"
      open={open}
      onCancel={loading ? undefined : onClose}
      onOk={() => onSave(trimmed)}
      okText="Save"
      confirmLoading={loading}
      okButtonProps={{ disabled: !canSave }}
      destroyOnHidden
    >
      <div className="space-y-2">
        <div className="text-sm text-gray-600">Display name</div>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={60}
          disabled={loading}
          onPressEnter={() => {
            if (canSave) onSave(trimmed);
          }}
        />

        <div className="text-xs text-gray-400">Max 60 characters.</div>
      </div>
    </Modal>
  );
}

// src/components/BanUserModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Select, Input } from "antd";

const { TextArea } = Input;

export type BanReasonOption =
  | "spam"
  | "harassment"
  | "inappropriate_content"
  | "impersonation"
  | "suspicious_activity"
  | "policy_violation"
  | "other";

const DEFAULT_REASONS: { value: BanReasonOption; label: string }[] = [
  { value: "spam", label: "Spam / Scams" },
  { value: "harassment", label: "Harassment / Bullying" },
  { value: "inappropriate_content", label: "Inappropriate Content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "suspicious_activity", label: "Suspicious Activity" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "other", label: "Other (custom)" },
];

export default function BanUserModal({
  open,
  loading,
  mode, // "ban" | "unban"
  userLabel,
  defaultReason, // optional prefill
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading?: boolean;
  mode: "ban" | "unban";
  userLabel: string; // e.g. email/displayName for UI
  defaultReason?: string | null;
  onCancel: () => void;
  onConfirm: (payload: { reason: string | null }) => void;
}) {
  const [selected, setSelected] = useState<BanReasonOption>("spam");
  const [custom, setCustom] = useState("");

  // Reset each time modal opens
  useEffect(() => {
    if (!open) return;

    // If they passed an existing reason, try to keep it as custom
    const initial = (defaultReason ?? "").trim();
    if (initial) {
      setSelected("other");
      setCustom(initial);
    } else {
      setSelected("spam");
      setCustom("");
    }
  }, [open, defaultReason]);

  const requiresReason = mode === "ban";

  const computedReason = useMemo(() => {
    if (mode === "unban") return null;

    if (selected === "other") {
      const r = custom.trim();
      return r ? r : "";
    }

    // map preset to readable reason string stored in Firestore
    const map: Record<Exclude<BanReasonOption, "other">, string> = {
      spam: "Spam / Scams",
      harassment: "Harassment / Bullying",
      inappropriate_content: "Inappropriate Content",
      impersonation: "Impersonation",
      suspicious_activity: "Suspicious Activity",
      policy_violation: "Policy Violation",
    };

    return map[selected as Exclude<BanReasonOption, "other">] ?? "";
  }, [mode, selected, custom]);

  const canConfirm = useMemo(() => {
    if (!requiresReason) return true; // unban
    return Boolean(computedReason && computedReason.trim().length >= 3);
  }, [requiresReason, computedReason]);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={mode === "ban" ? "Ban user" : "Unban user"}
      okText={mode === "ban" ? "Ban" : "Unban"}
      cancelText="Cancel"
      confirmLoading={Boolean(loading)}
      okButtonProps={{ danger: mode === "ban", disabled: !canConfirm }}
      onOk={() => onConfirm({ reason: computedReason || null })}
      destroyOnHidden
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {mode === "ban" ? (
            <>
              You are about to ban{" "}
              <span className="font-medium">{userLabel}</span>. This will block
              access and disable the account.
            </>
          ) : (
            <>
              You are about to unban{" "}
              <span className="font-medium">{userLabel}</span>. This will
              restore access to the account.
            </>
          )}
        </p>

        {mode === "ban" ? (
          <>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">
                Reason
              </div>

              <Select
                value={selected}
                onChange={(v) => setSelected(v)}
                className="w-full"
                options={DEFAULT_REASONS}
              />
            </div>

            {selected === "other" ? (
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">
                  Custom reason
                </div>
                <TextArea
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Write a short reason (required)…"
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  maxLength={200}
                  showCount
                />
                <div className="text-[11px] text-gray-400 mt-1">
                  Tip: keep it short and clear (e.g. “Repeated spam links in
                  comments”).
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-xs text-gray-500">
            No reason is required to unban.
          </div>
        )}
      </div>
    </Modal>
  );
}

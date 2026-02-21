"use client";

import React, { useMemo, useState } from "react";
import { Copy, Check, X, Eye, EyeClosed } from "lucide-react";
import CopyLine from "../ui/CopyLine";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";

export type AdminRole = "admin" | "superadmin";

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.focus();
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function roleLabel(role: AdminRole) {
  return role === "superadmin" ? "Super Admin" : "Admin";
}

export default function RegisterAdminModal({
  open,
  disableClose,
  title = "Register New Admin",
  subtitle = "Add an administrator for the KalikaScan Admin Panel.",
  isSuperAdmin,
  loading,
  role,
  displayName,
  email,
  password,
  onChangeRole,
  onChangeDisplayName,
  onChangeEmail,
  onChangePassword,
  onClose,
  onSubmit,
}: {
  open: boolean;
  disableClose: boolean;

  title?: string;
  subtitle?: string;

  isSuperAdmin: boolean;
  loading: boolean;

  role: AdminRole;
  displayName: string;
  email: string;
  password: string;

  onChangeRole: (role: AdminRole) => void;
  onChangeDisplayName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangePassword: (v: string) => void;

  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const [isEyeOpen, setIsEyeOpen] = useState(false);

  const copyBlock = useMemo(() => {
    return [
      `email: ${email || "(empty)"}`,
      `password: ${password || "(empty)"}`,
    ].join("\n");
  }, [email, password]);

  const [copiedAll, setCopiedAll] = useState(false);

  async function onCopyAll() {
    await copyToClipboard(copyBlock);
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1200);
  }

  if (!open) return null;

  const locked = loading || disableClose;

  const roleItems: MenuProps["items"] = [
    { key: "admin", label: "Admin" },
    { key: "superadmin", label: "Super Admin" },
  ];

  const onRoleClick: MenuProps["onClick"] = ({ key }) => {
    onChangeRole(key as AdminRole);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close modal"
        onClick={() => {
          if (!locked) onClose();
        }}
      />

      {/* Panel */}
      <div className="relative w-[560px] max-w-[95vw] rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-app-headerText truncate">
              {title}
            </div>
            <div className="text-xs text-app-text">{subtitle}</div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!locked) onClose();
            }}
            disabled={locked}
            className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Copy credentials */}
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-app-headerText">
                    Copy credentials
                  </div>
                  <div className="text-xs text-app-text">
                    Copy email and temporary password.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onCopyAll}
                  disabled={(!email && !password) || !email || !password}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs hover:bg-gray-50 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Copy email + password"
                >
                  {copiedAll ? (
                    <span className="inline-flex items-center gap-2">
                      <Check className="h-4 w-4" /> Copied
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Copy className="h-4 w-4" /> Copy all
                    </span>
                  )}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <CopyLine
                  label="email"
                  displayValue={email}
                  copyValue={email}
                />
                <CopyLine
                  label="password"
                  displayValue={password}
                  copyValue={password}
                  mask
                />
              </div>
            </div>

            {/* Role (AntD Dropdown) */}
            {isSuperAdmin && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-app-headerText">
                  Role
                </label>

                <Dropdown
                  menu={{ items: roleItems, onClick: onRoleClick }}
                  trigger={["click"]}
                  placement="bottomLeft"
                >
                  <button
                    type="button"
                    disabled={locked}
                    className="w-full rounded-lg border border-app-inputBorder px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-button focus:border-app-button transition bg-white cursor-pointer inline-flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-gray-900">{roleLabel(role)}</span>
                    <DownOutlined className="text-[10px] text-gray-500" />
                  </button>
                </Dropdown>

                <p className="text-[11px] text-app-text">
                  Only Super Admins can assign roles.
                </p>
              </div>
            )}

            {/* Display Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-headerText">
                Display Name
              </label>
              <input
                className="w-full rounded-lg border border-app-inputBorder px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-button focus:border-app-button transition"
                placeholder="Juan Dela Cruz"
                value={displayName}
                onChange={(e) => onChangeDisplayName(e.target.value)}
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-app-headerText">
                Admin Email
              </label>
              <input
                className="w-full rounded-lg border border-app-inputBorder px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-button focus:border-app-button transition"
                placeholder="admin@email.com"
                value={email}
                onChange={(e) => onChangeEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="space-y-1 relative">
              <label className="text-sm font-medium text-app-headerText">
                Temporary Password
              </label>
              <input
                type={isEyeOpen ? "text" : "password"}
                className="pr-16 w-full rounded-lg border border-app-inputBorder px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-button focus:border-app-button transition"
                placeholder="••••••••"
                value={password}
                onChange={(e) => onChangePassword(e.target.value)}
                autoComplete="new-password"
              />
              {isEyeOpen ? (
                <EyeClosed
                  className="absolute top-8 right-5 cursor-pointer"
                  onClick={() => setIsEyeOpen(!isEyeOpen)}
                />
              ) : (
                <Eye
                  className="absolute top-8 right-5 cursor-pointer"
                  onClick={() => setIsEyeOpen(!isEyeOpen)}
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!locked) onClose();
                }}
                disabled={locked}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                disabled={loading}
                type="submit"
                className="rounded-lg bg-app-button text-white px-4 py-2 text-sm font-medium hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Registering..." : "Register Admin"}
              </button>
            </div>

            <div className="pt-3 border-t border-gray-100 text-xs text-app-text">
              <strong>Tip:</strong> This password is temporary. Ask the new
              admin to use{" "}
              <span className="font-medium">“Forgot password?”</span> on the
              login page to set their own secure password.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

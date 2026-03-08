"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/src/lib/firebase/client";
import {
  LayoutDashboard,
  MapPinned,
  Stethoscope,
  Users,
  LogOut,
  ShieldUser,
  Sprout,
  SquareUser,
} from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/src/store/hooks";
import { fetchAdminNotifSummary } from "@/src/store/slices/adminNotifSlice";
import LogoSlider from "./ui/LogoSlider";

type NotifKey =
  | "plant_scans"
  | "map_posts"
  | "health_assessments"
  | "expert_applications";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  notifKey?: NotifKey;
  match?: "exact" | "prefix";
};

const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    match: "exact",
  },
  {
    label: "Plant Scans Report",
    href: "/admin/plant-scans-report",
    icon: Sprout,
    notifKey: "plant_scans",
    match: "prefix",
  },
  {
    label: "Map Posts Report",
    href: "/admin/map-posts",
    icon: MapPinned,
    notifKey: "map_posts",
    match: "prefix",
  },
  {
    label: "Health Assessments Report",
    href: "/admin/health-assessments-report",
    icon: Stethoscope,
    notifKey: "health_assessments",
    match: "prefix",
  },
  {
    label: "KalikaScan Users",
    href: "/admin/kalikascan-users",
    icon: Users,
    notifKey: "expert_applications",
    match: "prefix",
  },
  {
    label: "Register New Admin",
    href: "/admin/create-admin",
    icon: ShieldUser,
    match: "prefix",
  },
  {
    label: "Profile",
    href: "/admin/profile",
    icon: SquareUser,
    match: "prefix",
  },
];

function normalizePath(p: string) {
  if (!p) return "";
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  const text = count > 99 ? "99+" : String(count);

  return (
    <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
      {text}
    </span>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const dispatch = useAppDispatch();
  const counts = useAppSelector((s) => s.adminNotif.counts);

  async function onLogout() {
    await auth.signOut();
    window.location.href = "/";
  }

  useEffect(() => {
    dispatch(fetchAdminNotifSummary());
    const id = setInterval(() => dispatch(fetchAdminNotifSummary()), 15000);
    return () => clearInterval(id);
  }, [dispatch]);

  const current = normalizePath(pathname);

  function isActive(item: NavItem) {
    const href = normalizePath(item.href);
    if (item.match === "exact") return current === href;
    return current === href || current.startsWith(href + "/");
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Brand */}
      <div className="border-b border-black/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <LogoSlider
            size={40}
            intervalMs={2200}
            logos={[
              { src: "/logo.png", alt: "KalikaScan" },
              { src: "/cas-logo.png", alt: "cas" },
              { src: "/coed-logo.png", alt: "coed" },
              { src: "/esrdc-logo.png", alt: "esrdc" },
              { src: "/ssu-logo.png", alt: "ssu" },
            ]}
          />

          <div className="leading-tight">
            <div className="text-sm font-bold text-app-headerText">
              KalikaScan
            </div>
            <div className="text-xs text-app-text">Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-[11px] font-semibold text-black/40">
          MENU
        </div>

        <ul className="space-y-1">
          {NAV.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            const count = item.notifKey ? (counts[item.notifKey] ?? 0) : 0;

            return (
              <li key={item.href}>
                <button
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={[
                    "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    active
                      ? "bg-app-button/10 font-medium text-app-button"
                      : "text-app-text hover:bg-black/5 hover:text-app-button",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-5 w-5 transition-colors",
                      active
                        ? "text-app-button"
                        : "text-app-text group-hover:text-app-button",
                    ].join(" ")}
                  />

                  <span>{item.label}</span>

                  <CountBadge count={count} />

                  <span
                    className={[
                      "pointer-events-none absolute left-3 right-3 -bottom-1 h-[2px] rounded-full bg-app-button",
                      "origin-left transform transition-transform duration-300 ease-out",
                      active
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100",
                    ].join(" ")}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-black/10 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-around gap-3 rounded-xl bg-app-button px-3 py-2.5 text-sm text-white transition-colors hover:bg-app-buttonHover"
        >
          <span className="font-medium">Logout</span>
          <LogOut className="h-5 w-5" />
        </button>

        <div className="px-3 pt-3 text-[11px] text-black/35">
          © {new Date().getFullYear()} KalikaScan
        </div>
      </div>
    </div>
  );
}

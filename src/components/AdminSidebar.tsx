// src/components/AdminSidebar.tsx
"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },

  {
    label: "Plant Scans Report",
    href: "/admin/plant-scans-report",
    icon: Sprout,
    notifKey: "plant_scans",
  },
  {
    label: "Map Posts Report",
    href: "/admin/map-posts",
    icon: MapPinned,
    notifKey: "map_posts",
  },
  {
    label: "Health Assessments Report",
    href: "/admin/health-assessments-report",
    icon: Stethoscope,
    notifKey: "health_assessments",
  },

  //  Expert applications is inside KalikaScan Users page
  {
    label: "KalikaScan Users",
    href: "/admin/kalikascan-users",
    icon: Users,
    notifKey: "expert_applications",
  },

  {
    label: "Register New Admin",
    href: "/admin/create-admin",
    icon: ShieldUser,
  },
  { label: "Profile", href: "/admin/profile", icon: SquareUser },
];

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
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const counts = useAppSelector((s) => s.adminNotif.counts);

  async function onLogout() {
    await auth.signOut();
    window.location.href = "/";
  }

  //  Poll every 15 seconds
  useEffect(() => {
    dispatch(fetchAdminNotifSummary());
    const id = setInterval(() => dispatch(fetchAdminNotifSummary()), 15000);
    return () => clearInterval(id);
  }, [dispatch]);

  return (
    <aside className="sticky top-0 h-screen w-72 shrink-0 border-r border-black/10 bg-white">
      <div className="h-full flex flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-black/10">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image
                src="/logo.png"
                alt="KalikaScan"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-app-headerText">
                KalikaScan
              </div>
              <div className="text-xs text-app-text">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 flex-1 overflow-y-auto">
          <div className="text-[11px] font-semibold text-black/40 px-3 mb-2">
            MENU
          </div>

          <ul className="space-y-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname?.startsWith(item.href));

              const Icon = item.icon;

              const count = item.notifKey ? (counts[item.notifKey] ?? 0) : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      "group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "text-app-button font-medium"
                        : "text-app-text hover:text-app-button",
                    ].join(" ")}
                  >
                    {/* Icon */}
                    <Icon
                      className={[
                        "w-5 h-5 transition-colors",
                        active
                          ? "text-app-button"
                          : "text-app-text group-hover:text-app-button",
                      ].join(" ")}
                    />

                    {/* Label */}
                    <span>{item.label}</span>

                    {/*  Notification badge (keeps your design) */}
                    <CountBadge count={count} />

                    {/* Animated underline (hover + active) */}
                    <span
                      className={[
                        "pointer-events-none absolute left-3 right-3 -bottom-1 h-[2px] rounded-full bg-app-button",
                        "origin-left transform transition-transform duration-300 ease-out",
                        active
                          ? "scale-x-100"
                          : "scale-x-0 group-hover:scale-x-100",
                      ].join(" ")}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer / Logout */}
        <div className="p-3 border-t border-black/10">
          <button
            onClick={onLogout}
            className="w-full justify-around bg-app-button flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white hover:bg-app-buttonHover transition-colors"
          >
            <span className="font-medium">Logout</span>
            <LogOut className="w-5 h-5" />
          </button>

          <div className="px-3 pt-3 text-[11px] text-black/35">
            © {new Date().getFullYear()} KalikaScan
          </div>
        </div>
      </div>
    </aside>
  );
}

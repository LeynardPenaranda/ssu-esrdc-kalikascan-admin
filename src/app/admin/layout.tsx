"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import AdminGuard from "@/src/components/AdminGuard";
import AdminSidebar from "@/src/components/AdminSidebar";
import { Drawer, Button } from "antd";
import { MenuOutlined } from "@ant-design/icons";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerWidth = useMemo(() => 280, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <AdminGuard>
      <div className="h-screen bg-app-bg @container">
        <div className="flex h-full">
          {/* Desktop Sidebar */}
          <aside className="hidden h-full w-[280px] shrink-0 lg:block">
            <AdminSidebar />
          </aside>

          {/* Mobile/Tablet Drawer Sidebar */}
          <Drawer
            title="KalikaScan Admin"
            placement="left"
            open={open}
            onClose={() => setOpen(false)}
            size={drawerWidth}
            destroyOnHidden
            styles={{
              body: {
                padding: 0,
              },
            }}
          >
            <div className="h-full">
              <AdminSidebar />
            </div>
          </Drawer>

          {/* Main area */}
          <div className="flex h-full min-w-0 flex-1 flex-col">
            {/* Topbar only on mobile/tablet */}
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-app-bg/90 px-3 py-3 backdrop-blur lg:hidden">
              <Button
                type="primary"
                style={{
                  backgroundColor: "#16a34a",
                  borderColor: "#16a34a",
                }}
                icon={<MenuOutlined />}
                onClick={() => setOpen(true)}
              />
              <div className="font-semibold">KalikaScan Admin</div>
            </header>

            <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}

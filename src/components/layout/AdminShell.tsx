import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SidebarDrawerContext } from "@/components/layout/sidebar-drawer-context";

/* Route element for /admin — renders the grouped sidebar + header chrome
   around whatever child route matched, via <Outlet/>. Below lg breakpoint
   the sidebar becomes a drawer (see .admin-sidebar in index.css), toggled
   here and consumed by AdminHeader's menu button + AdminSidebar's close
   button through useSidebarDrawer(). */
export function AdminShell() {
  const [open, setOpen] = useState(false);

  return (
    <SidebarDrawerContext.Provider value={{ open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }}>
      <div className="admin-shell">
        <AdminSidebar />
        {open && (
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 30 }}
            aria-hidden="true"
          />
        )}
        <div className="admin-main">
          <AdminHeader />
          <div style={{ padding: "24px 24px 40px" }}>
            <Outlet />
          </div>
        </div>
      </div>
    </SidebarDrawerContext.Provider>
  );
}

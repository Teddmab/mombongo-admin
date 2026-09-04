import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SidebarDrawerContext } from "@/components/layout/sidebar-drawer-context";

/* Pages redesigned since ADM-UI-02 render their own title/description block
   (a real .page-header, with breadcrumb-aware content AdminHeader's static
   LABELS map can't express — e.g. a specific transaction's reference).
   Rendering AdminHeader on top of those doubles up the title bar, so those
   routes suppress it here instead of every such page needing to know about
   AdminHeader itself. Older, not-yet-redesigned pages still rely on
   AdminHeader for their only title bar — this list must only grow as pages
   get their own header, never regress a page to no title at all. */
const OWN_HEADER_PREFIXES = [
  "/admin/investors", "/admin/farmers", "/admin/agents", "/admin/merchants",
  "/admin/partner-invoices", "/admin/partners", "/admin/transactions",
  "/admin/kyc", "/admin/roles", "/admin/settings", "/admin/reports",
  "/admin/alerts", "/admin/agronomie", "/admin/opportunities",
  "/admin/harvest-offers", "/admin/qa/harvest-offers",
];

/* Route element for /admin — renders the grouped sidebar + header chrome
   around whatever child route matched, via <Outlet/>. Below lg breakpoint
   the sidebar becomes a drawer (see .admin-sidebar in index.css), toggled
   here and consumed by AdminHeader's menu button + AdminSidebar's close
   button through useSidebarDrawer(). */
export function AdminShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const hasOwnHeader = OWN_HEADER_PREFIXES.some((p) => location.pathname.startsWith(p));

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
          {hasOwnHeader ? (
            // The page supplies its own title bar, but still needs a way to open
            // the sidebar drawer below the 1024px breakpoint — AdminHeader would
            // normally carry that button. `.sidebar-menu-btn` already renders
            // invisible (display:none) above that breakpoint on its own, so this
            // costs nothing at desktop widths.
            <button type="button" className="sidebar-menu-btn admin-main-menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Ouvrir le menu">
              <Menu size={20} />
            </button>
          ) : (
            <AdminHeader />
          )}
          <div style={{ padding: "24px 24px 40px" }}>
            <Outlet />
          </div>
        </div>
      </div>
    </SidebarDrawerContext.Provider>
  );
}

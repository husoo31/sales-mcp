"use client";

import { usePathname } from "next/navigation";
import { 
  MessageSquare, Users, Settings, LogOut, LayoutDashboard, 
  Calendar, Check, X, Menu 
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import SettingsModal from "@/components/SettingsModal";
import Link from "next/link";
import { BASE_URL } from "@/lib/api";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/approvals", label: "Onay Bekleyenler", icon: MessageSquare },
  { href: "/leads", label: "Müşteriler", icon: Users },
  { href: "/follow-ups", label: "Takipler", icon: Calendar },
];

export default function Header() {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<"connected" | "disconnected">("disconnected");
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkStatus = () => {
      fetch(`${BASE_URL}/mcp/status`)
        .then(res => res.ok ? res.json() : { status: "disconnected" })
        .then(data => setMcpStatus(data.status === "connected" ? "connected" : "disconnected"))
        .catch(() => setMcpStatus("disconnected"));
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileOpen]);

  // Close drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <>
      <header className="border-b border-dark-border bg-dark-panel px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md w-full overflow-x-hidden">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
            S
          </div>
          <h1 className="text-base font-bold text-white tracking-wide whitespace-nowrap">
            Sales-MCP Kontrol Merkezi
          </h1>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex space-x-1 bg-dark-bg p-1 rounded-lg border border-dark-border">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
                pathname === href
                  ? "bg-dark-border text-white"
                  : "text-dark-text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop Right Controls */}
        <div className="hidden md:flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-3 mr-2 text-xs font-medium border-r border-dark-border pr-4">
            <div className="flex items-center gap-1.5 text-dark-text-muted">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Her şey yolunda
            </div>
            <div className="flex items-center gap-1.5 text-dark-text-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sistemler aktif
            </div>
            <div className={`flex items-center gap-1.5 ${mcpStatus === "connected" ? "text-emerald-400" : "text-warning"}`}>
              <span className={`w-2 h-2 rounded-full ${mcpStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-warning animate-pulse"}`} />
              {mcpStatus === "connected" ? "MCP Bağlı" : "MCP Beklemede"}
              {mcpStatus === "connected" ? <Check size={12} /> : <X size={12} />}
            </div>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-dark-text-muted hover:text-white hover:bg-dark-border rounded-md transition-colors"
          >
            <Settings size={16} />
            <span className="hidden lg:inline">Ayarlar</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10 rounded-md transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden lg:inline">Çıkış</span>
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-md bg-dark-bg border border-dark-border text-dark-text-muted hover:text-white transition-colors"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Menü"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" aria-hidden="true" />
      )}

      {/* Mobile Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-72 bg-dark-panel border-l border-dark-border z-50 flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-xs">S</div>
            <span className="text-sm font-bold text-white">Sales-MCP</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-dark-text-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? "bg-brand-500/10 text-brand-400 border border-brand-500/20"
                  : "text-dark-text-muted hover:text-white hover:bg-dark-border"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Status Indicators */}
        <div className="p-4 border-t border-dark-border space-y-2">
          <div className="flex items-center gap-2 text-xs text-dark-text-muted">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            Her şey yolunda
          </div>
          <div className="flex items-center gap-2 text-xs text-dark-text-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Sistemler aktif
          </div>
          <div className={`flex items-center gap-2 text-xs ${mcpStatus === "connected" ? "text-emerald-400" : "text-warning"}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${mcpStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-warning animate-pulse"}`} />
            {mcpStatus === "connected" ? "MCP Bağlı" : "MCP Beklemede"}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-dark-border space-y-2">
          <button
            onClick={() => { setShowSettings(true); setMobileOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-dark-text-muted hover:text-white hover:bg-dark-border transition-colors"
          >
            <Settings size={18} />
            Ayarlar
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut size={18} />
            Çıkış Yap
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

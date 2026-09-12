"use client";

import { useState, useEffect } from "react";
import { 
  CheckCircle, Play, Building2, MessageSquareCheck,
  TrendingUp, Users, Target, Activity, Search,
  Terminal, X, ChevronRight, XCircle, MapPin, Phone
} from "lucide-react";
import { BASE_URL, updateLeadStatus } from "@/lib/api";
import Link from "next/link";

interface DashboardStats {
  totalLeads: number;
  pendingApprovals: number;
  sentMessages: number;
  followUps: number;
  conversionRate: number;
}

interface RecentLead {
  id: string;
  clinicName: string;
  district: string | null;
  problem: string;
  status: string;
  updatedAt: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrapeDistrict, setScrapeDistrict] = useState("");
  const [scrapeCount, setScrapeCount] = useState(5);
  const [isScraping, setIsScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Live Audit Modal States
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [auditProgress, setAuditProgress] = useState(0);
  const [auditDone, setAuditDone] = useState(false);

  // Detail Modal State
  const [selectedLead, setSelectedLead] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, leadsRes] = await Promise.all([
        fetch(`${BASE_URL}/dashboard/stats`),
        fetch(`${BASE_URL}/dashboard/recent-leads`)
      ]);
      const statsData = await statsRes.json();
      const leadsData = await leadsRes.json();
      setStats(statsData);
      setRecentLeads(leadsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartScrape = async () => {
    if (!scrapeDistrict) return;
    setIsScraping(true);
    setShowAuditModal(true);
    setAuditLogs([]);
    setAuditProgress(0);
    setAuditDone(false);

    try {
      const eventSource = new EventSource(`${BASE_URL}/worker/scan-stream?district=${encodeURIComponent(scrapeDistrict)}&count=${scrapeCount}`);
      
      eventSource.addEventListener("log", (event) => {
        const data = JSON.parse(event.data);
        setAuditLogs(prev => [...prev, data.message]);
        setAuditProgress(prev => Math.min(prev + (100 / (scrapeCount * 2)), 99));
      });

      eventSource.addEventListener("done", (event) => {
        const data = JSON.parse(event.data);
        setAuditProgress(100);
        setAuditDone(true);
        setIsScraping(false);
        fetchDashboardData();
        eventSource.close();
      });

      eventSource.onerror = (error) => {
        console.error("SSE Error:", error);
        setAuditLogs(prev => [...prev, "[!] Bağlantı hatası oluştu, işlem koptu."]);
        eventSource.close();
        setIsScraping(false);
        setAuditDone(true);
      };
    } catch (e) {
      console.error(e);
      setAuditLogs(["[!] Kritik başlatma hatası."]);
      setIsScraping(false);
      setAuditDone(true);
    }
  };

  const filteredLeads = recentLeads.filter(lead => {
    const matchesSearch = lead.clinicName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "WAITING_APPROVAL":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">Onay Bekliyor</span>;
      case "APPROVED_MANUAL_SEND_PENDING":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">Gönderim Kuyruğunda</span>;
      case "APPROVED":
      case "SENT":
      case "WON":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Anlaşıldı / Onaylandı</span>;
      case "REJECTED":
      case "CANCELLED":
      case "LOST":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-danger-bg/10 text-danger border-danger/20">İptal Edildi</span>;
      case "FOLLOW_UP":
      case "WAITING_FOLLOWUP":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-purple-500/10 text-purple-400 border-purple-500/20">Takipte</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border bg-dark-border text-dark-text border-dark-border">{status}</span>;
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateLeadStatus(leadId, newStatus);
      setRecentLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    } catch (err) {
      console.error('Statü güncelleme hatası:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="text-brand-400" />
          Komuta Merkezi
        </h2>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-dark-panel p-5 rounded-xl border border-dark-border shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-brand-500/10 rounded-lg">
              <Building2 className="text-brand-400" size={24} />
            </div>
          </div>
          <p className="text-sm text-dark-text-muted font-medium">Toplam Bulunan İşletme</p>
          <h3 className="text-3xl font-bold text-white mt-1">{loading ? "-" : stats?.totalLeads}</h3>
        </div>
        
        <div className="bg-dark-panel p-5 rounded-xl border border-dark-border shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <CheckCircle className="text-amber-400" size={24} />
            </div>
          </div>
          <p className="text-sm text-dark-text-muted font-medium">Onay Bekleyen Taslaklar</p>
          <h3 className="text-3xl font-bold text-white mt-1">{loading ? "-" : stats?.pendingApprovals}</h3>
        </div>

        <div className="bg-dark-panel p-5 rounded-xl border border-dark-border shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <MessageSquareCheck className="text-emerald-400" size={24} />
            </div>
          </div>
          <p className="text-sm text-dark-text-muted font-medium">Mesaj Gönderilenler</p>
          <h3 className="text-3xl font-bold text-white mt-1">{loading ? "-" : stats?.sentMessages}</h3>
        </div>

        <div className="bg-dark-panel p-5 rounded-xl border border-dark-border shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="text-blue-400" size={24} />
            </div>
          </div>
          <p className="text-sm text-dark-text-muted font-medium">Dönüş / Takiptekiler</p>
          <h3 className="text-3xl font-bold text-white mt-1">{loading ? "-" : stats?.followUps}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ACTION PANEL */}
        <div className="lg:col-span-1 bg-dark-panel rounded-xl border border-dark-border p-6 shadow-lg flex flex-col">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
            <Target className="text-brand-400" size={20} />
            Canlı Tarama Başlat
          </h3>
          
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-xs font-medium text-dark-text-muted mb-1.5 uppercase tracking-wider">İlçe / Bölge</label>
              <input
                type="text"
                placeholder="Örn: Ataşehir, Kadıköy"
                value={scrapeDistrict}
                onChange={e => setScrapeDistrict(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border text-white rounded-lg px-4 py-2.5 focus:border-brand-500 focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-dark-text-muted mb-1.5 uppercase tracking-wider">Hedef Sayısı</label>
              <select
                value={scrapeCount}
                onChange={e => setScrapeCount(Number(e.target.value))}
                className="w-full bg-dark-bg border border-dark-border text-white rounded-lg px-4 py-2.5 focus:border-brand-500 focus:outline-none transition-colors appearance-none"
              >
                <option value={5}>5 Klinik (Hızlı)</option>
                <option value={10}>10 Klinik (Normal)</option>
                <option value={20}>20 Klinik (Kapsamlı)</option>
              </select>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-dark-border">
            <button
              onClick={handleStartScrape}
              disabled={isScraping || !scrapeDistrict}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-500/20"
            >
              {isScraping ? (
                <>
                  <Activity className="animate-pulse" size={20} />
                  Otonom Tarama Devam Ediyor...
                </>
              ) : (
                <>
                  <Play size={20} />
                  Otonom Taramayı Başlat
                </>
              )}
            </button>
          </div>
        </div>

        {/* RECENT LEADS TABLE */}
        <div className="lg:col-span-2 bg-dark-panel rounded-xl border border-dark-border shadow-lg flex flex-col">
          <div className="p-4 border-b border-dark-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-lg font-semibold text-white">Son İşlemler & Canlı Akış</h3>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-muted" size={16} />
                <input 
                  type="text" 
                  placeholder="Klinik ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none appearance-none"
              >
                <option value="ALL">Tümü</option>
                <option value="WAITING_APPROVAL">Bekleyenler</option>
                <option value="SENT">Gönderilenler</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto p-4">
            <div className="space-y-2">
              {loading ? (
                <div className="py-8 text-center text-dark-text-muted">Yükleniyor...</div>
              ) : filteredLeads.length === 0 ? (
                <div className="py-8 text-center text-dark-text-muted">Kayıt bulunamadı.</div>
              ) : (
                filteredLeads.map(lead => (
                  <div key={lead.id} className="bg-dark-bg/50 border border-dark-border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-brand-500/50 transition-colors">
                    <div>
                      <h4 className="font-semibold text-white">{lead.clinicName}</h4>
                      <p className="text-sm text-dark-text-muted flex items-center gap-2 mt-1">
                        <span>{lead.district || "Bölge Belirtilmemiş"}</span>
                        <span className="w-1 h-1 bg-dark-border rounded-full"></span>
                        <span className="truncate max-w-[200px] sm:max-w-xs">{lead.problem}</span>
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      {getStatusBadge(lead.status)}
                      <span className="text-xs text-dark-text-muted whitespace-nowrap hidden sm:inline-block">
                        {new Date(lead.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedLead(lead)} 
                          className="text-xs bg-dark-bg border border-dark-border hover:border-brand-500 text-white px-3 py-1.5 rounded transition-colors"
                        >
                          Detay
                        </button>
                        <button onClick={() => handleStatusChange(lead.id, 'WON')} className="text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1.5 rounded border border-emerald-500/30 transition-colors flex items-center gap-1">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => handleStatusChange(lead.id, 'LOST')} className="text-danger hover:text-red-400 bg-danger-bg/20 hover:bg-danger-bg/40 px-2 py-1.5 rounded border border-danger/30 transition-colors flex items-center gap-1">
                          <XCircle size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PERFORMANCE BAR */}
      <div className="bg-dark-panel p-6 rounded-xl border border-dark-border shadow-lg">
        <div className="flex justify-between items-end mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="text-emerald-400" size={20} />
              Dönüşüm & Performans
            </h3>
            <p className="text-sm text-dark-text-muted mt-1">Gönderilen mesajların yanıta dönüşme oranı</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-white">{loading ? "-" : stats?.conversionRate}%</span>
            <span className="text-sm text-emerald-400 font-medium ml-2">Başarı</span>
          </div>
        </div>
        <div className="w-full bg-dark-bg rounded-full h-3 border border-dark-border overflow-hidden">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-3 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${stats?.conversionRate || 0}%` }}
          ></div>
        </div>
      </div>

      {/* LIVE AUDIT MODAL */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-panel border border-dark-border shadow-2xl rounded-xl w-full max-w-3xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-bg/50">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Terminal className="text-brand-400" size={20} />
                Canlı Tarama & Denetim Konsolu
              </h3>
              {auditDone && (
                <button onClick={() => setShowAuditModal(false)} className="text-dark-text-muted hover:text-white transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>
            
            <div className="p-6 flex-1 flex flex-col gap-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-dark-text-muted font-medium">İlerleme Durumu</span>
                  <span className="text-brand-400 font-bold">{Math.round(auditProgress)}%</span>
                </div>
                <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden border border-dark-border">
                  <div 
                    className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${auditProgress}%` }}
                  ></div>
                </div>
              </div>

              <div 
                className="bg-black/90 font-mono text-xs text-emerald-400 p-4 rounded h-64 overflow-y-auto border border-dark-border/50 shadow-inner flex flex-col gap-1.5"
                ref={(el) => {
                  if (el) el.scrollTop = el.scrollHeight;
                }}
              >
                {auditLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 break-all">
                    <ChevronRight size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                    <span>{log}</span>
                  </div>
                ))}
                {!auditDone && (
                  <div className="flex gap-2 items-center text-emerald-600/50 mt-2">
                    <span className="animate-pulse">_</span>
                  </div>
                )}
              </div>

              {auditDone && (
                <div className="pt-2">
                  <Link 
                    href="/approvals"
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    Kapat ve Onay Bekleyenlere Git
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LEAD DETAIL MODAL */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLead(null)}>
          <div className="bg-dark-panel border border-dark-border rounded-xl shadow-2xl max-w-lg w-full p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedLead(null)} className="absolute top-4 right-4 text-dark-text-muted hover:text-white transition-colors">
              <XCircle size={24} />
            </button>
            <h3 className="text-2xl font-bold text-white mb-1">{selectedLead.clinicName}</h3>
            <div className="text-dark-text-muted mb-6 flex items-center gap-2">
              <MapPin size={16} /> {selectedLead.district || "Bölge bilgisi yok"}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-dark-bg p-3 rounded-lg border border-dark-border hover:border-brand-500/50 transition-colors">
                <Phone className="text-brand-500" size={20} />
                <a href={`tel:${selectedLead.phone}`} className="text-white hover:text-brand-400">{selectedLead.phone || "Telefon Yok"}</a>
              </div>
              <div className="flex items-center gap-3 bg-dark-bg p-3 rounded-lg border border-dark-border hover:border-brand-500/50 transition-colors">
                <Search className="text-brand-500" size={20} />
                <a href={selectedLead.website || "#"} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline break-all">{selectedLead.website || "Web sitesi yok"}</a>
              </div>
              {selectedLead.problem && (
                <div className="mt-4 p-4 rounded-lg bg-warning-bg border border-warning/30">
                  <h4 className="text-warning font-semibold text-sm mb-2 uppercase tracking-wide">Tespit Edilen Problem</h4>
                  <p className="text-white/90 text-sm leading-relaxed">{selectedLead.problem}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { 
  CheckCircle, XCircle, Edit3, MessageSquare, 
  Users, Calendar, Search, MapPin, Phone, Check, RefreshCw, LogOut, Settings
} from "lucide-react";
import SettingsModal from "@/components/SettingsModal";
import {
  Lead, MessageDraft, FollowUp,
  getLeads, getApprovals, approveMessage, rejectMessage, updateDraft, getFollowups, updateLeadStatus
} from "@/lib/api";
export default function ApprovalsPage() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="w-full font-sans">
      {/* MAIN CONTENT */}
      <main className="max-w-7xl w-full mx-auto">
        <ApprovalsTab showToast={showToast} />
      </main>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 transform transition-all z-50 ${
          toast.type === "success" 
            ? "bg-success-bg border-success/30 text-success" 
            : "bg-danger-bg border-danger/30 text-danger"
        }`}>
          {toast.type === "success" ? <CheckCircle size={20} /> : <XCircle size={20} />}
          <p className="font-medium">{toast.message}</p>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------
// APPROVALS TAB
// -----------------------------------------------------
function ApprovalsTab({ showToast }: { showToast: (msg: string, type?: "success"|"error") => void }) {
  const [drafts, setDrafts] = useState<MessageDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [animatingIds, setAnimatingIds] = useState<Record<string, 'approving' | 'rejecting'>>({});
  const [prevCount, setPrevCount] = useState(0);
  const [counterAnim, setCounterAnim] = useState(false);

  useEffect(() => {
    if (drafts.length !== prevCount) {
      setCounterAnim(true);
      const timer = setTimeout(() => setCounterAnim(false), 300);
      setPrevCount(drafts.length);
      return () => clearTimeout(timer);
    }
  }, [drafts.length, prevCount]);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const data = await getApprovals();
      setDrafts(data);
    } catch (err) {
      console.error(err);
      showToast("Taslaklar alınamadı", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (id: string) => {
    setAnimatingIds(prev => ({ ...prev, [id]: 'approving' }));
    await new Promise(resolve => setTimeout(resolve, 400));
    try {
      await approveMessage(id);
      setDrafts(prev => prev.filter(d => d.id !== id));
      setAnimatingIds(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      showToast("Mesaj başarıyla onaylandı!");
    } catch (err) {
      setAnimatingIds(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      showToast("Onaylama başarısız oldu", "error");
    }
  };

  const handleReject = async (id: string) => {
    setAnimatingIds(prev => ({ ...prev, [id]: 'rejecting' }));
    await new Promise(resolve => setTimeout(resolve, 400));
    try {
      await rejectMessage(id);
      setDrafts(prev => prev.filter(d => d.id !== id));
      setAnimatingIds(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      showToast("Mesaj reddedildi", "error");
    } catch (err) {
      setAnimatingIds(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      showToast("Reddetme başarısız", "error");
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDraft(id, editContent);
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, content: editContent } : d));
      setEditingId(null);
      showToast("Taslak güncellendi");
    } catch (err) {
      showToast("Taslak güncellenemedi", "error");
    }
  };

  if (loading) return <div className="text-center py-12 text-dark-text-muted flex flex-col items-center gap-3"><RefreshCw className="animate-spin" /> Yükleniyor...</div>;

  if (drafts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-dark-border rounded-xl bg-dark-panel/30">
      <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center text-success mb-4">
        <Check size={32} />
      </div>
      <h3 className="text-xl font-semibold text-white">Harika! Bekleyen onay yok.</h3>
      <p className="text-dark-text-muted mt-2">Tüm AI mesaj taslakları incelenmiş.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          Onay Bekleyen Mesajlar 
          <span className={`inline-block transition-all duration-300 ${counterAnim ? 'scale-125 text-brand-400 opacity-80' : 'scale-100 text-dark-text-muted opacity-100'}`}>
            ({drafts.length})
          </span>
        </h2>
        <button onClick={fetchDrafts} className="p-2 hover:bg-dark-border rounded-lg text-dark-text-muted hover:text-white transition-colors">
          <RefreshCw size={20} />
        </button>
      </div>
      <div className="grid gap-6">
        {drafts.map((draft) => {
          console.log("DRAFT GELEN VERİ:", draft);
          const isApproving = animatingIds[draft.id] === 'approving';
          const isRejecting = animatingIds[draft.id] === 'rejecting';
          return (
          <div 
            key={draft.id} 
            className="bg-dark-panel border border-dark-border rounded-xl p-5 flex flex-col md:flex-row gap-6 hover:border-dark-text-muted/30 shadow-lg"
            style={{
              transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
              ...(isApproving && {
                transform: 'translateX(120px)',
                opacity: 0,
                filter: 'blur(2px)',
                pointerEvents: 'none'
              }),
              ...(isRejecting && {
                transform: 'translateX(-120px)',
                opacity: 0,
                filter: 'blur(2px)',
                pointerEvents: 'none'
              })
            }}
          >
            {/* Lead Info */}
            <div className="md:w-1/3 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-dark-border pb-4 md:pb-0 md:pr-6">
              <div>
                <h3 className="text-lg font-semibold text-white">{draft.lead?.clinicName}</h3>
                <div className="flex items-center gap-2 text-sm text-dark-text-muted mt-1">
                  <MapPin size={14} /> {draft.lead?.district || "Bilinmiyor"}
                </div>
                <div className="flex items-center gap-2 text-sm text-dark-text-muted mt-1">
                  <Phone size={14} /> {draft.lead?.phone}
                </div>
              </div>
              
              {draft.lead?.problem && (
                <div className="mt-2 bg-warning-bg border border-warning/20 p-3 rounded-lg">
                  <p className="text-xs text-warning/80 uppercase font-bold mb-1">Tespit Edilen Problem</p>
                  <p className="text-sm text-warning/90">{draft.lead.problem}</p>
                </div>
              )}
              
              <div className="mt-4">
                <div 
                  onClick={() => setLightboxImage(draft.screenshotUrl || null)}
                  className="relative w-36 h-24 rounded-lg overflow-hidden border border-slate-700 hover:border-emerald-500 cursor-pointer group bg-slate-800 flex-shrink-0"
                >
                  {draft.screenshotUrl ? (
                    <>
                      <img 
                        src={draft.screenshotUrl} 
                        alt={draft.lead?.clinicName || "Denetim Kanıtı"} 
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          console.error("Görsel yüklenemedi:", draft.screenshotUrl);
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[11px] font-semibold text-white bg-emerald-600 px-2 py-0.5 rounded shadow">
                          Büyüt
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-red-950 text-red-300 text-[10px] p-2 text-center">
                      Görsel URL Veritabanında Boş!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Message Draft */}
            <div className="md:w-2/3 flex flex-col justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">AI Taslak Mesajı</span>
                  {editingId !== draft.id && (
                    <button 
                      onClick={() => { setEditingId(draft.id); setEditContent(draft.content); }}
                      className="text-dark-text-muted hover:text-white flex items-center gap-1 text-sm"
                    >
                      <Edit3 size={14} /> Düzenle
                    </button>
                  )}
                </div>
                
                {editingId === draft.id ? (
                  <div className="flex flex-col gap-3">
                    <textarea 
                      className="w-full bg-dark-bg border border-brand-500/50 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 min-h-[120px]"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm hover:bg-dark-border rounded-md">İptal</button>
                      <button onClick={() => handleSaveEdit(draft.id)} className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-md font-medium">Kaydet</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <div className="flex-1 bg-dark-bg/50 p-4 rounded-lg border border-dark-border/50 text-sm whitespace-pre-wrap leading-relaxed">
                      {draft.content}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-dark-border/50">
                <button 
                  onClick={() => handleReject(draft.id)}
                  disabled={!!animatingIds[draft.id]}
                  className={`px-4 py-2 flex items-center gap-2 rounded-lg cursor-pointer select-none transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-90 disabled:opacity-50 text-rose-400 hover:text-white hover:bg-rose-600/20 border border-rose-500/30 font-medium hover:border-rose-500 hover:shadow-md hover:shadow-rose-500/20 ${animatingIds[draft.id] === 'rejecting' ? 'animate-pulse' : ''}`}
                >
                  {animatingIds[draft.id] === 'rejecting' ? <RefreshCw className="animate-spin" size={18} /> : <XCircle size={18} />} Reddet
                </button>
                <button 
                  onClick={() => handleApprove(draft.id)}
                  disabled={!!animatingIds[draft.id]}
                  className={`px-6 py-2 flex items-center gap-2 rounded-lg cursor-pointer select-none transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-90 disabled:opacity-50 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-900/30 hover:shadow-lg hover:shadow-emerald-500/40 hover:ring-2 hover:ring-emerald-400/50 ${animatingIds[draft.id] === 'approving' ? 'animate-pulse' : ''}`}
                >
                  {animatingIds[draft.id] === 'approving' ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />} Onayla
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Lightbox for Approvals */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button onClick={() => setLightboxImage(null)} className="absolute -top-12 right-0 text-white hover:text-gray-300">
              <XCircle size={32} />
            </button>
            <img src={lightboxImage} alt="Büyütülmüş Kanıt" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-dark-border" />
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------
// WHATSAPP UTILITIES
// -----------------------------------------------------
const isFixedLine = (phone: string) => {
  if (!phone) return false;
  const clean = phone.replace(/[\s\-().+ ]/g, '');
  return (
    /^0?(212|216|312|232|224|342|262|264|268|272|274|282|288|258|252|242|236|226|222|284|286|228|248|246|244|234|266|276)/.test(clean) ||
    /^0?444/.test(clean) ||
    /^0?850/.test(clean)
  );
};

const getWhatsAppUrl = (phone: string, text: string) => {
  let clean = phone.replace(/[\s\-().+]/g, '');
  if (clean.startsWith('0')) {
    clean = '90' + clean.slice(1);
  } else if (!clean.startsWith('90')) {
    clean = '90' + clean;
  }
  return `https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(text)}`;
};

// -----------------------------------------------------
// LEADS TAB
// -----------------------------------------------------
export function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    getLeads().then(data => {
      setLeads(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const filtered = leads.filter(l => l.clinicName.toLowerCase().includes(search.toLowerCase()) || (l.district && l.district.toLowerCase().includes(search.toLowerCase())));

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
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    } catch (err) {
      console.error('Statü güncelleme hatası:', err);
    }
  };

  return (
    <div className="space-y-6 w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Müşteri Havuzu</h2>
      </div>

      {/* Filters */}
      <div className="bg-dark-panel p-4 rounded-xl border border-dark-border flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Klinik adı veya ilçe ara..." 
            className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-dark-panel border border-dark-border rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-bg border-b border-dark-border text-dark-text-muted">
              <tr>
                <th className="px-6 py-4 font-medium">Klinik Adı</th>
                <th className="px-6 py-4 font-medium">İlçe</th>
                <th className="px-6 py-4 font-medium">Telefon</th>
                <th className="px-6 py-4 font-medium">Statü</th>
                <th className="px-6 py-4 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-dark-text-muted">Yükleniyor...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-dark-text-muted">Sonuç bulunamadı</td></tr>
              ) : (
                filtered.map(lead => {
                  const isFixed = isFixedLine(lead.phone);
                  return (
                  <tr key={lead.id} className="hover:bg-dark-bg/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-white">{lead.clinicName}</td>
                    <td className="px-6 py-4 text-dark-text-muted">{lead.district || '-'}</td>
                    <td className="px-6 py-4 text-dark-text-muted">{lead.phone}</td>
                    <td className="px-6 py-4">
                      {getStatusBadge(lead.status)}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end items-center gap-2">
                      <button onClick={() => setSelectedLead(lead)} className="text-brand-500 hover:text-brand-400 font-medium bg-dark-bg px-3 py-1.5 rounded border border-brand-500/30 transition-colors">Detay</button>
                      <button 
                        onClick={() => {
                          if (isFixed) return;
                          const text = lead.drafts?.[0]?.content || "";
                          window.open(getWhatsAppUrl(lead.phone, text), '_blank');
                        }}
                        disabled={isFixed}
                        title={isFixed ? "Yalnızca mobil hatlara mesaj gönderilebilir" : "WhatsApp'ta Aç"}
                        className={`px-3 py-1.5 rounded border transition-colors flex items-center gap-1 font-medium ${isFixed ? "opacity-50 cursor-not-allowed bg-dark-bg text-dark-text-muted border-dark-border" : "text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30"}`}
                      >
                        <MessageSquare size={14} /> WP
                      </button>
                      <button onClick={() => handleStatusChange(lead.id, 'WON')} className="text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded border border-emerald-500/30 transition-colors flex items-center gap-1">
                        <CheckCircle size={14} /> Onayla
                      </button>
                      <button onClick={() => handleStatusChange(lead.id, 'LOST')} className="text-danger hover:text-red-400 bg-danger-bg/20 hover:bg-danger-bg/40 px-3 py-1.5 rounded border border-danger/30 transition-colors flex items-center gap-1">
                        <XCircle size={14} /> İptal
                      </button>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leads Modal */}
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
                <a href={`tel:${selectedLead.phone}`} className="text-white hover:text-brand-400">{selectedLead.phone}</a>
              </div>
              <div className="flex items-center gap-3 bg-dark-bg p-3 rounded-lg border border-dark-border hover:border-brand-500/50 transition-colors">
                <Search className="text-brand-500" size={20} />
                <a href={selectedLead.website || "#"} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline break-all">{selectedLead.website || "Web sitesi yok"}</a>
              </div>
              <div className="flex items-center gap-3 bg-dark-bg p-3 rounded-lg border border-dark-border">
                <Users className="text-brand-500" size={20} />
                <span className="text-white">Google Puanı: <strong className="text-brand-400">{selectedLead.rating || "-"}</strong> ({selectedLead.reviews || 0} Yorum)</span>
              </div>
              {selectedLead.problem && (
                <div className="mt-4 p-4 rounded-lg bg-warning-bg border border-warning/30">
                  <h4 className="text-warning font-semibold text-sm mb-2 uppercase tracking-wide">Tespit Edilen Problem</h4>
                  <p className="text-white/90 text-sm leading-relaxed">{selectedLead.problem}</p>
                </div>
              )}
              {selectedLead.drafts && selectedLead.drafts.length > 0 && selectedLead.drafts[0].screenshotUrl && (
                <div className="mt-4 p-4 rounded-lg bg-dark-bg border border-dark-border flex items-start gap-4">
                  <div className="flex-1">
                    <h4 className="text-brand-400 font-semibold text-sm mb-2 uppercase tracking-wide">Kanıt Ekran Görüntüsü</h4>
                    <p className="text-dark-text-muted text-xs leading-relaxed">Sistem tarafında otomatik alınmış, problemleri kanıtlayan ekran görüntüsü.</p>
                  </div>
                  <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden border border-dark-border cursor-pointer hover:border-brand-500 transition-colors" onClick={() => setLightboxImage(selectedLead.drafts![0].screenshotUrl!)}>
                     <img src={selectedLead.drafts[0].screenshotUrl} alt="Kanıt Thumbnail" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={() => {
                    const isFixed = isFixedLine(selectedLead.phone);
                    if (isFixed) return;
                    const text = selectedLead.drafts?.[0]?.content || "";
                    window.open(getWhatsAppUrl(selectedLead.phone, text), '_blank');
                  }}
                  disabled={isFixedLine(selectedLead.phone)}
                  title={isFixedLine(selectedLead.phone) ? "Yalnızca mobil hatlara mesaj gönderilebilir" : "WhatsApp'ta Aç"}
                  className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${isFixedLine(selectedLead.phone) ? "bg-dark-border text-dark-text-muted cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"}`}
                >
                  <MessageSquare size={20} /> WhatsApp Mesajını Aç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for Leads */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button onClick={() => setLightboxImage(null)} className="absolute -top-12 right-0 text-white hover:text-gray-300">
              <XCircle size={32} />
            </button>
            <img src={lightboxImage} alt="Büyütülmüş Kanıt" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-dark-border" />
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------
// FOLLOWUPS TAB
// -----------------------------------------------------
export function FollowupsTab() {
  const [tasks, setTasks] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const loadTasks = () => {
    setLoading(true);
    getFollowups().then(data => {
      setTasks(data);
    }).catch(err => {
      console.error(err);
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateDraft = async (leadId: string) => {
    setCreatingId(leadId);
    try {
      const res = await fetch(`/api/followups/${leadId}/draft`, { method: "POST" });
      if (res.ok) {
        alert("Takip mesajı taslağı oluşturuldu. Onay Bekleyenler sekmesinden kontrol edebilirsiniz.");
        loadTasks();
      } else {
        alert("Taslak oluşturulurken hata oluştu.");
      }
    } catch (err) {
      alert("Hata oluştu.");
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Yaklaşan Takipler</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="text-dark-text-muted col-span-full">Yükleniyor...</div>
        ) : tasks.length === 0 ? (
          <div className="text-dark-text-muted col-span-full py-8 text-center border border-dashed border-dark-border rounded-xl bg-dark-panel/30">
            Planlanmış takip bulunmuyor.
          </div>
        ) : (
          tasks.map(lead => (
            <div key={lead.id} className="bg-dark-panel border border-dark-border rounded-xl p-5 hover:border-brand-500/50 transition-colors relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
              <div className="flex justify-between items-start mb-3">
                <span className="px-2 py-1 bg-brand-500/10 text-brand-400 text-xs font-semibold rounded uppercase tracking-wider">
                  {lead.scheduledFollowUpAt ? new Date(lead.scheduledFollowUpAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : 'Belirsiz'}
                </span>
                <span className="text-dark-text-muted text-xs font-medium bg-dark-bg px-2 py-1 rounded">{lead.followUpStatus || 'BEKLIYOR'}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{lead.clinicName}</h3>
              {lead.district && <p className="text-sm text-dark-text-muted mt-2 border-t border-dark-border pt-2">{lead.district}</p>}
              
              <div className="mt-4 flex gap-2">
                <button 
                  onClick={() => handleCreateDraft(lead.id)}
                  disabled={creatingId === lead.id}
                  className="flex-1 py-1.5 text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white border border-brand-500/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  {creatingId === lead.id ? 'Hazırlanıyor...' : 'Takip Mesajı Hazırla'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

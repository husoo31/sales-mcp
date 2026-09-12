"use client";

import { useState, useEffect } from "react";
import { X, Shield, Key, Loader, ShieldCheck, ShieldAlert } from "lucide-react";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"password" | "2fa">("password");
  
  // Password State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 2FA State
  const [twoFaStatus, setTwoFaStatus] = useState<"loading" | "enabled" | "disabled">("loading");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMessage, setTwoFaMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (activeTab === "2fa" && twoFaStatus === "loading") {
      check2FAStatus();
    }
  }, [activeTab]);

  const check2FAStatus = async () => {
    try {
      const res = await fetch("/api/auth/2fa/disable", { method: "GET" });
      const data = await res.json();
      setTwoFaStatus(data.isEnabled ? "enabled" : "disabled");
    } catch (e) {
      setTwoFaStatus("disabled");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassMessage({ text: "Yeni şifreler eşleşmiyor", type: "error" });
      return;
    }
    
    setPassLoading(true);
    setPassMessage(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPassMessage({ text: "Şifre başarıyla güncellendi", type: "success" });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPassMessage({ text: data.error || "Şifre değiştirilemedi", type: "error" });
      }
    } catch (e) {
      setPassMessage({ text: "Bir hata oluştu", type: "error" });
    }
    setPassLoading(false);
  };

  const handleSetup2FA = async () => {
    setTwoFaLoading(true);
    setTwoFaMessage(null);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "GET" });
      const data = await res.json();
      if (res.ok && data.success) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
      } else {
        setTwoFaMessage({ text: "Kurulum başlatılamadı", type: "error" });
      }
    } catch (e) {
      setTwoFaMessage({ text: "Bir hata oluştu", type: "error" });
    }
    setTwoFaLoading(false);
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaLoading(true);
    setTwoFaMessage(null);
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTwoFaStatus("enabled");
        setQrCode(null);
        setSecret(null);
        setVerifyCode("");
        setTwoFaMessage({ text: "2FA başarıyla aktif edildi!", type: "success" });
      } else {
        setTwoFaMessage({ text: data.error || "Geçersiz kod", type: "error" });
      }
    } catch (e) {
      setTwoFaMessage({ text: "Bir hata oluştu", type: "error" });
    }
    setTwoFaLoading(false);
  };

  const handleDisable2FA = async () => {
    if (!confirm("İki Adımlı Doğrulama'yı devre dışı bırakmak istediğinize emin misiniz? Güvenliğiniz azalacaktır.")) return;
    
    setTwoFaLoading(true);
    setTwoFaMessage(null);
    try {
      const res = await fetch("/api/auth/2fa/disable", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setTwoFaStatus("disabled");
        setTwoFaMessage({ text: "2FA devre dışı bırakıldı", type: "success" });
      } else {
        setTwoFaMessage({ text: "Devre dışı bırakılamadı", type: "error" });
      }
    } catch (e) {
      setTwoFaMessage({ text: "Bir hata oluştu", type: "error" });
    }
    setTwoFaLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-panel border border-dark-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border bg-dark-bg/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="text-brand-400" size={20} />
            Güvenlik Ayarları
          </h2>
          <button onClick={onClose} className="p-2 text-dark-text-muted hover:text-white rounded-lg hover:bg-dark-border transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-border bg-dark-bg/30">
          <button 
            onClick={() => setActiveTab("password")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === "password" ? "border-brand-500 text-brand-400" : "border-transparent text-dark-text-muted hover:text-white"
            }`}
          >
            <Key size={16} /> Şifre Değiştir
          </button>
          <button 
            onClick={() => setActiveTab("2fa")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === "2fa" ? "border-brand-500 text-brand-400" : "border-transparent text-dark-text-muted hover:text-white"
            }`}
          >
            <ShieldCheck size={16} /> İki Adımlı Doğrulama (2FA)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          
          {/* Password Tab */}
          {activeTab === "password" && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs text-dark-text-muted mb-1 uppercase font-semibold tracking-wider">Mevcut Şifre</label>
                <input 
                  type="password" 
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-dark-text-muted mb-1 uppercase font-semibold tracking-wider">Yeni Şifre</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-dark-text-muted mb-1 uppercase font-semibold tracking-wider">Yeni Şifre (Tekrar)</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white focus:border-brand-500 focus:outline-none"
                  required
                />
              </div>
              
              {passMessage && (
                <div className={`p-3 rounded-lg text-sm ${passMessage.type === 'error' ? 'bg-danger/20 text-danger-hover border border-danger/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                  {passMessage.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={passLoading || !oldPassword || !newPassword || !confirmPassword}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {passLoading ? <Loader className="animate-spin" size={18} /> : "Şifreyi Güncelle"}
              </button>
            </form>
          )}

          {/* 2FA Tab */}
          {activeTab === "2fa" && (
            <div className="space-y-6">
              {twoFaStatus === "loading" ? (
                <div className="flex justify-center py-8 text-dark-text-muted"><Loader className="animate-spin" size={24} /></div>
              ) : twoFaStatus === "enabled" ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">2FA Aktif (Korumadasınız)</h3>
                    <p className="text-sm text-dark-text-muted">Hesabınız Google Authenticator ile güvence altında.</p>
                  </div>
                  
                  {twoFaMessage && (
                    <div className={`p-3 rounded-lg text-sm ${twoFaMessage.type === 'error' ? 'bg-danger/20 text-danger-hover border border-danger/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                      {twoFaMessage.text}
                    </div>
                  )}

                  <button 
                    onClick={handleDisable2FA}
                    disabled={twoFaLoading}
                    className="mt-4 px-4 py-2 border border-danger text-danger hover:bg-danger hover:text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {twoFaLoading ? <Loader className="animate-spin" size={16} /> : <ShieldAlert size={16} />}
                    2FA'yı Devre Dışı Bırak
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {!qrCode ? (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 bg-brand-500/10 text-brand-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-500/20">
                        <ShieldAlert size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">2FA Kurulumu</h3>
                      <p className="text-sm text-dark-text-muted mb-6">Hesabınızı korumak için Google Authenticator gibi bir TOTP uygulaması kullanın.</p>
                      <button 
                        onClick={handleSetup2FA}
                        disabled={twoFaLoading}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-lg transition-colors font-medium disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {twoFaLoading ? <Loader className="animate-spin" size={18} /> : "Kurulumu Başlat"}
                      </button>
                      {twoFaMessage && twoFaMessage.type === "error" && (
                        <p className="text-danger mt-4 text-sm">{twoFaMessage.text}</p>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleEnable2FA} className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="bg-white p-4 rounded-xl inline-block mx-auto flex justify-center">
                        <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-dark-text-muted mb-1">Karekod okunamıyorsa manuel kod:</p>
                        <code className="bg-dark-bg px-2 py-1 rounded text-brand-400 text-sm font-mono tracking-widest">{secret}</code>
                      </div>
                      
                      <div className="pt-4 border-t border-dark-border">
                        <label className="block text-xs text-dark-text-muted mb-2 uppercase font-semibold tracking-wider text-center">Uygulamadaki 6 Haneli Kodu Girin</label>
                        <input 
                          type="text" 
                          maxLength={6}
                          placeholder="000000"
                          value={verifyCode}
                          onChange={e => setVerifyCode(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full max-w-[200px] mx-auto block bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white focus:border-brand-500 focus:outline-none text-center text-2xl tracking-widest font-mono"
                          required
                          autoFocus
                        />
                      </div>

                      {twoFaMessage && (
                        <div className={`p-3 rounded-lg text-sm text-center ${twoFaMessage.type === 'error' ? 'bg-danger/20 text-danger-hover border border-danger/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                          {twoFaMessage.text}
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={twoFaLoading || verifyCode.length < 6}
                        className="w-full max-w-[200px] mx-auto bg-brand-600 hover:bg-brand-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {twoFaLoading ? <Loader className="animate-spin" size={18} /> : "Doğrula ve Aktifleştir"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

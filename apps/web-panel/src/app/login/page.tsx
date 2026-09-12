"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogIn } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        setError("Geçersiz şifre");
      }
    } catch (err) {
      setError("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-dark-panel border border-dark-border rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Decor */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400"></div>
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-500/20">
            <Lock className="text-brand-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Spark Command Center</h1>
          <p className="text-dark-text-muted text-sm">Lütfen yönetici şifrenizle giriş yapın.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all placeholder:text-dark-text-muted"
            />
            {error && <p className="text-danger text-sm mt-2">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
          >
            {loading ? "Giriş Yapılıyor..." : (
              <>
                <LogIn size={20} />
                Giriş Yap
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

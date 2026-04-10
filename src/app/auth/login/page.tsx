"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Package, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setError("");
        alert("Revisá tu email para confirmar la cuenta.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/control-general");
        router.refresh();
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060b18] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        <div className="bg-[#0c1222] rounded-3xl border border-[#1a2340] shadow-2xl shadow-black/40 p-8">
          <div className="flex flex-col items-center mb-7">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <Package className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Logística Hogareño</h1>
            <p className="text-[13px] text-[#7a8baa] mt-1 font-medium">
              {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 border border-[#1a2340] rounded-xl text-[13px] font-semibold text-[#e8edf5] hover:bg-white/[0.03] hover:border-[#2a3550] disabled:opacity-50 transition-all duration-200 mb-5"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1a2340]"></div>
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="bg-[#0c1222] px-3 text-[#7a8baa] font-medium">o con email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#7a8baa] mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-[#1a2340] rounded-xl text-[13px] bg-[#060b18] text-[#e8edf5] placeholder:text-[#3a4a6a] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#7a8baa] mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-[#1a2340] rounded-xl text-[13px] bg-[#060b18] text-[#e8edf5] placeholder:text-[#3a4a6a] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-[13px] font-bold hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[12px] text-[#7a8baa] mt-5 font-medium">
            {isSignUp ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-400 font-bold hover:text-blue-300 transition-colors"
            >
              {isSignUp ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layers, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await login(email.trim(), password.trim());
    if (!res.success) {
      setError(res.error || 'Erro ao fazer login.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#08080a] flex items-center justify-center p-4 selection:bg-blue-500/30">
      <div className="w-full max-w-md">
        
        {/* Logo / Brand */}
        <div className="flex flex-col items-center justify-center mb-10 animate-fade-in">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(99,102,241,0.1)]">
            <Layers className="text-blue-500" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Task Manager</h1>
          <p className="text-sm text-zinc-500 mt-1 font-medium">Uchoa Empreendimentos</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#121214] border border-zinc-800/80 rounded-2xl p-8 shadow-2xl shadow-black/50 animate-slide-up">
          <h2 className="text-lg font-semibold text-zinc-200 mb-6">Acesse sua conta</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#08080a] border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
                placeholder="seu@email.com.br"
              />
            </div>
            
            <div className="relative">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#08080a] border border-zinc-800 rounded-lg px-4 py-3 pr-10 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-lg font-medium animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_0_20px_rgba(79,70,229,0.15)] hover:shadow-[0_0_25px_rgba(79,70,229,0.3)]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="text-center mt-8">
          <p className="text-[11px] text-zinc-600 font-medium">
            Sistema interno. Acesso restrito.
          </p>
          <p className="text-[9px] text-zinc-700 mt-2 font-mono">
            {import.meta.env.VITE_SUPABASE_URL}
          </p>
        </div>

      </div>
    </div>
  );
}

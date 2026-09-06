'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { MessageSquare, Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;

      if (isRegister) {
        if (!form.name.trim()) {
          toast.error('Informe seu nome');
          setLoading(false);
          return;
        }
        const phoneDigits = form.phone.replace(/\D/g, '');
        if (phoneDigits.length < 10 || phoneDigits.length > 13) {
          toast.error('Informe um telefone válido com DDD');
          setLoading(false);
          return;
        }
        result = await api.register(form.name, form.email, form.password, phoneDigits);
      } else {
        result = await api.login(form.email, form.password);
      }

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      // Salvar token e dados do usuário
      localStorage.setItem('disparazap_token', result.token);
      localStorage.setItem('disparazap_user', JSON.stringify(result.user));

      toast.success(isRegister ? 'Conta criada com sucesso!' : 'Login realizado!');
      router.push('/');
    } catch (error) {
      toast.error('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 flex items-center justify-center p-4">
      <Toaster position="top-right" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-2xl mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">DisparaZap</h1>
          <p className="text-green-200 mt-2">Sistema de disparo de mensagens para WhatsApp</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isRegister ? 'Criar Conta' : 'Entrar'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm text-green-200 mb-1">Nome</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-300" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-green-300 focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="Seu nome"
                  />
                </div>
              </div>
            )}

            {isRegister && (
              <div>
                <label className="block text-sm text-green-200 mb-1">Telefone (com DDD)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-300" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-green-300 focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="11987654321"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-green-200 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-300" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-green-300 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-green-200 mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-300" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-green-300 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? 'Criar Conta' : 'Entrar'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-green-200 hover:text-white transition-colors text-sm"
            >
              {isRegister
                ? 'Já tem uma conta? Faça login'
                : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

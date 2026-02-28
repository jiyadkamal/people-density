'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [isSignup, setIsSignup] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) router.push('/dashboard');
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: isSignup ? 'signup' : 'login',
                    username,
                    password
                }),
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                router.push('/dashboard');
            } else {
                setError(data.error);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Something went wrong. Please check if your database is running.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden font-inter">
            {/* Animated Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00ff88]/10 rounded-full blur-[120px] animate-pulse delay-700" />

            <div className="w-full max-w-md z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-[#1e293b]/50 border border-white/10 mb-6 backdrop-blur-xl">
                        <ShieldCheck className="text-[#00ff88] w-10 h-10" strokeWidth={1.5} />
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">VisionMetrics <span className="text-[#00ff88]">Pro</span></h1>
                    <p className="text-slate-400 text-lg">Next-generation occupancy analytics</p>
                </div>

                <div className="bg-[#1e293b]/40 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/5 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Username</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#00ff88] transition-colors">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-[#0f172a]/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00ff88]/50 focus:border-[#00ff88]/50 transition-all"
                                    placeholder="Enter your username"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-[#00ff88] transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#0f172a]/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00ff88]/50 focus:border-[#00ff88]/50 transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#00ff88] hover:bg-[#00cc6e] text-[#020617] font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#00ff88]/20 flex items-center justify-center space-x-2 group active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5 text-center">
                        <button
                            onClick={() => setIsSignup(!isSignup)}
                            className="text-slate-400 font-medium hover:text-[#00ff88] transition-colors"
                        >
                            {isSignup ? "Already have an account? Sign In" : "New to VisionMetrics? Create an account"}
                        </button>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-center space-x-6 text-slate-600">
                    <span className="text-xs uppercase tracking-widest font-bold">Encrypted End-to-End</span>
                    <span className="text-xs">||</span>
                    <span className="text-xs uppercase tracking-widest font-bold">Real-time YOLO Engine</span>
                </div>
            </div>
        </div>
    );
}

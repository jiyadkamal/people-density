'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, Activity, ShieldCheck, Zap, BarChart3, Clock, AlertCircle, X, Download, TrendingUp } from 'lucide-react';

export default function Dashboard() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const captureCanvasRef = useRef<HTMLCanvasElement>(null);
    const isProcessing = useRef(false);

    const [personCount, setPersonCount] = useState(0);
    const [username, setUsername] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [latency, setLatency] = useState(0);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [backendError, setBackendError] = useState<string | null>(null);
    const [sessionData, setSessionData] = useState<{ count: number, time: string }[]>([]);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [sourceType, setSourceType] = useState<'webcam' | 'file'>('webcam');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const payload = JSON.parse(jsonPayload);
            setUsername(payload.username || 'Admin');
        } catch (e) {
            console.error('Token parsing failed:', e);
            localStorage.removeItem('token');
            router.push('/login');
        }
    }, [router]);

    const startDetection = async () => {
        try {
            // Full state reset before starting
            setIsRunning(false);
            setProcessedImage(null);
            setPersonCount(0);
            setLatency(0);
            setSessionData([]);
            setBackendError(null);

            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }

            if (captureCanvasRef.current) {
                const ctx = captureCanvasRef.current.getContext('2d');
                ctx?.clearRect(0, 0, captureCanvasRef.current.width, captureCanvasRef.current.height);
            }

            if (sourceType === 'webcam') {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.src = '';
                    setIsRunning(true);
                }
            } else if (sourceType === 'file' && selectedFile) {
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                    const url = URL.createObjectURL(selectedFile);
                    videoRef.current.src = url;
                    videoRef.current.play();
                    setIsRunning(true);
                }
            }
        } catch (err) {
            console.error('Error starting detection:', err);
            setBackendError('Failed to initialize media source.');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setSourceType('file');
            stopDetection(false); // Suppress analytics when just switching files
        }
    };

    const stopDetection = (shouldShowAnalytics = true) => {
        if (videoRef.current) {
            if (videoRef.current.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
                videoRef.current.srcObject = null;
            }

            // Revoke object URL if it exists
            if (videoRef.current.src.startsWith('blob:')) {
                URL.revokeObjectURL(videoRef.current.src);
            }

            videoRef.current.pause();
            videoRef.current.src = '';

            setIsRunning(false);
            setProcessedImage(null);
            setPersonCount(0);
            setLatency(0);

            // Clear display canvas
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }

            if (shouldShowAnalytics === true && sessionData.length > 0) {
                setShowAnalytics(true);
            }
        }
    };

    useEffect(() => {
        let intervalId: any;
        if (isRunning) {
            intervalId = setInterval(async () => {
                if (videoRef.current && captureCanvasRef.current && !isProcessing.current) {
                    const canvas = captureCanvasRef.current;
                    const context = canvas.getContext('2d');
                    if (context && canvas.width > 0 && canvas.height > 0) {
                        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob(async (blob) => {
                            if (blob) {
                                isProcessing.current = true;
                                const startTime = Date.now();
                                const formData = new FormData();
                                formData.append('file', blob, 'frame.jpg');
                                formData.append('model_name', 'yolov8n.pt');
                                formData.append('conf_threshold', '0.3');

                                try {
                                    const res = await fetch('http://localhost:8000/detect', {
                                        method: 'POST',
                                        body: formData,
                                    });
                                    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
                                    const data = await res.json();
                                    setLatency(Date.now() - startTime);
                                    setPersonCount(data.person_count);

                                    // Add to session history
                                    setSessionData(prev => [...prev, {
                                        count: data.person_count,
                                        time: new Date().toLocaleTimeString([], { hour12: false })
                                    }].slice(-500)); // Keep last 500 points for performance

                                    if (data.image) setProcessedImage(data.image);
                                    setBackendError(null);
                                } catch (e: any) {
                                    console.error('Detection poll failed:', e);
                                    setBackendError(e.message || 'Connection failed');
                                } finally {
                                    isProcessing.current = false;
                                }
                            }
                        }, 'image/jpeg', 1.0);
                    }
                }
            }, 80);
        }
        return () => {
            clearInterval(intervalId);
            isProcessing.current = false;
        };
    }, [isRunning]);

    useEffect(() => {
        if (processedImage && canvasRef.current && videoRef.current) {
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                if (canvas && video && video.videoWidth > 0 && isRunning) {
                    const aspectRatio = video.videoHeight / video.videoWidth;
                    const targetHeight = Math.floor(canvas.width * aspectRatio);

                    if (canvas.height !== targetHeight) {
                        canvas.height = targetHeight;
                        if (captureCanvasRef.current) {
                            captureCanvasRef.current.height = Math.floor(captureCanvasRef.current.width * aspectRatio);
                        }
                    }

                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    }
                }
            };
            img.src = processedImage;
        } else if (!processedImage && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }, [processedImage, isRunning]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col font-inter selection:bg-[#00ff88]/30">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#00ff88]/5 rounded-full blur-[120px]" />
            </div>

            {/* Header */}
            <header className="h-20 flex items-center justify-between px-8 bg-[#0f172a]/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
                <div className="flex items-center space-x-3 group cursor-default">
                    <div className="p-2.5 bg-[#1e293b] rounded-xl border border-white/10 group-hover:border-[#00ff88]/30 transition-colors">
                        <ShieldCheck className="text-[#00ff88] w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                            VisionMetrics <span className="text-[#00ff88] px-1.5 py-0.5 rounded-md bg-[#00ff88]/10 text-xs font-bold uppercase tracking-widest">Pro</span>
                        </h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Intelligence Engine</p>
                    </div>
                </div>
                <div className="flex items-center space-x-6">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Administrator</span>
                        <span className="text-sm font-semibold text-white">{username}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="group relative p-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/20 transition-all active:scale-95"
                    >
                        <LogOut size={20} className="text-red-400 group-hover:rotate-12 transition-transform" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 lg:p-10 max-w-[1600px] mx-auto w-full flex flex-col gap-6 z-10">

                {/* Content Section */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

                    {/* Left Column - Stats & Summary */}
                    <div className="xl:col-span-1 space-y-6 order-2 xl:order-1">
                        <div className="bg-[#1e293b]/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Users size={80} />
                            </div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">Total Occupancy</p>
                            <div className="relative flex items-baseline gap-4">
                                <span className="text-8xl font-black text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">{personCount}</span>
                                <div className="flex flex-col">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${personCount > 0 ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-slate-500/10 text-slate-500'}`}>
                                        {personCount > 0 ? 'Live Capture' : 'Empty'}
                                    </span>
                                    <span className="text-slate-500 text-sm font-semibold mt-1">Subjects</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#1e293b]/40 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-xl">
                                <div className="flex items-center gap-2 text-slate-500 mb-2">
                                    <Clock size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Latency</span>
                                </div>
                                <p className={`text-2xl font-black tabular-nums ${latency < 100 ? 'text-[#00ff88]' : 'text-amber-400'}`}>{latency}<span className="text-xs ml-1 opacity-50 font-medium">ms</span></p>
                            </div>
                            <div className="bg-[#1e293b]/40 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-xl">
                                <div className="flex items-center gap-2 text-slate-500 mb-2">
                                    <Zap size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Speed</span>
                                </div>
                                <p className="text-2xl font-black text-blue-400 tabular-nums">{latency > 0 ? Math.round(1000 / (latency || 1)) : 0}<span className="text-xs ml-1 opacity-50 font-medium">FPS</span></p>
                            </div>
                        </div>

                    </div>

                    {/* Right Column - Video Feed */}
                    <div className="xl:col-span-3 order-1 xl:order-2">
                        <div className="bg-[#1e293b]/40 backdrop-blur-2xl rounded-[3rem] border border-white/5 shadow-2xl overflow-hidden flex flex-col h-full max-h-[85vh] relative flex-1">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-[#00ff88] animate-pulse shadow-[0_0_12px_#00ff88]' : 'bg-slate-600'}`} />
                                    <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-3">
                                        <Activity size={20} className="text-[#00ff88]" />
                                        Strategic Analysis Feed
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        ref={fileInputRef}
                                    />
                                    {!isRunning && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center gap-2 transition-all active:scale-95 group"
                                            title={selectedFile ? selectedFile.name : "Upload video file"}
                                        >
                                            <Download size={18} className={selectedFile ? "text-[#00ff88]" : "text-slate-400"} />
                                            <span className="text-xs font-black uppercase tracking-widest">
                                                {selectedFile ? 'Change' : 'Upload'}
                                            </span>
                                            {selectedFile && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                                            )}
                                        </button>
                                    )}
                                    {selectedFile && !isRunning && (
                                        <button
                                            onClick={() => { setSelectedFile(null); setSourceType('webcam'); }}
                                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl border border-red-500/20 transition-all"
                                            title="Clear video and use camera"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={isRunning ? () => stopDetection(true) : startDetection}
                                        className={`px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all transform active:scale-95 flex items-center gap-3 ${isRunning
                                            ? 'bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30'
                                            : 'bg-[#00ff88] text-[#020617] hover:bg-[#00ff88]/90 shadow-lg shadow-[#00ff88]/20'
                                            }`}
                                    >
                                        {isRunning ? (
                                            <>
                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                                <span>Terminate Engine</span>
                                            </>
                                        ) : (
                                            <>
                                                <Zap size={16} fill="currentColor" />
                                                <span>{selectedFile ? 'Process Video' : 'Initialize Stream'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 relative bg-[#020617] p-4 flex items-center justify-center min-h-[400px]">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    onEnded={() => stopDetection(true)}
                                    suppressHydrationWarning
                                    className="absolute opacity-0 pointer-events-none"
                                />

                                <canvas
                                    ref={canvasRef}
                                    width={1280}
                                    height={720}
                                    className={`w-full h-full object-contain rounded-[2rem] transition-all duration-700 shadow-inner ${!isRunning ? 'opacity-0 scale-95 blur-xl' : 'opacity-100 scale-100 blur-0'}`}
                                />

                                {!isRunning && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 space-y-8 animate-in fade-in zoom-in duration-500">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-[#00ff88]/20 rounded-full blur-[40px] animate-pulse" />
                                            <div className="relative p-8 bg-[#1e293b]/80 backdrop-blur-3xl rounded-full border border-white/10 shadow-2xl">
                                                <ShieldCheck size={80} className="text-[#00ff88] opacity-50" strokeWidth={1} />
                                            </div>
                                        </div>
                                        <div className="space-y-3 z-10">
                                            <h2 className="text-3xl font-black text-white tracking-tight">System Ready for Deployment</h2>
                                            <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                                                The VisionMetrics Pro engine is on standby. Initialize the stream to activate real-time person detection and density analysis.
                                            </p>
                                        </div>
                                        <div className="flex gap-4 items-center px-6 py-3 bg-[#1e293b]/40 rounded-2xl border border-white/5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                            <Zap size={14} className="text-[#00ff88]" />
                                            Optimized for High-Performance
                                        </div>
                                        {backendError && (
                                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium animate-pulse">
                                                Warning: AI Engine unreachable. Please ensures the backend is running.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Optimization HD Canvas */}
                                <canvas ref={captureCanvasRef} width={1280} height={720} className="hidden" />
                            </div>

                            {/* Status Footer */}
                            <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                <div className="flex gap-6">
                                    <span className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        SSL Secured
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                                        YOLOv8 Edge Inference
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Clock size={12} />
                                    <span>Up: 99.9%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Analytics Modal */}
            {showAnalytics && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowAnalytics(false)} />

                    <div className="relative w-full max-w-5xl bg-[#1e293b]/80 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                    <TrendingUp className="text-[#00ff88]" />
                                    Session Intelligence
                                </h2>
                                <p className="text-slate-400 text-sm font-medium mt-1">Advanced temporal density analysis and occupancy trends</p>
                            </div>
                            <button
                                onClick={() => setShowAnalytics(false)}
                                className="p-3 hover:bg-white/5 rounded-2xl border border-white/5 transition-colors group"
                            >
                                <X size={24} className="text-slate-400 group-hover:text-white transition-colors" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Peak Occupancy</p>
                                    <p className="text-4xl font-black text-[#00ff88]">{Math.max(...sessionData.map(d => d.count), 0)}</p>
                                </div>
                                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Average Depth</p>
                                    <p className="text-4xl font-black text-blue-400">
                                        {(sessionData.reduce((acc, d) => acc + d.count, 0) / (sessionData.length || 1)).toFixed(1)}
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Data Points</p>
                                    <p className="text-4xl font-black text-amber-400">{sessionData.length}</p>
                                </div>
                            </div>

                            {/* Main Chart Container */}
                            <div className="bg-[#020617] rounded-[2rem] p-8 border border-white/5 relative min-h-[400px]">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                                    <Activity size={14} className="text-[#00ff88]" />
                                    Occupancy Over Real-Time
                                </h3>

                                <div className="w-full h-[300px] relative">
                                    {/* SVG Chart */}
                                    <svg width="100%" height="100%" viewBox="0 0 1000 300" preserveAspectRatio="none" className="overflow-visible">
                                        {/* Grid Lines */}
                                        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                                            <line
                                                key={i}
                                                x1="0" y1={300 * p} x2="1000" y2={300 * p}
                                                stroke="white" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="4 4"
                                            />
                                        ))}

                                        {/* Data Path */}
                                        {sessionData.length > 1 && (
                                            <>
                                                <path
                                                    d={`M ${sessionData.map((d, i) =>
                                                        `${(i / (sessionData.length - 1)) * 1000},${300 - (d.count / (Math.max(...sessionData.map(val => val.count), 1) + 1)) * 300}`
                                                    ).join(' L ')}`}
                                                    fill="none"
                                                    stroke="#00ff88"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 136, 0.3))' }}
                                                />
                                                {/* Markers */}
                                                {sessionData.filter((_, i) => i % Math.max(1, Math.floor(sessionData.length / 20)) === 0).map((d, i, arr) => {
                                                    const idx = sessionData.indexOf(d);
                                                    const x = (idx / (sessionData.length - 1)) * 1000;
                                                    const y = 300 - (d.count / (Math.max(...sessionData.map(val => val.count), 1) + 1)) * 300;
                                                    return (
                                                        <circle key={i} cx={x} cy={y} r="4" fill="#00ff88" stroke="#020617" strokeWidth="2" />
                                                    );
                                                })}
                                            </>
                                        )}
                                    </svg>

                                    {/* X-Axis Labels */}
                                    <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2">
                                        {sessionData.filter((_, i) => i % Math.max(1, Math.floor(sessionData.length / 5)) === 0).map((d, i) => (
                                            <span key={i} className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                                {d.time}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Y-Axis Label */}
                                    <div className="absolute -left-12 top-0 bottom-0 flex flex-col justify-between py-1 items-end">
                                        <span className="text-[10px] font-bold text-slate-500">{Math.max(...sessionData.map(d => d.count), 0) + 1}</span>
                                        <span className="text-[10px] font-bold text-slate-500">0</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-white/5 border-t border-white/5 flex justify-end gap-4">
                            <button
                                onClick={() => setShowAnalytics(false)}
                                className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
                            >
                                Dismiss Analytics
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="px-8 py-3 bg-[#00ff88] text-[#020617] rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:bg-[#00ff88]/90 active:scale-95 shadow-lg shadow-[#00ff88]/20 flex items-center gap-2"
                            >
                                <Download size={16} />
                                Export Intelligence
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

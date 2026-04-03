'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = typeof window !== 'undefined'
    ? `http://${window.location.hostname}:8080/api`
    : 'http://localhost:8080/api';

interface Concert {
    id: number;
    name: string;
    date: string;
    total_seats: number;
    available_seats: number;
}

export default function AdminPage() {
    const router = useRouter();
    const [name, setName] = useState('IU Concert');
    const [date, setDate] = useState('2026-12-25');
    const [totalSeats, setTotalSeats] = useState(100);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [concerts, setConcerts] = useState<Concert[]>([]);
    const [loaded, setLoaded] = useState(false);

    const loadConcerts = async () => {
        const res = await fetch(`${API_BASE}/concerts`, { cache: 'no-store' });
        setConcerts(await res.json());
        setLoaded(true);
    };

    useEffect(() => { loadConcerts(); }, []);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 2500);
    };

    const handleCreate = async () => {
        const res = await fetch(`${API_BASE}/admin/concerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, total_seats: totalSeats }),
        });
        if (res.ok) {
            showMessage('success', '콘서트가 등록되었어요');
            loadConcerts();
        }
    };

    const handleReset = async () => {
        await fetch(`${API_BASE}/admin/concerts/reset`, { method: 'POST' });
        showMessage('success', '데이터가 초기화되었어요');
        loadConcerts();
    };

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
            {/* Header */}
            <header className="sticky top-0 z-10 backdrop-blur-xl" style={{ background: 'rgba(247, 248, 250, 0.85)', borderBottom: '1px solid var(--color-border-light)' }}>
                <div className="max-w-xl mx-auto px-5 h-14 flex items-center">
                    <button onClick={() => router.push('/')} className="flex items-center -ml-1" style={{ color: 'var(--color-text-secondary)' }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                    <span className="flex-1 text-center text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        관리
                    </span>
                    <div className="w-5" />
                </div>
            </header>

            <main className="max-w-xl mx-auto px-5 pt-8 pb-20">
                {/* Create Form */}
                <div
                    className="rounded-2xl p-6 animate-fade-up"
                    style={{ background: 'var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                >
                    <h2 className="text-[17px] font-bold mb-5" style={{ color: 'var(--color-text-primary)' }}>
                        콘서트 등록
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[13px] font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>콘서트 이름</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl text-[15px] outline-none transition-all duration-150"
                                style={{
                                    background: 'var(--color-background)',
                                    border: '1.5px solid var(--color-border)',
                                    color: 'var(--color-text-primary)',
                                }}
                                onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--color-blue)'}
                                onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
                            />
                        </div>

                        <div>
                            <label className="text-[13px] font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>날짜</label>
                            <input
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl text-[15px] outline-none transition-all duration-150"
                                style={{
                                    background: 'var(--color-background)',
                                    border: '1.5px solid var(--color-border)',
                                    color: 'var(--color-text-primary)',
                                }}
                                onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--color-blue)'}
                                onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
                            />
                        </div>

                        <div>
                            <label className="text-[13px] font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>총 좌석수</label>
                            <input
                                type="number"
                                value={totalSeats}
                                onChange={e => setTotalSeats(Number(e.target.value))}
                                className="w-full h-12 px-4 rounded-xl text-[15px] outline-none transition-all duration-150"
                                style={{
                                    background: 'var(--color-background)',
                                    border: '1.5px solid var(--color-border)',
                                    color: 'var(--color-text-primary)',
                                }}
                                onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--color-blue)'}
                                onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <button
                            onClick={handleCreate}
                            className="flex-1 h-12 rounded-xl text-[15px] font-semibold transition-all duration-200"
                            style={{ background: 'var(--color-blue)', color: 'white' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-blue-hover)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-blue)'}
                        >
                            등록
                        </button>
                        <button
                            onClick={handleReset}
                            className="h-12 px-5 rounded-xl text-[15px] font-medium transition-all duration-200"
                            style={{ background: 'var(--color-red-light)', color: 'var(--color-red)' }}
                        >
                            초기화
                        </button>
                    </div>
                </div>

                {/* Concert List */}
                <div className="mt-8">
                    <h2
                        className="text-[15px] font-semibold mb-3 animate-fade-up"
                        style={{ color: 'var(--color-text-secondary)', animationDelay: '60ms' }}
                    >
                        등록된 콘서트
                    </h2>

                    <div className="space-y-2">
                        {loaded && concerts.map((c, i) => (
                            <div
                                key={c.id}
                                className="rounded-xl p-4 flex items-center justify-between animate-fade-up"
                                style={{
                                    background: 'var(--color-surface)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    animationDelay: `${100 + i * 40}ms`,
                                }}
                            >
                                <div>
                                    <span className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                        {c.name}
                                    </span>
                                    <span className="text-[13px] ml-2" style={{ color: 'var(--color-text-tertiary)' }}>
                                        {c.date}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                        {c.available_seats}/{c.total_seats}
                                    </span>
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                            background: c.available_seats === 0 ? 'var(--color-red)' :
                                                c.available_seats < c.total_seats * 0.2 ? 'var(--color-badge-v1)' : 'var(--color-green)',
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        {loaded && concerts.length === 0 && (
                            <div
                                className="rounded-xl p-8 text-center animate-fade-up"
                                style={{ background: 'var(--color-surface)', animationDelay: '100ms' }}
                            >
                                <p className="text-[14px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                    아직 등록된 콘서트가 없어요
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Toast */}
            {message && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down" style={{ maxWidth: '360px', width: '90%' }}>
                    <div
                        className="px-5 py-3.5 rounded-2xl text-[14px] font-medium backdrop-blur-lg"
                        style={{
                            background: message.type === 'success' ? 'rgba(48, 176, 110, 0.95)' : 'rgba(240, 68, 82, 0.95)',
                            color: 'white',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        }}
                    >
                        ✓ {message.text}
                    </div>
                </div>
            )}
        </div>
    );
}

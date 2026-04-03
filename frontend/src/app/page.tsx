'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchConcerts, Concert } from '@/lib/api';

export default function Home() {
    const [concerts, setConcerts] = useState<Concert[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        fetchConcerts().then(data => {
            setConcerts(data);
            setLoaded(true);
        });
    }, []);

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
            {/* Header */}
            <header className="sticky top-0 z-10 backdrop-blur-xl" style={{ background: 'rgba(247, 248, 250, 0.85)', borderBottom: '1px solid var(--color-border-light)' }}>
                <div className="max-w-xl mx-auto px-5 h-14 flex items-center justify-between">
                    <span className="text-[17px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Concert</span>
                    <Link
                        href="/admin"
                        className="text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors"
                        style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
                    >
                        관리
                    </Link>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-5 pt-8 pb-20">
                {/* Version Badge */}
                <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
                    <span
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full mb-4"
                        style={{ background: '#fff4ee', color: 'var(--color-badge-v1)' }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-badge-v1)' }} />
                        V1 Naive
                    </span>
                </div>

                {/* Title Section */}
                <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
                    <h1
                        className="text-[28px] font-bold leading-tight tracking-tight"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        콘서트 티켓
                    </h1>
                    <p className="text-[15px] mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                        지금 예매 가능한 공연
                    </p>
                </div>

                {/* Concert List */}
                <div className="mt-8 space-y-3">
                    {loaded && concerts.map((c, i) => (
                        <Link
                            key={c.id}
                            href={`/concert/${c.id}`}
                            className="block rounded-2xl p-5 transition-all duration-200 animate-fade-up"
                            style={{
                                background: 'var(--color-surface)',
                                animationDelay: `${100 + i * 60}ms`,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                            }}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h2 className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        {c.name}
                                    </h2>
                                    <p className="text-[14px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                        {c.date}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    {c.available_seats === 0 ? (
                                        <span
                                            className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                                            style={{ background: 'var(--color-red-light)', color: 'var(--color-red)' }}
                                        >
                                            매진
                                        </span>
                                    ) : (
                                        <span
                                            className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                                            style={{ background: 'var(--color-blue-light)', color: 'var(--color-blue)' }}
                                        >
                                            예매 가능
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Seat Progress */}
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>잔여 좌석</span>
                                    <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        {c.available_seats}<span style={{ color: 'var(--color-text-tertiary)' }}>/{c.total_seats}</span>
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border-light)' }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${(c.available_seats / c.total_seats) * 100}%`,
                                            background: c.available_seats === 0 ? 'var(--color-red)' :
                                                c.available_seats < c.total_seats * 0.2 ? 'var(--color-badge-v1)' : 'var(--color-blue)',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Arrow hint */}
                            <div className="flex justify-end mt-3">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--color-text-tertiary)' }}>
                                    <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        </Link>
                    ))}

                    {loaded && concerts.length === 0 && (
                        <div
                            className="rounded-2xl p-12 text-center animate-fade-up"
                            style={{ background: 'var(--color-surface)', animationDelay: '100ms' }}
                        >
                            <div className="text-[40px] mb-4">🎶</div>
                            <p className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                등록된 콘서트가 없어요
                            </p>
                            <p className="text-[14px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                                관리 페이지에서 콘서트를 등록해보세요
                            </p>
                            <Link
                                href="/admin"
                                className="inline-block mt-5 text-[14px] font-semibold px-5 py-2.5 rounded-xl transition-colors"
                                style={{ background: 'var(--color-blue)', color: 'white' }}
                            >
                                콘서트 등록하기
                            </Link>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

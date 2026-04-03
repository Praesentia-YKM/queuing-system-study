'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchConcert, fetchReservedSeats, reserve, Concert } from '@/lib/api';
import SeatGrid from '@/components/SeatGrid';

export default function ConcertPage() {
    const { id } = useParams();
    const router = useRouter();
    const [concert, setConcert] = useState<Concert | null>(null);
    const [reservedSeats, setReservedSeats] = useState<number[]>([]);
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [userId] = useState(`user-${Math.random().toString(36).slice(2, 8)}`);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const loadData = useCallback(async () => {
        if (!id) return;
        const [concertData, seats] = await Promise.all([
            fetchConcert(Number(id)),
            fetchReservedSeats(Number(id)),
        ]);
        setConcert(concertData);
        setReservedSeats(seats);
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleReserve = async () => {
        if (!selectedSeat || !id) return;
        setLoading(true);
        setMessage(null);
        try {
            await reserve(Number(id), userId, selectedSeat);
            const seatLabel = `${String.fromCharCode(65 + Math.floor((selectedSeat - 1) / 10))}열 ${((selectedSeat - 1) % 10) + 1}번`;
            setMessage({ type: 'success', text: `${seatLabel} 좌석이 예매되었어요` });
            setSelectedSeat(null);
            await loadData();
            setTimeout(() => setMessage(null), 3000);
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || '예매에 실패했어요' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    if (!concert) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-blue)' }} />
            </div>
        );
    }

    const seatLabel = selectedSeat
        ? `${String.fromCharCode(65 + Math.floor((selectedSeat - 1) / 10))}열 ${((selectedSeat - 1) % 10) + 1}번`
        : null;

    return (
        <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
            {/* Header */}
            <header className="sticky top-0 z-10 backdrop-blur-xl" style={{ background: 'rgba(247, 248, 250, 0.85)', borderBottom: '1px solid var(--color-border-light)' }}>
                <div className="max-w-xl mx-auto px-5 h-14 flex items-center">
                    <button onClick={() => router.push('/')} className="flex items-center gap-1 -ml-1" style={{ color: 'var(--color-text-secondary)' }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                    <span className="flex-1 text-center text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        좌석 선택
                    </span>
                    <div className="w-5" />
                </div>
            </header>

            <main className="max-w-xl mx-auto px-5 pt-6 pb-32">
                {/* Concert Info */}
                <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
                    <h1 className="text-[22px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {concert.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>{concert.date}</span>
                        <span className="text-[14px]" style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                        <span className="text-[14px] font-medium" style={{ color: 'var(--color-blue)' }}>
                            {concert.available_seats}석 남음
                        </span>
                    </div>
                </div>

                {/* Seat Grid */}
                <div
                    className="mt-8 p-5 rounded-2xl animate-fade-up"
                    style={{ background: 'var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', animationDelay: '80ms' }}
                >
                    <SeatGrid
                        totalSeats={concert.total_seats}
                        reservedSeats={reservedSeats}
                        selectedSeat={selectedSeat}
                        onSelect={setSelectedSeat}
                    />
                </div>

                {/* User ID */}
                <div className="mt-4 text-center animate-fade-up" style={{ animationDelay: '120ms' }}>
                    <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        ID: {userId}
                    </span>
                </div>

                {/* Toast Message */}
                {message && (
                    <div
                        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down"
                        style={{ maxWidth: '360px', width: '90%' }}
                    >
                        <div
                            className="px-5 py-3.5 rounded-2xl text-[14px] font-medium backdrop-blur-lg"
                            style={{
                                background: message.type === 'success' ? 'rgba(48, 176, 110, 0.95)' : 'rgba(240, 68, 82, 0.95)',
                                color: 'white',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            }}
                        >
                            {message.type === 'success' ? '✓ ' : ''}{message.text}
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom CTA */}
            <div
                className="fixed bottom-0 left-0 right-0 z-10"
                style={{ background: 'linear-gradient(transparent, var(--color-background) 20%)' }}
            >
                <div className="max-w-xl mx-auto px-5 pb-8 pt-6">
                    {selectedSeat && (
                        <div className="text-center mb-3 animate-fade-in">
                            <span className="text-[14px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {seatLabel}
                            </span>
                            <span className="text-[14px]" style={{ color: 'var(--color-text-tertiary)' }}> 좌석을 선택했어요</span>
                        </div>
                    )}
                    <button
                        onClick={handleReserve}
                        disabled={!selectedSeat || loading}
                        className="w-full h-[54px] rounded-2xl text-[16px] font-semibold transition-all duration-200"
                        style={{
                            background: selectedSeat ? 'var(--color-blue)' : 'var(--color-border-light)',
                            color: selectedSeat ? 'white' : 'var(--color-text-tertiary)',
                            cursor: selectedSeat ? 'pointer' : 'default',
                            transform: loading ? 'scale(0.98)' : 'scale(1)',
                        }}
                        onMouseEnter={e => {
                            if (selectedSeat && !loading) {
                                (e.currentTarget as HTMLElement).style.background = 'var(--color-blue-hover)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (selectedSeat) {
                                (e.currentTarget as HTMLElement).style.background = 'var(--color-blue)';
                            }
                        }}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                처리 중
                            </span>
                        ) : selectedSeat ? (
                            '예매하기'
                        ) : (
                            '좌석을 선택해주세요'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

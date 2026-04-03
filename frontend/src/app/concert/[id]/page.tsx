'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchConcert, reserve, Concert } from '@/lib/api';
import SeatGrid from '@/components/SeatGrid';

export default function ConcertPage() {
    const { id } = useParams();
    const [concert, setConcert] = useState<Concert | null>(null);
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [userId] = useState(`user-${Math.random().toString(36).slice(2, 8)}`);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (id) fetchConcert(Number(id)).then(setConcert);
    }, [id]);

    const handleReserve = async () => {
        if (!selectedSeat || !id) return;
        setLoading(true);
        setMessage('');
        try {
            await reserve(Number(id), userId, selectedSeat);
            setMessage(`좌석 ${selectedSeat}번 예매 완료!`);
            setSelectedSeat(null);
            fetchConcert(Number(id)).then(setConcert);
        } catch (e: any) {
            setMessage(`실패: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!concert) return <div className="p-8">Loading...</div>;

    return (
        <main className="max-w-4xl mx-auto p-8">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 목록으로</Link>
            <h1 className="text-2xl font-bold mt-4">{concert.name}</h1>
            <p className="text-gray-500 mb-2">{concert.date}</p>
            <p className="text-lg mb-4">잔여 <span className="font-bold text-blue-600">{concert.available_seats}</span>/{concert.total_seats}석</p>
            <p className="text-sm text-gray-400 mb-6">내 ID: {userId}</p>

            <SeatGrid
                totalSeats={concert.total_seats}
                reservedSeats={[]}
                selectedSeat={selectedSeat}
                onSelect={setSelectedSeat}
            />

            <div className="mt-6 flex items-center gap-4">
                <button
                    onClick={handleReserve}
                    disabled={!selectedSeat || loading}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-600 transition"
                >
                    {loading ? '처리 중...' : selectedSeat ? `좌석 ${selectedSeat}번 예매` : '좌석을 선택하세요'}
                </button>
                {message && (
                    <span className={`font-medium ${message.includes('실패') ? 'text-red-500' : 'text-green-500'}`}>
                        {message}
                    </span>
                )}
            </div>
        </main>
    );
}

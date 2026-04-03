'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = 'http://localhost:8080/api';

interface Concert {
    id: number;
    name: string;
    date: string;
    total_seats: number;
    available_seats: number;
}

export default function AdminPage() {
    const [name, setName] = useState('IU Concert');
    const [date, setDate] = useState('2026-12-25');
    const [totalSeats, setTotalSeats] = useState(100);
    const [message, setMessage] = useState('');
    const [concerts, setConcerts] = useState<Concert[]>([]);

    const loadConcerts = async () => {
        const res = await fetch(`${API_BASE}/concerts`, { cache: 'no-store' });
        setConcerts(await res.json());
    };

    useEffect(() => { loadConcerts(); }, []);

    const handleCreate = async () => {
        const res = await fetch(`${API_BASE}/admin/concerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, total_seats: totalSeats }),
        });
        if (res.ok) {
            setMessage('콘서트 생성 완료!');
            loadConcerts();
        }
    };

    const handleReset = async () => {
        await fetch(`${API_BASE}/admin/concerts/reset`, { method: 'POST' });
        setMessage('데이터 초기화 완료!');
        loadConcerts();
    };

    return (
        <main className="max-w-2xl mx-auto p-8">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 홈으로</Link>
            <h1 className="text-2xl font-bold mt-4 mb-6">Admin</h1>

            <div className="space-y-4 p-6 border rounded-lg mb-8">
                <h2 className="text-lg font-semibold">콘서트 등록</h2>
                <input value={name} onChange={e => setName(e.target.value)}
                       className="w-full p-2 border rounded" placeholder="콘서트 이름" />
                <input value={date} onChange={e => setDate(e.target.value)}
                       className="w-full p-2 border rounded" placeholder="날짜" />
                <input type="number" value={totalSeats} onChange={e => setTotalSeats(Number(e.target.value))}
                       className="w-full p-2 border rounded" placeholder="총 좌석수" />
                <div className="flex gap-2">
                    <button onClick={handleCreate} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">생성</button>
                    <button onClick={handleReset} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">전체 초기화</button>
                </div>
                {message && <p className="text-green-500">{message}</p>}
            </div>

            <div className="space-y-2">
                <h2 className="text-lg font-semibold">등록된 콘서트</h2>
                {concerts.map(c => (
                    <div key={c.id} className="p-4 border rounded flex justify-between items-center">
                        <div>
                            <span className="font-medium">{c.name}</span>
                            <span className="text-gray-400 ml-2">{c.date}</span>
                        </div>
                        <span className="text-sm">
                            {c.available_seats}/{c.total_seats}석 남음
                        </span>
                    </div>
                ))}
                {concerts.length === 0 && <p className="text-gray-400">없음</p>}
            </div>
        </main>
    );
}

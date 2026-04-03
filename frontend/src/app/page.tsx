'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchConcerts, Concert } from '@/lib/api';

export default function Home() {
    const [concerts, setConcerts] = useState<Concert[]>([]);

    useEffect(() => {
        fetchConcerts().then(setConcerts);
    }, []);

    return (
        <main className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-2">🎵 Concert Tickets</h1>
            <p className="text-gray-500 mb-8">V1 — Naive (No Lock, No Queue)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {concerts.map(c => (
                    <Link key={c.id} href={`/concert/${c.id}`}
                          className="block p-6 border rounded-lg hover:shadow-lg transition">
                        <h2 className="text-xl font-semibold">{c.name}</h2>
                        <p className="text-gray-500">{c.date}</p>
                        <div className="mt-4 flex justify-between">
                            <span>잔여 {c.available_seats}/{c.total_seats}석</span>
                            <span className={c.available_seats === 0 ? 'text-red-500' : 'text-green-500'}>
                                {c.available_seats === 0 ? '매진' : '예매 가능'}
                            </span>
                        </div>
                    </Link>
                ))}
                {concerts.length === 0 && (
                    <p className="text-gray-400 col-span-2 text-center py-12">
                        등록된 콘서트가 없습니다. <Link href="/admin" className="text-blue-500 underline">관리자 페이지</Link>에서 등록하세요.
                    </p>
                )}
            </div>
            <div className="mt-8 text-center">
                <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">Admin →</Link>
            </div>
        </main>
    );
}

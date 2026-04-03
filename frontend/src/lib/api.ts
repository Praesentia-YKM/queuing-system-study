const API_BASE = 'http://localhost:8080/api';

export interface Concert {
    id: number;
    name: string;
    date: string;
    total_seats: number;
    available_seats: number;
}

export interface ReservationResponse {
    id: number;
    concert_id: number;
    user_id: string;
    seat_no: number;
    status: string;
}

export async function fetchConcerts(): Promise<Concert[]> {
    const res = await fetch(`${API_BASE}/concerts`, { cache: 'no-store' });
    return res.json();
}

export async function fetchConcert(id: number): Promise<Concert> {
    const res = await fetch(`${API_BASE}/concerts/${id}`, { cache: 'no-store' });
    return res.json();
}

export async function reserve(concertId: number, userId: string, seatNo: number): Promise<ReservationResponse> {
    const res = await fetch(`${API_BASE}/concerts/${concertId}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, seat_no: seatNo }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
    }
    return res.json();
}

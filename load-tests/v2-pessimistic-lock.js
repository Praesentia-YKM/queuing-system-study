import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const successCount = new Counter('reservations_success');
const failCount = new Counter('reservations_fail');
const soldOutCount = new Counter('reservations_sold_out');
const duplicateCount = new Counter('reservations_duplicate');
const timeoutCount = new Counter('reservations_timeout');
const reserveDuration = new Trend('reserve_duration');

export const options = {
    scenarios: {
        spike: {
            executor: 'shared-iterations',
            vus: 50,
            iterations: 500,
            maxDuration: '120s',
        },
    },
};

export function setup() {
    http.post('http://localhost:8080/api/admin/concerts/reset');

    const res = http.post('http://localhost:8080/api/admin/concerts',
        JSON.stringify({ name: 'V2 Pessimistic Lock Test Concert', date: '2026-12-25', total_seats: 100 }),
        { headers: { 'Content-Type': 'application/json' } }
    );
    const concert = JSON.parse(res.body);
    console.log(`Setup: concert id=${concert.id}, totalSeats=${concert.total_seats}`);
    return concert;
}

export default function (data) {
    const concertId = data.id;
    const seatNo = Math.floor(Math.random() * 100) + 1;
    const userId = `user-${__VU}-${__ITER}`;

    const res = http.post(
        `http://localhost:8080/api/concerts/${concertId}/reserve`,
        JSON.stringify({ user_id: userId, seat_no: seatNo }),
        { headers: { 'Content-Type': 'application/json' }, timeout: '30s' }
    );

    reserveDuration.add(res.timings.duration);

    if (res.status === 200) {
        successCount.add(1);
    } else if (res.status === 500) {
        failCount.add(1);
        const body = res.body ? res.body.toString() : '';
        if (body.includes('매진')) {
            soldOutCount.add(1);
        } else if (body.includes('이미 예매된')) {
            duplicateCount.add(1);
        } else if (body.includes('timeout') || body.includes('connection')) {
            timeoutCount.add(1);
        }
    } else {
        failCount.add(1);
    }
}

export function teardown(data) {
    const res = http.get(`http://localhost:8080/api/concerts/${data.id}`);
    const concert = JSON.parse(res.body);

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   V2 PESSIMISTIC LOCK LOAD TEST RESULTS   ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  Total Seats:       ${String(concert.total_seats).padStart(15)} ║`);
    console.log(`║  Available Seats:   ${String(concert.available_seats).padStart(15)} ║`);
    console.log(`║  Reserved (calc):   ${String(concert.total_seats - concert.available_seats).padStart(15)} ║`);
    console.log('╠══════════════════════════════════════════╣');

    if (concert.available_seats < 0) {
        console.log(`║  ⚠️  OVERBOOKING: ${Math.abs(concert.available_seats)} seats oversold!`);
    } else if (concert.available_seats === 0) {
        console.log('║  ✅ SOLD OUT — No overbooking            ║');
    } else {
        console.log(`║  ℹ️  ${concert.available_seats} seats remaining (not all sold)  ║`);
    }
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
}

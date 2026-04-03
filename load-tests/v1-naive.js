import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const successCount = new Counter('reservations_success');
const failCount = new Counter('reservations_fail');
const reserveDuration = new Trend('reserve_duration');

export const options = {
    scenarios: {
        spike: {
            executor: 'shared-iterations',
            vus: 50,
            iterations: 500,
            maxDuration: '60s',
        },
    },
};

export function setup() {
    http.post('http://localhost:8080/api/admin/concerts/reset');

    const res = http.post('http://localhost:8080/api/admin/concerts',
        JSON.stringify({ name: 'V1 Load Test Concert', date: '2026-12-25', total_seats: 100 }),
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
        { headers: { 'Content-Type': 'application/json' } }
    );

    reserveDuration.add(res.timings.duration);

    if (res.status === 200) {
        successCount.add(1);
    } else {
        failCount.add(1);
    }
}

export function teardown(data) {
    const res = http.get(`http://localhost:8080/api/concerts/${data.id}`);
    const concert = JSON.parse(res.body);
    const reservedCount = concert.total_seats - concert.available_seats;

    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║      V1 NAIVE LOAD TEST RESULTS      ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Total Seats:       ${String(concert.total_seats).padStart(15)} ║`);
    console.log(`║  Available Seats:   ${String(concert.available_seats).padStart(15)} ║`);
    console.log(`║  Reserved (DB):     ${String(reservedCount).padStart(15)} ║`);
    console.log('╠══════════════════════════════════════╣');

    if (reservedCount > concert.total_seats) {
        console.log(`║  ⚠️  OVERBOOKING: ${reservedCount - concert.total_seats} seats oversold!     ║`);
    } else if (concert.available_seats < 0) {
        console.log(`║  ⚠️  NEGATIVE SEATS: ${Math.abs(concert.available_seats)} oversold!    ║`);
    } else {
        console.log('║  No overbooking detected             ║');
        console.log('║  (but same seat may have multiple    ║');
        console.log('║   reservations - check DB)           ║');
    }
    console.log('╚══════════════════════════════════════╝');
    console.log('');
}

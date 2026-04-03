import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const successCount = new Counter('reservations_success');
const failCount = new Counter('reservations_fail');

export const options = {
    scenarios: {
        spike: {
            executor: 'shared-iterations',
            vus: 200,
            iterations: 1000,
            maxDuration: '30s',
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
    console.log(`Created concert: id=${concert.id}, seats=${concert.total_seats}`);
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

    if (res.status === 200) {
        successCount.add(1);
    } else {
        failCount.add(1);
    }
}

export function teardown(data) {
    const res = http.get(`http://localhost:8080/api/concerts/${data.id}`);
    const concert = JSON.parse(res.body);
    console.log('\n========================================');
    console.log('  V1 NAIVE LOAD TEST RESULTS');
    console.log('========================================');
    console.log(`  Total Seats:      ${concert.total_seats}`);
    console.log(`  Available Seats:  ${concert.available_seats}`);
    console.log(`  Reservations:     ${concert.total_seats - concert.available_seats}`);
    console.log('========================================');
    if (concert.available_seats < 0) {
        console.log('  ⚠️  OVERBOOKING DETECTED!');
        console.log(`  ${Math.abs(concert.available_seats)} seats oversold`);
    }
    console.log('========================================\n');
}

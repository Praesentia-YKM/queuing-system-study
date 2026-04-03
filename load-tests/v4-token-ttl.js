import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const enqueueSuccess = new Counter('enqueue_success');
const tokenIssued = new Counter('token_issued');
const reserveSuccess = new Counter('reserve_success');
const reserveFail = new Counter('reserve_fail');
const tokenExpired = new Counter('token_expired');
const pollCount = new Counter('poll_requests');
const enqueueDuration = new Trend('enqueue_duration');
const tokenWaitDuration = new Trend('token_wait_duration');
const reserveDuration = new Trend('reserve_with_token_duration');
const totalDuration = new Trend('total_duration');

export const options = {
    scenarios: {
        spike: {
            executor: 'shared-iterations',
            vus: 50,
            iterations: 500,
            maxDuration: '180s',
        },
    },
};

export function setup() {
    http.post('http://localhost:8080/api/admin/concerts/reset');
    sleep(1);

    const res = http.post('http://localhost:8080/api/admin/concerts',
        JSON.stringify({ name: 'V4 Token TTL Test Concert', date: '2026-12-25', total_seats: 100 }),
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
    const startTime = Date.now();

    const enqueueRes = http.post(
        `http://localhost:8080/api/queue/concerts/${concertId}/enqueue`,
        JSON.stringify({ user_id: userId, seat_no: seatNo }),
        { headers: { 'Content-Type': 'application/json' } }
    );

    enqueueDuration.add(enqueueRes.timings.duration);

    if (enqueueRes.status !== 200) {
        reserveFail.add(1);
        return;
    }
    enqueueSuccess.add(1);

    let token = null;
    let maxPolls = 100;
    let pollInterval = 0.3;

    for (let i = 0; i < maxPolls; i++) {
        sleep(pollInterval);
        pollCount.add(1);

        const statusRes = http.get(
            `http://localhost:8080/api/queue/concerts/${concertId}/status?userId=${userId}&seatNo=${seatNo}`
        );

        if (statusRes.status === 200) {
            const body = JSON.parse(statusRes.body);

            if (body.status === 'TOKEN_ISSUED') {
                token = body.token;
                tokenIssued.add(1);
                tokenWaitDuration.add(Date.now() - startTime);
                break;
            } else if (body.status === 'FAIL') {
                reserveFail.add(1);
                totalDuration.add(Date.now() - startTime);
                return;
            }
        }
    }

    if (!token) {
        reserveFail.add(1);
        totalDuration.add(Date.now() - startTime);
        return;
    }

    const reserveRes = http.post(
        `http://localhost:8080/api/queue/concerts/${concertId}/reserve-with-token`,
        JSON.stringify({ user_id: userId, seat_no: seatNo, token: token }),
        { headers: { 'Content-Type': 'application/json' } }
    );

    reserveDuration.add(reserveRes.timings.duration);

    if (reserveRes.status === 200) {
        const body = JSON.parse(reserveRes.body);
        if (body.status === 'SUCCESS') {
            reserveSuccess.add(1);
        } else {
            reserveFail.add(1);
            if (body.message && body.message.includes('토큰')) {
                tokenExpired.add(1);
            }
        }
    } else {
        reserveFail.add(1);
    }

    totalDuration.add(Date.now() - startTime);
}

export function teardown(data) {
    sleep(8);

    const res = http.get(`http://localhost:8080/api/concerts/${data.id}`);
    const concert = JSON.parse(res.body);
    const queueRes = http.get(`http://localhost:8080/api/queue/concerts/${data.id}/queue-info`);
    const queueInfo = JSON.parse(queueRes.body);

    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║    V4 TOKEN + TTL LOAD TEST RESULTS               ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Total Seats:       ${String(concert.total_seats).padStart(15)} ║`);
    console.log(`║  Available Seats:   ${String(concert.available_seats).padStart(15)} ║`);
    console.log(`║  Reserved (calc):   ${String(concert.total_seats - concert.available_seats).padStart(15)} ║`);
    console.log(`║  Queue Remaining:   ${String(queueInfo.queue_size).padStart(15)} ║`);
    console.log(`║  Active Tokens:     ${String(queueInfo.active_tokens).padStart(15)} ║`);
    console.log('╠══════════════════════════════════════════════════╣');

    if (concert.available_seats < 0) {
        console.log(`║  ⚠️  OVERBOOKING: ${Math.abs(concert.available_seats)} seats oversold!`);
    } else if (concert.available_seats === 0) {
        console.log('║  ✅ SOLD OUT — No overbooking                       ║');
    } else {
        console.log(`║  ℹ️  ${concert.available_seats} seats remaining`);
    }
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
}

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const enqueueSuccess = new Counter('enqueue_success');
const reserveSuccess = new Counter('reserve_success');
const reserveFail = new Counter('reserve_fail');
const pollCount = new Counter('poll_requests');
const enqueueDuration = new Trend('enqueue_duration');
const totalDuration = new Trend('total_duration');

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
    sleep(1);

    const res = http.post('http://localhost:8080/api/admin/concerts',
        JSON.stringify({ name: 'V3 Redis Queue Test Concert', date: '2026-12-25', total_seats: 100 }),
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

    let maxPolls = 50;
    let pollInterval = 0.2;
    let finalStatus = 'TIMEOUT';

    for (let i = 0; i < maxPolls; i++) {
        sleep(pollInterval);
        pollCount.add(1);

        const statusRes = http.get(
            `http://localhost:8080/api/queue/concerts/${concertId}/status?userId=${userId}&seatNo=${seatNo}`
        );

        if (statusRes.status === 200) {
            const body = JSON.parse(statusRes.body);
            if (body.status === 'SUCCESS') {
                reserveSuccess.add(1);
                finalStatus = 'SUCCESS';
                break;
            } else if (body.status === 'FAIL') {
                reserveFail.add(1);
                finalStatus = 'FAIL';
                break;
            }
        }
    }

    totalDuration.add(Date.now() - startTime);

    if (finalStatus === 'TIMEOUT') {
        reserveFail.add(1);
    }
}

export function teardown(data) {
    sleep(5);

    const res = http.get(`http://localhost:8080/api/concerts/${data.id}`);
    const concert = JSON.parse(res.body);
    const queueRes = http.get(`http://localhost:8080/api/queue/concerts/${data.id}/queue-info`);
    const queueInfo = JSON.parse(queueRes.body);

    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║    V3 REDIS QUEUE LOAD TEST RESULTS           ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Total Seats:       ${String(concert.total_seats).padStart(15)} ║`);
    console.log(`║  Available Seats:   ${String(concert.available_seats).padStart(15)} ║`);
    console.log(`║  Reserved (calc):   ${String(concert.total_seats - concert.available_seats).padStart(15)} ║`);
    console.log(`║  Queue Remaining:   ${String(queueInfo.queue_size).padStart(15)} ║`);
    console.log('╠══════════════════════════════════════════════╣');

    if (concert.available_seats < 0) {
        console.log(`║  ⚠️  OVERBOOKING: ${Math.abs(concert.available_seats)} seats oversold!`);
    } else if (concert.available_seats === 0) {
        console.log('║  ✅ SOLD OUT — No overbooking                  ║');
    } else {
        console.log(`║  ℹ️  ${concert.available_seats} seats remaining                       ║`);
    }
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
}

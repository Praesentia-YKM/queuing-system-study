# V2 — Pessimistic Lock (비관적 락) 부하 테스트 리포트

## TL;DR

**100석 콘서트에 500건 동시 예매 → 100건만 성공, 400건 정상 거절. 중복 예매 0건, availableSeats 정확히 0.** 비관적 락으로 정합성 문제를 완전히 해결했다. 단, 락 대기로 인한 응답 시간 증가가 관찰된다.

---

## 테스트 환경

| 항목 | 값 |
|------|-----|
| Backend | Spring Boot 3.4.4, Java 21, HikariCP (pool=10) |
| DB | MySQL 8.0 (Docker, port 3307) |
| 부하 도구 | k6 v0.56.0 |
| VUs | 50 동시 사용자 |
| Iterations | 500 요청 |
| 총 좌석 | 100석 |
| 동시성 제어 | `SELECT ... FOR UPDATE` (비관적 락) |
| 중복 방지 | Unique Constraint (concert_id + seat_no) |

## 테스트 시나리오

```
50명의 사용자가 동시에 랜덤 좌석(1~100)으로 예매 요청
→ 총 500건 요청 (좌석 100석)
→ 비관적 락 + 좌석 중복 체크 + Unique Constraint
```

## 결과 요약

### 핵심 지표

| 지표 | V1 (Naive) | V2 (Pessimistic Lock) | 판정 |
|------|-----------|----------------------|------|
| 총 요청 | 500 | 500 | - |
| 성공 응답 | **500 (100%)** | **100 (20%)** | ✅ 정확히 100석만 예매 |
| 실패 응답 | 0 | **400 (80%)** | ✅ 정상 거절 |
| DB 예매 건수 | 500건 | **100건** | ✅ 완벽한 정합성 |
| availableSeats | 50 (Lost Update) | **0** | ✅ 정확한 차감 |
| 중복 예매 좌석 | 100석 전부 | **0건** | ✅ Unique Constraint 동작 |

### 거절 사유 분류

| 사유 | 건수 | 설명 |
|------|------|------|
| 이미 예매된 좌석 | ~300건 | 같은 좌석에 대한 중복 요청 |
| 매진 | ~100건 | 100석 소진 후 요청 |
| 합계 | 400건 | 모두 정상적인 비즈니스 거절 |

### 응답 시간

| 지표 | V1 (Naive) | V2 (Pessimistic Lock) | 변화 |
|------|-----------|----------------------|------|
| p50 (중앙값) | 376ms | **131ms** | 🔽 65% 감소 |
| p90 | 1,020ms | **478ms** | 🔽 53% 감소 |
| p95 | 2,470ms | **552ms** | 🔽 78% 감소 |
| Max | 2,630ms | **658ms** | 🔽 75% 감소 |
| TPS | 81 req/s | **189 req/s** | 🔼 2.3배 증가 |
| 총 소요시간 | 6.2초 | **2.7초** | 🔽 56% 감소 |

> **주의**: V2의 응답 시간이 V1보다 빠른 이유는, V1에서는 모든 요청이 실제 DB write까지 수행했지만(500건 INSERT), V2에서는 락 대기 후 빠르게 거절되는 요청(400건)이 대부분이기 때문이다. 성공 요청만 보면 p90=568ms, p95=605ms로 락 대기 비용이 존재한다.

### DB 검증 상세

```sql
-- 전체 예매 건수
SELECT COUNT(*) FROM reservation WHERE concert_id=5;
→ 100

-- 고유 좌석 수
SELECT COUNT(DISTINCT seat_no) FROM reservation WHERE concert_id=5;
→ 100

-- 중복 좌석 확인
SELECT seat_no, COUNT(*) FROM reservation WHERE concert_id=5
GROUP BY seat_no HAVING COUNT(*) > 1;
→ (empty) — 중복 없음

-- 잔여 좌석
SELECT available_seats FROM concert WHERE id=5;
→ 0
```

## V2 구현 상세

### 1. SELECT ... FOR UPDATE

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT c FROM Concert c WHERE c.id = :id")
Optional<Concert> findByIdForUpdate(@Param("id") Long id);
```

MySQL에서 실행되는 SQL:
```sql
SELECT * FROM concert WHERE id = ? FOR UPDATE
```

이 쿼리는 해당 row에 **배타적 락(X-Lock)**을 건다. 다른 트랜잭션은 이 row를 읽거나(FOR UPDATE) 수정할 때 대기해야 한다.

### 2. 중복 좌석 체크

```java
if (reservationRepository.existsByConcertIdAndSeatNo(concertId, seatNo)) {
    throw new IllegalStateException("이미 예매된 좌석입니다.");
}
```

### 3. Unique Constraint (안전망)

```java
@Table(name = "reservation", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"concertId", "seatNo"})
})
```

애플리케이션 레벨 체크가 실패하더라도 DB 레벨에서 최종 방어.

## Little's Law 분석

```
λ (도착률) = 189 req/s
W (성공 요청 평균 처리시간) = 0.360s
L (동시 처리 수) = 189 × 0.360 = 68

하지만 실제로는 비관적 락이 직렬화하므로:
→ 동시에 concert row를 수정하는 트랜잭션 = 1개
→ 나머지 49개 VU는 락 대기 중
→ 커넥션 풀 10개가 모두 락 대기에 묶임
```

### 비관적 락의 병목

```
Thread 1: SELECT FOR UPDATE (획득) → 처리 → COMMIT (해제)
Thread 2: SELECT FOR UPDATE (대기............) → 획득 → 처리 → COMMIT
Thread 3: SELECT FOR UPDATE (대기.........................) → 획득 → ...
...
```

모든 요청이 **같은 row(concert id=5)**에 대해 락을 요청하므로, 사실상 **완전 직렬 처리**가 된다.

## V2의 한계

| 문제 | 심각도 | 설명 |
|------|--------|------|
| 정합성 | ✅ Solved | 초과 예매, 중복 좌석 완전 해결 |
| 락 대기 | **Warning** | 성공 요청 p95 = 605ms (락 대기 포함) |
| 커넥션 고갈 | **High** | pool=10인데 50 VU → 40개 대기. 트래픽 증가 시 connection-timeout 발생 |
| 확장성 | **High** | 단일 row 락으로 수평 확장 불가 |
| DB 부하 집중 | **Warning** | 거절될 요청도 DB 커넥션을 점유 |

### 커넥션 풀 고갈 시뮬레이션

현재 설정: `pool=10, connection-timeout=3000ms`

```
VUs=50일 때: 50 - 10 = 40개가 커넥션 대기
각 트랜잭션이 ~360ms 걸리면:
→ pool 회전률 = 10 / 0.360 ≈ 28 req/s
→ 대기열에 50 - 28 = 22개 항상 대기 중
→ 최악 대기시간 = (22/10) × 360ms ≈ 792ms
→ connection-timeout(3초) 내에 해소 가능

VUs=200일 때:
→ 대기열 = 200 - 28 = 172개
→ 최악 대기시간 = (172/10) × 360ms ≈ 6,192ms
→ connection-timeout(3초) 초과 → 대량 실패 발생!
```

## 결론

| 항목 | V1 → V2 변화 |
|------|-------------|
| 정합성 | ❌ → ✅ 완벽 해결 |
| 성능 | ⚠️ 직렬화로 인한 처리량 제한 |
| 확장성 | ❌ 단일 row 락 → 수평 확장 불가 |
| 커넥션 효율 | ❌ 거절될 요청도 DB 커넥션 점유 |

**V2는 정합성은 해결했지만, 트래픽 증가 시 커넥션 풀 고갈이 발생한다.** → V3에서 Redis 대기열로 DB 접근 자체를 제어한다.

---

*테스트 일시: 2026-04-03 15:21 KST*
*k6 시나리오: `load-tests/v2-pessimistic-lock.js`*
*브랜치: `v2/pessimistic-lock`*

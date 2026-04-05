# 🎫 Concert Queue Evolution

**선착순 콘서트 티켓 예매 시스템 — 동시성 문제를 단계적으로 해결하는 과정**

> 500명이 동시에 100석을 예매하면 무슨 일이 벌어질까?  
> V1(무방비)부터 V4(토큰+TTL)까지, 실패에서 출발해 안전한 시스템으로 진화하는 여정.

---

## 프로젝트 구조

```
queue-system-evolution/
├── backend/          # Spring Boot 3.4.4 + Java 21
│   └── src/main/java/com/evolution/queue/
│       ├── api/          # REST Controllers + DTO
│       ├── config/       # CORS, Redis 설정
│       ├── domain/       # Concert, Reservation 엔티티
│       └── service/      # 예매, 대기열, 토큰, 스케줄러
├── frontend/         # Next.js 14 (토스 스타일 UI)
│   └── src/app/
│       ├── page.tsx          # 콘서트 목록
│       ├── concert/[id]/     # 좌석 선택 + 예매
│       └── admin/            # 관리자 페이지
├── docker/           # MySQL 8.0 + Redis 7.0
├── load-tests/       # k6 부하 테스트 시나리오 (V1~V4)
└── docs/             # 블로그, PR 문서
```

---

## 버전별 브랜치

| 브랜치 | 전략 | 핵심 키워드 | 결과 (50VU × 500req → 100석) |
|--------|------|-------------|------------------------------|
| [`v1/naive`](../../tree/v1/naive) | 없음 | Lost Update | ❌ 46번 좌석에 10명 중복 예매 |
| [`v2/pessimistic-lock`](../../tree/v2/pessimistic-lock) | 비관적 락 | `SELECT FOR UPDATE` | ✅ 정확히 100건, 400건 거절 |
| [`v3/redis-queue`](../../tree/v3/redis-queue) | Redis 대기열 | Sorted Set + Scheduler | ✅ 100건 + 서버 부하 분산 |
| [`v4/token-ttl`](../../tree/v4/token-ttl) | 토큰 + TTL | 30초 자동 만료 | ✅ 100건 + 이탈자 자동 정리 |

---

## 각 버전 상세

### V1 — Naive (동시성 제어 없음)

**문제:** `available_seats -= 1` 을 락 없이 실행 → 50개 스레드가 동시에 같은 값을 읽고 덮어씀

```
Thread A: SELECT available_seats → 99
Thread B: SELECT available_seats → 99  (같은 값!)
Thread A: UPDATE SET available_seats = 98
Thread B: UPDATE SET available_seats = 98  (A의 업데이트 소실)
```

**k6 결과:**
- 500건 전부 HTTP 200 OK (에러 로그 0줄)
- 하지만 DB에 150+건 예매, 46번 좌석에 10명 중복
- **서버 응답 ≠ 데이터 정합성**

### V2 — Pessimistic Lock (비관적 락)

**해결:** `SELECT ... FOR UPDATE` + 좌석별 Unique Constraint

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT c FROM Concert c WHERE c.id = :id")
Optional<Concert> findByIdWithLock(@Param("id") Long id);
```

**k6 결과:**
- 100건 성공, 400건 `409 CONFLICT` 정확히 거절
- 평균 응답: 245ms, p95: 1.2s
- **트레이드오프:** DB 커넥션 점유 시간 증가 (HikariCP pool=10 → 대기 발생)

### V3 — Redis Queue (대기열)

**해결:** Redis Sorted Set (score=timestamp) + Spring Scheduler (200ms, batch=5)

```
Client → Redis ZADD (즉시 응답) → Scheduler가 5건씩 꺼내서 DB 처리
```

**k6 결과:**
- 500건 전부 대기열 등록 성공 (즉시 응답)
- DB는 스케줄러가 순차 처리 → 커넥션 경합 제거
- **트레이드오프:** 실시간 확정이 아닌 비동기 처리 → 폴링 필요

### V4 — Token + TTL (입장 토큰)

**해결:** 대기열에서 입장 시 30초 TTL 토큰 발급, 만료 시 자동 해제

```
대기 → 토큰 발급(30s TTL) → 예매 완료 or 만료 → 다음 사람에게 기회
```

**k6 결과:**
- 최대 동시 활성 토큰 10개 제한
- 이탈자(토큰 만료) 자동 정리 → 좌석 잠김 방지
- **트레이드오프:** 토큰 유효기간(30s) 설정이 UX에 영향

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Spring Boot 3.4.4, Java 21, Spring Data JPA, Spring Data Redis |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Database | MySQL 8.0 (HikariCP pool=10) |
| Cache/Queue | Redis 7.0 (Sorted Set, String with TTL) |
| Load Test | k6 (50 VUs, 500 iterations) |
| Infra | Docker Compose |

---

## 실행 방법

### 1. 인프라 실행

```bash
docker-compose -f docker/docker-compose.yml up -d
```

MySQL: `localhost:3307`, Redis: `localhost:6379`

### 2. 백엔드 실행

```bash
cd backend
./gradlew bootRun
```

서버: `http://localhost:8080`

### 3. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:3000`

### 4. 부하 테스트

```bash
# V1 — Lost Update 증명
k6 run load-tests/v1-naive.js

# V2 — 비관적 락 검증
k6 run load-tests/v2-pessimistic-lock.js

# V3 — Redis 대기열 검증
k6 run load-tests/v3-redis-queue.js

# V4 — 토큰 + TTL 검증
k6 run load-tests/v4-token-ttl.js
```

---

## API 엔드포인트

### 예매 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/concerts` | 콘서트 목록 |
| GET | `/api/concerts/{id}` | 콘서트 상세 (좌석 현황) |
| POST | `/api/concerts/{id}/reserve` | 좌석 예매 (V1/V2 직접 처리) |

### 대기열 API (V3/V4)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/queue/concerts/{id}/enqueue` | 대기열 등록 |
| GET | `/api/queue/concerts/{id}/status` | 대기 상태 조회 |
| GET | `/api/queue/concerts/{id}/queue-info` | 대기열 전체 현황 |

### 관리자 API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/admin/concerts` | 콘서트 생성 |
| POST | `/api/admin/concerts/reset` | 전체 데이터 초기화 |

---

## 핵심 설정

```yaml
# backend/src/main/resources/application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10      # 의도적으로 작게 설정 (V2 병목 시연)
      connection-timeout: 3000   # 3초 내 커넥션 못 잡으면 실패
  data:
    redis:
      host: localhost
      port: 6379
```

HikariCP pool=10은 의도적 설정입니다. V2에서 50VU가 동시 요청 시 DB 커넥션 대기가 발생하는 것을 보여주기 위함이며, V3에서 Redis 대기열로 이 병목을 해소하는 과정을 보여줍니다.

---

## 교훈

> 서버가 200을 응답하는 것과, 데이터가 맞는 것은 전혀 다른 이야기다.  
> 확인하지 않으면 모른다. 진짜로.

---

## License

MIT

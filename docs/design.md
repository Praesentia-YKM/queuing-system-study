# 선착순 콘서트 티켓 예매 시스템 — 진화적 설계

## 개요

대기열 시스템이 **왜 필요한지**를 가장 원시적인 구현(V1)부터 시작해서 단계적으로 체감하고,
각 단계의 문제점을 **수치(k6 부하 테스트)**로 기록하며 개선해나가는 프로젝트.

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Spring Boot 3.x, Java 21, JPA, MySQL 8.0 |
| Frontend | Next.js 14 (App Router) |
| Cache/Queue | Redis 7.0 |
| Load Test | k6 |
| Infra | Docker Compose |

## 도메인

**콘서트 티켓 예매** — 100석 한정, 선착순 마감

### 핵심 엔티티
- `Concert` — id, name, date, totalSeats, availableSeats
- `Reservation` — id, concertId, userId, seatNo, status(RESERVED/CANCELLED), createdAt

---

## 진화 로드맵

### V1 — "그냥 만들면 되지" (Naive)

**구현**: 동시 요청이 직접 DB를 때림. 락 없음, 큐 없음.

```java
Concert concert = concertRepository.findById(concertId);
if (concert.getAvailableSeats() <= 0) throw ...;
concert.decreaseAvailableSeats();
reservationRepository.save(...);
```

**체감할 문제**: 100석인데 120명 예매 성공 (초과 예매), 같은 좌석 중복 예매

**API**:
- `GET /api/concerts` — 목록
- `GET /api/concerts/{id}` — 상세
- `POST /api/concerts/{id}/reserve` — 예매

---

### V2 — "락을 걸면 되잖아" (Pessimistic Lock)

**변경**: `SELECT ... FOR UPDATE` 추가

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT c FROM Concert c WHERE c.id = :id")
Concert findByIdForUpdate(Long id);
```

**해결**: 초과 예매 0건
**새로운 문제**: 1000명이 한 행 대기 → DB 커넥션 풀 고갈 → p99 10초+, 대부분 timeout

**Little's Law 적용**:
```
λ=1000, W=0.2초 → L=200 (필요 커넥션)
실제 Pool=10 → 부족 190 → timeout 폭주
이론 Max TPS = 10 / 0.2 = 50 TPS
```

---

### V3 — "DB 앞에 줄을 세우자" (Redis Queue)

**추가 API**:
- `POST /api/queue/enter` — 대기열 진입
- `GET /api/queue/position` — 순번 조회 (Polling)
- `GET /api/queue/status` — 입장 가능 여부

**Redis 구조**:
```
ZADD queue:concert:1  <timestamp>  "user-42"    # 대기열 (Sorted Set)
SADD active:concert:1  "user-42"                 # 입장 허용 (Set)
```

**스케줄러**: 3초 주기, 대기열에서 N명 꺼내서 active Set으로 이동

**배치 크기 산정**:
```
Pool=10, W_db=0.2초, Interval=3초
→ 커넥션당 처리량 = 3/0.2 = 15건
→ 10 × 15 = 150건, 안전계수 0.7 → N=105
→ 보수적 시작: N=50
```

**해결**: 커넥션 풀 안전, p99 200ms
**새로운 문제**: 이탈 유저 좌석 점유, Polling 트래픽 (초당 333건)

---

### V4 — "토큰으로 관리하자" (Token + TTL)

**변경**: active Set → 토큰 with TTL

```
SET token:concert:1:user-42 "{...}" EX 180
```

**TTL 산정**:
```
W_reservation=60초, safety=2x, UX_buffer=60초
→ TTL = 60×2 + 60 = 180초 (3분)
```

**스케줄러 변경**: 현재 active 토큰 수를 세고, 빈 자리만큼만 추가 입장

**해결**: 이탈 유저 자동 만료, 처리량 제어

---

## 용량 산정 공식

### 1. Little's Law
```
L = λ × W
L=동시 요청 수, λ=초당 도착률, W=평균 처리 시간
```

### 2. 커넥션 풀
```
Pool Size = λ × W_db + margin(20~30%)
```

### 3. 스케줄러 배치
```
Batch = Pool / W_db × Interval × safety(0.6~0.7)
```

### 4. 토큰 TTL
```
TTL = W_reservation × safety(1.5~2x) + UX_buffer
```

### 5. 처리량 상한
```
Max TPS = min(App Thread Pool, DB Pool, Redis OPS) / W_total
```

---

## 측정 지표 (k6 리포트)

| 지표 | V1 | V2 | V3 | V4 |
|------|-----|-----|-----|-----|
| 초과 예매 | 20~50건 | 0건 | 0건 | 0건 |
| 성공률 | 100%(초과포함) | 10~15% | 95%+ | 98%+ |
| p99 응답 | 300ms | 10,000ms+ | 200ms | 150ms |
| DB 커넥션 고갈 | 없음 | 심각 | 없음 | 없음 |
| 이탈 유저 처리 | - | - | 못함 | TTL 자동만료 |

---

## 프로젝트 구조

```
queue-system-evolution/
├── backend/                  # Spring Boot
├── frontend/                 # Next.js 14
├── load-tests/               # k6 시나리오
├── docs/                     # 단계별 리포트
└── docker/                   # MySQL, Redis
```

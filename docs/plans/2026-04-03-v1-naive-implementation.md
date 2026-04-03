# V1 — Naive 콘서트 예매 시스템 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 락 없이 동시 요청을 직접 처리하는 가장 순진한 예매 시스템을 구축하고, 부하 테스트로 초과 예매 문제를 수치로 증명한다.

**Architecture:** Spring Boot REST API + Next.js 14 SPA. JPA로 MySQL 직접 접근, 동시성 제어 없음. 의도적으로 race condition이 발생하도록 설계.

**Tech Stack:** Java 21, Spring Boot 3.4, JPA/Hibernate, MySQL 8.0, Next.js 14 (App Router), Tailwind CSS, Docker Compose, k6

---

## Task 1: 프로젝트 스캐폴딩 — Backend

**Files:**
- Create: `backend/build.gradle`
- Create: `backend/settings.gradle`
- Create: `backend/src/main/java/com/evolution/queue/QueueEvolutionApplication.java`
- Create: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/resources/application-test.yml`
- Create: `docker/docker-compose.yml`

**Step 1: Docker Compose 작성 (MySQL)**

```yaml
# docker/docker-compose.yml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: queue_evolution
    ports:
      - "3307:3306"
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

**Step 2: Gradle 프로젝트 초기화**

```groovy
// backend/build.gradle
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.4.4'
    id 'io.spring.dependency-management' version '1.1.7'
}

group = 'com.evolution'
version = '0.0.1'
sourceCompatibility = '21'

repositories { mavenCentral() }

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    runtimeOnly 'com.mysql:mysql-connector-j'
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'

    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testRuntimeOnly 'com.mysql:mysql-connector-j'
}

tasks.named('test') { useJUnitPlatform() }
```

```groovy
// backend/settings.gradle
rootProject.name = 'queue-evolution-backend'
```

**Step 3: Application 클래스 + 설정**

```java
// QueueEvolutionApplication.java
package com.evolution.queue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class QueueEvolutionApplication {
    public static void main(String[] args) {
        SpringApplication.run(QueueEvolutionApplication.class, args);
    }
}
```

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3307/queue_evolution?useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: root
    hikari:
      maximum-pool-size: 10
      connection-timeout: 3000
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.MySQLDialect
  jackson:
    property-naming-strategy: SNAKE_CASE

server:
  port: 8080
```

```yaml
# application-test.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3307/queue_evolution_test?useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: root
  jpa:
    hibernate:
      ddl-auto: create-drop
```

**Step 4: Docker 실행 후 애플리케이션 기동 확인**

Run: `cd C:/ALLSP/queue-system-evolution && docker-compose -f docker/docker-compose.yml up -d`
Run: `cd backend && ./gradlew bootRun`
Expected: 8080 포트에서 정상 기동

**Step 5: Commit**

```bash
git init && git add -A
git commit -m "chore: V1 프로젝트 스캐폴딩 (Spring Boot + MySQL + Docker)"
```

---

## Task 2: Concert 도메인 — 엔티티 + Repository

**Files:**
- Create: `backend/src/main/java/com/evolution/queue/domain/Concert.java`
- Create: `backend/src/main/java/com/evolution/queue/domain/ConcertRepository.java`
- Create: `backend/src/test/java/com/evolution/queue/domain/ConcertTest.java`

**Step 1: 실패하는 테스트 작성 — Concert 생성 검증**

```java
package com.evolution.queue.domain;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ConcertTest {

    @Test
    void 콘서트_생성_성공() {
        Concert concert = Concert.create("IU Concert", "2026-12-25", 100);

        assertThat(concert.getName()).isEqualTo("IU Concert");
        assertThat(concert.getTotalSeats()).isEqualTo(100);
        assertThat(concert.getAvailableSeats()).isEqualTo(100);
    }

    @Test
    void 좌석수_0이하면_실패() {
        assertThatThrownBy(() -> Concert.create("IU Concert", "2026-12-25", 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 좌석_감소_성공() {
        Concert concert = Concert.create("IU Concert", "2026-12-25", 100);
        concert.decreaseAvailableSeats();
        assertThat(concert.getAvailableSeats()).isEqualTo(99);
    }

    @Test
    void 잔여좌석_0이면_감소_실패() {
        Concert concert = Concert.create("IU Concert", "2026-12-25", 1);
        concert.decreaseAvailableSeats();

        assertThatThrownBy(() -> concert.decreaseAvailableSeats())
                .isInstanceOf(IllegalStateException.class);
    }
}
```

**Step 2: 테스트 실행 확인 — 실패**

Run: `cd backend && ./gradlew test --tests "ConcertTest" -v`
Expected: FAIL — Concert 클래스 없음

**Step 3: Concert 엔티티 구현**

```java
package com.evolution.queue.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "concert")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Concert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String date;

    @Column(nullable = false)
    private int totalSeats;

    @Column(nullable = false)
    private int availableSeats;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private Concert(String name, String date, int totalSeats) {
        if (totalSeats <= 0) {
            throw new IllegalArgumentException("좌석 수는 1 이상이어야 합니다.");
        }
        this.name = name;
        this.date = date;
        this.totalSeats = totalSeats;
        this.availableSeats = totalSeats;
        this.createdAt = LocalDateTime.now();
    }

    public static Concert create(String name, String date, int totalSeats) {
        return new Concert(name, date, totalSeats);
    }

    public void decreaseAvailableSeats() {
        if (this.availableSeats <= 0) {
            throw new IllegalStateException("잔여 좌석이 없습니다.");
        }
        this.availableSeats--;
    }

    public boolean isSoldOut() {
        return this.availableSeats <= 0;
    }
}
```

```java
package com.evolution.queue.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ConcertRepository extends JpaRepository<Concert, Long> {
    List<Concert> findByAvailableSeatsGreaterThan(int seats);
}
```

**Step 4: 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests "ConcertTest" -v`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: Concert 엔티티 + Repository 구현"
```

---

## Task 3: Reservation 도메인 — 엔티티 + Repository

**Files:**
- Create: `backend/src/main/java/com/evolution/queue/domain/Reservation.java`
- Create: `backend/src/main/java/com/evolution/queue/domain/ReservationRepository.java`
- Create: `backend/src/test/java/com/evolution/queue/domain/ReservationTest.java`

**Step 1: 실패하는 테스트 작성**

```java
package com.evolution.queue.domain;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ReservationTest {

    @Test
    void 예매_생성_성공() {
        Reservation reservation = Reservation.create(1L, "user-1", 42);

        assertThat(reservation.getConcertId()).isEqualTo(1L);
        assertThat(reservation.getUserId()).isEqualTo("user-1");
        assertThat(reservation.getSeatNo()).isEqualTo(42);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.RESERVED);
    }

    @Test
    void 예매_취소() {
        Reservation reservation = Reservation.create(1L, "user-1", 42);
        reservation.cancel();
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CANCELLED);
    }
}
```

**Step 2: 테스트 실행 — 실패 확인**

Run: `cd backend && ./gradlew test --tests "ReservationTest" -v`
Expected: FAIL

**Step 3: Reservation 엔티티 구현**

```java
package com.evolution.queue.domain;

public enum ReservationStatus {
    RESERVED, CANCELLED
}
```

```java
package com.evolution.queue.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "reservation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long concertId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private int seatNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private Reservation(Long concertId, String userId, int seatNo) {
        this.concertId = concertId;
        this.userId = userId;
        this.seatNo = seatNo;
        this.status = ReservationStatus.RESERVED;
        this.createdAt = LocalDateTime.now();
    }

    public static Reservation create(Long concertId, String userId, int seatNo) {
        return new Reservation(concertId, userId, seatNo);
    }

    public void cancel() {
        this.status = ReservationStatus.CANCELLED;
    }
}
```

```java
package com.evolution.queue.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    boolean existsByConcertIdAndSeatNo(Long concertId, int seatNo);
    boolean existsByConcertIdAndUserId(Long concertId, String userId);
}
```

**Step 4: 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests "ReservationTest" -v`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: Reservation 엔티티 + Repository 구현"
```

---

## Task 4: 예매 서비스 — 의도적으로 순진한 구현

**Files:**
- Create: `backend/src/main/java/com/evolution/queue/service/ReservationService.java`
- Create: `backend/src/test/java/com/evolution/queue/service/ReservationServiceTest.java`

**Step 1: 실패하는 테스트 작성**

```java
package com.evolution.queue.service;

import com.evolution.queue.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock ConcertRepository concertRepository;
    @Mock ReservationRepository reservationRepository;
    @InjectMocks ReservationService reservationService;

    private Concert concert;

    @BeforeEach
    void setUp() {
        concert = Concert.create("IU Concert", "2026-12-25", 100);
    }

    @Test
    void 예매_성공() {
        given(concertRepository.findById(1L)).willReturn(Optional.of(concert));
        given(reservationRepository.existsByConcertIdAndSeatNo(1L, 42)).willReturn(false);
        given(reservationRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        Reservation result = reservationService.reserve(1L, "user-1", 42);

        assertThat(result.getUserId()).isEqualTo("user-1");
        assertThat(result.getSeatNo()).isEqualTo(42);
        assertThat(concert.getAvailableSeats()).isEqualTo(99);
    }

    @Test
    void 매진_시_예매_실패() {
        Concert soldOut = Concert.create("Sold Out", "2026-12-25", 1);
        soldOut.decreaseAvailableSeats();

        given(concertRepository.findById(1L)).willReturn(Optional.of(soldOut));

        assertThatThrownBy(() -> reservationService.reserve(1L, "user-1", 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("매진");
    }
}
```

**Step 2: 테스트 실행 — 실패 확인**

Run: `cd backend && ./gradlew test --tests "ReservationServiceTest" -v`
Expected: FAIL

**Step 3: ReservationService 구현 — 락 없는 순진한 버전**

```java
package com.evolution.queue.service;

import com.evolution.queue.domain.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReservationService {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    @Transactional
    public Reservation reserve(Long concertId, String userId, int seatNo) {
        Concert concert = concertRepository.findById(concertId)
                .orElseThrow(() -> new IllegalArgumentException("콘서트를 찾을 수 없습니다."));

        if (concert.isSoldOut()) {
            throw new IllegalStateException("매진되었습니다.");
        }

        // ⚠️ V1: 락 없음 — 여러 스레드가 동시에 이 지점을 통과할 수 있음
        concert.decreaseAvailableSeats();

        return reservationRepository.save(Reservation.create(concertId, userId, seatNo));
    }
}
```

**Step 4: 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests "ReservationServiceTest" -v`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: ReservationService 구현 (V1 — 락 없는 순진한 버전)"
```

---

## Task 5: REST API 컨트롤러

**Files:**
- Create: `backend/src/main/java/com/evolution/queue/api/ConcertController.java`
- Create: `backend/src/main/java/com/evolution/queue/api/ConcertDto.java`
- Create: `backend/src/main/java/com/evolution/queue/api/GlobalExceptionHandler.java`

**Step 1: 컨트롤러 + DTO 구현**

```java
package com.evolution.queue.api;

import com.evolution.queue.domain.Concert;
import com.evolution.queue.domain.Reservation;

public class ConcertDto {

    public record ConcertResponse(Long id, String name, String date, int totalSeats, int availableSeats) {
        public static ConcertResponse from(Concert c) {
            return new ConcertResponse(c.getId(), c.getName(), c.getDate(), c.getTotalSeats(), c.getAvailableSeats());
        }
    }

    public record ReserveRequest(String userId, int seatNo) {}

    public record ReservationResponse(Long id, Long concertId, String userId, int seatNo, String status) {
        public static ReservationResponse from(Reservation r) {
            return new ReservationResponse(r.getId(), r.getConcertId(), r.getUserId(), r.getSeatNo(), r.getStatus().name());
        }
    }

    public record ErrorResponse(String message) {}
}
```

```java
package com.evolution.queue.api;

import com.evolution.queue.domain.Concert;
import com.evolution.queue.domain.ConcertRepository;
import com.evolution.queue.service.ReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/concerts")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class ConcertController {

    private final ConcertRepository concertRepository;
    private final ReservationService reservationService;

    @GetMapping
    public List<ConcertDto.ConcertResponse> list() {
        return concertRepository.findByAvailableSeatsGreaterThan(0).stream()
                .map(ConcertDto.ConcertResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    public ConcertDto.ConcertResponse detail(@PathVariable Long id) {
        Concert concert = concertRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("콘서트를 찾을 수 없습니다."));
        return ConcertDto.ConcertResponse.from(concert);
    }

    @PostMapping("/{id}/reserve")
    public ConcertDto.ReservationResponse reserve(
            @PathVariable Long id,
            @RequestBody ConcertDto.ReserveRequest request) {
        return ConcertDto.ReservationResponse.from(
                reservationService.reserve(id, request.userId(), request.seatNo()));
    }
}
```

```java
package com.evolution.queue.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ConcertDto.ErrorResponse> handleNotFound(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ConcertDto.ErrorResponse(e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ConcertDto.ErrorResponse> handleConflict(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ConcertDto.ErrorResponse(e.getMessage()));
    }
}
```

**Step 2: 수동 테스트 — Docker + 앱 기동 후 curl**

```bash
# 테스트 데이터 삽입 (MySQL CLI 또는 data.sql)
# 또는 Admin API (Task 6에서 추가)
curl http://localhost:8080/api/concerts
curl http://localhost:8080/api/concerts/1
curl -X POST http://localhost:8080/api/concerts/1/reserve \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","seatNo":42}'
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: REST API 컨트롤러 (콘서트 목록/상세/예매)"
```

---

## Task 6: 관리자 API — 콘서트 등록 + 초기 데이터

**Files:**
- Create: `backend/src/main/java/com/evolution/queue/api/AdminController.java`
- Create: `backend/src/main/java/com/evolution/queue/domain/ReservationRepository.java` (count 메서드 추가)

**Step 1: AdminController 구현**

```java
package com.evolution.queue.api;

import com.evolution.queue.domain.Concert;
import com.evolution.queue.domain.ConcertRepository;
import com.evolution.queue.domain.ReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class AdminController {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;

    public record CreateConcertRequest(String name, String date, int totalSeats) {}

    @PostMapping("/concerts")
    @ResponseStatus(HttpStatus.CREATED)
    public ConcertDto.ConcertResponse create(@RequestBody CreateConcertRequest request) {
        Concert concert = Concert.create(request.name(), request.date(), request.totalSeats());
        return ConcertDto.ConcertResponse.from(concertRepository.save(concert));
    }

    @PostMapping("/concerts/reset")
    public void reset() {
        reservationRepository.deleteAll();
        concertRepository.deleteAll();
    }
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: 관리자 API (콘서트 등록/초기화)"
```

---

## Task 7: Frontend — Next.js 프로젝트 초기화

**Files:**
- Create: `frontend/` (Next.js 14 프로젝트)

**Step 1: Next.js 프로젝트 생성**

```bash
cd C:/ALLSP/queue-system-evolution
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"
```

**Step 2: API 클라이언트 설정**

```typescript
// frontend/src/lib/api.ts
const API_BASE = 'http://localhost:8080/api';

export async function fetchConcerts() {
    const res = await fetch(`${API_BASE}/concerts`, { cache: 'no-store' });
    return res.json();
}

export async function fetchConcert(id: number) {
    const res = await fetch(`${API_BASE}/concerts/${id}`, { cache: 'no-store' });
    return res.json();
}

export async function reserve(concertId: number, userId: string, seatNo: number) {
    const res = await fetch(`${API_BASE}/concerts/${concertId}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, seatNo }),
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
    }
    return res.json();
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "chore: Next.js 14 프로젝트 초기화"
```

---

## Task 8: Frontend — 콘서트 목록 + 예매 페이지

**Files:**
- Create: `frontend/src/app/page.tsx` (콘서트 목록)
- Create: `frontend/src/app/concert/[id]/page.tsx` (좌석 선택 + 예매)
- Create: `frontend/src/components/SeatGrid.tsx` (10x10 좌석 격자)

**Step 1: 콘서트 목록 페이지**

```tsx
// frontend/src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchConcerts } from '@/lib/api';

interface Concert {
    id: number;
    name: string;
    date: string;
    total_seats: number;
    available_seats: number;
}

export default function Home() {
    const [concerts, setConcerts] = useState<Concert[]>([]);

    useEffect(() => {
        fetchConcerts().then(setConcerts);
    }, []);

    return (
        <main className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-2">Concert Tickets</h1>
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
            </div>
        </main>
    );
}
```

**Step 2: 좌석 그리드 컴포넌트**

```tsx
// frontend/src/components/SeatGrid.tsx
'use client';

interface SeatGridProps {
    totalSeats: number;
    reservedSeats: number[];
    selectedSeat: number | null;
    onSelect: (seatNo: number) => void;
}

export default function SeatGrid({ totalSeats, reservedSeats, selectedSeat, onSelect }: SeatGridProps) {
    const cols = 10;
    const rows = Math.ceil(totalSeats / cols);

    return (
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: totalSeats }, (_, i) => {
                const seatNo = i + 1;
                const isReserved = reservedSeats.includes(seatNo);
                const isSelected = selectedSeat === seatNo;

                return (
                    <button
                        key={seatNo}
                        onClick={() => !isReserved && onSelect(seatNo)}
                        disabled={isReserved}
                        className={`w-10 h-10 rounded text-xs font-mono transition
                            ${isReserved ? 'bg-red-400 text-white cursor-not-allowed' :
                              isSelected ? 'bg-blue-500 text-white' :
                              'bg-green-100 hover:bg-green-300 cursor-pointer'}`}
                    >
                        {seatNo}
                    </button>
                );
            })}
        </div>
    );
}
```

**Step 3: 예매 페이지**

```tsx
// frontend/src/app/concert/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchConcert, reserve } from '@/lib/api';
import SeatGrid from '@/components/SeatGrid';

export default function ConcertPage() {
    const { id } = useParams();
    const [concert, setConcert] = useState<any>(null);
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [userId] = useState(`user-${Math.random().toString(36).slice(2, 8)}`);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchConcert(Number(id)).then(setConcert);
    }, [id]);

    const handleReserve = async () => {
        if (!selectedSeat) return;
        setLoading(true);
        setMessage('');
        try {
            await reserve(Number(id), userId, selectedSeat);
            setMessage(`좌석 ${selectedSeat}번 예매 완료!`);
            fetchConcert(Number(id)).then(setConcert);
        } catch (e: any) {
            setMessage(`실패: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!concert) return <div className="p-8">Loading...</div>;

    return (
        <main className="max-w-4xl mx-auto p-8">
            <h1 className="text-2xl font-bold">{concert.name}</h1>
            <p className="text-gray-500 mb-4">{concert.date} · 잔여 {concert.available_seats}/{concert.total_seats}석</p>
            <p className="text-sm text-gray-400 mb-4">내 ID: {userId}</p>

            <SeatGrid
                totalSeats={concert.total_seats}
                reservedSeats={[]}
                selectedSeat={selectedSeat}
                onSelect={setSelectedSeat}
            />

            <div className="mt-6 flex items-center gap-4">
                <button
                    onClick={handleReserve}
                    disabled={!selectedSeat || loading}
                    className="px-6 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                >
                    {loading ? '처리 중...' : `좌석 ${selectedSeat ?? '-'}번 예매`}
                </button>
                {message && <span className={message.includes('실패') ? 'text-red-500' : 'text-green-500'}>{message}</span>}
            </div>
        </main>
    );
}
```

**Step 4: 동작 확인**

Run: `cd frontend && npm run dev`
브라우저: `http://localhost:3000` → 콘서트 목록 → 좌석 선택 → 예매

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: 콘서트 목록 + 좌석 선택 예매 UI 구현"
```

---

## Task 9: Frontend — 관리자 페이지

**Files:**
- Create: `frontend/src/app/admin/page.tsx`

**Step 1: 관리자 페이지 구현**

```tsx
// frontend/src/app/admin/page.tsx
'use client';

import { useState } from 'react';

const API_BASE = 'http://localhost:8080/api';

export default function AdminPage() {
    const [name, setName] = useState('IU Concert');
    const [date, setDate] = useState('2026-12-25');
    const [totalSeats, setTotalSeats] = useState(100);
    const [message, setMessage] = useState('');

    const handleCreate = async () => {
        const res = await fetch(`${API_BASE}/admin/concerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, totalSeats }),
        });
        if (res.ok) setMessage('콘서트 생성 완료!');
    };

    const handleReset = async () => {
        await fetch(`${API_BASE}/admin/concerts/reset`, { method: 'POST' });
        setMessage('데이터 초기화 완료!');
    };

    return (
        <main className="max-w-2xl mx-auto p-8">
            <h1 className="text-2xl font-bold mb-6">Admin</h1>

            <div className="space-y-4 p-6 border rounded-lg">
                <h2 className="text-lg font-semibold">콘서트 등록</h2>
                <input value={name} onChange={e => setName(e.target.value)}
                       className="w-full p-2 border rounded" placeholder="콘서트 이름" />
                <input value={date} onChange={e => setDate(e.target.value)}
                       className="w-full p-2 border rounded" placeholder="날짜" />
                <input type="number" value={totalSeats} onChange={e => setTotalSeats(Number(e.target.value))}
                       className="w-full p-2 border rounded" placeholder="총 좌석수" />
                <div className="flex gap-2">
                    <button onClick={handleCreate} className="px-4 py-2 bg-blue-500 text-white rounded">생성</button>
                    <button onClick={handleReset} className="px-4 py-2 bg-red-500 text-white rounded">전체 초기화</button>
                </div>
                {message && <p className="text-green-500">{message}</p>}
            </div>
        </main>
    );
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: 관리자 페이지 (콘서트 등록/초기화)"
```

---

## Task 10: k6 부하 테스트 — V1 시나리오

**Files:**
- Create: `load-tests/v1-naive.js`
- Create: `load-tests/setup.js`

**Step 1: 부하 테스트 시나리오 작성**

```javascript
// load-tests/setup.js — 테스트 전 콘서트 생성
import http from 'k6/http';

export function setup() {
    // 기존 데이터 초기화
    http.post('http://localhost:8080/api/admin/concerts/reset');

    // 100석 콘서트 생성
    const res = http.post('http://localhost:8080/api/admin/concerts',
        JSON.stringify({ name: 'Load Test Concert', date: '2026-12-25', totalSeats: 100 }),
        { headers: { 'Content-Type': 'application/json' } }
    );
    return JSON.parse(res.body);
}
```

```javascript
// load-tests/v1-naive.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

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
        JSON.stringify({ name: 'V1 Load Test', date: '2026-12-25', totalSeats: 100 }),
        { headers: { 'Content-Type': 'application/json' } }
    );
    return JSON.parse(res.body);
}

export default function (data) {
    const concertId = data.id;
    const seatNo = Math.floor(Math.random() * 100) + 1;
    const userId = `user-${__VU}-${__ITER}`;

    const res = http.post(
        `http://localhost:8080/api/concerts/${concertId}/reserve`,
        JSON.stringify({ userId, seatNo }),
        { headers: { 'Content-Type': 'application/json' } }
    );

    if (res.status === 200) {
        successCount.add(1);
    } else {
        failCount.add(1);
    }
}

export function teardown(data) {
    // 최종 콘서트 상태 확인
    const res = http.get(`http://localhost:8080/api/concerts/${data.id}`);
    console.log(`\n===== V1 결과 =====`);
    console.log(`콘서트 상태: ${res.body}`);
    console.log(`(100석인데 예매 성공이 100건 초과하면 → 초과 예매 증명)`);
}
```

**Step 2: k6 실행 및 결과 확인**

```bash
# k6 설치 (아직 없다면)
# Windows: choco install k6 또는 winget install k6
k6 run load-tests/v1-naive.js
```

Expected: `reservations_success` 카운터가 100을 초과 (초과 예매 증명)

**Step 3: 결과를 docs/v1-report.md에 기록**

**Step 4: Commit**

```bash
git add -A && git commit -m "test: k6 부하 테스트 시나리오 (V1 초과 예매 증명)"
```

---

## 완료 기준

- [ ] Backend: Concert/Reservation CRUD API 동작
- [ ] Frontend: 목록 → 좌석 선택 → 예매 → 결과 표시
- [ ] Admin: 콘서트 등록/초기화
- [ ] k6: 1000명 동시 요청 시 초과 예매 수치 기록
- [ ] V1 리포트: 문제점 + 수치 문서화

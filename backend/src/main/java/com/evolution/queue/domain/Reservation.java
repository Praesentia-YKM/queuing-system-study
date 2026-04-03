package com.evolution.queue.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "reservation", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"concertId", "seatNo"})
})
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

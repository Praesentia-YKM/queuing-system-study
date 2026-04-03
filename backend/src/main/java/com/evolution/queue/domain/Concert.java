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

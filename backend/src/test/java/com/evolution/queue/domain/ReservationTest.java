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

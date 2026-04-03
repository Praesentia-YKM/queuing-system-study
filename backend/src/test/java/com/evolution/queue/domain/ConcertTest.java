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

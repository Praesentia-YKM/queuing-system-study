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

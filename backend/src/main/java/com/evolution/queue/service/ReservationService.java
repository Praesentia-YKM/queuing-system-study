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

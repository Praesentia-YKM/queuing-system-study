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

    private volatile Long activeConcertId;

    public Long getActiveConcertId() {
        return activeConcertId;
    }

    public void setActiveConcertId(Long concertId) {
        this.activeConcertId = concertId;
    }

    @Transactional
    public Reservation reserve(Long concertId, String userId, int seatNo) {
        Concert concert = concertRepository.findByIdForUpdate(concertId)
                .orElseThrow(() -> new IllegalArgumentException("콘서트를 찾을 수 없습니다."));

        if (concert.isSoldOut()) {
            throw new IllegalStateException("매진되었습니다.");
        }

        if (reservationRepository.existsByConcertIdAndSeatNo(concertId, seatNo)) {
            throw new IllegalStateException("이미 예매된 좌석입니다.");
        }

        concert.decreaseAvailableSeats();

        return reservationRepository.save(Reservation.create(concertId, userId, seatNo));
    }
}

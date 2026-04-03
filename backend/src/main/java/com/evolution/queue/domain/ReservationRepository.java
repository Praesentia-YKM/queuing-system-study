package com.evolution.queue.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    boolean existsByConcertIdAndSeatNo(Long concertId, int seatNo);
    boolean existsByConcertIdAndUserId(Long concertId, String userId);
    List<Reservation> findByConcertIdAndStatus(Long concertId, ReservationStatus status);
}

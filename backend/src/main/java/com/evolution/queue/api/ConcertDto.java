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

package com.evolution.queue.api;

import com.evolution.queue.domain.*;
import com.evolution.queue.service.ReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/concerts")
@RequiredArgsConstructor
public class ConcertController {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;
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

    @GetMapping("/{id}/reservations")
    public List<Integer> reservedSeats(@PathVariable Long id) {
        return reservationRepository.findByConcertIdAndStatus(id, ReservationStatus.RESERVED).stream()
                .map(Reservation::getSeatNo)
                .toList();
    }

    @PostMapping("/{id}/reserve")
    public ConcertDto.ReservationResponse reserve(
            @PathVariable Long id,
            @RequestBody ConcertDto.ReserveRequest request) {
        return ConcertDto.ReservationResponse.from(
                reservationService.reserve(id, request.userId(), request.seatNo()));
    }
}

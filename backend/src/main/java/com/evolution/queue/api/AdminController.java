package com.evolution.queue.api;

import com.evolution.queue.domain.Concert;
import com.evolution.queue.domain.ConcertRepository;
import com.evolution.queue.domain.ReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final ConcertRepository concertRepository;
    private final ReservationRepository reservationRepository;
    private final StringRedisTemplate redisTemplate;

    public record CreateConcertRequest(String name, String date, int totalSeats) {}

    @PostMapping("/concerts")
    @ResponseStatus(HttpStatus.CREATED)
    public ConcertDto.ConcertResponse create(@RequestBody CreateConcertRequest request) {
        Concert concert = Concert.create(request.name(), request.date(), request.totalSeats());
        return ConcertDto.ConcertResponse.from(concertRepository.save(concert));
    }

    @PostMapping("/concerts/reset")
    public void reset() {
        reservationRepository.deleteAll();
        concertRepository.deleteAll();
        Set<String> queueKeys = redisTemplate.keys("queue:concert:*");
        if (queueKeys != null && !queueKeys.isEmpty()) redisTemplate.delete(queueKeys);
        Set<String> resultKeys = redisTemplate.keys("result:concert:*");
        if (resultKeys != null && !resultKeys.isEmpty()) redisTemplate.delete(resultKeys);
    }
}

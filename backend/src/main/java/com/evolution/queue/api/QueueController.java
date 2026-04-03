package com.evolution.queue.api;

import com.evolution.queue.service.QueueService;
import com.evolution.queue.service.ReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/queue")
@RequiredArgsConstructor
public class QueueController {

    private final QueueService queueService;
    private final ReservationService reservationService;

    public record EnqueueRequest(String userId, int seatNo) {}

    @PostMapping("/concerts/{id}/enqueue")
    public Map<String, Object> enqueue(@PathVariable Long id, @RequestBody EnqueueRequest request) {
        reservationService.setActiveConcertId(id);
        long rank = queueService.enqueue(id, request.userId(), request.seatNo());
        long queueSize = queueService.getQueueSize(id);
        return Map.of(
                "status", "QUEUED",
                "rank", rank,
                "queue_size", queueSize,
                "user_id", request.userId(),
                "seat_no", request.seatNo()
        );
    }

    @GetMapping("/concerts/{id}/status")
    public Map<String, Object> status(
            @PathVariable Long id,
            @RequestParam String userId,
            @RequestParam int seatNo) {
        String result = queueService.getResult(id, userId, seatNo);
        if (result != null) {
            String[] parts = result.split("\\|", 2);
            return Map.of(
                    "status", parts[0],
                    "message", parts.length > 1 ? parts[1] : "",
                    "queue_position", -1
            );
        }

        long rank = queueService.getRank(id, userId, seatNo);
        if (rank >= 0) {
            return Map.of(
                    "status", "WAITING",
                    "queue_position", rank,
                    "queue_size", queueService.getQueueSize(id)
            );
        }

        return Map.of("status", "UNKNOWN");
    }

    @GetMapping("/concerts/{id}/queue-info")
    public Map<String, Object> queueInfo(@PathVariable Long id) {
        return Map.of("queue_size", queueService.getQueueSize(id));
    }
}

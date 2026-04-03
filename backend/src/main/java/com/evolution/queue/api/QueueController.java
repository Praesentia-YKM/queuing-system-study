package com.evolution.queue.api;

import com.evolution.queue.service.QueueService;
import com.evolution.queue.service.ReservationService;
import com.evolution.queue.service.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/queue")
@RequiredArgsConstructor
public class QueueController {

    private final QueueService queueService;
    private final ReservationService reservationService;
    private final TokenService tokenService;

    public record EnqueueRequest(String userId, int seatNo) {}
    public record ReserveWithTokenRequest(String userId, int seatNo, String token) {}

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
            String status = parts[0];

            if ("TOKEN_ISSUED".equals(status) && parts.length > 1) {
                String[] tokenData = parts[1].split("\\|", 2);
                return Map.of(
                        "status", "TOKEN_ISSUED",
                        "token", tokenData[0],
                        "seat_no", tokenData.length > 1 ? tokenData[1] : String.valueOf(seatNo),
                        "ttl", tokenService.getTokenTTL().getSeconds()
                );
            }

            return Map.of(
                    "status", status,
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

    @PostMapping("/concerts/{id}/reserve-with-token")
    public Map<String, Object> reserveWithToken(
            @PathVariable Long id,
            @RequestBody ReserveWithTokenRequest request) {
        if (!tokenService.validateToken(id, request.token(), request.userId())) {
            return Map.of("status", "FAIL", "message", "유효하지 않은 토큰입니다 (만료 또는 미발급)");
        }

        try {
            reservationService.reserve(id, request.userId(), request.seatNo());
            tokenService.consumeToken(id, request.token(), request.userId());
            return Map.of("status", "SUCCESS", "message", "예매 성공");
        } catch (IllegalStateException e) {
            tokenService.consumeToken(id, request.token(), request.userId());
            return Map.of("status", "FAIL", "message", e.getMessage());
        }
    }

    @GetMapping("/concerts/{id}/queue-info")
    public Map<String, Object> queueInfo(@PathVariable Long id) {
        return Map.of(
                "queue_size", queueService.getQueueSize(id),
                "active_tokens", tokenService.getActiveTokenCount(id)
        );
    }
}

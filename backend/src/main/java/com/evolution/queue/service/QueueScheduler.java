package com.evolution.queue.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class QueueScheduler {

    private final QueueService queueService;
    private final TokenService tokenService;
    private final ReservationService reservationService;

    private static final int BATCH_SIZE = 5;

    @Scheduled(fixedDelay = 200)
    public void processQueue() {
        Long concertId = reservationService.getActiveConcertId();
        if (concertId == null) return;

        long activeTokens = tokenService.getActiveTokenCount(concertId);
        if (activeTokens >= 10) return;

        int available = (int) (10 - activeTokens);
        int batchSize = Math.min(BATCH_SIZE, available);
        if (batchSize <= 0) return;

        Set<ZSetOperations.TypedTuple<String>> batch = queueService.dequeueBatch(concertId, batchSize);
        if (batch == null || batch.isEmpty()) return;

        for (ZSetOperations.TypedTuple<String> entry : batch) {
            String member = entry.getValue();
            if (member == null) continue;

            String[] parts = member.split(":");
            if (parts.length < 2) continue;

            String seatPart = parts[parts.length - 1];
            String userId = member.substring(0, member.length() - seatPart.length() - 1);
            int seatNo = Integer.parseInt(seatPart);

            String token = tokenService.issueToken(concertId, userId);
            if (token != null) {
                queueService.saveResult(concertId, userId, seatNo,
                        "TOKEN_ISSUED", token + "|" + seatNo);
                log.info("Token issued via queue: concert={}, user={}, seat={}", concertId, userId, seatNo);
            } else {
                queueService.saveResult(concertId, userId, seatNo,
                        "FAIL", "입장 제한 초과");
            }
        }
    }
}

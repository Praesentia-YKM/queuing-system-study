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
    private final ReservationService reservationService;

    private static final int BATCH_SIZE = 5;

    @Scheduled(fixedDelay = 200)
    public void processQueue() {
        processQueueForConcert(findActiveConcertId());
    }

    private void processQueueForConcert(Long concertId) {
        if (concertId == null) return;

        Set<ZSetOperations.TypedTuple<String>> batch = queueService.dequeueBatch(concertId, BATCH_SIZE);
        if (batch == null || batch.isEmpty()) return;

        for (ZSetOperations.TypedTuple<String> entry : batch) {
            String member = entry.getValue();
            if (member == null) continue;

            String[] parts = member.split(":");
            if (parts.length < 2) continue;

            String seatPart = parts[parts.length - 1];
            String userId = member.substring(0, member.length() - seatPart.length() - 1);
            int seatNo = Integer.parseInt(seatPart);

            try {
                reservationService.reserve(concertId, userId, seatNo);
                queueService.saveResult(concertId, userId, seatNo, "SUCCESS", "예매 성공");
                log.info("Reserved: concert={}, user={}, seat={}", concertId, userId, seatNo);
            } catch (IllegalStateException e) {
                queueService.saveResult(concertId, userId, seatNo, "FAIL", e.getMessage());
                log.info("Rejected: concert={}, user={}, seat={}, reason={}", concertId, userId, seatNo, e.getMessage());
            } catch (Exception e) {
                queueService.saveResult(concertId, userId, seatNo, "FAIL", "시스템 오류");
                log.error("Error processing reservation: concert={}, user={}, seat={}", concertId, userId, seatNo, e);
            }
        }
    }

    private Long findActiveConcertId() {
        return reservationService.getActiveConcertId();
    }
}

package com.evolution.queue.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueueService {

    private final StringRedisTemplate redisTemplate;

    private static final String QUEUE_KEY_PREFIX = "queue:concert:";
    private static final String RESULT_KEY_PREFIX = "result:concert:";

    public long enqueue(Long concertId, String userId, int seatNo) {
        String queueKey = QUEUE_KEY_PREFIX + concertId;
        String member = userId + ":" + seatNo;
        double score = System.currentTimeMillis();

        Boolean added = redisTemplate.opsForZSet().add(queueKey, member, score);
        if (Boolean.FALSE.equals(added)) {
            return getRank(concertId, userId, seatNo);
        }

        Long rank = redisTemplate.opsForZSet().rank(queueKey, member);
        log.info("Enqueued: concert={}, user={}, seat={}, rank={}", concertId, userId, seatNo, rank);
        return rank != null ? rank : -1;
    }

    public long getRank(Long concertId, String userId, int seatNo) {
        String queueKey = QUEUE_KEY_PREFIX + concertId;
        String member = userId + ":" + seatNo;
        Long rank = redisTemplate.opsForZSet().rank(queueKey, member);
        return rank != null ? rank : -1;
    }

    public Set<ZSetOperations.TypedTuple<String>> dequeueBatch(Long concertId, int batchSize) {
        String queueKey = QUEUE_KEY_PREFIX + concertId;
        Set<ZSetOperations.TypedTuple<String>> batch =
                redisTemplate.opsForZSet().popMin(queueKey, batchSize);
        return batch;
    }

    public long getQueueSize(Long concertId) {
        String queueKey = QUEUE_KEY_PREFIX + concertId;
        Long size = redisTemplate.opsForZSet().size(queueKey);
        return size != null ? size : 0;
    }

    public void saveResult(Long concertId, String userId, int seatNo, String status, String message) {
        String resultKey = RESULT_KEY_PREFIX + concertId + ":" + userId + ":" + seatNo;
        redisTemplate.opsForValue().set(resultKey, status + "|" + message);
    }

    public String getResult(Long concertId, String userId, int seatNo) {
        String resultKey = RESULT_KEY_PREFIX + concertId + ":" + userId + ":" + seatNo;
        return redisTemplate.opsForValue().get(resultKey);
    }

    public void clearQueue(Long concertId) {
        redisTemplate.delete(QUEUE_KEY_PREFIX + concertId);
    }
}

package com.evolution.queue.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenService {

    private final StringRedisTemplate redisTemplate;

    private static final String TOKEN_KEY_PREFIX = "token:concert:";
    private static final String TOKEN_USER_PREFIX = "token:user:";
    private static final Duration TOKEN_TTL = Duration.ofSeconds(30);
    private static final String ACTIVE_COUNT_KEY_PREFIX = "active:concert:";
    private static final int MAX_ACTIVE_TOKENS = 10;

    public String issueToken(Long concertId, String userId) {
        String activeKey = ACTIVE_COUNT_KEY_PREFIX + concertId;
        Long activeCount = redisTemplate.opsForValue().increment(activeKey);

        if (activeCount != null && activeCount > MAX_ACTIVE_TOKENS) {
            redisTemplate.opsForValue().decrement(activeKey);
            return null;
        }

        String token = UUID.randomUUID().toString();
        String tokenKey = TOKEN_KEY_PREFIX + concertId + ":" + token;
        String userKey = TOKEN_USER_PREFIX + concertId + ":" + userId;

        redisTemplate.opsForValue().set(tokenKey, userId + ":" + concertId, TOKEN_TTL);
        redisTemplate.opsForValue().set(userKey, token, TOKEN_TTL);

        log.info("Token issued: concert={}, user={}, token={}, active={}", concertId, userId, token, activeCount);
        return token;
    }

    public boolean validateToken(Long concertId, String token, String userId) {
        String tokenKey = TOKEN_KEY_PREFIX + concertId + ":" + token;
        String stored = redisTemplate.opsForValue().get(tokenKey);
        if (stored == null) return false;
        return stored.startsWith(userId + ":");
    }

    public void consumeToken(Long concertId, String token, String userId) {
        String tokenKey = TOKEN_KEY_PREFIX + concertId + ":" + token;
        String userKey = TOKEN_USER_PREFIX + concertId + ":" + userId;
        redisTemplate.delete(tokenKey);
        redisTemplate.delete(userKey);
        String activeKey = ACTIVE_COUNT_KEY_PREFIX + concertId;
        redisTemplate.opsForValue().decrement(activeKey);
        log.info("Token consumed: concert={}, user={}", concertId, userId);
    }

    public void expireToken(Long concertId, String userId) {
        String userKey = TOKEN_USER_PREFIX + concertId + ":" + userId;
        String token = redisTemplate.opsForValue().get(userKey);
        if (token != null) {
            String tokenKey = TOKEN_KEY_PREFIX + concertId + ":" + token;
            redisTemplate.delete(tokenKey);
            redisTemplate.delete(userKey);
            String activeKey = ACTIVE_COUNT_KEY_PREFIX + concertId;
            redisTemplate.opsForValue().decrement(activeKey);
            log.info("Token expired: concert={}, user={}", concertId, userId);
        }
    }

    public long getActiveTokenCount(Long concertId) {
        String activeKey = ACTIVE_COUNT_KEY_PREFIX + concertId;
        String val = redisTemplate.opsForValue().get(activeKey);
        return val != null ? Long.parseLong(val) : 0;
    }

    public Duration getTokenTTL() {
        return TOKEN_TTL;
    }

    public long getRemainingTTL(Long concertId, String token) {
        String tokenKey = TOKEN_KEY_PREFIX + concertId + ":" + token;
        Long ttl = redisTemplate.getExpire(tokenKey);
        return ttl != null ? ttl : -1;
    }

    public void resetActiveCount(Long concertId) {
        String activeKey = ACTIVE_COUNT_KEY_PREFIX + concertId;
        redisTemplate.delete(activeKey);
    }
}

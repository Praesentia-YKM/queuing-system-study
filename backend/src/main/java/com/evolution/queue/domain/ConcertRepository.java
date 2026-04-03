package com.evolution.queue.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ConcertRepository extends JpaRepository<Concert, Long> {
    List<Concert> findByAvailableSeatsGreaterThan(int seats);
}

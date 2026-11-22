package com.example.passwordmanager.dto;

import java.time.Instant;
import java.util.List;

public final class AuditDtos {
    private AuditDtos() {}

    public record LogResponse(String id, String action, String details,
                              String ip, String userAgent, Instant createdAt) {}

    public record PageResponse(List<LogResponse> items, int page, int totalPages, long totalElements) {}
}
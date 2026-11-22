package com.example.passwordmanager.service;

import com.example.passwordmanager.dto.AuditDtos;
import com.example.passwordmanager.model.AuditAction;
import com.example.passwordmanager.model.AuditLog;
import com.example.passwordmanager.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final AuditLogRepository repo;

    public AuditService(AuditLogRepository repo) {
        this.repo = repo;
    }

    /**
     * Records an event for a user. Never throws: a logging failure must not break the real action.
     * Never pass secrets in `details`.
     */
    public void record(String userId, AuditAction action, String details) {
        try {
            AuditLog entry = new AuditLog();
            entry.setUserId(userId);
            entry.setAction(action);
            entry.setDetails(details);

            HttpServletRequest req = currentRequest();
            if (req != null) {
                entry.setIp(clientIp(req));
                entry.setUserAgent(truncate(req.getHeader("User-Agent"), 200));
            }
            repo.save(entry);
        } catch (Exception e) {
            log.warn("Could not write audit log entry for action {}", action, e);
        }
    }

    public AuditDtos.PageResponse list(String userId, int page, int size, String action) {
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<AuditLog> result;
        if (action == null || action.isBlank()) {
            result = repo.findByUserId(userId, pageable);
        } else {
            AuditAction parsed;
            try {
                parsed = AuditAction.valueOf(action);
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown action");
            }
            result = repo.findByUserIdAndAction(userId, parsed, pageable);
        }

        return new AuditDtos.PageResponse(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getNumber(),
                result.getTotalPages(),
                result.getTotalElements());
    }

    private AuditDtos.LogResponse toResponse(AuditLog l) {
        return new AuditDtos.LogResponse(l.getId(), l.getAction().name(), l.getDetails(),
                l.getIp(), l.getUserAgent(), l.getCreatedAt());
    }

    private static HttpServletRequest currentRequest() {
        var attrs = RequestContextHolder.getRequestAttributes();
        return attrs instanceof ServletRequestAttributes sra ? sra.getRequest() : null;
    }

    // X-Forwarded-For is deliberately not trusted: clients can spoof it.
    // If you deploy behind a reverse proxy, configure server.forward-headers-strategy instead.
    private static String clientIp(HttpServletRequest req) {
        String ip = req.getRemoteAddr();
        if ("0:0:0:0:0:0:0:1".equals(ip) || "::1".equals(ip) || "127.0.0.1".equals(ip)) return "localhost";
        return ip;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
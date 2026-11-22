package com.example.passwordmanager.controller;

import com.example.passwordmanager.dto.AuditDtos;
import com.example.passwordmanager.service.AuditService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/audit")
public class AuditController {
    private final AuditService audit;

    public AuditController(AuditService audit) {
        this.audit = audit;
    }

    // Read-only on purpose: there is no endpoint to edit or delete audit entries.
    @GetMapping
    public AuditDtos.PageResponse list(Authentication auth,
                                       @RequestParam(name = "page", defaultValue = "0") int page,
                                       @RequestParam(name = "size", defaultValue = "15") int size,
                                       @RequestParam(name = "action", required = false) String action) {
        return audit.list(auth.getName(), page, size, action);
    }
}
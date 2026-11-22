package com.example.passwordmanager.repository;

import com.example.passwordmanager.model.AuditAction;
import com.example.passwordmanager.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AuditLogRepository extends MongoRepository<AuditLog, String> {
    Page<AuditLog> findByUserId(String userId, Pageable pageable);
    Page<AuditLog> findByUserIdAndAction(String userId, AuditAction action, Pageable pageable);
}
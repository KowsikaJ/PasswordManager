package com.example.passwordmanager.service;

import com.example.passwordmanager.dto.VaultRequest;
import com.example.passwordmanager.dto.VaultResponse;
import com.example.passwordmanager.model.AuditAction;
import com.example.passwordmanager.model.VaultItem;
import com.example.passwordmanager.repository.VaultItemRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.List;

@Service
public class VaultService {
    // Must match the item limit in AccountDtos.ChangePasswordRequest
    public static final int MAX_ITEMS = 5000;

    private final VaultItemRepository repo;
    private final AuditService audit;

    public VaultService(VaultItemRepository repo, AuditService audit) {
        this.repo = repo;
        this.audit = audit;
    }

    public List<VaultResponse> list(String userId) {
        return repo.findByUserId(userId).stream().map(this::toResponse).toList();
    }

    public VaultResponse create(String userId, VaultRequest req) {
        ensureCapacity(userId, 1);
        VaultItem item = new VaultItem();
        item.setUserId(userId);
        item.setEncryptedData(req.encryptedData());
        item.setIv(req.iv());
        VaultItem saved = repo.save(item);
        audit.record(userId, AuditAction.ITEM_CREATED, "Item " + saved.getId());
        return toResponse(saved);
    }

    /** Used by import. One audit entry per batch, never one per item. */
    public int createBulk(String userId, List<VaultRequest> requests) {
        ensureCapacity(userId, requests.size());
        List<VaultItem> items = requests.stream().map(r -> {
            VaultItem item = new VaultItem();
            item.setUserId(userId);
            item.setEncryptedData(r.encryptedData());
            item.setIv(r.iv());
            return item;
        }).toList();
        repo.saveAll(items);
        audit.record(userId, AuditAction.ITEMS_IMPORTED, items.size() + " items imported");
        return items.size();
    }

    public void logExport(String userId, String format, int count) {
        audit.record(userId, AuditAction.ITEMS_EXPORTED, count + " items exported (" + format + ")");
    }

    public VaultResponse update(String userId, String id, VaultRequest req) {
        VaultItem item = find(userId, id);
        item.setEncryptedData(req.encryptedData());
        item.setIv(req.iv());
        item.setUpdatedAt(Instant.now());
        VaultItem saved = repo.save(item);
        audit.record(userId, AuditAction.ITEM_UPDATED, "Item " + id);
        return toResponse(saved);
    }

    public void delete(String userId, String id) {
        repo.delete(find(userId, id));
        audit.record(userId, AuditAction.ITEM_DELETED, "Item " + id);
    }

    private void ensureCapacity(String userId, int adding) {
        if (repo.countByUserId(userId) + adding > MAX_ITEMS) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Vault item limit reached (" + MAX_ITEMS + " items)");
        }
    }

    // Ownership check: users can only touch their own items
    private VaultItem find(String userId, String id) {
        return repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
    }

    private VaultResponse toResponse(VaultItem i) {
        return new VaultResponse(i.getId(), i.getEncryptedData(), i.getIv(), i.getUpdatedAt());
    }
}
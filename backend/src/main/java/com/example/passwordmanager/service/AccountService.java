package com.example.passwordmanager.service;

import com.example.passwordmanager.dto.AccountDtos;
import com.example.passwordmanager.model.AuditAction;
import com.example.passwordmanager.model.User;
import com.example.passwordmanager.model.VaultItem;
import com.example.passwordmanager.repository.UserRepository;
import com.example.passwordmanager.repository.VaultItemRepository;
import com.example.passwordmanager.security.RateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AccountService {
    private static final int MAX_FAILS = 5;
    private static final long WINDOW_MS = 15 * 60_000L;

    private final UserRepository users;
    private final VaultItemRepository items;
    private final PasswordEncoder encoder;
    private final MfaService mfa;
    private final AuditService audit;
    private final RateLimiter limiter;
    private final RefreshTokenService refreshTokens;

    public AccountService(UserRepository users, VaultItemRepository items, PasswordEncoder encoder,
                          MfaService mfa, AuditService audit, RateLimiter limiter,
                          RefreshTokenService refreshTokens) {
        this.users = users;
        this.items = items;
        this.encoder = encoder;
        this.mfa = mfa;
        this.audit = audit;
        this.limiter = limiter;
        this.refreshTokens = refreshTokens;
    }

    public void changePassword(String userId, AccountDtos.ChangePasswordRequest req) {
        String failKey = "pwchange-fail:" + userId;
        limiter.requireBelow(failKey, MAX_FAILS);

        // 404 rather than 401, so the frontend doesn't read it as "session expired"
        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // 400 rather than 401 for the same reason
        if (!encoder.matches(req.currentAuthHash(), user.getAuthHash())) {
            fail(userId, failKey, "Wrong current master password");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current master password is incorrect");
        }

        if (user.isMfaEnabled() && !mfa.checkSecondFactor(user, req.mfaCode())) {
            fail(userId, failKey, "Wrong 2FA code");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid 2FA or recovery code");
        }

        if (req.newAuthHash().equals(req.currentAuthHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The new master password must be different from the current one");
        }

        // The request must contain exactly this user's items: no more, no fewer, no duplicates.
        // Otherwise an item could be left encrypted with the old key and become unreadable.
        List<VaultItem> existing = items.findByUserId(userId);
        Set<String> existingIds = existing.stream().map(VaultItem::getId).collect(Collectors.toSet());

        Map<String, AccountDtos.ReencryptedItem> byId = new HashMap<>();
        for (AccountDtos.ReencryptedItem r : req.items()) {
            if (byId.put(r.id(), r) != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate item in request");
            }
        }
        if (byId.size() != existing.size() || !byId.keySet().equals(existingIds)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Your vault changed while updating. Please try again.");
        }

        Instant now = Instant.now();
        for (VaultItem item : existing) {
            AccountDtos.ReencryptedItem r = byId.get(item.getId());
            item.setEncryptedData(r.encryptedData());
            item.setIv(r.iv());
            item.setUpdatedAt(now);
        }
        items.saveAll(existing);

        user.setAuthHash(encoder.encode(req.newAuthHash()));
        users.save(user);

        limiter.reset(failKey);
        // Every sign-in on every device must use the new password
        refreshTokens.revokeAllForUser(userId);
        audit.record(userId, AuditAction.PASSWORD_CHANGED,
                "Master password changed, " + existing.size() + " items re-encrypted");
    }

    /** Ends every refresh session. Access tokens already issued expire within minutes. */
    public void logoutEverywhere(String userId) {
        refreshTokens.revokeAllForUser(userId);
        audit.record(userId, AuditAction.LOGOUT_ALL, "Signed out of all devices");
    }

    private void fail(String userId, String failKey, String reason) {
        limiter.hit(failKey, WINDOW_MS);
        audit.record(userId, AuditAction.PASSWORD_CHANGE_FAILED, reason);
    }
}
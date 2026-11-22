package com.example.passwordmanager.service;

import com.example.passwordmanager.model.AuditAction;
import com.example.passwordmanager.model.RefreshToken;
import com.example.passwordmanager.repository.RefreshTokenRepository;
import com.example.passwordmanager.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {

    public record Issued(String token, Instant expiresAt) {}
    public record Rotation(String userId, Issued issued) {}

    // Two requests carrying the same token within this window (e.g. two tabs) are treated as a
    // harmless race: the second is rejected, but the sign-in is not revoked.
    private static final Duration REUSE_GRACE = Duration.ofSeconds(10);

    private final RefreshTokenRepository repo;
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final AuditService audit;
    private final Duration ttl;
    private final Duration maxSession;
    private final SecureRandom random = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository repo, MongoTemplate mongo, UserRepository users,
                               AuditService audit,
                               @Value("${app.refresh.ttl-hours}") long ttlHours,
                               @Value("${app.refresh.max-session-hours}") long maxSessionHours) {
        this.repo = repo;
        this.mongo = mongo;
        this.users = users;
        this.audit = audit;
        this.ttl = Duration.ofHours(ttlHours);
        this.maxSession = Duration.ofHours(maxSessionHours);
    }

    /** Starts a new sign-in (a new token family). */
    public Issued issue(String userId) {
        Instant now = Instant.now();
        return create(userId, UUID.randomUUID().toString(), now.plus(maxSession), now);
    }

    /**
     * Exchanges a refresh token for a new one. Empty means: reject with 401.
     * The "claim" is a single atomic database update, so two requests can never both succeed
     * with the same token.
     */
    public Optional<Rotation> rotate(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > 200) return Optional.empty();

        String hash = hash(raw);
        Instant now = Instant.now();

        RefreshToken claimed = mongo.findAndModify(
                Query.query(Criteria.where("tokenHash").is(hash).and("rotated").is(false).and("revoked").is(false)),
                new Update().set("rotated", true).set("rotatedAt", now),
                FindAndModifyOptions.options().returnNew(false),
                RefreshToken.class);

        if (claimed == null) {
            // Unknown, revoked, or already used. A used token presented outside the grace
            // window means it was probably stolen: end the whole sign-in.
            repo.findByTokenHash(hash).ifPresent(existing -> {
                if (existing.isRotated() && !existing.isRevoked() && existing.getRotatedAt() != null
                        && now.isAfter(existing.getRotatedAt().plus(REUSE_GRACE))) {
                    revokeFamily(existing.getFamilyId());
                    audit.record(existing.getUserId(), AuditAction.REFRESH_REUSE_DETECTED,
                            "An old session token was reused. That sign-in was ended.");
                }
            });
            return Optional.empty();
        }

        if (!claimed.getExpiresAt().isAfter(now) || !claimed.getFamilyExpiresAt().isAfter(now)) {
            return Optional.empty();
        }
        if (!users.existsById(claimed.getUserId())) {
            revokeFamily(claimed.getFamilyId());
            return Optional.empty();
        }

        Issued next = create(claimed.getUserId(), claimed.getFamilyId(), claimed.getFamilyExpiresAt(), now);
        return Optional.of(new Rotation(claimed.getUserId(), next));
    }

    /** Ends the sign-in this token belongs to. Safe to call with an unknown token. */
    public void revokeByRawToken(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > 200) return;
        repo.findByTokenHash(hash(raw)).ifPresent(t -> revokeFamily(t.getFamilyId()));
    }

    /** Ends every sign-in for the user. */
    public void revokeAllForUser(String userId) {
        List<RefreshToken> all = repo.findByUserId(userId);
        all.forEach(t -> t.setRevoked(true));
        repo.saveAll(all);
    }

    private void revokeFamily(String familyId) {
        List<RefreshToken> family = repo.findByFamilyId(familyId);
        family.forEach(t -> t.setRevoked(true));
        repo.saveAll(family);
    }

    private Issued create(String userId, String familyId, Instant familyExpiresAt, Instant now) {
        String raw = newToken();
        Instant expires = now.plus(ttl);
        if (expires.isAfter(familyExpiresAt)) expires = familyExpiresAt;

        RefreshToken t = new RefreshToken();
        t.setTokenHash(hash(raw));
        t.setUserId(userId);
        t.setFamilyId(familyId);
        t.setFamilyExpiresAt(familyExpiresAt);
        t.setExpiresAt(expires);
        repo.save(t);
        return new Issued(raw, expires);
    }

    private String newToken() {
        byte[] bytes = new byte[32]; // 256 bits
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    // Tokens are high-entropy random values, so a fast hash is appropriate here
    private static String hash(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
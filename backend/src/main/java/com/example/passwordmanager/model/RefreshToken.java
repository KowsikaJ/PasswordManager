package com.example.passwordmanager.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document("refresh_tokens")
public class RefreshToken {
    @Id
    private String id;

    @Indexed(unique = true)
    private String tokenHash;      // SHA-256 of the token; the token itself is never stored

    @Indexed
    private String userId;

    @Indexed
    private String familyId;       // all tokens from one sign-in share a family

    private Instant createdAt = Instant.now();
    private Instant familyExpiresAt;  // absolute cap for the whole sign-in

    // The document is deleted automatically once this time passes
    @Indexed(expireAfter = "0s")
    private Instant expiresAt;

    private boolean rotated = false;
    private Instant rotatedAt;
    private boolean revoked = false;

    public String getId() { return id; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getFamilyId() { return familyId; }
    public void setFamilyId(String familyId) { this.familyId = familyId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getFamilyExpiresAt() { return familyExpiresAt; }
    public void setFamilyExpiresAt(Instant familyExpiresAt) { this.familyExpiresAt = familyExpiresAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public boolean isRotated() { return rotated; }
    public void setRotated(boolean rotated) { this.rotated = rotated; }
    public Instant getRotatedAt() { return rotatedAt; }
    public void setRotatedAt(Instant rotatedAt) { this.rotatedAt = rotatedAt; }
    public boolean isRevoked() { return revoked; }
    public void setRevoked(boolean revoked) { this.revoked = revoked; }
}
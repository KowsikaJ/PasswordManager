package com.example.passwordmanager.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document("users")
public class User {
    @Id
    private String id;
    @Indexed(unique = true)
    private String email;
    private String authHash;
    private Instant createdAt = Instant.now();

    // MFA
    private boolean mfaEnabled = false;
    private String totpSecret;                 // set at setup, active once mfaEnabled = true
    private long lastTotpStep = 0;             // blocks reuse of the same code
    private List<String> recoveryCodeHashes = new ArrayList<>();

    public String getId() { return id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAuthHash() { return authHash; }
    public void setAuthHash(String authHash) { this.authHash = authHash; }
    public Instant getCreatedAt() { return createdAt; }

    public boolean isMfaEnabled() { return mfaEnabled; }
    public void setMfaEnabled(boolean mfaEnabled) { this.mfaEnabled = mfaEnabled; }
    public String getTotpSecret() { return totpSecret; }
    public void setTotpSecret(String totpSecret) { this.totpSecret = totpSecret; }
    public long getLastTotpStep() { return lastTotpStep; }
    public void setLastTotpStep(long lastTotpStep) { this.lastTotpStep = lastTotpStep; }
    public List<String> getRecoveryCodeHashes() { return recoveryCodeHashes; }
    public void setRecoveryCodeHashes(List<String> hashes) { this.recoveryCodeHashes = hashes; }
}
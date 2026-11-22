package com.example.passwordmanager.service;

import com.example.passwordmanager.dto.MfaDtos;
import com.example.passwordmanager.model.AuditAction;
import com.example.passwordmanager.model.User;
import com.example.passwordmanager.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

@Service
public class MfaService {
    private static final String ISSUER = "SecureVault";
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private final UserRepository users;
    private final TotpService totp;
    private final AuditService audit;
    private final SecureRandom random = new SecureRandom();

    public MfaService(UserRepository users, TotpService totp, AuditService audit) {
        this.users = users;
        this.totp = totp;
        this.audit = audit;
    }

    public MfaDtos.StatusResponse status(String userId) {
        return new MfaDtos.StatusResponse(getUser(userId).isMfaEnabled());
    }

    /** Step 1: create a pending secret. MFA is not active until enable() succeeds. */
    public MfaDtos.SetupResponse setup(String userId) {
        User user = getUser(userId);
        if (user.isMfaEnabled()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "MFA is already enabled");
        }
        String secret = totp.generateSecret();
        user.setTotpSecret(secret);
        users.save(user);
        audit.record(userId, AuditAction.MFA_SETUP_STARTED, "2FA setup started");
        return new MfaDtos.SetupResponse(secret, totp.otpAuthUri(ISSUER, user.getEmail(), secret));
    }

    /** Step 2: confirm with a code from the app, activate MFA, return recovery codes (shown once). */
    public MfaDtos.RecoveryCodesResponse enable(String userId, String code) {
        User user = getUser(userId);
        if (user.isMfaEnabled() || user.getTotpSecret() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start setup first");
        }
        long step = totp.verify(user.getTotpSecret(), code.trim(), user.getLastTotpStep());
        if (step < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid code");
        }
        List<String> plain = generateRecoveryCodes();
        user.setMfaEnabled(true);
        user.setLastTotpStep(step);
        user.setRecoveryCodeHashes(new ArrayList<>(plain.stream()
                .map(c -> hash(normalize(c))).toList()));
        users.save(user);
        audit.record(userId, AuditAction.MFA_ENABLED, "2FA enabled, recovery codes generated");
        return new MfaDtos.RecoveryCodesResponse(plain);
    }

    public void disable(String userId, String code) {
        User user = getUser(userId);
        if (!user.isMfaEnabled()) return;
        if (!checkSecondFactor(user, code)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid code");
        }
        user.setMfaEnabled(false);
        user.setTotpSecret(null);
        user.setLastTotpStep(0);
        user.setRecoveryCodeHashes(new ArrayList<>());
        users.save(user);
        audit.record(userId, AuditAction.MFA_DISABLED, "2FA disabled");
    }

    /** Accepts a 6-digit TOTP code or a one-time recovery code. Persists state on success. */
    public boolean checkSecondFactor(User user, String code) {
        if (code == null) return false;
        String c = code.trim();

        if (c.matches("\\d{6}")) {
            long step = totp.verify(user.getTotpSecret(), c, user.getLastTotpStep());
            if (step < 0) return false;
            user.setLastTotpStep(step);
            users.save(user);
            return true;
        }

        // Recovery code: single use
        if (user.getRecoveryCodeHashes().remove(hash(normalize(c)))) {
            users.save(user);
            audit.record(user.getId(), AuditAction.RECOVERY_CODE_USED,
                    user.getRecoveryCodeHashes().size() + " recovery codes left");
            return true;
        }
        return false;
    }

    private User getUser(String userId) {
        // 404 rather than 401, so the frontend doesn't read it as "session expired"
        return users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private List<String> generateRecoveryCodes() {
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < 10; j++) sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            codes.add(sb.substring(0, 5) + "-" + sb.substring(5));
        }
        return codes;
    }

    private static String normalize(String code) {
        return code.toUpperCase().replaceAll("[^A-Z2-7]", "");
    }

    // Recovery codes are high-entropy random values, so a fast hash is fine here
    private static String hash(String s) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
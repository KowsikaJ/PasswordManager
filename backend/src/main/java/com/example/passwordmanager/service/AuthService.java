package com.example.passwordmanager.service;

import com.example.passwordmanager.dto.AuthRequest;
import com.example.passwordmanager.dto.AuthResponse;
import com.example.passwordmanager.dto.MfaDtos;
import com.example.passwordmanager.model.AuditAction;
import com.example.passwordmanager.model.User;
import com.example.passwordmanager.repository.UserRepository;
import com.example.passwordmanager.security.JwtService;
import com.example.passwordmanager.security.RateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    private static final int LOGIN_MAX_FAILS = 10;
    private static final long LOGIN_WINDOW_MS = 15 * 60_000L;
    private static final int MFA_MAX_FAILS = 5;
    private static final long MFA_WINDOW_MS = 5 * 60_000L;

    /** The JSON body, plus the refresh token that the controller puts into a cookie (may be null). */
    public record Result(AuthResponse response, RefreshTokenService.Issued refresh) {}

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final MfaService mfa;
    private final AuditService audit;
    private final RateLimiter limiter;
    private final RefreshTokenService refreshTokens;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtService jwt,
                       MfaService mfa, AuditService audit, RateLimiter limiter,
                       RefreshTokenService refreshTokens) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.mfa = mfa;
        this.audit = audit;
        this.limiter = limiter;
        this.refreshTokens = refreshTokens;
    }

    public AuthResponse register(AuthRequest req) {
        String email = req.email().trim().toLowerCase();
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        User user = new User();
        user.setEmail(email);
        user.setAuthHash(encoder.encode(req.authHash()));
        users.save(user);
        audit.record(user.getId(), AuditAction.REGISTER, "Account created");
        // No session is issued: the user signs in next
        return new AuthResponse(null, false, null);
    }

    public Result login(AuthRequest req) {
        String email = req.email().trim().toLowerCase();

        // Keyed by the email string whether or not the account exists, so this doesn't reveal accounts
        String failKey = "login-fail:" + email;
        limiter.requireBelow(failKey, LOGIN_MAX_FAILS);

        User user = users.findByEmail(email).orElse(null);

        if (user == null || !encoder.matches(req.authHash(), user.getAuthHash())) {
            limiter.hit(failKey, LOGIN_WINDOW_MS);
            if (user != null) {
                audit.record(user.getId(), AuditAction.LOGIN_FAILED, "Wrong master password");
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        limiter.reset(failKey);

        if (user.isMfaEnabled()) {
            // Password OK, but no real session until the second factor is verified.
            return new Result(new AuthResponse(null, true, jwt.generateMfaToken(user.getId())), null);
        }

        audit.record(user.getId(), AuditAction.LOGIN_SUCCESS, "Signed in");
        return new Result(new AuthResponse(jwt.generateToken(user.getId()), false, null),
                refreshTokens.issue(user.getId()));
    }

    public Result verifyMfa(MfaDtos.VerifyRequest req) {
        String userId;
        try {
            userId = jwt.extractUserId(req.mfaToken(), "mfa");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired MFA session");
        }

        // Keyed by user, not by token: logging in again does not reset the counter
        String failKey = "mfa-fail:" + userId;
        limiter.requireBelow(failKey, MFA_MAX_FAILS);

        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid MFA session"));

        if (!user.isMfaEnabled() || !mfa.checkSecondFactor(user, req.code())) {
            limiter.hit(failKey, MFA_WINDOW_MS);
            audit.record(user.getId(), AuditAction.MFA_LOGIN_FAILED, "Wrong 2FA or recovery code");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid code");
        }

        limiter.reset(failKey);
        audit.record(user.getId(), AuditAction.MFA_LOGIN_SUCCESS, "Signed in with 2FA");
        return new Result(new AuthResponse(jwt.generateToken(user.getId()), false, null),
                refreshTokens.issue(user.getId()));
    }
}
package com.example.passwordmanager.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.util.Date;

@Service
public class JwtService {
    private static final long MFA_TOKEN_MS = 5 * 60 * 1000L;

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expiration-ms}") long expirationMs) {
        byte[] bytes;
        try {
            bytes = Decoders.BASE64.decode(secret);
        } catch (Exception e) {
            throw new IllegalStateException("JWT_SECRET must be a Base64 string (see setup notes).", e);
        }
        if (bytes.length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET is too short: it must decode to at least 32 bytes (256 bits).");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.expirationMs = expirationMs;
    }

    /** Full session token. */
    public String generateToken(String userId) {
        return build(userId, "access", expirationMs);
    }

    /** Short-lived token issued after the password step, valid only for /api/auth/mfa/verify. */
    public String generateMfaToken(String userId) {
        return build(userId, "mfa", MFA_TOKEN_MS);
    }

    /** Returns the userId, or throws if the token is invalid, expired, or of the wrong type. */
    public String extractUserId(String token, String expectedType) {
        Claims claims = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
        if (!expectedType.equals(claims.get("type", String.class))) {
            throw new JwtException("Wrong token type");
        }
        return claims.getSubject();
    }

    private String build(String userId, String type, long ttlMs) {
        Date now = new Date();
        return Jwts.builder()
                .subject(userId)
                .claim("type", type)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + ttlMs))
                .signWith(key)
                .compact();
    }
}
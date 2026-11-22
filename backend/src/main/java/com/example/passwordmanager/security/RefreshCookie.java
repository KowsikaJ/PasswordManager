package com.example.passwordmanager.security;

import com.example.passwordmanager.service.RefreshTokenService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.time.Instant;

@Component
public class RefreshCookie {
    public static final String NAME = "pm_refresh";
    // Only sent to the auth endpoints, never with vault requests
    private static final String PATH = "/api/auth";

    private final boolean secure;
    private final String sameSite;

    public RefreshCookie(@Value("${app.cookie.secure}") boolean secure,
                         @Value("${app.cookie.same-site}") String sameSite) {
        this.secure = secure;
        this.sameSite = sameSite;
    }

    /** Value for a Set-Cookie header that stores the token. */
    public String header(RefreshTokenService.Issued issued) {
        Duration maxAge = Duration.between(Instant.now(), issued.expiresAt());
        if (maxAge.isNegative()) maxAge = Duration.ZERO;
        return build(issued.token(), maxAge);
    }

    /** Value for a Set-Cookie header that deletes the cookie. */
    public String clearHeader() {
        return build("", Duration.ZERO);
    }

    public String read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (NAME.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private String build(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path(PATH)
                .maxAge(maxAge)
                .build()
                .toString();
    }
}
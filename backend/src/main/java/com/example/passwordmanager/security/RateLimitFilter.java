package com.example.passwordmanager.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Map;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(String name, int max, long windowMs) {}

    private static final Map<String, Rule> RULES = Map.of(
            "/api/auth/login", new Rule("login", 20, 5 * 60_000L),
            "/api/auth/register", new Rule("register", 5, 60 * 60_000L),
            "/api/auth/mfa/verify", new Rule("mfa", 15, 5 * 60_000L),
            "/api/auth/refresh", new Rule("refresh", 60, 5 * 60_000L));

    private final RateLimiter limiter;

    public RateLimitFilter(RateLimiter limiter) {
        this.limiter = limiter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        Rule rule = "POST".equalsIgnoreCase(request.getMethod())
                ? RULES.get(request.getRequestURI()) : null;

        if (rule != null) {
            // getRemoteAddr is the real peer address. X-Forwarded-For is not trusted (spoofable).
            String key = "ip:" + rule.name() + ":" + request.getRemoteAddr();
            if (limiter.hit(key, rule.windowMs()) > rule.max()) {
                long retryAfter = limiter.retryAfterSeconds(key);
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(retryAfter));
                response.setContentType("application/problem+json");
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"Too Many Requests\","
                        + "\"status\":429,\"detail\":\"Too many requests. Please try again in "
                        + retryAfter + " seconds.\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
package com.example.passwordmanager.security;

import com.example.passwordmanager.exception.TooManyRequestsException;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;

/** Simple in-memory fixed-window counter. */
@Component
public class RateLimiter {

    private static final class Window {
        final long start;
        final long windowMs;
        volatile int count;

        Window(long start, long windowMs) {
            this.start = start;
            this.windowMs = windowMs;
        }

        boolean expired(long now) {
            return now - start >= windowMs;
        }
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    /** Counts one hit for the key and returns the new count in the current window. */
    public int hit(String key, long windowMs) {
        long now = System.currentTimeMillis();
        Window w = windows.compute(key, (k, old) -> {
            if (old == null || old.expired(now)) old = new Window(now, windowMs);
            old.count++;
            return old;
        });
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(e -> e.getValue().expired(now));
        }
        return w.count;
    }

    public int count(String key) {
        Window w = windows.get(key);
        if (w == null || w.expired(System.currentTimeMillis())) return 0;
        return w.count;
    }

    public long retryAfterSeconds(String key) {
        Window w = windows.get(key);
        if (w == null) return 1;
        long remainingMs = w.windowMs - (System.currentTimeMillis() - w.start);
        return Math.max(1, (remainingMs + 999) / 1000);
    }

    public void reset(String key) {
        windows.remove(key);
    }

    /** Throws 429 if the key has already reached `max` hits in its window. */
    public void requireBelow(String key, int max) {
        if (count(key) >= max) {
            throw new TooManyRequestsException(
                    "Too many failed attempts. Please try again later.", retryAfterSeconds(key));
        }
    }
}
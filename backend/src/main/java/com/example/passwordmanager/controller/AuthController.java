package com.example.passwordmanager.controller;

import com.example.passwordmanager.dto.AuthRequest;
import com.example.passwordmanager.dto.AuthResponse;
import com.example.passwordmanager.dto.MfaDtos;
import com.example.passwordmanager.security.JwtService;
import com.example.passwordmanager.security.RefreshCookie;
import com.example.passwordmanager.service.AuthService;
import com.example.passwordmanager.service.RefreshTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final RefreshTokenService refreshTokens;
    private final RefreshCookie cookie;
    private final JwtService jwt;

    public AuthController(AuthService auth, RefreshTokenService refreshTokens,
                          RefreshCookie cookie, JwtService jwt) {
        this.auth = auth;
        this.refreshTokens = refreshTokens;
        this.cookie = cookie;
        this.jwt = jwt;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody AuthRequest req) {
        return auth.register(req);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody AuthRequest req, HttpServletResponse res) {
        return finish(auth.login(req), res);
    }

    @PostMapping("/mfa/verify")
    public AuthResponse verifyMfa(@Valid @RequestBody MfaDtos.VerifyRequest req, HttpServletResponse res) {
        return finish(auth.verifyMfa(req), res);
    }

    /** Swaps the refresh cookie for a new access token and a new cookie. */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest req) {
        if (!isAjax(req)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        Optional<RefreshTokenService.Rotation> rotation = refreshTokens.rotate(cookie.read(req));
        if (rotation.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, cookie.clearHeader())
                    .build();
        }
        RefreshTokenService.Rotation r = rotation.get();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.header(r.issued()))
                .body(new AuthResponse(jwt.generateToken(r.userId()), false, null));
    }

    /** Ends this browser's sign-in. Always succeeds, so locking never hangs on it. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest req) {
        if (!isAjax(req)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

        refreshTokens.revokeByRawToken(cookie.read(req));
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie.clearHeader())
                .build();
    }

    private AuthResponse finish(AuthService.Result result, HttpServletResponse res) {
        if (result.refresh() != null) {
            res.addHeader(HttpHeaders.SET_COOKIE, cookie.header(result.refresh()));
        }
        return result.response();
    }

    // A custom header can't be sent by a cross-site form or image, and a cross-origin
    // fetch needs a CORS preflight that only our own frontend origin passes.
    private static boolean isAjax(HttpServletRequest req) {
        return "XMLHttpRequest".equals(req.getHeader("X-Requested-With"));
    }
}
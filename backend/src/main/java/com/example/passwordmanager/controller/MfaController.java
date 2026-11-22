package com.example.passwordmanager.controller;

import com.example.passwordmanager.dto.MfaDtos;
import com.example.passwordmanager.service.MfaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mfa")
public class MfaController {
    private final MfaService mfa;

    public MfaController(MfaService mfa) {
        this.mfa = mfa;
    }

    @GetMapping("/status")
    public MfaDtos.StatusResponse status(Authentication auth) {
        return mfa.status(auth.getName());
    }

    @PostMapping("/setup")
    public MfaDtos.SetupResponse setup(Authentication auth) {
        return mfa.setup(auth.getName());
    }

    @PostMapping("/enable")
    public MfaDtos.RecoveryCodesResponse enable(@Valid @RequestBody MfaDtos.CodeRequest req,
                                                Authentication auth) {
        return mfa.enable(auth.getName(), req.code());
    }

    @PostMapping("/disable")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disable(@Valid @RequestBody MfaDtos.CodeRequest req, Authentication auth) {
        mfa.disable(auth.getName(), req.code());
    }
}
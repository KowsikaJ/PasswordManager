package com.example.passwordmanager.controller;

import com.example.passwordmanager.dto.AccountDtos;
import com.example.passwordmanager.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final AccountService account;

    public AccountController(AccountService account) {
        this.account = account;
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody AccountDtos.ChangePasswordRequest req,
                               Authentication auth) {
        account.changePassword(auth.getName(), req);
    }

    @PostMapping("/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutAll(Authentication auth) {
        account.logoutEverywhere(auth.getName());
    }
}
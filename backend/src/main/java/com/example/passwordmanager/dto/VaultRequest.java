package com.example.passwordmanager.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VaultRequest(
        @NotBlank @Size(max = 20000) String encryptedData,
        @NotBlank @Size(max = 64) String iv) {}
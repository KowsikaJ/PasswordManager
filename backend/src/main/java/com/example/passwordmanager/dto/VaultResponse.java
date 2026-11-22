package com.example.passwordmanager.dto;

import java.time.Instant;

public record VaultResponse(String id, String encryptedData, String iv, Instant updatedAt) {}
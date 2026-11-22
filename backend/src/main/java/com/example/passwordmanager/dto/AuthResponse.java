package com.example.passwordmanager.dto;

public record AuthResponse(String token, boolean mfaRequired, String mfaToken) {}
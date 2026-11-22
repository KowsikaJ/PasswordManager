package com.example.passwordmanager.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class MfaDtos {
    private MfaDtos() {}

    public record CodeRequest(@NotBlank @Size(max = 20) String code) {}

    public record VerifyRequest(@NotBlank @Size(max = 2000) String mfaToken,
                                @NotBlank @Size(max = 20) String code) {}

    public record SetupResponse(String secret, String otpAuthUri) {}

    public record RecoveryCodesResponse(List<String> codes) {}

    public record StatusResponse(boolean enabled) {}
}
package com.example.passwordmanager.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class AccountDtos {
    private AccountDtos() {}

    public record ReencryptedItem(
            @NotBlank @Size(max = 64) String id,
            @NotBlank @Size(max = 20000) String encryptedData,
            @NotBlank @Size(max = 64) String iv) {}

    public record ChangePasswordRequest(
            @NotBlank @Size(min = 20, max = 200) String currentAuthHash,
            @NotBlank @Size(min = 20, max = 200) String newAuthHash,
            @Size(max = 20) String mfaCode,
            @NotNull @Size(max = 5000) List<@Valid ReencryptedItem> items) {}
}
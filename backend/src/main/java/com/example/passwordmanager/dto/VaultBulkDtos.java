package com.example.passwordmanager.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class VaultBulkDtos {
    private VaultBulkDtos() {}

    public record BulkRequest(@NotNull @Size(min = 1, max = 500) List<@NotNull @Valid VaultRequest> items) {}

    public record BulkResponse(int created) {}

    public record ExportLogRequest(
            @NotBlank @Pattern(regexp = "csv|encrypted-json") String format,
            @Min(0) @Max(100000) int count) {}
}
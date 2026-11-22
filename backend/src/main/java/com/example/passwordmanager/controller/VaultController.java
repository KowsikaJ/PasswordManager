package com.example.passwordmanager.controller;

import com.example.passwordmanager.dto.VaultBulkDtos;
import com.example.passwordmanager.dto.VaultRequest;
import com.example.passwordmanager.dto.VaultResponse;
import com.example.passwordmanager.service.VaultService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/vault")
public class VaultController {
    private final VaultService vault;

    public VaultController(VaultService vault) {
        this.vault = vault;
    }

    @GetMapping
    public List<VaultResponse> list(Authentication auth) {
        return vault.list(auth.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VaultResponse create(@Valid @RequestBody VaultRequest req, Authentication auth) {
        return vault.create(auth.getName(), req);
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public VaultBulkDtos.BulkResponse bulk(@Valid @RequestBody VaultBulkDtos.BulkRequest req,
                                           Authentication auth) {
        return new VaultBulkDtos.BulkResponse(vault.createBulk(auth.getName(), req.items()));
    }

    /** The export itself happens in the browser. This only records that it happened. */
    @PostMapping("/export-log")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void exportLog(@Valid @RequestBody VaultBulkDtos.ExportLogRequest req, Authentication auth) {
        vault.logExport(auth.getName(), req.format(), req.count());
    }

    @PutMapping("/{id}")
    public VaultResponse update(@PathVariable String id, @Valid @RequestBody VaultRequest req,
                                Authentication auth) {
        return vault.update(auth.getName(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, Authentication auth) {
        vault.delete(auth.getName(), id);
    }
}
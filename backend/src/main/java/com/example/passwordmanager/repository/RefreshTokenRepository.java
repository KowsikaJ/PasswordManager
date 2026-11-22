package com.example.passwordmanager.repository;

import com.example.passwordmanager.model.RefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends MongoRepository<RefreshToken, String> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    List<RefreshToken> findByFamilyId(String familyId);
    List<RefreshToken> findByUserId(String userId);
}
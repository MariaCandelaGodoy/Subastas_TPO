package com.bidvault.api;

import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(ApiException.class)
  ResponseEntity<Map<String, Object>> api(ApiException ex) {
    return ResponseEntity.status(ex.status()).body(Map.of("error", ex.getMessage(), "status", ex.status().value()));
  }

  @ExceptionHandler(DuplicateKeyException.class)
  ResponseEntity<Map<String, Object>> duplicate(DuplicateKeyException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "El registro ya existe", "status", 409));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, Object>> invalid(MethodArgumentNotValidException ex) {
    return ResponseEntity.badRequest().body(Map.of("error", "Datos inválidos", "status", 400));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> generic(Exception ex) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", ex.getMessage(), "status", 500));
  }
}

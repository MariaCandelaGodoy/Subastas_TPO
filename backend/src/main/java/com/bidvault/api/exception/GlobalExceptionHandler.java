package com.bidvault.api.exception;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(ApiException.class)
  ResponseEntity<Map<String, Object>> api(ApiException ex) {
    return ResponseEntity.status(ex.status()).body(Map.of("error", ex.getMessage(), "status", ex.status().value()));
  }

  @ExceptionHandler(DuplicateKeyException.class)
  ResponseEntity<Map<String, Object>> duplicate(DuplicateKeyException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "El registro ya existe.", "status", 409));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, Object>> invalid(MethodArgumentNotValidException ex) {
    return ResponseEntity.badRequest().body(Map.of("error", "Datos invalidos.", "status", 400));
  }

  @ExceptionHandler(DataAccessException.class)
  ResponseEntity<Map<String, Object>> database(DataAccessException ex) {
    log.error("Database error", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "No pudimos completar la operacion en la base de datos. Revisa los datos e intenta nuevamente.", "status", 500));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> generic(Exception ex) {
    log.error("Unexpected error", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "Ocurrio un error inesperado. Intenta nuevamente.", "status", 500));
  }
}

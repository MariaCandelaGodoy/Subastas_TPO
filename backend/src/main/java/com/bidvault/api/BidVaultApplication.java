package com.bidvault.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BidVaultApplication {
  public static void main(String[] args) {
    SpringApplication.run(BidVaultApplication.class, args);
  }
}

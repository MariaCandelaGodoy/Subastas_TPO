package com.bidvault.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import java.util.concurrent.CompletableFuture;

@Service
public class EmailService {
  private static final Logger log = LoggerFactory.getLogger(EmailService.class);
  private final ObjectProvider<JavaMailSender> mailSender;
  private final boolean enabled;
  private final String from;

  public EmailService(ObjectProvider<JavaMailSender> mailSender,
                      @Value("${app.mail.enabled:false}") boolean enabled,
                      @Value("${app.mail.from:no-reply@bidvault.local}") String from) {
    this.mailSender = mailSender;
    this.enabled = enabled;
    this.from = from;
  }

  public void sendTemporaryPassword(String to, String fullName, String temporaryPassword) {
    if (!enabled) {
      log.warn("MAIL DESHABILITADO. Password temporal para {} <{}>: {}", fullName, to, temporaryPassword);
      return;
    }

    CompletableFuture.runAsync(() -> sendTemporaryPasswordNow(to, fullName, temporaryPassword));
  }

  private void sendTemporaryPasswordNow(String to, String fullName, String temporaryPassword) {
    try {
      JavaMailSender sender = mailSender.getIfAvailable();
      if (sender == null) {
        log.warn("No hay JavaMailSender configurado. Password temporal para {} <{}>: {}", fullName, to, temporaryPassword);
        return;
      }

      SimpleMailMessage message = new SimpleMailMessage();
      message.setFrom(from);
      message.setTo(to);
      message.setSubject("BidVault - Password temporal");
      message.setText("""
          Hola %s,

          Tu registro en BidVault fue recibido.
          Para iniciar sesion por primera vez usa esta password temporal:

          %s

          Al ingresar, el sistema te va a pedir que la cambies desde Editar Perfil.

          BidVault
          """.formatted(fullName, temporaryPassword));
      sender.send(message);
      log.info("Password temporal enviada a {}", to);
      System.out.println( "Password temporal enviada a " + to);
    } catch (Exception ex) {
      log.error("No se pudo enviar el mail a {}. Password temporal de contingencia: {}", to, temporaryPassword, ex);
      System.out.println(ex);
    }
  }
}

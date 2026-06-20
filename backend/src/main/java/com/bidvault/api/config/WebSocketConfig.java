package com.bidvault.api.config;

import com.bidvault.api.service.AuctionRealtimeHub;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
  private final AuctionRealtimeHub auctionRealtimeHub;

  public WebSocketConfig(AuctionRealtimeHub auctionRealtimeHub) {
    this.auctionRealtimeHub = auctionRealtimeHub;
  }

  @Override
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    registry.addHandler(auctionRealtimeHub, "/ws/auctions/{auctionId}")
        .setAllowedOrigins("*");
  }
}

package com.bidvault.api.service;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class AuctionRealtimeHub extends TextWebSocketHandler {
  private final Map<Integer, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();
  private final Map<String, Integer> sessionRooms = new ConcurrentHashMap<>();

  @Override
  public void afterConnectionEstablished(WebSocketSession session) throws Exception {
    int auctionId = auctionId(session.getUri());
    rooms.computeIfAbsent(auctionId, key -> ConcurrentHashMap.newKeySet()).add(session);
    sessionRooms.put(session.getId(), auctionId);
    session.sendMessage(new TextMessage("{\"tipo\":\"CONECTADO\",\"subastaId\":" + auctionId + "}"));
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    Integer auctionId = sessionRooms.remove(session.getId());
    if (auctionId == null) return;
    Set<WebSocketSession> room = rooms.get(auctionId);
    if (room != null) {
      room.remove(session);
      if (room.isEmpty()) rooms.remove(auctionId);
    }
  }

  public void publish(int auctionId, Map<String, Object> payload) {
    String json = toJson(payload);
    Set<WebSocketSession> room = rooms.get(auctionId);
    if (room == null || room.isEmpty()) return;
    for (WebSocketSession session : room) {
      if (!session.isOpen()) continue;
      try {
        session.sendMessage(new TextMessage(json));
      } catch (IOException ignored) {
        try {
          session.close();
        } catch (IOException ignoredAgain) {
          // best effort cleanup
        }
      }
    }
  }

  private int auctionId(URI uri) {
    String path = uri == null ? "" : uri.getPath();
    String[] parts = path.split("/");
    return Integer.parseInt(parts[parts.length - 1]);
  }

  private String toJson(Map<String, Object> payload) {
    StringBuilder builder = new StringBuilder("{");
    boolean first = true;
    for (var entry : payload.entrySet()) {
      if (!first) builder.append(',');
      first = false;
      builder.append('"').append(escape(entry.getKey())).append('"').append(':');
      Object value = entry.getValue();
      if (value == null) {
        builder.append("null");
      } else if (value instanceof Number || value instanceof Boolean) {
        builder.append(value);
      } else {
        builder.append('"').append(escape(Objects.toString(value))).append('"');
      }
    }
    return builder.append('}').toString();
  }

  private String escape(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }
}

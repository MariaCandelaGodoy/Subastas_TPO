import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class UploadProductPhotos {
  private static final String URL = "jdbc:mysql://localhost:3306/bidvault?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Argentina/Buenos_Aires";
  private static final String USER = "root";
  private static final String PASSWORD = "5090";
  private static final Path ASSETS = Path.of("mobile", "assets", "fotos");

  record Target(int productId, String label, Path folder, String contains, boolean append) {}

  public static void main(String[] args) throws Exception {
    Class.forName("com.mysql.cj.jdbc.Driver");
    try (Connection connection = DriverManager.getConnection(URL, USER, PASSWORD)) {
      connection.setAutoCommit(false);
      List<Target> targets = List.of(
          new Target(findProduct(connection, "Anillo Oval Cut"), "Anillo Oval Cut", ASSETS.resolve("Joyeria Ruiz"), "anillo", true),
          new Target(findProduct(connection, "Collar de Esmeraldas"), "Collar de Esmeraldas", ASSETS.resolve("Joyeria Ruiz"), "collar", true),
          new Target(findCatalogProduct(connection, "Automotores", null), "Automotores", ASSETS.resolve("Automotores"), null, false),
          new Target(findCatalogProduct(connection, "Instrumentos musicales", null), "Instrumentos musicales", ASSETS.resolve("Instrumentos Musicales"), null, false),
          new Target(findCatalogProduct(connection, "Obras de arte", "Obra"), "Obras de arte", ASSETS.resolve("Obras de arte"), null, false)
      );

      for (Target target : targets) {
        List<Path> photos = photos(target.folder(), target.contains());
        if (photos.isEmpty()) {
          throw new IllegalStateException("No encontre fotos para " + target.label() + " en " + target.folder());
        }
        if (!target.append()) {
          deletePhotos(connection, target.productId());
        }
        int before = countPhotos(connection, target.productId());
        for (Path photo : photos) {
          insertPhoto(connection, target.productId(), Files.readAllBytes(photo));
        }
        int after = countPhotos(connection, target.productId());
        System.out.println(target.label() + " -> producto " + target.productId() + " | antes=" + before + " | agregadas=" + photos.size() + " | total=" + after);
      }
      connection.commit();
    }
  }

  private static int findProduct(Connection connection, String title) throws Exception {
    try (PreparedStatement statement = connection.prepareStatement("""
        SELECT identificador
        FROM productos
        WHERE descripcionCatalogo = ?
        ORDER BY identificador
        LIMIT 1
        """)) {
      statement.setString(1, title);
      try (ResultSet rs = statement.executeQuery()) {
        if (rs.next()) return rs.getInt(1);
      }
    }
    throw new IllegalStateException("No encontre producto: " + title);
  }

  private static int findCatalogProduct(Connection connection, String catalog, String productTitleContains) throws Exception {
    String titleFilter = productTitleContains == null ? "" : " AND p.descripcionCatalogo LIKE ? ";
    try (PreparedStatement statement = connection.prepareStatement("""
        SELECT p.identificador
        FROM productos p
        JOIN itemsCatalogo i ON i.producto = p.identificador
        JOIN catalogos c ON c.identificador = i.catalogo
        WHERE c.descripcion = ?
        """ + titleFilter + """
        ORDER BY p.identificador DESC
        LIMIT 1
        """)) {
      statement.setString(1, catalog);
      if (productTitleContains != null) {
        statement.setString(2, "%" + productTitleContains + "%");
      }
      try (ResultSet rs = statement.executeQuery()) {
        if (rs.next()) return rs.getInt(1);
      }
    }
    throw new IllegalStateException("No encontre producto para catalogo: " + catalog);
  }

  private static List<Path> photos(Path folder, String contains) throws Exception {
    if (!Files.isDirectory(folder)) return List.of();
    List<Path> result = new ArrayList<>();
    try (var stream = Files.list(folder)) {
      stream
          .filter(Files::isRegularFile)
          .filter(path -> {
            String name = path.getFileName().toString().toLowerCase();
            boolean image = name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");
            boolean matches = contains == null || name.contains(contains.toLowerCase());
            return image && matches;
          })
          .sorted(Comparator.comparing(path -> path.getFileName().toString().toLowerCase()))
          .forEach(result::add);
    }
    return result;
  }

  private static void deletePhotos(Connection connection, int productId) throws Exception {
    try (PreparedStatement statement = connection.prepareStatement("DELETE FROM fotos WHERE producto=?")) {
      statement.setInt(1, productId);
      statement.executeUpdate();
    }
  }

  private static void insertPhoto(Connection connection, int productId, byte[] bytes) throws Exception {
    try (PreparedStatement statement = connection.prepareStatement("INSERT INTO fotos (producto, foto) VALUES (?, ?)")) {
      statement.setInt(1, productId);
      statement.setBytes(2, bytes);
      statement.executeUpdate();
    }
  }

  private static int countPhotos(Connection connection, int productId) throws Exception {
    try (PreparedStatement statement = connection.prepareStatement("SELECT COUNT(*) FROM fotos WHERE producto=?")) {
      statement.setInt(1, productId);
      try (ResultSet rs = statement.executeQuery()) {
        rs.next();
        return rs.getInt(1);
      }
    }
  }
}

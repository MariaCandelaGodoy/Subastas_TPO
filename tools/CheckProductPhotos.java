import java.sql.Connection;
import java.sql.DriverManager;

public class CheckProductPhotos {
  public static void main(String[] args) throws Exception {
    Class.forName("com.mysql.cj.jdbc.Driver");
    try (Connection connection = DriverManager.getConnection(
        "jdbc:mysql://localhost:3306/bidvault?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Argentina/Buenos_Aires",
        "root",
        "5090");
         var statement = connection.prepareStatement("""
             SELECT p.identificador, p.descripcionCatalogo, COUNT(f.identificador) fotos
             FROM productos p
             LEFT JOIN fotos f ON f.producto = p.identificador
             WHERE p.identificador IN (2,3,4,5,7)
             GROUP BY p.identificador, p.descripcionCatalogo
             ORDER BY p.identificador
             """);
         var rs = statement.executeQuery()) {
      while (rs.next()) {
        System.out.println(rs.getInt("identificador") + " | " + rs.getString("descripcionCatalogo") + " | fotos=" + rs.getInt("fotos"));
      }
    }
  }
}

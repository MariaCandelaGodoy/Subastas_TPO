CREATE TABLE IF NOT EXISTS productos_imagenes_app (
  identificador INT NOT NULL AUTO_INCREMENT,
  producto INT NOT NULL,
  url LONGTEXT NOT NULL,
  orden INT NOT NULL DEFAULT 1,
  CONSTRAINT pk_productos_imagenes_app PRIMARY KEY (identificador),
  CONSTRAINT fk_productos_imagenes_app_productos FOREIGN KEY (producto) REFERENCES productos(identificador)
);

DELETE FROM fotos
WHERE producto IN (
  SELECT DISTINCT producto
  FROM productos_imagenes_app
);

INSERT INTO fotos (producto, foto)
SELECT producto, FROM_BASE64(SUBSTRING_INDEX(url, ',', -1))
FROM productos_imagenes_app
WHERE url LIKE 'data:image/%;base64,%';

DROP TABLE productos_imagenes_app;

USE bidvault;

-- Cambiar este email por el usuario que se quiere validar.
SET @email = 'usuario@bidvault.com';

START TRANSACTION;

UPDATE clientes c
JOIN usuarios_app u ON u.persona = c.identificador
SET c.admitido = 'si'
WHERE u.email = @email;

INSERT INTO mensajes (cliente, titulo, cuerpo, tipo)
SELECT u.persona,
       'Cuenta validada',
       'Tu cuenta fue validada. Desde el login usa Olvide mi contraseña para recibir tu clave temporal.',
       'importante'
FROM usuarios_app u
WHERE u.email = @email
  AND ROW_COUNT() > 0;

COMMIT;

SELECT u.email, p.nombre, c.admitido, c.categoria, u.password_temporal
FROM usuarios_app u
JOIN personas p ON p.identificador = u.persona
JOIN clientes c ON c.identificador = p.identificador
WHERE u.email = @email;

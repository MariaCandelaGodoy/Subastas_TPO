UPDATE mensajes
SET cuerpo = 'Su registro fue recibido. Le enviaremos un correo cuando la validación se complete.'
WHERE titulo = 'Registrado'
  AND cuerpo LIKE 'Su registro fue recibido.%';

UPDATE mensajes
SET titulo = 'Producto enviado a revisión',
    cuerpo = 'Recibimos tu solicitud y la empresa revisará el bien.'
WHERE titulo LIKE 'Producto enviado a%'
  AND cuerpo LIKE 'Recibimos tu solicitud%';

UPDATE mensajes
SET cuerpo = REPLACE(cuerpo, 'ComisiÃƒÆ’Ã‚Â³n', 'Comisión');

UPDATE mensajes
SET cuerpo = REPLACE(cuerpo, 'CoordinÃƒÆ’Ã‚Â¡ envÃƒÆ’Ã‚Â­o', 'Coordiná envío');

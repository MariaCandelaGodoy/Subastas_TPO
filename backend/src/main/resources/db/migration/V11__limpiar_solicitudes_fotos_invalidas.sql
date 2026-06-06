DELETE FROM solicitudes_fotos
WHERE url NOT LIKE 'data:image/%'
  AND url NOT LIKE 'http://%'
  AND url NOT LIKE 'https://%';

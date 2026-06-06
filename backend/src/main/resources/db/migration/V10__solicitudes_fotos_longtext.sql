ALTER TABLE solicitudes_fotos
MODIFY COLUMN url LONGTEXT NOT NULL;

DELETE FROM solicitudes_fotos
WHERE url LIKE 'https://images.unsplash.com/%';

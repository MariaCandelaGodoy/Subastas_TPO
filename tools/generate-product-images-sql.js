const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'mobile', 'assets');
const output = path.join(root, 'backend', 'src', 'main', 'resources', 'db', 'migration', 'V13__productos_imagenes_en_bd.sql');
const databaseOutput = path.join(root, 'database', '13_productos_imagenes_en_bd.sql');

const pairs = [
  [5, 'Anillo-1.png', 1],
  [5, 'Anillo-2.png', 2],
  [5, 'Anillo-3.png', 3],
  [7, 'Collar-1.png', 1],
  [7, 'Collar-2.png', 2],
  [7, 'Collar-3.png', 3],
];

const esc = (value) => value.replace(/'/g, "''");

let sql = 'ALTER TABLE productos_imagenes_app MODIFY url LONGTEXT NOT NULL;\n\n';
sql += 'DELETE FROM productos_imagenes_app WHERE producto IN (5, 7);\n\n';
sql += 'INSERT INTO productos_imagenes_app (producto, url, orden) VALUES\n';
sql += pairs.map(([producto, file, orden]) => {
  const base64 = fs.readFileSync(path.join(assets, file)).toString('base64');
  return `(${producto}, 'data:image/png;base64,${esc(base64)}', ${orden})`;
}).join(',\n');
sql += ';\n';

fs.writeFileSync(output, sql, 'utf8');
fs.writeFileSync(databaseOutput, sql, 'utf8');
console.log(`Generated ${pairs.length} image rows in ${output}`);

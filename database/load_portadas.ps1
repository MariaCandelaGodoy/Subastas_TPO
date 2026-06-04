$ErrorActionPreference = 'Stop'

$mysql = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$assets = Join-Path $root 'mobile\assets'
$tmp = Join-Path $PSScriptRoot 'tmp-portadas'

New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$covers = @(
  @{ Id = 1; File = 'subasta-3.png'; Name = 'obras de arte' },
  @{ Id = 2; File = 'subasta-5.png'; Name = 'automotores' },
  @{ Id = 3; File = 'subasta-2.png'; Name = 'instrumentos' },
  @{ Id = 4; File = 'subasta-1.png'; Name = 'joyas' },
  @{ Id = 5; File = 'subasta-4.png'; Name = 'vestidos' }
)

& $mysql -uroot -p5090 -D bidvault -e "CREATE TABLE IF NOT EXISTS subastas_portadas (identificador INT NOT NULL AUTO_INCREMENT, subasta INT NOT NULL, imagen LONGTEXT NOT NULL, mime_type VARCHAR(80) NOT NULL DEFAULT 'image/png', descripcion VARCHAR(250) NULL, creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT pk_subastas_portadas PRIMARY KEY (identificador), CONSTRAINT uq_subastas_portadas_subasta UNIQUE (subasta), CONSTRAINT fk_subastas_portadas_subastas FOREIGN KEY (subasta) REFERENCES subastas(identificador));"

foreach ($cover in $covers) {
  $source = Join-Path $assets $cover.File
  if (!(Test-Path $source)) {
    Write-Warning "No existe $source"
    continue
  }

  $exists = & $mysql -N -B -uroot -p5090 -D bidvault -e "SELECT COUNT(*) FROM subastas WHERE identificador=$($cover.Id);"
  if ([int]$exists -eq 0) {
    Write-Warning "No existe subasta $($cover.Id). Se saltea $($cover.File)."
    continue
  }

  $base64Path = Join-Path $tmp ("subasta-$($cover.Id).b64")
  $bytes = [System.IO.File]::ReadAllBytes($source)
  [System.IO.File]::WriteAllText($base64Path, [Convert]::ToBase64String($bytes), [System.Text.Encoding]::ASCII)
  $mysqlPath = $base64Path.Replace('\', '/')
  $name = $cover.Name.Replace("'", "''")

  & $mysql --local-infile=1 -uroot -p5090 -D bidvault -e "CREATE TEMPORARY TABLE tmp_portada (imagen LONGTEXT); LOAD DATA LOCAL INFILE '$mysqlPath' INTO TABLE tmp_portada LINES TERMINATED BY '\n' (imagen); INSERT INTO subastas_portadas (subasta, imagen, mime_type, descripcion) SELECT $($cover.Id), CONCAT('data:image/png;base64,', imagen), 'image/png', '$name' FROM tmp_portada ON DUPLICATE KEY UPDATE imagen=VALUES(imagen), mime_type=VALUES(mime_type), descripcion=VALUES(descripcion);"
  Write-Host "Portada cargada: subasta $($cover.Id) -> $($cover.Name)"
}

& $mysql -uroot -p5090 -D bidvault -e "SELECT subasta, descripcion, LENGTH(imagen) bytes_guardados FROM subastas_portadas ORDER BY subasta;"

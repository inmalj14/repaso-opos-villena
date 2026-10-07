# Regenera data/temas.json a partir de los títulos de los temas y de los ficheros data/NN.json.
# Uso:  powershell -File tools/build-index.ps1
$app = Split-Path $PSScriptRoot -Parent
$titles = Get-Content (Join-Path $PSScriptRoot 'titulos.txt') -Encoding UTF8
$items = foreach ($line in $titles) {
  if (-not $line.Trim()) { continue }
  $n, $title = $line.Split('|', 2)
  $file = Join-Path $app ("data\{0:D2}.json" -f [int]$n)
  $count = 0
  if (Test-Path $file) {
    $qs = Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json
    $count = @($qs).Count
    foreach ($q in $qs) { if (@($q.o).Count -ne 4) { Write-Warning "Tema $n -> pregunta sin 4 opciones: $($q.q)" } }
  }
  [ordered]@{ n = [int]$n; title = $title.Trim(); count = $count }
}
$json = ConvertTo-Json @($items) -Compress
[IO.File]::WriteAllText((Join-Path $app 'data\temas.json'), $json, (New-Object Text.UTF8Encoding $false))
"Temas con preguntas: " + @($items | Where-Object { $_.count -gt 0 }).Count + " / " + @($items).Count

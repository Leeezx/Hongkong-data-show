$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceName = [string]([char]0x76F8) + [char]0x5173 + [char]0x6570 + [char]0x636E
$sourceDir = Join-Path $projectRoot $sourceName
$assetDir = Join-Path $projectRoot 'assets'
$generatedDir = Join-Path $PSScriptRoot '.generated'
$node = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$python = 'C:\ProgramData\miniconda3\envs\irrigation_water\python.exe'

$required = @(
  (Join-Path $sourceDir 'wst.tif'),
  (Join-Path $sourceDir 'Chla.tif'),
  (Join-Path $sourceDir 'gis_osm_adminareas_a_free_1.shp'),
  (Join-Path $sourceDir 'gis_osm_water_a_free_1.shp')
)
foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) { throw "Missing source: $file" }
}

New-Item -ItemType Directory -Force -Path $assetDir, $generatedDir | Out-Null

$gdalCalc = 'C:\ProgramData\miniconda3\envs\irrigation_water\Scripts\gdal_calc.py'
$gdalWarp = (Get-Command gdalwarp -ErrorAction Stop).Source
$gdalDem = (Get-Command gdaldem -ErrorAction Stop).Source
$ogr2ogr = (Get-Command ogr2ogr -ErrorAction Stop).Source
foreach ($commandPath in @($node, $python, $gdalCalc, $gdalWarp, $gdalDem, $ogr2ogr)) {
  if (-not (Test-Path -LiteralPath $commandPath)) { throw "Missing command: $commandPath" }
}

$wstClass = Join-Path $generatedDir 'wst-classes.tif'
$chlaWarp = Join-Path $generatedDir 'chla-wgs84.tif'
$chlaClass = Join-Path $generatedDir 'chla-classes.tif'
$wstColors = Join-Path $generatedDir 'wst-colors.txt'
$chlaColors = Join-Path $generatedDir 'chla-colors.txt'
$adminJson = Join-Path $generatedDir 'administrative.geojson'
$waterJson = Join-Path $generatedDir 'water.geojson'

@'
0 232 232 232 128
1 102 169 234 255
2 201 242 177 255
3 255 242 102 255
4 242 160 0 255
5 229 68 0 255
'@ | Set-Content -LiteralPath $wstColors -Encoding ascii

@'
0 232 232 232 128
1 102 169 234 255
2 201 242 177 255
3 51 224 0 255
4 23 117 0 255
5 242 160 0 255
'@ | Set-Content -LiteralPath $chlaColors -Encoding ascii

& $python $gdalCalc -A (Join-Path $sourceDir 'wst.tif') --outfile=$wstClass --type=Byte --NoDataValue=0 --overwrite --calc="1*((A>=15)*(A<20))+2*((A>=20)*(A<25))+3*((A>=25)*(A<30))+4*((A>=30)*(A<35))+5*((A>=35)*(A<=40))"
if ($LASTEXITCODE -ne 0) { throw "gdal_calc failed for wst (exit $LASTEXITCODE)" }
& $gdalDem color-relief $wstClass $wstColors (Join-Path $assetDir 'wst.png') -alpha -nearest_color_entry
if ($LASTEXITCODE -ne 0) { throw "gdaldem failed for wst (exit $LASTEXITCODE)" }

& $gdalWarp -overwrite -t_srs EPSG:4326 -r bilinear -dstnodata -9999 (Join-Path $sourceDir 'Chla.tif') $chlaWarp
if ($LASTEXITCODE -ne 0) { throw "gdalwarp failed for Chla (exit $LASTEXITCODE)" }
& $python $gdalCalc -A $chlaWarp --outfile=$chlaClass --type=Byte --NoDataValue=0 --overwrite --calc="1*((A>=0)*(A<1.5))+2*((A>=1.5)*(A<3))+3*((A>=3)*(A<4.5))+4*((A>=4.5)*(A<6))+5*(A>=6)"
if ($LASTEXITCODE -ne 0) { throw "gdal_calc failed for Chla (exit $LASTEXITCODE)" }
& $gdalDem color-relief $chlaClass $chlaColors (Join-Path $assetDir 'chla.png') -alpha -nearest_color_entry
if ($LASTEXITCODE -ne 0) { throw "gdaldem failed for Chla (exit $LASTEXITCODE)" }

foreach ($vectorOutput in @($adminJson, $waterJson)) {
  if (Test-Path -LiteralPath $vectorOutput) { Remove-Item -LiteralPath $vectorOutput -Force }
}
& $ogr2ogr -overwrite -f GeoJSON -t_srs EPSG:4326 -simplify 0.00008 -lco COORDINATE_PRECISION=6 -select name $adminJson (Join-Path $sourceDir 'gis_osm_adminareas_a_free_1.shp')
if ($LASTEXITCODE -ne 0) { throw "ogr2ogr failed for administrative data (exit $LASTEXITCODE)" }
& $ogr2ogr -overwrite -f GeoJSON -t_srs EPSG:4326 -simplify 0.00004 -lco COORDINATE_PRECISION=6 -select name $waterJson (Join-Path $sourceDir 'gis_osm_water_a_free_1.shp')
if ($LASTEXITCODE -ne 0) { throw "ogr2ogr failed for water data (exit $LASTEXITCODE)" }

& $node (Join-Path $PSScriptRoot 'wrap-geojson.mjs') $adminJson $waterJson (Join-Path $assetDir 'map-data.js')
if ($LASTEXITCODE -ne 0) { throw "GeoJSON wrapper failed (exit $LASTEXITCODE)" }

foreach ($auxiliaryOutput in @((Join-Path $assetDir 'wst.png.aux.xml'), (Join-Path $assetDir 'chla.png.aux.xml'))) {
  if (Test-Path -LiteralPath $auxiliaryOutput) { Remove-Item -LiteralPath $auxiliaryOutput -Force }
}

@'
window.HK_DEMO_METADATA = {
  mapBounds: [[22.1367246, 113.8172408], [22.5683333, 114.5024867]],
  datasets: {
    wst: {
      image: 'assets/wst.png', unit: '\u00b0C', bounds: [[22.1362852, 113.8165465], [22.5683749, 114.5028594]],
      breaks: [15, 20, 25, 30, 35, 40], labels: ['15\u201320', '20\u201325', '25\u201330', '30\u201335', '35\u201340'],
      colors: ['#66a9ea', '#c9f2b1', '#fff266', '#f2a000', '#e54400']
    },
    chla: {
      image: 'assets/chla.png', unit: 'mg/m\u00b3', bounds: [[22.130450, 113.809311], [22.571122, 114.506519]],
      breaks: [0, 1.5, 3, 4.5, 6], labels: ['0\u20131.5', '1.5\u20133', '3\u20134.5', '4.5\u20136', '>6'],
      colors: ['#66a9ea', '#c9f2b1', '#33e000', '#177500', '#f2a000']
    }
  }
};
'@ | Set-Content -LiteralPath (Join-Path $assetDir 'metadata.js') -Encoding utf8

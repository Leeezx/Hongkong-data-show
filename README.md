# Hong Kong Remote Sensing Water Quality Monitoring Demonstration System

This is a four-module remote-sensing data display site. The existing layout is retained; the browser can use the bundled fallback assets directly, or connect to the local FastAPI service for dynamic uploads.

## Open

For the dynamic mode, run `run-server.ps1` and open `http://127.0.0.1:8000`. The FastAPI service reads the default material layers and any registered runtime layers, reprojects GeoTIFFs to WGS84, renders Web Mercator tiles on demand at `/api/tiles/{layer}/{z}/{x}/{y}.png`, and exposes previews and legends through `/api/layers`. The server uses `C:\ProgramData\miniconda3\python.exe`; install `requirements-server.txt` first if that runtime is not already prepared.

Double-click `index.html` for the bundled read-only fallback. Dynamic layer discovery requires the local service because a file opened directly in the browser cannot receive API requests.
The fallback needs no installation, server, Node.js, Python, or database.

The street basemap is loaded from the internet when available. When offline, the local raster overlays and Hong Kong vector boundaries remain available on a neutral map background.

The page sends analytics to Google Analytics 4 and GoatCounter when online. The header also displays the public site-wide visit total supplied by GoatCounter. In GoatCounter site settings, enable “Allow adding visitor counts on your website” for the total to be readable by the page.

## Included samples

- Water Environment Data → water extent, WST, Chal-index, SAR, precipitation, air temperature and downwelling radiation.
- Historical Water Quality → Chlorophyll-a, turbidity, TSS, total phosphorus and total nitrogen.
- Water Quality Forecasts → the supplied forecast model rasters for the same five water-quality variables.
- Risk Alerts & Recommended Actions → the supplied Hong Kong RGB risk map.

The source rasters are organized under `source-data/` by module: `environment/`, `historical/`, `forecasts/`, and `alerts/`. `scripts/build-material-assets.py` converts the supplied examples to browser-sized fallback overlays and writes matching metadata; rerun it after replacing source rasters.

For GitHub deployment, the large `source-data/`, legacy `website-material/`, and `相关数据/` source folders are intentionally ignored. Copy `source-data/` to the server separately so the dynamic tile API can read the original GeoTIFFs.

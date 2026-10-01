from __future__ import annotations

import json
import io
import re
import shutil
import uuid
from pathlib import Path

import numpy as np
import rasterio
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
from rasterio.transform import from_bounds
from rasterio.warp import calculate_default_transform, reproject, transform_bounds

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime-data"
UPLOADS = RUNTIME / "uploads"
PREVIEWS = RUNTIME / "previews"
REGISTRY = RUNTIME / "layers.json"
for directory in (UPLOADS, PREVIEWS):
    directory.mkdir(parents=True, exist_ok=True)

PALETTE = np.array([[40, 95, 180], [70, 170, 220], [120, 205, 130], [245, 220, 70], [220, 80, 45]], dtype=np.uint8)
SECTIONS = {"environment", "historical", "forecasts", "alerts"}
SAFE_NAME = re.compile(r"[^A-Za-z0-9_.-]+")


def _read_registry() -> list[dict]:
    if not REGISTRY.exists():
        return []
    try:
        return json.loads(REGISTRY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []


def _write_registry(layers: list[dict]) -> None:
    REGISTRY.write_text(json.dumps(layers, ensure_ascii=False, indent=2), encoding="utf-8")


def _default_layers() -> list[dict]:
    source = ROOT / "assets" / "material" / "metadata.json"
    if not source.exists():
        return []
    raw = json.loads(source.read_text(encoding="utf-8"))
    sections = {
        "water-extent": "environment", "wst": "environment", "chal-index": "environment",
        "vv-vh": "environment", "pr": "environment", "air-temperature": "environment", "srad": "environment",
        "hist-chla": "historical", "hist-turbidity": "historical", "hist-tss": "historical",
        "hist-total-phosphorus": "historical", "hist-total-nitrogen": "historical",
        "forecast-chla": "forecasts", "forecast-turbidity": "forecasts", "forecast-tss": "forecasts",
        "forecast-total-phosphorus": "forecasts", "forecast-total-nitrogen": "forecasts", "risk": "alerts",
    }
    names = {
        "water-extent": "Water Extent / Water Level / Storage", "wst": "Water Surface Temperature",
        "chal-index": "Chlorophyll Index", "vv-vh": "SAR Polarimetric Index", "pr": "Precipitation",
        "air-temperature": "Air Temperature", "srad": "Downwelling Radiation", "hist-chla": "Chlorophyll-a",
        "hist-turbidity": "Turbidity", "hist-tss": "Total Suspended Solids", "hist-total-phosphorus": "Total Phosphorus",
        "hist-total-nitrogen": "Total Nitrogen", "forecast-chla": "Chlorophyll-a", "forecast-turbidity": "Turbidity",
        "forecast-tss": "Total Suspended Solids", "forecast-total-phosphorus": "Total Phosphorus",
        "forecast-total-nitrogen": "Total Nitrogen", "risk": "Hong Kong Risk Map",
    }
    source_paths = {
        "water-extent": "source-data/environment/water-extent.tif", "wst": "source-data/environment/wst.tif",
        "chal-index": "source-data/environment/Chal-index.tif", "vv-vh": "source-data/environment/VV-VH.tif",
        "pr": "source-data/environment/Pr.tif", "air-temperature": "source-data/environment/T.tif",
        "srad": "source-data/environment/SRAD.tif", "risk": "source-data/alerts/hongkong.tif",
    }
    for key, name in [("chla", "Chla.tif"), ("turbidity", "Turbidity.tif"), ("tss", "TSS.tif"),
                      ("total-phosphorus", "Total_Phosphorus.tif"), ("total-nitrogen", "Total_Nitrogen.tif")]:
        source_paths[f"hist-{key}"] = f"source-data/historical/{name}"
        source_paths[f"forecast-{key}"] = f"source-data/forecasts/{name}"
    result = []
    for key, item in raw.items():
        if key not in sections:
            continue
        result.append({**item, "id": key, "name": names[key], "section": sections[key], "source": "default",
                       "sourceFile": source_paths.get(key), "tileTemplate": f"/api/tiles/{key}/{{z}}/{{x}}/{{y}}.png"})
    return result


def list_layers() -> list[dict]:
    defaults = _default_layers()
    uploaded = _read_registry()
    by_id = {item["id"]: item for item in defaults}
    by_id.update({item["id"]: item for item in uploaded})
    return list(by_id.values())


def _preview_path(layer: dict) -> Path:
    if layer.get("source") == "default":
        return ROOT / layer["image"]
    return ROOT / layer["preview"]


def _source_path(layer: dict) -> Path | None:
    source_file = layer.get("sourceFile")
    if not source_file:
        return None
    path = ROOT / source_file
    return path if path.is_file() else None


def _tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    if z < 0 or z > 22:
        raise ValueError("zoom must be between 0 and 22")
    limit = 2 ** z
    if x < 0 or y < 0 or x >= limit or y >= limit:
        raise ValueError("tile is outside the tile matrix")
    world = 20037508.342789244
    size = (world * 2) / limit
    return (-world + x * size, world - (y + 1) * size, -world + (x + 1) * size, world - y * size)


def _render_tile(layer: dict, z: int, x: int, y: int) -> bytes:
    source = _source_path(layer)
    if source is None:
        raise FileNotFoundError("source raster is unavailable")
    left, bottom, right, top = _tile_bounds(z, x, y)
    tile_transform = from_bounds(left, bottom, right, top, 256, 256)
    with rasterio.open(source) as src:
        if not src.crs:
            raise ValueError("raster has no coordinate reference system")
        count = min(src.count, 3)
        with WarpedVRT(src, crs="EPSG:3857", transform=tile_transform, width=256, height=256,
                       resampling=Resampling.bilinear) as vrt:
            data = vrt.read(indexes=list(range(1, count + 1)), out_shape=(count, 256, 256), masked=False)
            mask = vrt.dataset_mask() > 0
    if count >= 3:
        reflectance_values = data[(data < 20000) & np.isfinite(data)]
        reflectance_max = float(np.nanmax(reflectance_values)) if reflectance_values.size else 0
        scale = 255.0 if reflectance_max <= 255 else 10000.0 if reflectance_max <= 20000 else 65535.0
        rgb = np.clip(np.moveaxis(data.astype(np.float32), 0, -1) / scale * 255, 0, 255).astype(np.uint8)
        valid_limit = 20000 if scale == 10000.0 else 65535
        valid = mask & np.any(data > 2, axis=0) & np.all(data < valid_limit, axis=0)
    else:
        values = data[0].astype(np.float32)
        breaks = np.asarray(layer.get("breaks") or [0, 1], dtype=float)
        if breaks.size < 2:
            breaks = np.array([0, 1], dtype=float)
        indices = np.clip(np.searchsorted(breaks[1:], values, side="right"), 0, 4)
        rgb = PALETTE[indices]
        valid = mask & np.isfinite(values) & (values != -9999) & (values > 0)
    rgba = np.dstack([rgb, np.where(valid, 255, 0).astype(np.uint8)])
    output = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(output, format="PNG", optimize=True)
    return output.getvalue()


def _rgba_preview(path: Path) -> tuple[np.ndarray, list[float], list[str], list[str], list[list[float]]]:
    with rasterio.open(path) as src:
        if not src.crs:
            raise ValueError("Uploaded raster has no coordinate reference system")
        dst_transform, width, height = calculate_default_transform(
            src.crs, "EPSG:4326", src.width, src.height, *src.bounds,
            dst_width=1200, dst_height=max(1, round(src.height * 1200 / src.width))
        )
        width, height = max(1, width), max(1, height)
        count = min(src.count, 3)
        bands = np.zeros((count, height, width), dtype=np.float32)
        for index in range(count):
            reproject(
                source=rasterio.band(src, index + 1), destination=bands[index],
                src_transform=src.transform, src_crs=src.crs, dst_transform=dst_transform,
                dst_crs="EPSG:4326", resampling=Resampling.bilinear,
            )
        nodata = src.nodata
        bounds = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
    if count >= 3:
        scale = 255.0 if np.nanmax(bands) <= 255 else 65535.0
        rgb = np.clip(np.moveaxis(bands, 0, -1) / scale * 255, 0, 255).astype(np.uint8)
        valid = np.any(bands > 2, axis=0) & np.all(bands < scale, axis=0)
        return np.dstack([rgb, np.where(valid, 255, 0).astype(np.uint8)]), [0], ["RGB composite"], ["#6aa9d8"], [[bounds[1], bounds[0]], [bounds[3], bounds[2]]]
    values = bands[0]
    valid = np.isfinite(values) & (values != -9999)
    if nodata is not None:
        valid &= values != nodata
    valid &= values > 0
    finite = values[valid]
    cuts = np.linspace(float(np.nanmin(finite)) if finite.size else 0, float(np.nanmax(finite)) if finite.size else 1, 6)
    if cuts[-1] <= cuts[0]:
        cuts = np.linspace(cuts[0], cuts[0] + 1, 6)
    indices = np.clip(np.searchsorted(cuts[1:], values, side="right"), 0, 4)
    rgba = np.dstack([PALETTE[indices], np.where(valid, 255, 0).astype(np.uint8)])
    labels = [f"{cuts[i]:.2f}–{cuts[i + 1]:.2f}" for i in range(5)]
    colors = ["#285fb4", "#46aadc", "#78cd82", "#f5dc46", "#dc502d"]
    return rgba, cuts.tolist(), labels, colors, [[bounds[1], bounds[0]], [bounds[3], bounds[2]]]


app = FastAPI(title="Hong Kong Remote Sensing Dynamic Data API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "layers": len(list_layers())}


@app.get("/api/layers")
def layers(section: str | None = None) -> list[dict]:
    result = list_layers()
    if section:
        if section not in SECTIONS:
            raise HTTPException(400, "Unknown section")
        result = [item for item in result if item["section"] == section]
    return result


@app.get("/api/layers/{layer_id}/preview")
def preview(layer_id: str):
    layer = next((item for item in list_layers() if item["id"] == layer_id), None)
    if not layer:
        raise HTTPException(404, "Layer not found")
    path = _preview_path(layer)
    if not path.is_file():
        raise HTTPException(404, "Layer preview not found")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "no-cache"})


@app.get("/api/tiles/{layer_id}/{z}/{x}/{y}.png")
def tile(layer_id: str, z: int, x: int, y: int):
    """Render a live Web Mercator tile from the layer's source GeoTIFF."""
    layer = next((item for item in list_layers() if item["id"] == layer_id), None)
    if not layer:
        raise HTTPException(404, "Layer not found")
    try:
        content = _render_tile(layer, z, x, y)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(404, str(exc)) from exc
    return Response(content=content, media_type="image/png", headers={"Cache-Control": "public, max-age=300"})


@app.post("/api/uploads/{section}")
async def upload(section: str, file: UploadFile = File(...), name: str = Form(""), unit: str = Form("")) -> dict:
    if section not in SECTIONS:
        raise HTTPException(400, "Unknown section")
    extension = Path(file.filename or "upload.tif").suffix.lower()
    if extension not in {".tif", ".tiff"}:
        raise HTTPException(415, "Only GeoTIFF uploads are supported")
    layer_id = f"upload-{uuid.uuid4().hex[:12]}"
    UPLOADS.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    safe_filename = SAFE_NAME.sub("-", Path(file.filename or "upload.tif").name)
    source = UPLOADS / f"{layer_id}-{safe_filename}"
    with source.open("wb") as target:
        shutil.copyfileobj(file.file, target)
    try:
        rgba, breaks, labels, colors, bounds = _rgba_preview(source)
    except Exception as exc:
        source.unlink(missing_ok=True)
        raise HTTPException(422, f"Unable to read raster: {exc}") from exc
    preview_file = PREVIEWS / f"{layer_id}.png"
    Image.fromarray(rgba, "RGBA").save(preview_file, optimize=True)
    item = {
        "id": layer_id, "name": name.strip() or Path(file.filename or "Uploaded raster").stem,
        "section": section, "unit": unit.strip() or "—", "image": f"/api/layers/{layer_id}/preview",
        "preview": str(preview_file.relative_to(ROOT)).replace("\\", "/"),
        "sourceFile": str(source.relative_to(ROOT)).replace("\\", "/"),
        "tileTemplate": f"/api/tiles/{layer_id}/{{z}}/{{x}}/{{y}}.png", "bounds": bounds,
        "breaks": breaks, "labels": labels, "colors": colors, "source": "upload", "filename": safe_filename,
    }
    registry = [entry for entry in _read_registry() if entry.get("id") != layer_id]
    registry.append(item)
    _write_registry(registry)
    return item


app.mount("/", StaticFiles(directory=ROOT, html=True), name="site")

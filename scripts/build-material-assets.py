"""Convert source-data rasters to small browser-ready RGBA overlays."""
from pathlib import Path
import json
import numpy as np
from osgeo import gdal
from PIL import Image

gdal.UseExceptions()
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "material"
OUT.mkdir(parents=True, exist_ok=True)
PALETTE = np.array([[40, 95, 180], [70, 170, 220], [120, 205, 130], [245, 220, 70], [220, 80, 45]], dtype=np.uint8)
DATA = {}

def bounds(ds):
    gt = ds.GetGeoTransform()
    x0, px, _, y0, _, py = gt
    x1, y1 = x0 + px * ds.RasterXSize, y0 + py * ds.RasterYSize
    return [[min(y0, y1), min(x0, x1)], [max(y0, y1), max(x0, x1)]]

def warp(path):
    src = gdal.Open(str(path))
    ratio = src.RasterYSize / src.RasterXSize
    return gdal.Warp("", src, format="MEM", dstSRS="EPSG:4326", width=1200,
                     height=max(1, round(1200 * ratio)), resampleAlg="bilinear")

def save(key, path, unit, rgb=False, labels=None):
    ds = warp(path)
    a = ds.ReadAsArray()
    if rgb and a.ndim == 3:
        # Material RGB files use byte channels or reflectance-like Float32 channels.
        reflectance_values = a[:3][(a[:3] < 20000) & np.isfinite(a[:3])]
        reflectance_max = float(np.nanmax(reflectance_values)) if reflectance_values.size else 0
        scale = 255 if reflectance_max <= 255 else 10000 if reflectance_max <= 20000 else 65535
        valid_rgb = np.all(a[:3] < (20000 if scale == 10000 else 65535), axis=0)
        rgb_data = np.clip(np.moveaxis(a[:3], 0, -1) / scale * 255, 0, 255).astype(np.uint8)
        valid_rgb &= np.any(a[:3] > 2, axis=0)
        alpha = np.where(valid_rgb, 255, 0).astype(np.uint8)
        rgba = np.dstack([rgb_data, alpha])
        legend_labels, colors, breaks = ["RGB composite"], ["#6aa9d8"], [0]
    else:
        values = a[0] if a.ndim == 3 else a
        valid = np.isfinite(values) & (values != -9999)
        if np.nanmax(values) > 1.5 or np.nanmax(values) == 1:
            valid &= values > 0
        finite = values[valid]
        if finite.size == 0:
            finite = np.array([0, 1], dtype=float)
        cuts = np.unique(np.percentile(finite, [0, 20, 40, 60, 80, 100])).astype(float)
        if cuts.size < 6:
            cuts = np.linspace(float(cuts[0]), float(cuts[-1]) if cuts[-1] > cuts[0] else float(cuts[0]) + 1, 6)
        idx = np.clip(np.searchsorted(cuts[1:], values, side="right"), 0, 4)
        rgba = np.dstack([PALETTE[idx], np.where(valid, 255, 0).astype(np.uint8)])
        legend_labels = labels or [f"{cuts[i]:.2f}–{cuts[i + 1]:.2f}" for i in range(5)]
        breaks = cuts.tolist()
        colors = ["#285fb4", "#46aadc", "#78cd82", "#f5dc46", "#dc502d"]
    out = OUT / f"{key}.png"
    Image.fromarray(rgba, "RGBA").save(out, optimize=True)
    DATA[key] = {"image": f"assets/material/{out.name}", "unit": unit, "bounds": bounds(ds),
                 "breaks": breaks, "labels": legend_labels, "colors": colors}

def src(folder, name):
    return ROOT / "source-data" / folder / name

# Function 1: environmental indicators.
save("water-extent", src("environment", "water-extent.tif"), "—")
save("chal-index", src("environment", "Chal-index.tif"), "—", rgb=True)
save("pr", src("environment", "Pr.tif"), "mm/day")
save("srad", src("environment", "SRAD.tif"), "W/m²")
save("air-temperature", src("environment", "T.tif"), "°C")
save("vv-vh", src("environment", "VV-VH.tif"), "—", rgb=True)
# Keep the existing classified sample so its dimensions and legend remain stable.
DATA["wst"] = {"image": "assets/wst.png", "unit": "°C", "bounds": [[22.1362852, 113.8165465], [22.5683749, 114.5028594]],
                "breaks": [15, 20, 25, 30, 35, 40], "labels": ["15–20", "20–25", "25–30", "30–35", "35–40"],
                "colors": ["#66a9ea", "#c9f2b1", "#fff266", "#f2a000", "#e54400"]}

# Functions 2 and 3 share the supplied model rasters.
for folder, prefix in [("historical", "hist"), ("forecasts", "forecast")]:
    for name, key, unit in [("Chla.tif", "chla", "mg/m³"), ("Turbidity.tif", "turbidity", "NTU"),
                            ("TSS.tif", "tss", "mg/L"), ("Total_Phosphorus.tif", "total-phosphorus", "mg/L"),
                            ("Total_Nitrogen.tif", "total-nitrogen", "mg/L")]:
        save(f"{prefix}-{key}", src(folder, name), unit)

save("risk", src("alerts", "hongkong.tif"), "—", rgb=True)

(OUT / "metadata.json").write_text(json.dumps(DATA, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT / "metadata.js").write_text("window.HK_MATERIAL_METADATA = " + json.dumps(DATA, ensure_ascii=False) + ";\n", encoding="utf-8")
print(f"generated {len(DATA)} overlays in {OUT}")

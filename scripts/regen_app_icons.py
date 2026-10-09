"""Regenerate web/Android/iOS icons from transparent logo.png (no white bg)."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = Image.open(ROOT / "apps/web/public/logo.png").convert("RGBA")
bbox = SRC.getbbox()
SRC = SRC.crop(bbox)

BRAND_BG = (234, 248, 252, 255)  # soft cyan #EAF8FC
TRANSPARENT = (0, 0, 0, 0)


def fit_logo(size, pad_ratio=0.14, bg=TRANSPARENT, circle_mask=False):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = int(size * (1 - 2 * pad_ratio))
    lw, lh = SRC.size
    scale = min(inner / lw, inner / lh)
    nw, nh = max(1, int(lw * scale)), max(1, int(lh * scale))
    logo = SRC.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2
    canvas.alpha_composite(logo, (x, y))
    if circle_mask:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        out = Image.new("RGBA", (size, size), TRANSPARENT)
        out.paste(canvas, (0, 0), mask)
        return out
    return canvas


def fit_foreground(size, content_ratio=0.60):
    canvas = Image.new("RGBA", (size, size), TRANSPARENT)
    inner = int(size * content_ratio)
    lw, lh = SRC.size
    scale = min(inner / lw, inner / lh)
    nw, nh = max(1, int(lw * scale)), max(1, int(lh * scale))
    logo = SRC.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2
    canvas.alpha_composite(logo, (x, y))
    return canvas


def save(im, path, solid_rgb=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if solid_rgb is not None:
        bg = Image.new("RGB", im.size, solid_rgb)
        bg.paste(im, mask=im.split()[-1])
        bg.save(path, "PNG")
    elif im.mode == "RGB":
        im.save(path, "PNG")
    else:
        im.save(path, "PNG")
    print("wrote", path.relative_to(ROOT), im.size)


def main():
    for s in [32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512]:
        name = "favicon.png" if s == 32 else f"icon-{s}.png"
        pad = 0.10 if s >= 180 else 0.12
        save(fit_logo(s, pad_ratio=pad, bg=TRANSPARENT), ROOT / "apps/web/public" / name)

    launcher = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    foreground = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
    for dens, s in launcher.items():
        base = ROOT / f"android/app/src/main/res/mipmap-{dens}"
        save(fit_logo(s, pad_ratio=0.12, bg=BRAND_BG), base / "ic_launcher.png")
        save(
            fit_logo(s, pad_ratio=0.12, bg=BRAND_BG, circle_mask=True),
            base / "ic_launcher_round.png",
        )
    for dens, s in foreground.items():
        save(
            fit_foreground(s, content_ratio=0.60),
            ROOT / f"android/app/src/main/res/mipmap-{dens}/ic_launcher_foreground.png",
        )

    splash_specs = [
        ("drawable/splash.png", 480, 320),
        ("drawable-land-mdpi/splash.png", 480, 320),
        ("drawable-land-hdpi/splash.png", 800, 480),
        ("drawable-land-xhdpi/splash.png", 1280, 720),
        ("drawable-land-xxhdpi/splash.png", 1600, 960),
        ("drawable-land-xxxhdpi/splash.png", 1920, 1280),
        ("drawable-port-mdpi/splash.png", 320, 480),
        ("drawable-port-hdpi/splash.png", 480, 800),
        ("drawable-port-xhdpi/splash.png", 720, 1280),
        ("drawable-port-xxhdpi/splash.png", 960, 1600),
        ("drawable-port-xxxhdpi/splash.png", 1280, 1920),
    ]
    for rel, w, h in splash_specs:
        canvas = Image.new("RGBA", (w, h), BRAND_BG)
        side = int(min(w, h) * 0.36)
        logo_sq = fit_logo(side, pad_ratio=0.06, bg=TRANSPARENT)
        canvas.alpha_composite(logo_sq, ((w - side) // 2, (h - side) // 2))
        save(canvas.convert("RGB"), ROOT / "android/app/src/main/res" / rel)

    ios_icon = fit_logo(1024, pad_ratio=0.12, bg=BRAND_BG)
    save(
        ios_icon,
        ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
        solid_rgb=BRAND_BG[:3],
    )

    splash_dir = ROOT / "ios/App/App/Assets.xcassets/Splash.imageset"
    for name in [
        "splash-2732x2732.png",
        "splash-2732x2732-1.png",
        "splash-2732x2732-2.png",
    ]:
        w = h = 2732
        canvas = Image.new("RGBA", (w, h), BRAND_BG)
        side = int(min(w, h) * 0.28)
        logo_sq = fit_logo(side, pad_ratio=0.06, bg=TRANSPARENT)
        canvas.alpha_composite(logo_sq, ((w - side) // 2, (h - side) // 2))
        save(canvas, splash_dir / name, solid_rgb=BRAND_BG[:3])

    for p in [
        "apps/web/public/icon-512.png",
        "apps/web/public/favicon.png",
        "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
        "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png",
        "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    ]:
        im = Image.open(ROOT / p).convert("RGBA")
        px = im.load()
        print(
            "CHECK",
            p,
            im.size,
            "corner",
            px[0, 0],
            "center",
            px[im.width // 2, im.height // 2],
        )


if __name__ == "__main__":
    main()

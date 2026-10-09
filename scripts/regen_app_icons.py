"""Place the full main logo onto app icons. Keeps the artwork (including the white note)."""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BAK = ROOT / "apps/web/public/logo.png.bak"
SRC_PATH = BAK if BAK.exists() else ROOT / "apps/web/public/logo.png"


def content_bbox(im):
    """Square crop around the teal logo frame. The white note inside the frame stays."""
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if g > r + 25 and g > 130 and b > 100 and r < 190:
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if not found:
        return rgba
    pad = 8
    side = max(maxx - minx, maxy - miny) + pad * 2
    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2
    left = int(round(cx - side / 2))
    top = int(round(cy - side / 2))
    left = max(0, min(left, w - side))
    top = max(0, min(top, h - side))
    return rgba.crop((left, top, left + side, top + side))


def fill_outer_canvas(im, color):
    """Replace the plain canvas outside the rounded frame. The white note inside stays."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def is_canvas(x, y):
        r, g, b, a = px[x, y]
        return a < 8 or (r >= 236 and g >= 236 and b >= 236)

    seen = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_canvas(x, y):
                seen[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y][x] and is_canvas(x, y):
                seen[y][x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = color + (255,)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and is_canvas(nx, ny):
                seen[ny][nx] = True
                q.append((nx, ny))
    return im


def sample_edge_color(im):
    """Pick the logo frame color from the mid-edges so icon padding matches the artwork."""
    px = im.load()
    w, h = im.size
    samples = []
    for x in range(w // 3, 2 * w // 3, max(1, w // 40)):
        samples.append(px[x, min(h - 1, int(h * 0.08))][:3])
        samples.append(px[x, min(h - 1, int(h * 0.92))][:3])
    for y in range(h // 3, 2 * h // 3, max(1, h // 40)):
        samples.append(px[min(w - 1, int(w * 0.08)), y][:3])
        samples.append(px[min(w - 1, int(w * 0.92)), y][:3])
    # Prefer the saturated teal frame over the white paper.
    vivid = [c for c in samples if max(c) - min(c) > 25 and c[1] > c[0]]
    pool = vivid or samples
    n = len(pool)
    return tuple(sum(c[i] for c in pool) // n for i in range(3))


def fit_full(logo, size, bg):
    """Show the entire logo, scaled as large as the square allows."""
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    lw, lh = logo.size
    scale = min(size / lw, size / lh)
    nw, nh = max(1, int(round(lw * scale))), max(1, int(round(lh * scale)))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def save(im, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    out = Image.new("RGB", im.size, (255, 255, 255))
    out.paste(im, mask=im.split()[-1])
    out.save(path, "PNG")
    print("wrote", path.relative_to(ROOT), out.size)


def splash(logo, w, h):
    canvas_bg = (246, 247, 246)
    canvas = Image.new("RGBA", (w, h), canvas_bg + (255,))
    side = int(min(w, h) * 0.62)
    mark = fit_full(logo, side, canvas_bg)
    canvas.alpha_composite(mark, ((w - side) // 2, (h - side) // 2))
    return canvas


def main():
    raw = Image.open(SRC_PATH)
    logo = content_bbox(raw)
    bg = sample_edge_color(logo)
    logo = fill_outer_canvas(logo, bg)
    print("source", SRC_PATH.name, "logo", logo.size, "bg", "#%02x%02x%02x" % bg)

    for s in [32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512]:
        name = "favicon.png" if s == 32 else f"icon-{s}.png"
        save(fit_full(logo, s, bg), ROOT / "apps/web/public" / name)

    launcher = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    # Adaptive foreground is masked; keep the whole logo inside the center safe area.
    foreground = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
    for dens, s in launcher.items():
        base = ROOT / f"android/app/src/main/res/mipmap-{dens}"
        save(fit_full(logo, s, bg), base / "ic_launcher.png")
        save(fit_full(logo, s, bg), base / "ic_launcher_round.png")
    for dens, s in foreground.items():
        save(fit_full(logo, s, bg), ROOT / f"android/app/src/main/res/mipmap-{dens}/ic_launcher_foreground.png")

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
        save(splash(logo, w, h), ROOT / "android/app/src/main/res" / rel)

    save(
        fit_full(logo, 1024, bg),
        ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    )
    splash_dir = ROOT / "ios/App/App/Assets.xcassets/Splash.imageset"
    for name in (
        "splash-2732x2732.png",
        "splash-2732x2732-1.png",
        "splash-2732x2732-2.png",
    ):
        save(splash(logo, 2732, 2732), splash_dir / name)

    print("BG_HEX", "#%02x%02x%02x" % bg)


if __name__ == "__main__":
    main()

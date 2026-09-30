#!/usr/bin/env python3
"""Generate LuckyTodo Android launcher, splash, and notification icons."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'apps/web/public/logo.png'
RES = ROOT / 'android/app/src/main/res'
WHITE = (255, 255, 255, 255)

logo = Image.open(SRC).convert('RGBA')


def fit_square(img: Image.Image, size: int, pad_ratio: float = 0.18) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = int(size * (1 - pad_ratio * 2))
    scaled = img.copy()
    scaled.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - scaled.width) // 2
    y = (size - scaled.height) // 2
    canvas.paste(scaled, (x, y), scaled)
    return canvas


def solid_icon(size: int, bg, fg_img: Image.Image) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), bg)
    content = fit_square(fg_img, size, pad_ratio=0.16)
    canvas.alpha_composite(content)
    return canvas


def write_png(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'PNG')
    print('wrote', path.relative_to(ROOT), img.size)


# Adaptive / legacy launcher densities
densities = {
    'mdpi': 1,
    'hdpi': 1.5,
    'xhdpi': 2,
    'xxhdpi': 3,
    'xxxhdpi': 4,
}

for name, scale in densities.items():
    legacy = int(48 * scale)
    fg = int(108 * scale)
    write_png(solid_icon(legacy, WHITE, logo), RES / f'mipmap-{name}' / 'ic_launcher.png')
    write_png(solid_icon(legacy, WHITE, logo), RES / f'mipmap-{name}' / 'ic_launcher_round.png')
    write_png(fit_square(logo, fg, pad_ratio=0.22), RES / f'mipmap-{name}' / 'ic_launcher_foreground.png')

# Notification status icon: white silhouette on transparent
# Make a simple rounded square + check from alpha of logo, then force white
stat_base = logo.copy()
# Use luminance of logo as alpha mask of a white glyph
gray = stat_base.convert('L')
# invert-ish: keep opaque logo pixels as white
alpha = gray.point(lambda p: 255 if p < 245 else 0)
white_glyph = Image.new('RGBA', logo.size, (0, 0, 0, 0))
white_layer = Image.new('RGBA', logo.size, (255, 255, 255, 255))
white_glyph.paste(white_layer, (0, 0), alpha)

for name, scale in densities.items():
    size = int(24 * scale)
    icon = fit_square(white_glyph, size, pad_ratio=0.12)
    write_png(icon, RES / f'drawable-{name}' / 'ic_stat_icon.png')

# Splash screens: white background with centered logo
splash_sizes = {
    'drawable': (480, 320),
    'drawable-port-mdpi': (320, 480),
    'drawable-port-hdpi': (480, 800),
    'drawable-port-xhdpi': (720, 1280),
    'drawable-port-xxhdpi': (1080, 1920),
    'drawable-port-xxxhdpi': (1440, 2560),
    'drawable-land-mdpi': (480, 320),
    'drawable-land-hdpi': (800, 480),
    'drawable-land-xhdpi': (1280, 720),
    'drawable-land-xxhdpi': (1920, 1080),
    'drawable-land-xxxhdpi': (2560, 1440),
}

for folder, (w, h) in splash_sizes.items():
    canvas = Image.new('RGBA', (w, h), WHITE)
    mark = min(w, h) * 0.34
    scaled = logo.copy()
    scaled.thumbnail((int(mark), int(mark)), Image.Resampling.LANCZOS)
    x = (w - scaled.width) // 2
    y = (h - scaled.height) // 2
    canvas.paste(scaled, (x, y), scaled)
    write_png(canvas.convert('RGB'), RES / folder / 'splash.png')

print('done')

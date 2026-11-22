# Делает иконки приложения из исходной картинки с белым фоном (нужны Pillow, numpy, scipy).
#   python tools/make-icons.py путь/к/картинке.jpg
# Убирает ТОЛЬКО белый фон (то, что соединено с краем картинки), светлые блики внутри тотема не трогает.
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

src = sys.argv[1]; root = os.path.join(os.path.dirname(__file__), '..')
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
h, w, _ = rgb.shape

# 1. фон = почти белые пикселы, связанные с краем картинки
near = (rgb.min(axis=2) >= 238)
lab, n = ndi.label(near)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
# 2. полоса у границы фона: «цвет в прозрачность» относительно белого — мягкий край свечения без белой каймы
band = ndi.binary_dilation(bg, iterations=9) & ~bg
alpha = np.ones((h, w), np.float32)
alpha[bg] = 0
c = rgb[band]
a_c = np.clip((255 - c) / 255.0, 0, 1).max(axis=1)           # сколько «краски» в пикселе относительно белого
a_c = np.clip(a_c * 1.25, 0, 1)                              # чуть плотнее: свечение не должно выглядеть блёклым
alpha[band] = np.where(a_c > 0.96, 1.0, a_c)
alpha = ndi.gaussian_filter(alpha, 0.6) * (~ndi.binary_erosion(bg, iterations=1)) + 0   # сглаживание шума JPEG
alpha = np.clip(alpha, 0, 1)
# 3. возвращаем цвет без примеси белого: F = (C - (1-a)*255) / a
out = rgb.copy(); m = alpha < 0.999
with np.errstate(divide='ignore', invalid='ignore'):
    out[m] = np.clip((rgb[m] - (1 - alpha[m, None]) * 255) / np.maximum(alpha[m, None], 1e-3), 0, 255)
rgba = np.dstack([out, alpha * 255]).astype(np.uint8)
im = Image.fromarray(rgba, 'RGBA')

# 4. обрезка по содержимому и квадратный холст с полями
bb = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox(); im = im.crop(bb)
side = int(max(im.size) * 1.10); sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
base = sq.resize((512, 512), Image.LANCZOS)

# 5. значок установщика: тот же тотем + заметный синий кружок со стрелкой «вниз»
S = 4; big = base.resize((512 * S, 512 * S), Image.LANCZOS); d = ImageDraw.Draw(big)
R = int(512 * S * 0.235); cx, cy = int(512 * S * 0.745), int(512 * S * 0.745)
for i in range(R, 0, -1):                                      # синий градиент: светлее сверху
    t = i / R; col = (int(20 + 10 * (1 - t)), int(110 + 80 * (1 - t)), 255)
    d.ellipse([cx - i, cy - i + int((R - i) * 0.35), cx + i, cy + i + int((R - i) * 0.35)], fill=col + (255,))
d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(255, 255, 255, 255), width=int(R * 0.09))
aw = R * 0.52; top = cy - R * 0.52; mid = cy + R * 0.08
d.rectangle([cx - aw * 0.34, top, cx + aw * 0.34, mid], fill=(255, 255, 255, 255))
d.polygon([(cx - aw, mid - R * 0.02), (cx + aw, mid - R * 0.02), (cx, cy + R * 0.58)], fill=(255, 255, 255, 255))
d.rounded_rectangle([cx - aw * 1.15, cy + R * 0.66, cx + aw * 1.15, cy + R * 0.80], radius=R * 0.07, fill=(255, 255, 255, 255))
inst = big.resize((512, 512), Image.LANCZOS)

def save(img, png, ico=None):
    img.save(png)
    if ico: img.save(ico, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)])
os.makedirs(os.path.join(root, 'build'), exist_ok=True)
save(base, os.path.join(root, 'build', 'icon.png'), os.path.join(root, 'build', 'icon.ico'))
save(inst, os.path.join(root, 'build', 'installer-icon.png'), os.path.join(root, 'build', 'installer-icon.ico'))
base.resize((256, 256), Image.LANCZOS).save(os.path.join(root, 'src', 'ui', 'assets', 'app-icon.png'))
print('готово: build/icon.*, build/installer-icon.*, src/ui/assets/app-icon.png; размер полотна', side)

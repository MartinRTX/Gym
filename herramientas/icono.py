#!/usr/bin/env python3
"""Cambia el ícono de la app (web y APK) a partir de UNA imagen cuadrada.

Uso:  python3 herramientas/icono.py mi-imagen.png
      (cualquier PNG o JPG; mejor de 1024×1024 o más, sin esquinas redondeadas: Android y el iPhone las recortan solos)

Genera:
  icon-192.png, icon-512.png, apple-touch-icon.png   → la app web (pantalla de inicio, pestaña)
  icon-maskable-512.png                              → Android recorta en círculo: la imagen va al 80 % sobre su fondo
  apk/icono/icon-only.png                            → ícono clásico del APK (Android 7 o anterior)
  apk/icono/icon-foreground.png + icon-background.png → ícono adaptable del APK (Android 8+). Sin estas dos capas,
                                                         Android muestra el ícono de fábrica de Capacitor.
El workflow del APK toma apk/icono/ en la siguiente compilación.
"""
import os
import sys
from PIL import Image, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cuadrada(im):
    """Recorta al centro para que quede cuadrada."""
    w, h = im.size
    l = min(w, h)
    return im.crop(((w - l) // 2, (h - l) // 2, (w - l) // 2 + l, (h - l) // 2 + l))


def fondo(im, lado):
    """Fondo que combina con la imagen: la misma imagen, más grande y muy desenfocada (sin transparencias)."""
    base = Image.new('RGB', im.size, color_borde(im))
    base.paste(im, mask=im.split()[3])
    return base.resize((lado, lado), Image.LANCZOS).filter(ImageFilter.GaussianBlur(lado // 12)).convert('RGBA')


def color_borde(im):
    """Color promedio del borde (para rellenar lo transparente)."""
    p = im.convert('RGBA').resize((32, 32)).load()
    px = [p[x, y] for x in range(32) for y in (0, 31)] + [p[x, y] for y in range(32) for x in (0, 31)]
    px = [c for c in px if c[3] > 128] or [(18, 15, 28, 255)]
    return tuple(sum(c[i] for c in px) // len(px) for i in range(3))


def centrada(im, lado, escala, con_fondo):
    """La imagen al `escala` del lado, centrada; con fondo desenfocado o transparente alrededor."""
    lienzo = fondo(im, lado) if con_fondo else Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    n = round(lado * escala)
    chica = im.resize((n, n), Image.LANCZOS)
    lienzo.alpha_composite(chica, ((lado - n) // 2, (lado - n) // 2))
    return lienzo


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    im = cuadrada(Image.open(sys.argv[1]).convert('RGBA'))
    if im.size[0] < 512:
        print('Aviso: la imagen mide %dpx; con 1024 o más se ve mejor' % im.size[0])
    lleno = lambda lado: centrada(im, lado, 1.0, True).convert('RGB')
    os.makedirs(os.path.join(RAIZ, 'apk', 'icono'), exist_ok=True)
    salidas = {
        'icon-192.png': lleno(192),
        'icon-512.png': lleno(512),
        'apple-touch-icon.png': lleno(180),
        'icon-maskable-512.png': centrada(im, 512, 0.8, True).convert('RGB'),
        'apk/icono/icon-only.png': lleno(1024),
        # Adaptable: @capacitor/assets ya mete cada capa en el área visible (inset 16.7 %), así que la imagen va completa;
        # el sistema la recorta con su forma (círculo en Pixel). Detrás, el fondo desenfocado por si la imagen trae transparencias.
        'apk/icono/icon-foreground.png': centrada(im, 1024, 1.0, False),
        'apk/icono/icon-background.png': fondo(im, 1024).convert('RGB'),
    }
    for nombre, img in salidas.items():
        img.save(os.path.join(RAIZ, nombre), optimize=True)
        print('✓', nombre, '%d×%d' % img.size)
    print('Listo. Sube los cambios: la app web lo toma al publicar y el APK en su siguiente compilación.')


if __name__ == '__main__':
    main()

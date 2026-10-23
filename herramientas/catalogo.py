#!/usr/bin/env python3
"""Arma datos/alimentos.json: el catálogo grande para el buscador de Comida (se baja solo cuando buscas).

Fuentes:
  - datos/mexico.json: Tabla de composición de alimentos mexicanos (INCMNSZ, en el SiAgro de CONABIO), ~3,300 alimentos
    en español. La baja herramientas/catalogo_mx.py en GitHub Actions (.github/workflows/catalogo.yml).
  - USDA FoodData Central, SR Legacy (dominio público), ~7,200 alimentos en inglés. Se toma del paquete npm tempo-food-db
    (que lo trae completo por 100 g) y solo los renglones que dicen venir del USDA.

Uso: python3 herramientas/catalogo.py   (vuelve a escribir datos/alimentos.json)
Formato: {"v": versión, "fuentes": {...}, "a": [[id, nombre, nombre_en, grupo, p, c, f, kcal, fibra, unidad, porciones, crudo], ...]}
"""
import io, json, os, re, tarfile, unicodedata, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPO = 'https://registry.npmjs.org/tempo-food-db/-/tempo-food-db-1.0.0.tgz'


def num(x):
    try:
        v = float(x)
        return round(v, 1) if v == v else None
    except (TypeError, ValueError):
        return None


def norm(s):
    return unicodedata.normalize('NFD', str(s or '').lower()).encode('ascii', 'ignore').decode()


def titulo(s):
    s = re.sub(r'\s+', ' ', str(s or '')).strip()
    return s[:1].upper() + s[1:].lower() if s.isupper() else s


# Grupos de la tabla mexicana que casi siempre vienen crudos (nota 6 de la tabla: salvo lo preparado, los valores son del alimento crudo)
CRUDOS = re.compile(r'fruta|verdura|hortaliza|carne|pescado|marisco|ave|legumin|cereal|semilla|tub[eé]rculo|huevo', re.I)
PREPARADO = re.compile(r'cocid|frit|guisad|asad|hervid|preparad|enlatad|tostad|horneado|al vapor|capeado|empanizad|tortilla|pan |sopa|caldo|tamal|taco', re.I)


def mexico():
    ruta = os.path.join(RAIZ, 'datos', 'mexico.json')
    if not os.path.exists(ruta):
        print('Aviso: falta datos/mexico.json (córrelo en GitHub Actions: workflow "Catálogo de alimentos")')
        return []
    filas = json.load(open(ruta))
    # Varias muestras con el mismo nombre (p. ej. 6 naranjas): se queda la más completa
    mejores = {}
    for r in filas:
        p, c, f, k = num(r.get('p')), num(r.get('c')), num(r.get('f')), num(r.get('k'))
        if p is None or k is None or c is None or f is None:
            continue
        clave = norm(r.get('n'))
        completa = sum(x is not None for x in (p, c, f, k, num(r.get('fib'))))
        if clave not in mejores or completa > mejores[clave][0]:
            mejores[clave] = (completa, r)
    out = []
    for _, r in mejores.values():
        n = titulo(r.get('n')); g = titulo(r.get('g'))
        crudo = 1 if CRUDOS.search(g or '') and not PREPARADO.search(n) else 0
        out.append(['mx:' + str(r['id']), n, titulo(r.get('en')), g, num(r['p']), num(r['c']), num(r['f']), round(float(r['k'])),
                    num(r.get('fib')) or 0, 'g', [], crudo])
    return out


def usda():
    datos = urllib.request.urlopen(TEMPO, timeout=120).read()
    with tarfile.open(fileobj=io.BytesIO(datos)) as t:
        filas = json.load(t.extractfile('package/data/tempolife-foods.json'))
    out, vistos = [], set()
    for i, r in enumerate(filas):
        if r.get('source') != 'usda_sr_legacy':
            continue
        n = re.sub(r'\s+', ' ', r['name']).strip()
        if norm(n) in vistos:
            continue
        vistos.add(norm(n))
        p, c, f, k = num(r.get('protein_g')), num(r.get('carbs_g')), num(r.get('fat_g')), num(r.get('kcal_per_100g'))
        if p is None or k is None:
            continue
        out.append(['us:' + str(i), n, '', '', p, c or 0, f or 0, round(k), num(r.get('fiber_g')) or 0, 'g', [], 0])
    return out


def main():
    mx, us = mexico(), usda()
    cat = {'v': 1, 'fuentes': {
        'mx': 'Tabla de composición de alimentos mexicanos, INCMNSZ (SiAgro, CONABIO). Por 100 g de porción comestible; salvo lo preparado, crudo.',
        'us': 'USDA FoodData Central, SR Legacy (dominio público, CC0). Por 100 g.'}, 'a': mx + us}
    destino = os.path.join(RAIZ, 'datos', 'alimentos.json')
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    json.dump(cat, open(destino, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('✓ datos/alimentos.json:', len(mx), 'de México +', len(us), 'del USDA =', len(mx) + len(us),
          '(%d KB)' % (os.path.getsize(destino) // 1024))


if __name__ == '__main__':
    main()

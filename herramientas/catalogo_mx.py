#!/usr/bin/env python3
"""Baja la Tabla de composición de alimentos mexicanos (INCMNSZ, en el SiAgro de CONABIO) por su API GraphQL
y la deja en datos/mexico.json: un renglón por alimento con proteína, hidratos, grasa, kcal y fibra por 100 g.
Corre en GitHub Actions (aquí sí hay acceso a esa página): .github/workflows/catalogo.yml
"""
import json, re, sys, time, urllib.request

G = 'https://nutricion-siagro.conabio.gob.mx/graphql'


def q(query, variables=None):
    for intento in range(4):
        try:
            req = urllib.request.Request(G, data=json.dumps({'query': query, 'variables': variables or {}}).encode(),
                                         headers={'Content-Type': 'application/json', 'User-Agent': 'GymApp/8 (uso personal)'})
            r = json.load(urllib.request.urlopen(req, timeout=120))
            if r.get('errors'):
                raise RuntimeError(json.dumps(r['errors'])[:500])
            return r['data']
        except Exception as e:
            print('  reintento', intento + 1, e, file=sys.stderr)
            time.sleep(3 * (intento + 1))
    raise SystemExit('La API de CONABIO no respondió')


def escalares(tipo):
    d = q('query($n:String!){__type(name:$n){fields{name type{kind name ofType{kind name}}}}}', {'n': tipo})
    campos = []
    for f in d['__type']['fields']:
        t = f['type']; k = t['kind'] if t['kind'] != 'NON_NULL' else t['ofType']['kind']
        if k == 'SCALAR': campos.append(f['name'])
    return campos


def todos(nombre, campos, por=1000):
    total = q('{count%s}' % (nombre[0].upper() + nombre[1:]))
    total = list(total.values())[0]
    print(nombre, 'total', total)
    out = []
    for off in range(0, total, por):
        d = q('{%s(pagination:{limit:%d, offset:%d}){%s}}' % (nombre, por, off, ' '.join(campos)))
        out += list(d.values())[0]
        print('  ', len(out), '/', total)
    return out


def main():
    cr = escalares('registro'); cc = escalares('caracteristica_cuantitativa')
    print('registro:', cr); print('caracteristica_cuantitativa:', cc)
    regs = todos('registros', cr)
    cars = todos('caracteristica_cuantitativas', [c for c in cc if c in ('id', 'nombre', 'nombre_corto', 'valor', 'unidad', 'registro_id')])
    # Qué nutrientes hay (para elegir bien los nombres)
    tipos = {}
    for c in cars:
        k = (c.get('nombre') or '') + ' | ' + (c.get('nombre_corto') or '') + ' | ' + (c.get('unidad') or '')
        tipos[k] = tipos.get(k, 0) + 1
    for k, n in sorted(tipos.items(), key=lambda x: -x[1])[:80]:
        print('%6d  %s' % (n, k))
    # Valores por registro
    def elegir(nombre, corto, unidad):
        t = (nombre + ' ' + corto).lower()
        u = (unidad or '').lower()
        if re.search(r'prote', t): return 'p'
        if re.search(r'l[ií]pid|grasa|extracto et[eé]reo', t) and not re.search(r'satur|monoins|poliins|trans|colest', t): return 'f'
        if re.search(r'hidratos|carbohidrat', t) and not re.search(r'disponib', t): return 'c'
        if re.search(r'energ', t) and 'kj' not in u: return 'k'
        if re.search(r'fibra', t): return 'fd' if re.search(r'diet', t) and not re.search(r'insol', t) else ('fb' if re.search(r'bruta', t) else None)
        if re.search(r'porci[oó]n comestible', t): return 'pc'
        return None
    vals = {}
    for c in cars:
        k = elegir(c.get('nombre') or '', c.get('nombre_corto') or '', c.get('unidad'))
        if not k or c.get('valor') is None: continue
        vals.setdefault(c['registro_id'], {}).setdefault(k, c['valor'])
    out = []
    for r in regs:
        v = vals.get(r['conabio_id'], {})
        if 'p' not in v and 'k' not in v: continue
        # Ojo (nota 6 de la tabla): salvo lo que ya viene preparado (tortilla, pan, tacos, enlatados…), los valores son del alimento CRUDO
        out.append({'id': r['conabio_id'], 'n': (r.get('descripcion_alimento') or '').strip(), 'en': (r.get('food_description') or '').strip(),
                    'g': r.get('tipo_alimento'), 'pc': v.get('pc'),
                    'p': v.get('p'), 'c': v.get('c'), 'f': v.get('f'), 'k': v.get('k'), 'fib': v.get('fd', v.get('fb'))})
    print('con macros:', len(out), 'de', len(regs))
    for x in out[:15]: print('  ', json.dumps(x, ensure_ascii=False)[:300])
    import os; os.makedirs('datos', exist_ok=True)
    json.dump(out, open('datos/mexico.json', 'w'), ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()

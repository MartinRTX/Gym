# Gym

La app de gym de Martin: registrar series, peso, cintura, trotes y comida, con el plan del día y un coach con IA.
Funciona sin señal y guarda todo en una hoja de Google de cada quien.

- Abrir: https://martinrtx.github.io/Gym/ (o la APK de Releases).
- **Cómo está hecha y cómo cambiarla sin romperla: [ARQUITECTURA.md](ARQUITECTURA.md).**
- Qué se hizo, qué falta y las reglas para publicar: [PENDIENTES.md](PENDIENTES.md).

```bash
node herramientas/revisar.js
npx -y -p typescript@6.0.2 tsc -p tsconfig.json
node --test tests/*.test.js
NODE_PATH=/opt/node-tools/node_modules node tests/e2e/correr.js
```

<div align="center">

# cREA

### _Reverse engineer anything. Then create._

**Æ** — Nigredo · Sol · Luna

</div>

---

> cREA es un fork personal de [REA](https://github.com/morluto/rea) (MIT).
> Toma un programa, un binario, una canción o un dispositivo del que **no tienes
> el código fuente**, y lo descompone hasta entenderlo — con la evidencia y los
> límites de cada conclusión a la vista. Lo que entiendes, lo puedes reconstruir.

---

## Qué es, sin humo

REA conecta un agente con herramientas reales de ingeniería inversa: Ghidra,
Hopper, IDA, Frida, GDB, JADX, apktool, análisis de .NET, Electron, JavaScript,
firmware y capturas de red. El análisis corre **localmente**. Cada resultado
viene con su evidencia.

cREA es esa base, con tres principios propios:

1. **No alucina.** Toda afirmación se contrasta contra el `Evidence contract` de
   REA. Si no hay bytes que la respalden, se marca como no verificada. Un
   agente verificador vigila esto.
2. **Datos duros primero.** Los acordes, el MIDI, los hechos de un APK, el campo
   armónico — salen de analizadores deterministas, al instante, sin modelo. El
   LLM solo narra, y es opcional. cREA es rápida porque no está "pensando".
3. **Honra la fuente.** El análisis de una obra —código, música, letra— sirve
   para entenderla e interoperar, nunca para copiarla ni para saltarse las
   protecciones de nadie.

---

## Estado — qué es real hoy

| Pieza                                              | Estado                                                                                                           | Dónde                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Línea base                                         | ✅ instala, compila, typecheck limpio, tests verdes                                                              | —                            |
| Motor REA (binarios, APK, JS, .NET, firmware, red) | ✅ heredado de upstream                                                                                          | `src/`                       |
| Verificador (`crea verify`)                        | ✅ veredicto verified / open / contradicted sobre el ledger de REA                                               | `crea/verify.mjs`            |
| Interfaz web local                                 | ✅ soltar JSON → veredicto; mapa de capacidades                                                                  | `crea/web/`                  |
| Manual "amigo cREA" en PDF                         | ✅ portada, índice, color por capítulo, capas Semilla / Raíz / Ojo                                               | `crea/manual/`               |
| Música (`crea music`)                              | ✅ prueba de concepto: tonalidad, modo, acordes, grados, campo armónico, fuera de tonalidad, bajo, melodía, MIDI | `crea/music/`                |
| Narración local (`crea narrate`)                   | ✅ modelo local opcional; se rechaza si inventa números o IDs                                                    | `crea/narrate.mjs`           |
| Guía de IA local para el Acer                      | ✅                                                                                                               | `crea/docs/ia-local-acer.md` |
| CI                                                 | ✅ definido; corre cuando actives Actions en el fork                                                             | `.github/workflows/crea.yml` |

`crea music` está probado con audio sintetizado de verdad conocida, no con grabaciones comerciales. `crea narrate` está probado con un servidor Ollama simulado, no con un modelo real.

## Hoja de ruta — qué falta

> Marcado así para no confundir deseo con hecho. Nada de esta lista existe aún.

- [ ] **Extensiones armónicas** (9, 11, 13) y voicings en `crea music`
- [ ] **Análisis de letra**, honrando al artista
- [ ] **Receta desde la foto del plato**
- [ ] **Interoperabilidad USB**: conectar, probar y documentar tus propios dispositivos
- [ ] **Perfil de arquitectura o herramienta nueva** (APK o CPU nueva)
- [ ] **Mascota de cREA**, a partir de un diseño propio
- [ ] Validar `crea music` en grabaciones reales y medir la IA local en el Acer

---

## Quick start

> Requiere Node.js. Igual que REA upstream.

```bash
git clone https://github.com/HenryLozada/crea.git
cd crea
npm ci
npm run build:cached

# verificar un análisis
node crea/verify.mjs crea/examples/empty-request.json
node crea/web/server.mjs                 # http://127.0.0.1:4173

# manual en PDF
node crea/manual/build.mjs               # → crea/manual/out/cREA-manual.pdf

# música
pip install -r crea/music/requirements.txt
python3 crea/music/analyze.py cancion.mp3 --midi cancion.mid

# pruebas
node --test crea/*.test.mjs crea/web/*.test.mjs crea/manual/*.test.mjs
python3 -I -m unittest discover -s crea/music -p 'test_*.py'
```

---

## Identidad

- **Nigredo** `#0D0A17` — Binah, la materia prima. El fondo.
- **Sol** `#CBA24A` — Tiféret, el oro de la Obra. La marca.
- **Luna** `#CBD3DC` — Yesod, el reflejo. La R espejo vive aquí.
- Tipografía: **Cinzel** (capital romana) + **EB Garamond** itálica.
- Logo: la ligadura **Æ** inscrita en el rectángulo áurico; _solve et coagula_.

---

## Uso responsable

cREA hereda el [DISCLAIMER de REA](https://github.com/morluto/rea/blob/main/DISCLAIMER.md).
Para análisis lícito: investigación de seguridad, análisis de malware,
interoperabilidad, preservación, CTFs, educación, y depurar o auditar software
que posees o estás autorizado a examinar. No para saltar DRM, anti-cheat,
autenticación o controles de acceso de sistemas que no son tuyos. La autoría de
un análisis no otorga derechos sobre el programa original.

---

<div align="center">

**cREA** — del reflejo de <span>Я</span>EA

</div>

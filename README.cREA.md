<div align="center">

# cREA

### *Reverse engineer anything. Then create.*

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

| | |
|---|---|
| Línea base | ✅ instala, compila, typecheck limpio, tests verdes |
| Motor REA (binarios, APK, JS, .NET, firmware, red) | ✅ heredado de upstream |
| Contrato de evidencia | ✅ existe, con tests propios |

## Hoja de ruta — qué añade cREA

> Marcado así para no confundir deseo con hecho. Nada de esto existe aún.

- [ ] **Agente verificador** — consume evidencia/ledgers y reporta alucinaciones y fugas
- [ ] **Agente "amigo cREA"** — genera manuales, PDFs y docs con voz propia
- [ ] **IA local privada** — anota decompilados offline, sin salida de datos
- [ ] **Audio** — canción → acordes, extensiones, campo armónico, armonía modal, líneas de bajo
- [ ] **Melodía → MIDI**
- [ ] **Análisis de letra** honrando al artista
- [ ] **Receta desde la foto del plato**
- [ ] **Interoperabilidad USB** — conectar, probar, documentar dispositivos
- [ ] **Plataforma web** — agente rápido, respuestas directas
- [ ] **Perfil de arquitectura / herramienta nueva** (APK o CPU nueva)

---

## Quick start

> Requiere Node.js. Igual que REA upstream.

```bash
git clone https://github.com/HenryLozada/crea.git
cd crea
npm ci
npx tsc --noEmit        # typecheck
npx vitest run src/contracts   # muestra de tests
```

---

## Identidad

- **Nigredo** `#0D0A17` — Binah, la materia prima. El fondo.
- **Sol** `#CBA24A` — Tiféret, el oro de la Obra. La marca.
- **Luna** `#CBD3DC` — Yesod, el reflejo. La R espejo vive aquí.
- Tipografía: **Cinzel** (capital romana) + **EB Garamond** itálica.
- Logo: la ligadura **Æ** inscrita en el rectángulo áurico; *solve et coagula*.

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

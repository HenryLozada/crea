# Manual de inicio

## Qué es cREA

cREA toma algo de lo que no tienes el código fuente —un programa, una app, un archivo— y te ayuda a entender cómo funciona por dentro. Lo que entiendes, lo puedes reconstruir a tu manera.

> [semilla] Imagina un reloj cerrado. No puedes ver los engranes, pero puedes escuchar cómo suena, ver cómo se mueven las manecillas y, con cuidado, abrir la tapa. cREA es la lupa y el desarmador. Y además te dice cuáles de tus conclusiones están comprobadas y cuáles son solo una corazonada.

> [raiz] cREA es un fork de REA (licencia MIT). REA conecta un agente con herramientas reales de ingeniería inversa —Ghidra, Hopper, IDA, Frida, GDB, JADX, apktool— y con analizadores de .NET, Electron, JavaScript, firmware y capturas de red. Todo corre en tu máquina. Cada resultado sale como un registro de Evidencia con su procedencia y sus límites.

### Tres reglas de la casa

1. **No alucina.** Una afirmación sin evidencia que la respalde se queda abierta. Nunca se da por cierta.
2. **Datos duros primero.** Lo que se puede medir se mide con analizadores deterministas, sin modelo. Una IA, si la usas, solo narra.
3. **Honra la fuente.** Analizar sirve para entender e interoperar, no para copiar la obra de nadie ni saltarse sus protecciones.

## Antes de empezar

Necesitas Node.js (la versión exacta está en el archivo `.nvmrc` del repositorio) y Git.

```bash
git clone https://github.com/HenryLozada/crea.git
cd crea
npm ci
npm run build:cached
```

> [semilla] `npm ci` baja las piezas que cREA necesita. `build:cached` las arma. Solo se hace una vez, o cuando actualizas.

> [raiz] `build:cached` compila el runtime de REA con Turborepo. Sin ese paso, el CLI responde "REA's compiled runtime is missing". Para análisis nativo profundo, REA usa tu propia instalación de Ghidra, Hopper o IDA; cREA no instala ninguna.

### Comprobar que todo está bien

```bash
npx tsc --noEmit
node --test crea/verify.test.mjs crea/web/server.test.mjs
```

Si ambos terminan sin errores, la base está sana.

## Tu primera verificación

El corazón de cREA es `crea verify`. Le das el resultado de un análisis y te responde una de tres cosas.

| Estado | Qué significa | Código de salida |
|---|---|---|
| **verified** | Cada afirmación requerida tiene dueño, casos de prueba y un verificador que pasó. | 0 |
| **open** | Hay afirmaciones sin probar. Puede ser trabajo pendiente o falta de evidencia. | 1 |
| **contradicted** | La evidencia se contradice. Alguna conclusión está mal. | 2 |

```bash
node crea/verify.mjs crea/examples/empty-request.json
```

Con el ejemplo vacío el resultado es **open**: no hay evidencia, así que no se puede afirmar nada. Eso es correcto, y es la prueba más simple de que cREA no inventa.

> [semilla] Es como un profesor que revisa tu tarea: no le basta con que la respuesta suene bien, quiere ver el procedimiento.

> [raiz] `crea verify` envuelve la herramienta `build_reconstruction_obligation_ledger` de REA. El ledger convierte registros de Evidencia autenticados en una lista determinista de obligaciones. Una obligación solo se cierra cuando un enlace del manifiesto aporta dueño único, los tipos requeridos, cada caso de prueba y un verificador con autoridad comparable a la observación original. Agrega `--json` para obtener el veredicto como datos.

> [ojo] Un estado `open` no es un error del programa. Significa que todavía no hay pruebas suficientes. Tratarlo como "casi verificado" es justo el tipo de alucinación que cREA existe para evitar.

## La interfaz web

Si prefieres no usar la terminal:

```bash
node crea/web/server.mjs
```

Abre `http://127.0.0.1:4173` en tu navegador. Arrastra un archivo `.json` o prueba con el ejemplo vacío.

> [semilla] Es la misma verificación, pero con botones. Nada sale de tu computadora.

> [raiz] El servidor no tiene dependencias y solo escucha en `127.0.0.1`. Expone `POST /api/verify` (límite de 8 MB) y `GET /api/capabilities`, que separa con honestidad lo que ya funciona de lo que está en camino.

## Leer un veredicto

Un veredicto trae cuatro listas. Cada una responde una pregunta distinta.

| Lista | La pregunta que responde |
|---|---|
| Contradichas | ¿Dónde se contradice la evidencia? |
| Sin dueño | ¿Qué afirmación no tiene un responsable claro en el código? |
| Sin verificador | ¿Qué afirmación nadie ha comprobado? |
| Incógnitas residuales | ¿Qué sigue sin saberse? Aquí suelen esconderse las fugas. |

Al final aparecen los **límites declarados por REA**. Léelos siempre: dicen lo que el análisis no pudo ver.

## Ruta de aprendizaje

Avanza por niveles. Cada uno se apoya en el anterior.

1. **Semilla.** Instala cREA, corre la verificación con el ejemplo vacío y entiende por qué sale `open`.
2. **Brote.** Analiza una app JavaScript o Electron tuya con REA. No necesitas motor nativo.
3. **Raíz.** Exporta el bundle de Evidencia de esa sesión y pásalo por `crea verify`. Mira qué queda abierto.
4. **Tronco.** Instala Ghidra y analiza un binario que tú compilaste. Compara lo que dice el análisis con tu código fuente: esa es la mejor escuela.
5. **Copa.** Escribe obligaciones revisadas y un manifiesto para cerrar afirmaciones de verdad.

> [ojo] Practica siempre con cosas que son tuyas o que tienes permiso de analizar. Un binario que tú compilaste es perfecto, porque puedes comprobar cada conclusión.

## Glosario

| Término | Significado |
|---|---|
| Evidencia | Registro de una observación, con su origen, su autoridad y sus límites. |
| Ledger de obligaciones | Lista de afirmaciones a probar, derivada de la evidencia. |
| Obligación | Una afirmación concreta, por ejemplo "este comando acepta tal opción". |
| Manifiesto | Dice quién es dueño de cada obligación y cómo se verifica. |
| Incógnita residual | Algo que el análisis no pudo determinar. |
| Determinista | Mismo input, mismo resultado, siempre. Sin azar ni modelo. |

## Uso responsable

cREA hereda el DISCLAIMER de REA. Sirve para investigación de seguridad, análisis de malware, interoperabilidad, preservación de software, CTFs, educación, y para depurar o auditar software que posees o que estás autorizado a examinar.

> [ojo] cREA no es para saltarse DRM, anti-cheat, licencias, autenticación ni controles de acceso de sistemas ajenos. Tener un archivo o que una app sea pública no te da permiso para todo. Analizar algo tampoco te da derechos sobre el programa original.

## Fuentes

Este manual se basa en la documentación del repositorio:

- `README.md` y `DISCLAIMER.md` de REA
- `docs/reconstruction-obligation-ledgers.md`, sobre cómo se construye y se cierra un ledger
- `AGENTS.md`, sobre principios de evidencia, procedencia y arquitectura
- El código y las pruebas de `crea/verify.mjs` y `crea/web/server.mjs`

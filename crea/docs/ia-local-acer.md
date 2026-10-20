# IA local para cREA en el Acer Aspire VX 15

Equipo: i7-7700HQ (4 núcleos / 8 hilos), 24 GB de RAM, GTX 1050 Ti de 4 GB (Pascal, compute capability 6.1).

## Veredicto

Sí se puede, con límites claros:

- **Cabe:** un modelo de 3 a 4 mil millones de parámetros, cuantizado a 4 bits (Q4_K_M, unos 2–2.5 GB), con contexto de 2K–4K tokens, casi todo en la GPU.
- **No cabe bien:** un 7B Q4 (4–5 GB). Se desborda a la RAM y baja a unos 2–8 tokens por segundo.
- **No es instantáneo.** Por eso en cREA la IA **solo narra**: los datos duros (veredictos, acordes, MIDI) salen de analizadores deterministas al instante, y el modelo solo los explica si se lo pides.

## Dato crítico: CUDA 13 ya no soporta tu GPU

CUDA 13 eliminó Maxwell, Pascal y Volta; el mínimo ahora es Turing (7.5). Tu 1050 Ti sigue funcionando por **builds CUDA 12**:

- **Ollama** incluye un runner CUDA 12 que cubre compute 6.1 y lo elige automáticamente. Su documentación de hardware lista la GTX 1050 Ti y pide **driver 570 o superior** para compute 5.0–6.2.
- **llama.cpp** en Windows: usa el zip **CUDA 12.x** más el zip `cudart` que le corresponde. El build CUDA 13 no arranca en tu tarjeta.
- **Respaldo:** el backend Vulkan, que Ollama activa por defecto si está instalado. No hay mediciones publicadas en Pascal, así que conviene compararlo contra CUDA en tu equipo.

Cuando Ollama quite su runner CUDA 12, Pascal se queda sin GPU en Ollama. Hoy no hay fecha anunciada.

## Instalación (Windows)

1. Revisa el driver:
   ```powershell
   nvidia-smi --query-gpu=name,compute_cap,driver_version --format=csv
   ```
   Necesitas `compute_cap` 6.1 y driver 570 o superior. Si es menor, actualízalo desde NVIDIA.
2. Instala Ollama desde su sitio oficial.
3. Baja un modelo pequeño (los nombres exactos de los tags cambian; confírmalos en la biblioteca de Ollama):
   ```powershell
   ollama pull qwen2.5:3b
   ollama pull llama3.2:3b
   ollama pull phi4-mini
   ```
4. Prueba con contexto corto:
   ```powershell
   ollama run qwen2.5:3b --verbose
   ```
   `--verbose` muestra tokens por segundo. Esa es tu medición real, no la de ningún blog.

## Ajuste para tu equipo

| Ajuste                      | Valor                                             | Por qué                                                                                                    |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Modelo                      | 3–4B, Q4_K_M                                      | Deja ~1.5 GB de VRAM para el escritorio de Windows y el contexto                                           |
| Contexto (`num_ctx`)        | 2048, subir a 4096 si no falla                    | El contexto largo come 1–2 GB extra de VRAM                                                                |
| `OLLAMA_NUM_PARALLEL`       | 1                                                 | Una petición a la vez; con 4 GB no hay espacio para dos                                                    |
| `OLLAMA_MAX_LOADED_MODELS`  | 1                                                 | Evita que dos modelos se peleen la VRAM                                                                    |
| Hilos de CPU (`num_thread`) | empezar en 4, comparar con 8                      | 4 = núcleos físicos del 7700HQ; en inferencia suele rendir igual o mejor que usar los 8 hilos, pero mídelo |
| Energía                     | Conectado a corriente, perfil de alto rendimiento | Las laptops suelen limitar la GPU con batería                                                              |
| Juegos / DAW abiertos       | Ciérralos                                         | Comparten la misma VRAM                                                                                    |

Variables de entorno en PowerShell (persisten para tu usuario):

```powershell
setx OLLAMA_NUM_PARALLEL 1
setx OLLAMA_MAX_LOADED_MODELS 1
```

Reinicia Ollama después de cambiarlas.

## Cómo encaja en cREA

```
análisis determinista ──► JSON (veredicto, acordes, MIDI) ──► [opcional] modelo local ──► explicación en prosa
        hechos                         fuente de verdad                  solo narra
```

Reglas para la integración:

1. El modelo recibe **solo** el JSON del análisis, nunca el binario ni el audio.
2. La narración no puede introducir números, IDs ni nombres que no estén en el JSON. Un verificador lo comprueba antes de mostrarla y, si falla, se muestra el JSON tal cual.
3. Todo va a `127.0.0.1:11434`. Nada sale de tu máquina.
4. Sin modelo instalado, cREA funciona igual: la narración es un extra, no una dependencia.

## Uso

```powershell
node crea/verify.mjs mi-analisis.json --json > veredicto.json
node crea/narrate.mjs veredicto.json --model qwen2.5:3b
```

`crea narrate` ya aplica la regla 2. Si el modelo menciona un número o un ID que no está en el JSON, la narración se rechaza y se muestra el JSON. Sin Ollama corriendo, hace lo mismo y devuelve el código de salida 1.

## Pendiente

- Medir tokens por segundo reales en tu Acer con 2–3 modelos y elegir el modelo por defecto.
- Extender el verificador de narración a nombres de acordes y notas para los resultados de `crea music`.

## Fuentes

- [Pascal GPUs after CUDA 13 — Local AI Master](https://localaimaster.com/blog/pascal-gpus-after-cuda-13) (revisado al 18 de agosto de 2026)
- [Ollama — documentación de hardware (docs/gpu.mdx, paquete 0.40.6)](https://fossies.org/linux/ollama/docs/gpu.mdx)
- [Running local AI on a 4GB VRAM GPU in 2026 — LMSA](https://lmsa.app/blog/running-local-ai-on-a-4gb-vram-gpu-in-2026-the-real-world-guide-that-actually-works/) (actualizado en junio de 2026)
- [PyTorch: CUDA 12.6 wheels will no longer be published from 2.15 (drops Maxwell / Pascal / Volta)](https://dev-discuss.pytorch.org/t/notice-cuda-12-6-wheels-will-no-longer-be-published-from-pytorch-2-15-drops-maxwell-pascal-volta/3432)

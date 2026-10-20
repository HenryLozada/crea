# cREA · música

Análisis musical **determinista**: procesamiento de señal, sin modelo de IA y sin red.

```bash
pip install -r crea/music/requirements.txt   # librosa, mido, soundfile (ffmpeg para MP3)
python3 crea/music/analyze.py cancion.mp3 --midi cancion.mid
python3 crea/music/analyze.py cancion.mp3 --json
```

## Qué mide

| Salida                  | Cómo se obtiene                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tonalidad               | Perfiles Krumhansl-Kessler sobre el croma, reordenados con evidencia de centro tonal: tiempo como raíz, acordes inicial y final, y calidad del acorde de tónica |
| Modo (hipótesis)        | Qué modo eclesiástico sobre la tónica explica mejor la energía de cada nota                                                                                     |
| Acordes                 | Plantillas (tríadas, 7, maj7, m7, dim, sus2, sus4) sobre croma CQT sincronizado al pulso                                                                        |
| Grados y campo armónico | Números romanos y acordes diatónicos con séptima de la tonalidad                                                                                                |
| Fuera de tonalidad      | Cada acorde ajeno lleva una hipótesis: dominante secundaria, intercambio modal o cromático                                                                      |
| Bajo                    | La nota más fuerte entre E1 y E3 en cada acorde                                                                                                                 |
| Melodía                 | La voz predominante por cuadro (E3–C7), con los armónicos limitados por la energía de su fundamental                                                            |
| MIDI                    | Pistas separadas de melodía, bajo y acordes                                                                                                                     |

## Lo que no hace (todavía)

- No transcribe una partitura completa: sobre una mezcla, todo es aproximado.
- No detecta extensiones (9, 11, 13) ni voicings.
- No separa instrumentos: si dos voces compiten, la melodía sigue a la más fuerte.
- No analiza letras.

El reporte imprime estos límites cada vez que corre.

## Cómo se prueba

```bash
python3 -I -m unittest discover -s crea/music -p 'test_*.py'
```

Las pruebas sintetizan su propio audio con verdad conocida (tonalidad, acordes, bajo y melodía nota por nota, octava incluida):
progresión I–vi–IV–V en C, un bVII prestado (C–Bb–F–C, C mixolidio), una progresión en A menor con dominante de la menor armónica, entrada MP3, export MIDI, y la normalización de magnitud de la CQT.

Analiza música que te pertenece o que estudias. El análisis sirve para entender una obra, no para reproducirla.

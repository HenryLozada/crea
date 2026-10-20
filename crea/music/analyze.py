#!/usr/bin/env python3
"""crea music — deterministic song analysis. No model, no network.

    python3 crea/music/analyze.py song.mp3 [--midi out.mid] [--json]

Reports key, mode hypothesis, chord timeline with roman numerals, the
harmonic field of the key, chords outside it (with a labelled hypothesis),
bass line, and melody, and writes melody/bass/chords to a MIDI file.

Everything is measured from the audio with signal processing (librosa).
Results on a full mix are approximations; the report states its limits.
"""
from __future__ import annotations

import argparse
import json
import sys
import warnings
from dataclasses import dataclass, asdict, field

import numpy as np

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

# Krumhansl-Kessler key profiles.
KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

# Chord vocabulary: suffix -> intervals from root.
CHORDS = {
    "": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "maj7": (0, 4, 7, 11),
    "m7": (0, 3, 7, 10), "dim": (0, 3, 6), "sus4": (0, 5, 7), "sus2": (0, 2, 7),
}

MODES = {
    "jónico (mayor)": (0, 2, 4, 5, 7, 9, 11),
    "dórico": (0, 2, 3, 5, 7, 9, 10),
    "frigio": (0, 1, 3, 5, 7, 8, 10),
    "lidio": (0, 2, 4, 6, 7, 9, 11),
    "mixolidio": (0, 2, 4, 5, 7, 9, 10),
    "eólico (menor natural)": (0, 2, 3, 5, 7, 8, 10),
    "locrio": (0, 1, 3, 5, 6, 8, 10),
}

ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"]

LIMITS = [
    "Análisis de señal sobre la mezcla completa: aproximado, no una partitura.",
    "La melodía es la voz predominante por cuadro; cuando dos voces compiten, gana la más fuerte.",
    "Vocabulario de acordes: tríadas, séptimas, sus2/sus4 y disminuido. Extensiones (9, 11, 13) no se detectan.",
    "El modo y las hipótesis de acordes fuera de tonalidad son interpretaciones, no hechos medidos.",
]


@dataclass
class ChordEvent:
    start: float
    end: float
    chord: str
    root: int
    quality: str
    score: float
    degree: str | None = None
    in_key: bool = True
    hypothesis: str | None = None


@dataclass
class NoteEvent:
    start: float
    end: float
    midi: int
    name: str


@dataclass
class Analysis:
    duration: float
    tempo_bpm: float | None
    key: str
    key_confidence: float
    mode_hypothesis: str
    harmonic_field: list[str]
    chords: list[ChordEvent] = field(default_factory=list)
    out_of_key: list[dict] = field(default_factory=list)
    bass: list[NoteEvent] = field(default_factory=list)
    melody: list[NoteEvent] = field(default_factory=list)
    limits: list[str] = field(default_factory=lambda: list(LIMITS))


def note_name(midi: int) -> str:
    return f"{NOTES[midi % 12]}{midi // 12 - 1}"


def detect_key(profile: np.ndarray, roots: list[tuple[int, float, str]] | None = None) -> tuple[int, str, float]:
    """Return (tonic, 'major'|'minor', confidence).

    Krumhansl-Kessler correlation on the pitch-class profile, re-ranked by
    tonal-center evidence when a chord timeline is given: how long each pitch
    class sounds as a chord root, and whether it opens and closes the piece.
    That separates e.g. C mixolydian (C-Bb-F-C) from F major, which share notes.
    The quality of the chord built on the tonic (major or minor third) then
    weighs the mode.
    """
    total = sum(d for _, d, _ in roots or []) or 1.0
    root_time = np.zeros(12)
    minor_time = np.zeros(12)
    for r, d, q in roots or []:
        root_time[r] += d / total
        if q in ("m", "m7", "dim"):
            minor_time[r] += d / total
    first = roots[0][0] if roots else None  # (root, duration, quality)
    last = roots[-1][0] if roots else None
    scores = []
    for tonic in range(12):
        for mode, prof in (("major", KK_MAJOR), ("minor", KK_MINOR)):
            r = float(np.nan_to_num(np.corrcoef(profile, np.roll(prof, tonic))[0, 1]))
            if roots:
                r += 0.35 * root_time[tonic] + 0.15 * (last == tonic) + 0.05 * (first == tonic)
                if root_time[tonic] > 0:
                    minor_share = minor_time[tonic] / root_time[tonic]
                    r += 0.2 * (minor_share if mode == "minor" else 1 - minor_share)
            scores.append((r, tonic, mode))
    scores.sort(reverse=True)
    best, second = scores[0], scores[1]
    return best[1], best[2], round(best[0] - second[0], 3)


def key_name(tonic: int, mode: str) -> str:
    return f"{NOTES[tonic]} {'mayor' if mode == 'major' else 'menor'}"


def scale_of(tonic: int, mode: str) -> list[int]:
    steps = MODES["jónico (mayor)"] if mode == "major" else MODES["eólico (menor natural)"]
    return [(tonic + s) % 12 for s in steps]


def harmonic_field(tonic: int, mode: str) -> list[dict]:
    """Diatonic seventh chords of the key, degree by degree."""
    scale = scale_of(tonic, mode)
    out = []
    for i, root in enumerate(scale):
        third = (scale[(i + 2) % 7] - root) % 12
        fifth = (scale[(i + 4) % 7] - root) % 12
        seventh = (scale[(i + 6) % 7] - root) % 12
        if (third, fifth) == (4, 7):
            q7 = "maj7" if seventh == 11 else "7"
            triad, numeral = "", ROMAN[i]
        elif (third, fifth) == (3, 7):
            q7, triad, numeral = "m7", "m", ROMAN[i].lower()
        else:
            q7, triad, numeral = "m7b5", "dim", ROMAN[i].lower() + "°"
        out.append({"degree": numeral, "root": root, "triad": NOTES[root] + triad, "seventh": NOTES[root] + q7})
    return out


def classify_chord(root: int, quality: str, tonic: int, mode: str, field_: list[dict]) -> tuple[str | None, bool, str | None]:
    """Return (degree, in_key, hypothesis) for a detected chord."""
    scale = scale_of(tonic, mode)
    tones = {(root + iv) % 12 for iv in CHORDS[quality]}
    if tones <= set(scale) and root in scale:
        deg = field_[scale.index(root)]["degree"]
        return deg + ("7" if quality in ("7", "maj7", "m7") else ""), True, None
    # In minor, a major or dominant V comes from the harmonic minor: standard, in key.
    if mode == "minor" and root == (tonic + 7) % 12 and quality in ("", "7"):
        return "V" + ("7" if quality == "7" else ""), True, None
    # Secondary dominant: a major/dominant chord a fifth above a diatonic degree.
    if quality in ("", "7"):
        target = (root + 5) % 12
        if target in scale and target != root:
            tdeg = field_[scale.index(target)]["degree"]
            return f"V/{tdeg}", False, f"dominante secundaria: prepara el {tdeg}"
    # Modal interchange: diatonic to the parallel major/minor.
    parallel = "minor" if mode == "major" else "major"
    pscale = scale_of(tonic, parallel)
    if tones <= set(pscale) and root in pscale:
        pdeg = harmonic_field(tonic, parallel)[pscale.index(root)]["degree"]
        flat = "b" if (root - tonic) % 12 in (3, 8, 10) and mode == "major" else ""
        return flat + pdeg, False, f"intercambio modal: tomado de {key_name(tonic, parallel)}"
    # Mixolydian bVII in major is common outside the parallel minor check above.
    return None, False, "cromático: fuera de la tonalidad y de su modo paralelo"


def match_chord(chroma: np.ndarray) -> tuple[int, str, float]:
    v = chroma / (np.linalg.norm(chroma) + 1e-9)
    best = (0, "", -1.0)
    for q, ivs in CHORDS.items():
        tmpl = np.zeros(12)
        for k, iv in enumerate(ivs):
            tmpl[iv] = 1.0 if k < 3 else 0.7
        tmpl /= np.linalg.norm(tmpl)
        for r in range(12):
            s = float(v @ np.roll(tmpl, r))
            # Small bias toward simpler chords so a triad is not read as a 7th.
            s -= 0.02 * (len(ivs) - 3)
            if s > best[2]:
                best = (r, q, s)
    return best


def mode_hypothesis(profile: np.ndarray, tonic: int) -> str:
    p = profile / (profile.sum() + 1e-9)
    scores = {name: sum(p[(tonic + s) % 12] for s in steps) for name, steps in MODES.items()}
    best = max(scores, key=scores.get)
    return f"{NOTES[tonic]} {best}"


def notes_from_f0(f0: np.ndarray, times: np.ndarray, min_dur: float) -> list[NoteEvent]:
    out: list[NoteEvent] = []
    cur, start = None, None
    midi = np.round(12 * np.log2(np.where(np.isnan(f0), np.nan, f0) / 440.0) + 69)
    for t, m in zip(times, midi):
        m = None if np.isnan(m) else int(m)
        if m != cur:
            if cur is not None and t - start >= min_dur:
                out.append(NoteEvent(round(start, 3), round(float(t), 3), cur, note_name(cur)))
            cur, start = m, float(t)
    if cur is not None and times.size and times[-1] - start >= min_dur:
        out.append(NoteEvent(round(start, 3), round(float(times[-1]), 3), cur, note_name(cur)))
    return out


def flat_cqt(y: np.ndarray, sr: int, hop: int, lo: int, n_bins: int) -> np.ndarray:
    """Semitone CQT magnitude, flattened across pitch.

    librosa's CQT magnitude falls as f^-1/2 for equal amplitude (measured:
    half per two octaves), which biases any argmax toward lower octaves.
    Multiplying bin k by 2^(k/24) makes equal amplitudes compare equal.
    """
    import librosa

    mag = np.abs(librosa.cqt(y, sr=sr, hop_length=hop, fmin=librosa.midi_to_hz(lo), n_bins=n_bins, bins_per_octave=12))
    return mag * (2.0 ** (np.arange(n_bins) / 24.0))[:, None]


def predominant_melody(harm: np.ndarray, sr: int, hop: int, lo: int = 52, hi: int = 96) -> list[NoteEvent]:
    """Top-line estimate: the most salient pitch per frame in E3..C7.

    Salience adds each candidate's first overtones, capped by the candidate's
    own fundamental energy, so overtones reinforce the right octave. Frames well below the piece's
    level are unvoiced. A short median filter removes one-frame jumps.
    """
    import librosa
    from scipy.ndimage import median_filter

    n_bins = (hi + 24) - lo + 1
    mag = flat_cqt(harm, sr, hop, lo, n_bins)
    cand = hi - lo + 1
    base = mag[:cand]
    sal = base.copy()
    # Overtones reinforce a candidate only up to its own fundamental energy;
    # otherwise the octave below a loud note would win (subharmonic error).
    for k, off in enumerate((12, 19, 24), start=1):
        sal += (0.8 ** k) * np.minimum(mag[off:off + cand], base)
    best = np.argmax(sal, axis=0)
    peak = sal[best, np.arange(sal.shape[1])]
    voiced = peak > 0.25 * np.percentile(peak, 95)
    midi = median_filter(best + lo, size=5).astype(float)
    midi[~voiced] = np.nan
    f0 = 440.0 * 2 ** ((midi - 69) / 12)
    times = librosa.frames_to_time(np.arange(len(f0)), sr=sr, hop_length=hop)
    return notes_from_f0(f0, times, min_dur=0.08)


def analyze(path: str, sr: int = 22050) -> Analysis:
    import librosa

    y, sr = librosa.load(path, sr=sr, mono=True)
    duration = float(len(y) / sr)
    harm, perc = librosa.effects.hpss(y)

    tempo, beats = librosa.beat.beat_track(y=perc if np.abs(perc).sum() > 1e-3 else y, sr=sr)
    tempo = float(np.atleast_1d(tempo)[0]) if len(beats) > 4 else None

    hop = 512
    chroma = librosa.feature.chroma_cqt(y=harm, sr=sr, hop_length=hop, bins_per_octave=36)
    n = chroma.shape[1]
    # Segment on beats when the beat tracker is confident, else every 0.5 s.
    if tempo and len(beats) > 4:
        bounds = np.unique(np.concatenate([[0], beats, [n]]))
    else:
        step = max(1, int(0.5 * sr / hop))
        bounds = np.unique(np.concatenate([np.arange(0, n, step), [n]]))

    profile = chroma.sum(axis=1)

    rms = librosa.feature.rms(y=harm, hop_length=hop)[0]
    silence = 0.05 * (rms.max() + 1e-9)
    raw: list[ChordEvent] = []
    for a, b in zip(bounds[:-1], bounds[1:]):
        if b <= a:
            continue
        t0, t1 = (float(x) for x in librosa.frames_to_time([a, b], sr=sr, hop_length=hop))
        if rms[a:b].mean() < silence:
            raw.append(ChordEvent(t0, t1, "N", -1, "N", 0.0, None, True, None))
            continue
        r, q, s = match_chord(np.median(chroma[:, a:b], axis=1))
        raw.append(ChordEvent(t0, t1, NOTES[r] + q, r, q, round(s, 3)))

    chords: list[ChordEvent] = []
    for c in raw:
        if chords and chords[-1].chord == c.chord:
            chords[-1].end = c.end
        else:
            chords.append(c)
    tonic, mode, conf = detect_key(profile, [(c.root, c.end - c.start, c.quality) for c in chords if c.chord != "N"])
    field_ = harmonic_field(tonic, mode)
    out_of_key = []
    for c in chords:
        c.start, c.end = round(c.start, 3), round(c.end, 3)
        if c.chord == "N":
            continue
        c.degree, c.in_key, c.hypothesis = classify_chord(c.root, c.quality, tonic, mode, field_)
        if not c.in_key:
            out_of_key.append({"start": c.start, "chord": c.chord, "degree": c.degree, "hypothesis": c.hypothesis})

    # Bass: strongest pitch in E1..E3 per segment, from a low-register CQT.
    cqt = flat_cqt(harm, sr, hop, 28, 25)
    bass: list[NoteEvent] = []
    for c in chords:
        if c.chord == "N":
            continue
        a, b = librosa.time_to_frames([c.start, c.end], sr=sr, hop_length=hop)
        b = max(b, a + 1)
        m = 28 + int(np.argmax(cqt[:, a:b].mean(axis=1)))
        bass.append(NoteEvent(c.start, c.end, m, note_name(m)))

    melody = predominant_melody(harm, sr, hop)

    return Analysis(
        duration=round(duration, 3),
        tempo_bpm=round(tempo, 1) if tempo else None,
        key=key_name(tonic, mode),
        key_confidence=conf,
        mode_hypothesis=mode_hypothesis(profile, tonic),
        harmonic_field=[f"{f['degree']}: {f['triad']} ({f['seventh']})" for f in field_],
        chords=chords,
        out_of_key=out_of_key,
        bass=bass,
        melody=melody,
    )


def write_midi(a: Analysis, path: str) -> None:
    import mido

    bpm = a.tempo_bpm or 120.0
    tpb = 480
    sec_to_ticks = lambda s: int(round(s * tpb * bpm / 60.0))
    mid = mido.MidiFile(ticks_per_beat=tpb)

    def track(name: str, channel: int, program: int, notes: list[tuple[float, float, int, int]]):
        tr = mido.MidiTrack()
        tr.append(mido.MetaMessage("track_name", name=name, time=0))
        tr.append(mido.Message("program_change", program=program, channel=channel, time=0))
        events = []
        for s, e, m, vel in notes:
            events.append((sec_to_ticks(s), 1, m, vel))
            events.append((sec_to_ticks(e), 0, m, 0))
        events.sort(key=lambda x: (x[0], x[1]))
        now = 0
        for t, on, m, vel in events:
            tr.append(mido.Message("note_on" if on else "note_off", note=m, velocity=vel, channel=channel, time=t - now))
            now = t
        mid.tracks.append(tr)

    tempo_tr = mido.MidiTrack()
    tempo_tr.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0))
    mid.tracks.append(tempo_tr)
    track("melodía", 0, 0, [(n.start, n.end, n.midi, 90) for n in a.melody])
    track("bajo", 1, 33, [(n.start, n.end, n.midi, 90) for n in a.bass])
    chord_notes = []
    for c in a.chords:
        if c.chord == "N":
            continue
        for iv in CHORDS[c.quality]:
            chord_notes.append((c.start, c.end, 48 + c.root + iv, 60))
    track("acordes", 2, 48, chord_notes)
    mid.save(path)


def report(a: Analysis) -> str:
    L = []
    L.append("")
    L.append("  cREA · música")
    L.append(f"  duración {a.duration:.1f} s · tempo {a.tempo_bpm or 'sin pulso claro'} BPM")
    L.append(f"  tonalidad {a.key} (confianza {a.key_confidence:+.3f})")
    L.append(f"  modo (hipótesis) {a.mode_hypothesis}")
    L.append("")
    L.append("  campo armónico:")
    for f in a.harmonic_field:
        L.append(f"    {f}")
    L.append("")
    L.append("  acordes:")
    for c in a.chords:
        tag = "" if c.in_key else f"   ← fuera de tonalidad · {c.hypothesis}"
        L.append(f"    {c.start:7.2f}s  {c.chord:<6} {c.degree or '':<6}{tag}")
    L.append("")
    if a.bass:
        L.append("  bajo: " + " ".join(n.name for n in a.bass))
    if a.melody:
        L.append(f"  melodía: {len(a.melody)} notas · " + " ".join(n.name for n in a.melody[:24]) + (" …" if len(a.melody) > 24 else ""))
    L.append("")
    L.append("  límites:")
    for l in a.limits:
        L.append(f"    · {l}")
    L.append("")
    return "\n".join(L)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="cREA · análisis musical determinista")
    ap.add_argument("audio")
    ap.add_argument("--midi", help="escribe melodía, bajo y acordes a este .mid")
    ap.add_argument("--json", action="store_true", help="salida en JSON")
    args = ap.parse_args(argv)
    try:
        a = analyze(args.audio)
    except Exception as e:  # noqa: BLE001 — surface a readable reason
        print(f"crea music: no se pudo analizar {args.audio}: {e}", file=sys.stderr)
        return 3
    if args.midi:
        write_midi(a, args.midi)
    print(json.dumps(asdict(a), ensure_ascii=False, indent=2) if args.json else report(a))
    return 0


if __name__ == "__main__":
    sys.exit(main())

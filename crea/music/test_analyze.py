"""python3 -I -m unittest discover -s crea/music -p 'test_*.py'

Ground truth comes from audio this test synthesizes itself, so every claim
can be checked: known key, known chords, known bass, known melody.
"""
import os
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze as A  # noqa: E402

SR = 22050


def tone(midi, dur, amp=0.2, partials=4):
    t = np.arange(int(dur * SR)) / SR
    f = 440.0 * 2 ** ((midi - 69) / 12)
    y = sum((amp / k) * np.sin(2 * np.pi * f * k * t) for k in range(1, partials + 1))
    env = np.minimum(1, np.minimum(t / 0.01, (dur - t) / 0.03))
    return y * env


def song(progression, melody_per_chord, chord_dur=2.0, clicks=True):
    """progression: list of (root_midi, intervals); melody: list of midi lists per chord."""
    parts = []
    for (root, ivs), mel in zip(progression, melody_per_chord):
        n = int(chord_dur * SR)
        seg = np.zeros(n)
        for iv in ivs:
            seg += tone(root + 12 + iv, chord_dur, 0.12)
        seg += tone(root - 12, chord_dur, 0.25, partials=3)  # bass, root position
        step = chord_dur / len(mel)
        for i, m in enumerate(mel):
            note = tone(m, step, 0.22)
            s = int(i * step * SR)
            seg[s:s + len(note)] += note
        if clicks:  # a simple pulse at 120 BPM so the beat tracker has something
            for b in range(int(chord_dur * 2)):
                s = int(b * 0.5 * SR)
                seg[s:s + 200] += 0.4 * np.random.default_rng(b).standard_normal(200)
        parts.append(seg)
    y = np.concatenate(parts)
    return (y / np.abs(y).max() * 0.8).astype("float32")


def write(y):
    import soundfile as sf
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    sf.write(path, y, SR)
    return path


MAJ, MIN, DOM7 = (0, 4, 7), (0, 3, 7), (0, 4, 7, 10)
C3, A2, F2, G2, Bb2 = 48, 45, 41, 43, 46


def chord_at(a, t):
    for c in a.chords:
        if c.start <= t < c.end:
            return c
    return None


class TestKnownSong(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        prog = [(C3, MAJ), (A2, MIN), (F2, MAJ), (G2, DOM7)] * 2
        mel = [[72, 76, 79, 76], [72, 69, 76, 72], [69, 72, 77, 72], [74, 71, 67, 71]] * 2
        cls.path = write(song(prog, mel))
        cls.a = A.analyze(cls.path)
        cls.expected = ["C", "Am", "F", "G7"] * 2

    @classmethod
    def tearDownClass(cls):
        os.remove(cls.path)

    def test_key(self):
        self.assertEqual(self.a.key, "C mayor")

    def test_chords_at_chord_centers(self):
        got = [(chord_at(self.a, 2.0 * i + 1.0) or A.ChordEvent(0, 0, "?", -1, "?", 0)).chord for i in range(8)]
        hits = sum(g == e or (e == "G7" and g == "G") for g, e in zip(got, self.expected))
        self.assertGreaterEqual(hits, 7, f"got {got}")

    def test_all_in_key(self):
        self.assertEqual(self.a.out_of_key, [], self.a.out_of_key)

    def test_roman_numerals(self):
        degs = [chord_at(self.a, t).degree for t in (1.0, 3.0, 5.0, 7.0)]
        self.assertEqual([d.rstrip("7") for d in degs], ["I", "vi", "IV", "V"])

    def test_bass_roots(self):
        roots = []
        for t in (1.0, 3.0, 5.0, 7.0):
            n = next(b for b in self.a.bass if b.start <= t < b.end)
            roots.append(A.NOTES[n.midi % 12])
        self.assertEqual(roots, ["C", "A", "F", "G"])

    def test_melody_pitch_classes(self):
        expected = [72, 76, 79, 76, 72, 69, 76, 72]
        got = []
        for i in range(8):
            t = 0.5 * i + 0.25
            n = next((m for m in self.a.melody if m.start <= t < m.end), None)
            got.append(n.midi if n else None)
        hits = sum(g == e for g, e in zip(got, expected))  # exact note, octave included
        self.assertGreaterEqual(hits, 6, f"got {got}")

    def test_harmonic_field(self):
        self.assertEqual(self.a.harmonic_field[0], "I: C (Cmaj7)")
        self.assertEqual(self.a.harmonic_field[4], "V: G (G7)")
        self.assertEqual(self.a.harmonic_field[6], "vii°: Bdim (Bm7b5)")

    def test_midi_export(self):
        import mido
        fd, mpath = tempfile.mkstemp(suffix=".mid")
        os.close(fd)
        try:
            A.write_midi(self.a, mpath)
            mid = mido.MidiFile(mpath)
            names = [t.name for t in mid.tracks]
            self.assertIn("melodía", names)
            self.assertIn("bajo", names)
            ons = sum(1 for t in mid.tracks for m in t if m.type == "note_on" and m.velocity > 0)
            self.assertGreater(ons, 20)
        finally:
            os.remove(mpath)

    def test_limits_are_declared(self):
        self.assertTrue(any("aproximado" in l for l in self.a.limits))


class TestOutOfTheBox(unittest.TestCase):
    """C - Bb - F - C: the Bb is a borrowed bVII (modal interchange)."""

    @classmethod
    def setUpClass(cls):
        prog = [(C3, MAJ), (Bb2, MAJ), (F2, MAJ), (C3, MAJ)] * 2
        mel = [[72, 76, 79, 76], [70, 74, 77, 74], [69, 72, 77, 72], [72, 76, 79, 84]] * 2
        cls.path = write(song(prog, mel))
        cls.a = A.analyze(cls.path)

    @classmethod
    def tearDownClass(cls):
        os.remove(cls.path)

    def test_borrowed_chord_flagged(self):
        flagged = [o for o in self.a.out_of_key if o["chord"] == "Bb"]
        self.assertTrue(flagged, self.a.out_of_key)
        self.assertEqual(flagged[0]["degree"], "bVII")
        self.assertIn("intercambio modal", flagged[0]["hypothesis"])


class TestMinorKey(unittest.TestCase):
    """Am - Dm - E7 - Am: E7 is the harmonic-minor dominant, not an outsider."""

    @classmethod
    def setUpClass(cls):
        E2, D2 = 40, 38
        prog = [(A2 + 12, MIN), (D2 + 12, MIN), (E2 + 12, DOM7), (A2 + 12, MIN)] * 2
        mel = [[76, 72, 69, 72], [74, 77, 81, 77], [76, 80, 83, 80], [81, 76, 72, 69]] * 2
        cls.path = write(song(prog, mel))
        cls.a = A.analyze(cls.path)

    @classmethod
    def tearDownClass(cls):
        os.remove(cls.path)

    def test_key_is_a_minor(self):
        self.assertEqual(self.a.key, "A menor")

    def test_dominant_in_key(self):
        e = [c for c in self.a.chords if c.chord.startswith("E")]
        self.assertTrue(e)
        self.assertTrue(all(c.in_key for c in e), [(c.chord, c.degree, c.hypothesis) for c in e])
        self.assertTrue(all(c.degree.startswith("V") for c in e))


class TestMp3(unittest.TestCase):
    def test_mp3_input(self):
        import shutil, subprocess
        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg not installed")
        wav = write(song([(C3, MAJ), (F2, MAJ), (G2, MAJ), (C3, MAJ)], [[72, 76, 79, 76]] * 4))
        mp3 = wav.replace(".wav", ".mp3")
        try:
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-b:a", "128k", mp3], check=True)
            a = A.analyze(mp3)
            self.assertEqual(a.key, "C mayor")
        finally:
            for f in (wav, mp3):
                if os.path.exists(f):
                    os.remove(f)


class TestUnits(unittest.TestCase):
    def test_flat_cqt_equal_amplitude_equal_magnitude(self):
        t = np.arange(SR * 2) / SR
        mags = []
        for m in (52, 64, 76, 88):
            y = (0.2 * np.sin(2 * np.pi * 440 * 2 ** ((m - 69) / 12) * t)).astype("float32")
            mag = A.flat_cqt(y, SR, 512, 52, 40)
            mags.append(float(mag[m - 52, 20:-20].mean()))
        self.assertLess(max(mags) / min(mags), 1.1, mags)

    def test_classify_secondary_dominant(self):
        f = A.harmonic_field(0, "major")
        deg, in_key, hyp = A.classify_chord(2, "", 0, "major", f)  # D major in C
        self.assertEqual((deg, in_key), ("V/V", False))
        self.assertIn("dominante secundaria", hyp)

    def test_minor_key_field(self):
        f = A.harmonic_field(9, "minor")  # A minor
        self.assertEqual([x["degree"] for x in f], ["i", "ii°", "III", "iv", "v", "VI", "VII"])

    def test_detect_key_from_profile(self):
        prof = np.roll(A.KK_MAJOR, 7)  # G major profile
        tonic, mode, _ = A.detect_key(prof)
        self.assertEqual((A.NOTES[tonic], mode), ("G", "major"))


if __name__ == "__main__":
    unittest.main()

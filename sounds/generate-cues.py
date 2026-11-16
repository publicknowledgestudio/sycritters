"""Generate the small, original creature cues using only Python's standard library."""
import math
from pathlib import Path
import struct
import wave

RATE = 22050
CUES = {
    'happy-warble': [(660, .14), (880, .12), (990, .19), (1320, .16)],
    'puzzled-boop': [(440, .16), (554, .22), (370, .25)],
    'digital-chatter': [(520, .07), (780, .08), (630, .06), (1040, .1), (690, .07), (920, .16)],
    'little-purr': [(160, .65)],
    'surprised-squeak': [(540, .12), (1080, .23)],
    'gentle-goodnight': [(660, .18), (523, .2), (392, .32)],
}
for name, notes in CUES.items():
    samples = []
    for index, (frequency, duration) in enumerate(notes):
        for n in range(int(RATE * duration)):
            t = n / RATE
            envelope = min(1, t / .018, (duration - t) / .045)
            vibrato = 3 * math.sin(2 * math.pi * 7 * t)
            phase = 2 * math.pi * frequency * t + vibrato * .12
            tone = math.sin(phase) + .18 * math.sin(phase * 2)
            if name == 'little-purr':
                tone *= .65 + .35 * math.sin(2 * math.pi * 24 * t)
            samples.append(int(6500 * envelope * tone))
        samples.extend([0] * int(RATE * .035))
    with wave.open(str(Path(__file__).parent / (name + '.wav')), 'wb') as output:
        output.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        output.writeframes(struct.pack('<' + 'h' * len(samples), *samples))

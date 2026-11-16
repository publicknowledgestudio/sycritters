"""Generate bundled replies with FFmpeg's Flite filter (no runtime speech service)."""
from pathlib import Path
import subprocess
import tempfile

PHRASES = ["I'm listening!", "Tell me more!", "Hmm. What happened next?", "I'm here!", "Go on, I'm curious!"]
for index, phrase in enumerate(PHRASES):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt') as text:
        text.write(phrase)
        text.flush()
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
            '-f', 'lavfi', '-i', f'flite=textfile={text.name}:voice=slt',
            '-af', 'asetrate=18560,aresample=22050,volume=0.75',
            str(Path(__file__).parent / f'reply-{index}.wav'),
        ], check=True)

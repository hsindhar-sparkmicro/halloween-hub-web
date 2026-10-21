"""Stage the static site and version its offline cache by content. No dependencies."""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]


def build():
    source = ROOT / 'web'
    target = ROOT / 'dist' / 'site'
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)
    files = sorted(p for p in target.rglob('*') if p.is_file() and p.name != 'sw.js')
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.relative_to(target).as_posix().encode())
        digest.update(path.read_bytes())
    cache = 'halloween-hub-' + digest.hexdigest()[:16]
    shell = ['./', './index.html'] + [
        './' + p.relative_to(target).as_posix() for p in files
        if p.suffix in {'.js', '.css', '.png', '.svg', '.ttf', '.wav', '.mp3', '.ogg'}
    ]
    worker = (source / 'sw.js').read_text()
    start = worker.index('self.addEventListener')
    (target / 'sw.js').write_text(
        f'const CACHE={json.dumps(cache)};\nconst SHELL={json.dumps(shell)};\n' + worker[start:]
    )
    print(f'Static site: {target} ({len(files)} files, cache {cache})')
    return target


if __name__ == '__main__':
    build()

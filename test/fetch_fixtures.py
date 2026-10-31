#!/usr/bin/env python3
"""Fetch the Ideate transcription-test fixtures into test/fixtures/ (gitignored, ~7.7 MB).

    python3 -I test/fetch_fixtures.py        # from the repo root

- Dataset excerpts (vocadito, GuitarSet): single members pulled out of the Zenodo zips with HTTP
  Range requests, so only a few MB download instead of the full archives (~1.4 GB).
- The CC0 BigSoundBank whistle: copied from a local Whistler checkout ($WHISTLER_DIR, default
  ~/git/whistler). BigSoundBank has no stable direct-download URL; without a checkout, download
  https://bigsoundbank.com/happy-birthday-whistling-s2193.html (FLAC) to the path printed below.

Stdlib only. Re-runnable: skips files already present. Licenses: test/fixtures/ATTRIBUTION.md.
"""
import io, os, shutil, sys, zipfile, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')

# ---- manifest ----
VOCADITO = 'https://zenodo.org/records/5578807/files/vocadito.zip?download=1'
GS_ANNOT = 'https://zenodo.org/records/3371780/files/annotation.zip?download=1'
GS_MIC   = 'https://zenodo.org/records/3371780/files/audio_mono-mic.zip?download=1'
GS_TAKES = ('00_Jazz1-200-B_solo', '00_BN1-147-Gb_solo')

ZIP_MEMBERS = {   # zip url -> [(member in the zip, path under test/fixtures/)]
    VOCADITO: [(f'{d}/vocadito_{n}{s}', f'vocadito/vocadito_{n}{s}')
               for n in (10, 20, 14)
               for d, s in (('Audio', '.wav'), ('Annotations/Notes', '_notesA1.csv'))],
    GS_ANNOT: [(f'{t}.jams', f'guitarset/{t}.jams') for t in GS_TAKES],
    GS_MIC:   [(f'{t}_mic.wav', f'guitarset/{t}_mic.wav') for t in GS_TAKES],
}
WHISTLER = os.environ.get('WHISTLER_DIR', os.path.expanduser('~/git/whistler'))
COPIES = [   # (source, path under test/fixtures/)
    (os.path.join(WHISTLER, 'test/fixtures/hb-whistle-bigsoundbank.flac'), 'hb-whistle-bigsoundbank.flac'),
]


class RangeFile(io.RawIOBase):
    """Seekable read-only file over HTTP Range requests (enough for zipfile)."""
    def __init__(self, url):
        with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': 'bytes=0-0'}), timeout=60) as r:
            if r.status != 206:
                sys.exit(f'server ignored Range request for {url}')
            self.url, self.size = r.geturl(), int(r.headers['Content-Range'].rsplit('/', 1)[1])
        self.pos = 0
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def read(self, n=-1):
        if n is None or n < 0: n = self.size - self.pos
        if n == 0 or self.pos >= self.size: return b''
        end = min(self.size, self.pos + n) - 1
        with urllib.request.urlopen(urllib.request.Request(self.url, headers={'Range': f'bytes={self.pos}-{end}'}), timeout=60) as r:
            if r.status != 206:              # a 200 here would be the whole archive (up to 657 MB)
                sys.exit(f'server ignored Range request for {self.url}')
            data = r.read()
        if len(data) != end - self.pos + 1:
            sys.exit(f'short read from {self.url}: wanted {end - self.pos + 1} bytes, got {len(data)}')
        self.pos += len(data)
        return data
    def readinto(self, b):
        data = self.read(len(b)); b[:len(data)] = data; return len(data)


def write_atomic(dest, data):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest + '.part', 'wb') as f:      # an interrupted run never leaves a truncated fixture
        f.write(data)
    os.replace(dest + '.part', dest)


def main():
    for url, members in ZIP_MEMBERS.items():
        todo = [(m, out) for m, out in members if not os.path.exists(os.path.join(ROOT, out))]
        if not todo:
            continue
        zf = zipfile.ZipFile(RangeFile(url))
        names = [n for n in zf.namelist() if not n.startswith('__MACOSX')]
        for member, out in todo:
            hit = [n for n in names if n == member or n.endswith('/' + member)]
            if not hit:
                sys.exit(f'{member} not found in {url}')
            data = zf.read(hit[0])                      # checks the member's CRC
            write_atomic(os.path.join(ROOT, out), data)
            print(f'{len(data):>10,}  {out}')
    for src, out in COPIES:
        dest = os.path.join(ROOT, out)
        if os.path.exists(dest):
            continue
        if not os.path.exists(src):
            print(f'missing: {src} -- get it per ATTRIBUTION.md and save it as {dest}', file=sys.stderr)
            continue
        shutil.copyfile(src, dest)
        print(f'{os.path.getsize(dest):>10,}  {out} (copied)')


if __name__ == '__main__':
    main()

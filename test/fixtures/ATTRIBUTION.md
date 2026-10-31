# Fixture sources and licenses

| Files | Source | License |
|---|---|---|
| `hb-whistle-bigsoundbank.flac` | "Happy Birthday, Whistling" by Joseph SARDIN — [BigSoundBank #2193](https://bigsoundbank.com/happy-birthday-whistling-s2193.html) | [CC0 1.0](https://bigsoundbank.com/licenses.html) (attribution appreciated, not required) |
| `vocadito/vocadito_{10,14,20}.wav`, `vocadito/vocadito_*_notesA1.csv` | vocadito — Bittner, Pasalo, Bosch, Meseguer-Brocal, Rubinstein (2021), [Zenodo 5578807](https://zenodo.org/records/5578807), [arXiv:2110.05580](https://arxiv.org/abs/2110.05580) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `guitarset/00_Jazz1-200-B_solo*`, `guitarset/00_BN1-147-Gb_solo*` | GuitarSet 1.1.0 — Q. Xi, R. Bittner, J. Pauwels, X. Ye, J. P. Bello, "GuitarSet: A Dataset for Guitar Transcription", ISMIR 2018, [doi:10.5281/zenodo.3371780](https://doi.org/10.5281/zenodo.3371780) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

No changes were made: the dataset files are byte-identical extracts from the Zenodo archives (fetched by
`test/fetch_fixtures.py`), and the FLAC is BigSoundBank's original download.

Citations:

- R. M. Bittner, K. Pasalo, J. J. Bosch, G. Meseguer-Brocal, D. Rubinstein. *vocadito: A dataset of solo vocals with f0, note, and lyric annotations.* Spotify technical report, 2021. arXiv:2110.05580.
- Q. Xi, R. Bittner, J. Pauwels, X. Ye, J. P. Bello. *GuitarSet: A Dataset for Guitar Transcription.* 19th ISMIR, Paris, 2018.

The Happy Birthday melody itself is public domain. `hb-*-user.*` takes, when present, belong to whoever recorded them.

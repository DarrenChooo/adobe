# Person A numbers (SPEC section 7)

Measured, not guessed. Regenerate with `python docs/findings/a_measure.py` (raw output: [`a-numbers-raw.txt`](a-numbers-raw.txt)).

**Machine:** Windows 11 laptop, Python 3.13.9. Each time is the median of 20 runs of the tool's `run()` (no HTTP), on the files in `samples/`. The 51-page file is the 3-page sample report merged with itself 17 times.

## Speed

| Operation | Median time |
|---|---|
| Merge 3 p + 2 p | 5.7 ms |
| Merge 51 p + 2 p | 15.5 ms |
| Split 3 p into 3 files | 6.4 ms |
| Split 51 p into 51 files | 57.9 ms |
| Password-protect 3 p (AES-256) | 12.1 ms |
| Password-protect 51 p (AES-256) | 29.3 ms |

Everything runs on your own machine. No upload, no queue, no account.

## Compression

| Input | Level | Before | After | Saved |
|---|---|---|---|---|
| 5 photo pages (1200×800 photo at full resolution) | low (≤2400 px, JPEG q85) | 250 KB | 112 KB | 55.1% |
| same | medium (≤1600 px, q70) | 250 KB | 76 KB | 69.4% |
| same | high (≤1100 px, q55) | 250 KB | 55 KB | 78.0% |
| 3-page text-only report | medium | 3.1 KB | 2.8 KB | 11.3% |

Text-only PDFs have little to squeeze, because the savings come from images. The tool never returns a file bigger than its input.

## Cost

Acrobat Standard is US$179.88 a year. These tools cost US$0 and make no AI calls, so there is no per-operation cost either.

## Caveats

- These are small, made-up samples. Re-run the script on a real scanned or photo-heavy PDF before quoting a compression figure on stage.
- Timings exclude the browser upload and download, which depend on file size, not on our code.

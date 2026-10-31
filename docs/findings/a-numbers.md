# Person A numbers (SPEC section 7)

Measured, not guessed. Regenerate with `python docs/findings/a_measure.py` (raw output: [`a-numbers-raw.txt`](a-numbers-raw.txt)).

**Machine:** Windows 11 laptop, Python 3.13.9. Each time is the median of 20 runs of the tool's `run()` (no HTTP), on the files in `samples/`. The 51-page file is the 3-page sample report merged with itself 17 times.

## Speed

| Operation | Median time |
|---|---|
| Merge 3 p + 2 p | 5.8 ms |
| Merge 51 p + 2 p | 10.6 ms |
| Split 3 p into 3 files | 3.8 ms |
| Split 51 p into 51 files | 44.2 ms |
| Password-protect 3 p (AES-256) | 7.4 ms |
| Password-protect 51 p (AES-256) | 17.1 ms |

Everything runs on your own machine. No upload, no queue, no account.

## Compression

**Test file:** a 10-page PDF made with our `create` tool from 10 real photos (the 3840×2400 wallpaper JPEGs that ship with Windows in `C:\Windows\Web\Wallpaper`). The photos total 9,647 KB and the PDF is 9,655 KB, because the JPEGs are embedded as-is.

| Level | What it does | Before | After | Saved | Time |
|---|---|---|---|---|---|
| low | images ≤2400 px, JPEG q85 | 9,655 KB | 2,466 KB | 74.5% | 4.9 s |
| medium (default) | ≤1600 px, q70 | 9,655 KB | 817 KB | 91.5% | 4.3 s |
| high | ≤1100 px, q55 | 9,655 KB | 358 KB | 96.3% | 3.4 s |
| medium, 3-page text-only report | | 3.1 KB | 2.8 KB | 11.3% | |

- **Text-only PDFs have little to squeeze.** The savings come from images.
- **Medium (1600 px) is still sharp on a laptop screen.** That's the honest headline: "a 9.4 MB photo PDF becomes 0.8 MB".
- **The output is never bigger than the input.** The tool hands back the original file if it can't do better.

## Cost

Acrobat Standard is US$179.88 a year. These tools cost US$0 and make no AI calls, so there is no per-operation cost either.

## Caveats

- Timings exclude the browser upload and download, which depend on file size, not on our code.
- Scanned documents (black-and-white text on paper) compress differently from photos. If a scan is in the demo, run the script on it too.

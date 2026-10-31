# What we uncovered: redaction and OCR

## 1. A black box is not redaction
A PDF page is a list of drawing instructions: "write this text here", "draw this rectangle there". When someone "redacts" by drawing a black rectangle over a name, the instruction that writes the name is still in the file. The box only covers it on screen.

**Proof with our sample** (`samples/b_naive_redaction.pdf`): on screen, the NRIC, mobile number and emergency-contact NRIC are blacked out. Our audit mode reads the file and finds every character whose position falls inside a filled dark rectangle:

```
.venv/bin/python -m app.pro.cli redact samples/b_naive_redaction.pdf --params '{"mode":"audit"}'
-> Found 3 black box(es) with readable text still underneath.
   S1234567D | +65 9123 4567 | T0123456Z
```
Anyone can do the same by selecting the text under the box and pasting it.

**How Fill Me redacts instead:** each affected page is turned into a picture, the boxes are painted into the picture, and the page is rebuilt from that picture. The original text instructions for that page are gone, so there is nothing left to copy. We then run OCR on the rebuilt page so the parts that weren't redacted stay searchable, and finally run a leak test that tries to find every redacted value in the output. Running audit on our own output finds nothing.

## 2. How OCR makes a scan searchable
A scanned page is only a picture, so a PDF reader has no text to search. OCR (Tesseract here) reads the letters off the picture and writes them back as **invisible text** placed exactly over the matching words. You still see the original picture, but search, copy and our redaction now work. Our sample scan went from 0 words of text to 98.1% of words correct.

The catch, seen on our own sample: OCR can misread characters. It read the NRIC `S1234567D` as `$1234567D`. A redaction tool that only looks for "S + 7 digits + letter" would miss it on a scan, so ours also accepts `$`.

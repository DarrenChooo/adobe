# What we uncovered: how PDF forms hide what their fields mean

Measured on 9 blank US federal forms in `samples/forms/` (460 fillable fields). None are Singapore forms yet, so these numbers describe these forms, not all PDFs.

## 1. What you see isn't what the file calls it

The W-4's first box is printed as "First name and middle initial". Inside the file it's called `f1_01[0]`, with no description attached. Browser autofill matches on names like these, so it has nothing to work with.

| Form | Fields | Meaningless names (`f1_01`, `c1_2`) | No tooltip | No tooltip, but printed label found |
|---|---|---|---|---|
| IRS 2848 | 87 | 0 | 87 | 67 |
| IRS 4506-T | 28 | 27 | 0 | 0 |
| IRS 8822 | 25 | 25 | 25 | 25 |
| IRS SS-4 | 89 | 89 | 89 | 82 |
| IRS W-4 | 48 | 48 | 48 | 46 |
| IRS W-9 | 23 | 23 | 23 | 23 |
| USCIS AR-11 | 27 | 0 | 0 | 0 |
| USCIS G-1145 | 5 | 0 | 0 | 0 |
| USCIS I-9 | 128 | 0 | 0 | 0 |
| **Total** | **460** | **212 (46%)** | **272 (59%)** | **243 of those 272 (89%)** |

Four of the nine forms (185 fields) have both a meaningless name and no tooltip, so the file alone says nothing about those fields. The meaning is only in the printed text beside them. So Fill Me finds each field's position on the page, reads the printed words next to it, and gives the model that label.

The printed label is the blank form's own text. It doesn't contain the user's details, as long as the form isn't pre-printed with them.

## 2. Many forms contain two copies of themselves

8 of the 9 forms are hybrids: a normal AcroForm plus a second XFA copy of the form. Acrobat prefers the XFA copy, so filling only the AcroForm can leave fields looking blank there. Fill Me removes the XFA copy from the filled file.

We confirmed the filled values display by rendering filled W-4 and G-1145 forms with PDFium, the engine behind Chrome's PDF viewer ([W-4 screenshot](img/c-w4-filled.png)). Not yet checked in Acrobat itself.

## 3. What goes to the model, and what stays on the machine

For autofill, this is everything the model receives about a field:

```json
{"id": 4, "name": "f1_05[0]", "type": "text", "printed_label": "(b) Social security number"}
```

It also receives the list of profile key names, such as `surname` and `postal_code`. It never receives the values. `tests/test_autofill.py` checks every profile value against the outgoing prompt.

| Sent to the model | Stays on the machine |
|---|---|
| Field names, tooltips, printed labels, field types | Profile values (name, NRIC, passport, address...) |
| Profile key names | The filled PDF |
| | Remembered corrections, which store keys and not values |

This covers autofill only. Q&A and summaries do send the document's page text to the model, as does `detect_pii` if the user opts in.

## 4. Why the model can't quietly fill in a wrong value

The model only picks a key, and code looks up the value. It can choose the wrong key, which is why the review screen exists, but it can't invent an NRIC. A key that isn't in the profile is discarded.

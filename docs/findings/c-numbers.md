# Person C: measured numbers

Measured 31 Oct 2026 on SoCLaaS with model `gemma4:26b`, using public forms and a made-up profile. Set `LLM_MODEL=gemma4:26b` in `.env`, then re-run with `python scripts/eval_c.py all`. Raw results, including every mistake, are in [`c-eval.json`](c-eval.json).

| Tool | What we measured | Result |
|---|---|---|
| Autofill | Fields that must be filled, filled correctly | **29 / 35** |
| Autofill | Wrong values put into a field | **1 / 460 fields** |
| Autofill | All fields right, including ones correctly left empty | 454 / 460 |
| Autofill | Fields a user would have to fix | 6 / 460 |
| Autofill | Profile values found in the prompt (G-1145 run through the app, on `qwen3.6:35b`; the prompt is built the same way on any model) | **0** |
| Q&A | Questions answered with a correct, verified page citation | **5 / 6** |
| Q&A | Questions the document can't answer, correctly refused | **5 / 5** |
| Command bar | Plans that chose the right tools, including refusing 2 impossible requests | **11 / 11** |

Lead with 29 of 35 and 1 wrong fill. The 454 of 460 looks better only because most fields on these forms should stay empty.

## Autofill, form by form

| Form | Fields | Must fill | Filled correctly | Wrong fills |
|---|---|---|---|---|
| USCIS G-1145 | 5 | 4 | 4 | 0 |
| USCIS AR-11 | 27 | 6 | 5 | 1 |
| USCIS I-9 | 128 | 8 | 8 | 0 |
| IRS W-4 | 48 | 4 | 4 | 0 |
| IRS W-9 | 23 | 3 | 3 | 0 |
| IRS 8822 | 25 | 4 | 1 | 0 |
| IRS 4506-T | 28 | 3 | 3 | 0 |
| IRS 2848 | 87 | 3 | 1 | 0 |
| IRS SS-4 | 89 | 0 | 0 | 0 |

## Cost per operation

| Operation | Tokens in | Tokens out | Seconds | At SoCLaaS's listed price |
|---|---|---|---|---|
| Autofill, per form | 2,759 | 2,034 | 34.6 | US$0.00105 |
| Q&A, per call (12 calls for 11 questions, because a reply needed a retry) | 10,157 | 603 | 14.2 | US$0.00127 |
| Command bar, per call (13 calls for 11 plans) | 2,414 | 269 | 5.9 | US$0.00035 |

Prices are from SoCLaaS's model list for `gemma4:26b`: US$0.102059 per million input tokens and US$0.378588 per million output tokens.

**Is it US$0?** Our notes describe SoCLaaS as free for NUS but rate-limited, while its model list also shows these prices. We haven't confirmed whether NUS users are ever charged, so check before saying "US$0". Either way, the AI costs about a tenth of a US cent per operation, against US$239.88 a year for Acrobat Pro.

Once a form has been reviewed, it fills from memory with no model call.

## Which model, and why

| Model | Must-fill correct | Wrong fills | Seconds per form |
|---|---|---|---|
| `gemma4:26b` (chosen) | 29 / 35 | 1 | 34.6 |
| `qwen3.6:35b` | 31 / 35 | 4 | 20.5 |
| `qwen3-coder-next`, on the earlier prompt | 31 / 35 | 30 | 2.6 |

The team chose Gemma. It puts the fewest wrong values into forms, which is the costliest kind of mistake, but it leaves more fields empty and is the slowest. `qwen3.8:27b` timed out and has no valid score. Other models weren't scored.

## Failure cases to show

1. **The date format was wrong on the AR-11:** it used the raw date, not month/day/year, at 100% confidence. High confidence doesn't mean right.
2. **The IRS 2848 left the taxpayer's name and address empty.** The printed label is shared by two fields, "Taxpayer name and address", and the model filled neither.
3. **The IRS 8822 is the weakest form:** only 1 of 4. It left the new address, country and postal code empty, so the user must type them. Leaving a field empty is the safer way to fail.
4. **One Q&A citation failed the check.** For "What does FATCA stand for?" the answer was right, but one of its two citations wasn't on the page it named. The app flags this on screen rather than hiding it.
5. **The review screen is required.** Every one of these is why a person checks before the PDF is filled.

## Limits of these numbers

- **The answer key isn't independent.** Person C wrote the expected answers, and no teammate has spot-checked them yet.
- **The prompt and the checker were adjusted after seeing results on these same forms and questions.** There's no separate held-out test set, so new forms may score lower.
- **Small samples, one run each.** That's 9 forms, 11 questions and 11 commands. Results vary between runs.
- **All forms are US federal forms.** None are from Singapore.
- **The command bar score covers choosing tools, not running them.** One real plan (merge then compress) was run through the app, and a merge-then-convert plan is covered by a test.
- **Forms were checked in PDFium, not Acrobat.**

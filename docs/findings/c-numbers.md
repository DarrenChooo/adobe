# Person C: measured numbers

Measured 31 Oct 2026 on SoCLaaS with model `qwen3.6:35b`, using public forms and a made-up profile. Re-run with `python scripts/eval_c.py all`. Raw results, including every mistake, are in [`c-eval.json`](c-eval.json).

| Tool | What we measured | Result |
|---|---|---|
| Autofill | Fields that must be filled, filled correctly | **31 / 35** |
| Autofill | Wrong values put into a field | **4 / 460 fields** |
| Autofill | All fields right, including ones correctly left empty | 453 / 460 |
| Autofill | Fields a user would have to fix | 7 / 460 |
| Autofill | Profile values found in the prompt (G-1145 run through the app) | **0** |
| Q&A | Questions answered with a correct, verified page citation | **6 / 6** |
| Q&A | Questions the document can't answer, correctly refused | **5 / 5** |
| Command bar | Plans that chose the right tools, including refusing 2 impossible requests | **11 / 11** |

Lead with 31 of 35. The 453 of 460 looks better only because most fields on these forms should stay empty.

## Autofill, form by form

| Form | Fields | Must fill | Filled correctly | Wrong fills |
|---|---|---|---|---|
| USCIS G-1145 | 5 | 4 | 4 | 0 |
| USCIS AR-11 | 27 | 6 | 5 | 1 |
| USCIS I-9 | 128 | 8 | 8 | 0 |
| IRS W-4 | 48 | 4 | 4 | 0 |
| IRS W-9 | 23 | 3 | 3 | 1 |
| IRS 8822 | 25 | 4 | 1 | 0 |
| IRS 4506-T | 28 | 3 | 3 | 0 |
| IRS 2848 | 87 | 3 | 3 | 1 |
| IRS SS-4 | 89 | 0 | 0 | 1 |

## Cost per operation

US$0 on SoCLaaS, which is free but rate-limited and run by NUS School of Computing. Elsewhere, multiply these averages by your provider's price:

| Operation | Tokens in | Tokens out | Seconds |
|---|---|---|---|
| Autofill, per form (uses 1 call unless a reply needs a retry) | 2,718 | 1,606 | 20.5 |
| Q&A, per call (14 calls for 11 questions, because some replies needed a retry) | 10,041 | 72 | 1.9 |
| Command bar, per plan | 2,362 | 143 | 4.7 |

Time depends on the form: the 5-field G-1145 took 2.2 seconds when run through the app. Once a form has been reviewed, it fills from memory with no model call.

## Which model, and why

| Model | Must-fill correct | Wrong fills | Seconds per form |
|---|---|---|---|
| `qwen3-coder-next` | 31 / 35 | 30 | 2.6 |
| `qwen3.6:35b`, first run | 33 / 35 | 9 | 20.0 |
| `qwen3.6:35b`, final prompt | 31 / 35 | 4 | 20.5 |

We chose accuracy over speed, because a wrong value on a form does more harm than a wait. `qwen3.8:27b` timed out and has no valid score. Other models weren't scored.

## Failure cases to show

1. **An NRIC went into a US Social Security field** on the W-9 and the 2848. We added a prompt rule against this and it still happened on those two forms.
2. **The date format was wrong on the AR-11:** day/month/year instead of month/day/year, at 90% confidence. High confidence doesn't mean right.
3. **"Legal name of entity" on the SS-4 got the person's name.** This is a business form, so it should have stayed empty.
4. **The 8822 is the weakest form:** only 1 of 4. It left the new address, country and postal code empty, so the user must type them. Leaving a field empty is the safer way to fail.
5. **The review screen is required.** Every one of these is why a person checks before the PDF is filled.

## Limits of these numbers

- **The answer key isn't independent.** Person C wrote the expected answers, and no teammate has spot-checked them yet.
- **The prompt and the checker were adjusted after seeing results on these same forms and questions.** There's no separate held-out test set, so new forms may score lower. The autofill prompt change traded 2 must-fill fields for 5 fewer wrong fills.
- **Q&A scored 5 / 6 before a fix.** The model shortened a real quote with "...", and the checker now accepts that only when every part is on the page, in order.
- **Small samples, one run each.** That's 9 forms, 11 questions and 11 commands. Results vary between runs.
- **All forms are US federal forms.** None are from Singapore.
- **The command bar score covers choosing tools, not running them.** One real plan (merge then compress) was run through the app, and a merge-then-convert plan is covered by a test.
- **Forms were checked in PDFium, not Acrobat.**

# Pitch numbers: what Acrobat costs and how many people use it

Researched 31 Oct 2026. Every figure has its source and how solid it is. Quote only ✅ rows as fact; say "reported" for ⚠️ rows; don't use ❌ rows.

## Reach (how many people use the expensive old thing)

| Figure | Period | Source | Status |
|---|---|---|---|
| 1 billion monthly active users across all Adobe creativity and productivity products | Headline of Q3 FY2026 results (quarter ended 28 Aug 2026) | Adobe 8-K exhibit 99.1: https://www.sec.gov/Archives/edgar/data/0000796343/000079634326000147/adbeex991q326.htm | ✅ Adobe's own words. Covers ALL Adobe products, not Acrobat alone |
| "Acrobat + Express MAU surpassed 900 million, growing more than 25% year over year" | Q3 FY2026 (quarter ended 28 Aug 2026) | Adobe earnings script, p.17: https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/01906202/c6yetrerew.pdf | ✅ Adobe's own words. Combines Acrobat and Express, and includes free users |
| Acrobat and Express MAU up "from greater than 700 million to greater than 850 million year-over-year" | Q2 FY2026 | Adobe call transcript, p.3: https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/adbe-q2fy26-transcript.pdf | ✅ Adobe's own words |
| "more than 650 million monthly active users" of Acrobat | Feb 2025, so older | Adobe press release: https://news.adobe.com/news/2025/02/acrobat-ai-assistant-contracts | ✅ Adobe's own words, but dated. Say "as of Feb 2025" |
| "more than 400 billion PDFs in Acrobat every year" | Sept 2026 | Adobe press release: https://news.adobe.com/news/2026/09/adobe-productivity-agent-in-acrobat-now-transforms-complex-documents | ✅ The Feb 2025 release said "each month", so use this newer wording |

**Gap:** Adobe does not publish an Acrobat-only user count or a paid-subscriber count in its results.
Adobe said of its 850 million that "many of them are on desktop Reader", with others on browser extensions and mobile (Q2 FY2026 transcript, p.18), so don't say 900 million people use Acrobat or pay for it. The paying base is far smaller (see the estimate below).

## Cost of the status quo (what people pay)

| Figure | Period | Source | Status |
|---|---|---|---|
| US$6.50 billion "Business Professionals & Consumers" subscription revenue, +15% year over year | FY2025 (year ended 28 Nov 2025) | Adobe 8-K exhibit 99.1: https://www.sec.gov/Archives/edgar/data/796343/000079634325000135/adbeex991q425.htm | ✅ Official |
| US$1.91 billion in that group, +16% | Q3 FY2026 (quarter ended 28 Aug 2026) | Adobe 8-K (Q3 FY2026 link above) | ✅ Official |
| US$7.470 to 7.490 billion target for that group | FY2026 | Adobe 8-K (Q3 FY2026 link above) | ✅ Official target |
| Acrobat Standard US$14.99/mo (annual plan, billed monthly); US$179.88/yr prepaid; US$24.99 month to month | Rechecked 31 Oct 2026, US prices | https://www.adobe.com/acrobat/pricing.html | ✅ (the Standard price appears on this page only) |
| Acrobat Pro US$19.99/mo (annual, billed monthly); US$239.88/yr prepaid; US$29.99 month to month | Same | https://www.adobe.com/acrobat/pricing.html and https://www.adobe.com/acrobat/acrobat-pro.html | ✅ Two Adobe pages agree |
| Acrobat Pro for teams US$23.99/mo per licence; US$287.88/yr | Same | Same | ✅ |
| Acrobat Studio US$24.99/mo; US$299.88/yr; US$34.99 month to month | Same | https://www.adobe.com/acrobat/pricing.html and https://www.adobe.com/acrobat/acrobat-pro.html | ✅ Two Adobe pages agree |
| AI Assistant Plus add-on US$4.99/mo | Same | https://www.adobe.com/acrobat/acrobat-pro.html | ✅ |

**Caveat:** the 8-K does not list which products sit in "Business Professionals & Consumers". Call summaries tie it to Acrobat and Express. Say "Adobe's Acrobat and Express group", not "Acrobat revenue".
Singapore prices aren't confirmed: Adobe's Singapore page showed no prices to our text fetch and its site blocked our automated browser. All prices above are US, so someone should screenshot the pages in a normal browser.

## Estimates (our arithmetic on the figures above; label them as estimates)

| Estimate | Working |
|---|---|
| About US$17.8 million a day spent in that group in FY2025; about US$20.5 million a day on the FY2026 target | US$6.50B / 365; US$7.48B / 365 |
| Roughly 23 to 27 million paid seats implied in FY2025 | US$6.50B / US$287.88 (teams Pro) to / US$239.88 (individual Pro). Rough: the group also includes Express and enterprise discounts |
| Per person: US$179.88 to US$299.88 a year, depending on plan | Adobe list prices above |
| A team of 10 on Pro for teams: US$2,878.80 a year | 10 x US$287.88 |
| One person on Pro for 3 years: US$719.64 | 3 x US$239.88 |

## Fill Me's cost (the "after" number)

| Item | Cost per user |
|---|---|
| Software | US$0, MIT licence |
| PDF libraries, OCR (Tesseract) | US$0, open source |
| AI features on SoCLaaS (NUS SoC's free model service) | US$0 (free, rate-limited). Outside NUS: any OpenAI-compatible endpoint or a local model; tokens per operation are measured in `docs/findings/c-numbers.md` once Person C's tools land |
| **Saving vs Acrobat Pro** | **US$239.88 per user per year (100%)**. This applies to paying users only, so don't multiply it by the 900 million |

**The US$0 AI cost only applies at NUS:** SoCLaaS is free but rate-limited, and anyone else pays their own model provider.

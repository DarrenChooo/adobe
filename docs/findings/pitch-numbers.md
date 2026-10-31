# Pitch numbers: Adobe's cost and reach

Checked 31 Oct 2026 against Adobe's own pages and investor documents. Use the wording below, because the caveats matter if a judge asks.

## What Acrobat costs today (US prices)

| Plan | Annual, billed monthly | Annual, prepaid | Monthly, no contract |
|---|---|---|---|
| Acrobat Standard | US$14.99/mo | US$179.88/yr | US$24.99/mo |
| Acrobat Pro | US$19.99/mo | US$239.88/yr | US$29.99/mo |
| Acrobat Studio | US$24.99/mo | US$299.88/yr | US$34.99/mo |
| Standard for teams | US$16.99/mo | US$203.88/yr | |
| Pro for teams | US$23.99/mo per licence | US$287.88/yr per licence | |
| Studio for teams | US$29.99/mo per licence | US$359.88/yr per licence | |

The AI Assistant Plus add-on is US$4.99/mo on top of Pro, annual, billed monthly (Pro page header).

Sources: [Acrobat pricing](https://www.adobe.com/acrobat/pricing.html), [Acrobat Pro](https://www.adobe.com/acrobat/acrobat-pro.html).

- Pro and Studio appear on both pages with the same prices. Standard appears on the pricing page only.
- These are US prices. Adobe's [Singapore page](https://www.adobe.com/sg/acrobat/pricing.html) showed no prices to our text fetch, and Adobe's site blocked our automated browser.
- **To do:** someone opens both pages in a normal browser, screenshots them, and notes the Singapore price. Until then, say "US prices".

## How many people use it

**Say:** "Adobe reports over 900 million monthly active users across Acrobat and Express."

| Figure | Period | Source |
|---|---|---|
| "Acrobat + Express MAU surpassed 900 million, growing more than 25% year over year" | Q3 FY2026, quarter ended 28 Aug 2026 | [Adobe earnings script, p.17](https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/01906202/c6yetrerew.pdf) |
| "more than 400 billion PDFs in Acrobat every year" | Sept 2026 | [Adobe press release, 9 Sept 2026](https://news.adobe.com/news/2026/09/adobe-productivity-agent-in-acrobat-now-transforms-complex-documents) |
| "more than 650 million monthly active users" of Acrobat | Feb 2025, older | [Adobe press release, 4 Feb 2025](https://news.adobe.com/news/2025/02/acrobat-ai-assistant-contracts) |
| Acrobat Reader mobile: "more than 635 million installs" | Current page | [Acrobat Pro page](https://www.adobe.com/acrobat/acrobat-pro.html) |

## What not to claim

- **Don't say "900 million people use Acrobat."** The figure combines Acrobat and Express, and we found no current Acrobat-only figure.
- **Don't say "900 million people pay Adobe."** Monthly active users include free users. On the Q2 FY2026 call, Adobe said of its 850 million that "many of them are on desktop Reader", with others on browser extensions and mobile ([transcript, p.18](https://www.adobe.com/cc-shared/assets/investor-relations/pdfs/adbe-q2fy26-transcript.pdf)). We found no paid Acrobat subscriber count.
- **Don't quote the 400 billion as monthly.** The Feb 2025 release says "each month", but the Sept 2026 release says "every year". Use the newer one.

## Before and after, per user per year

| | Adobe | Fill Me |
|---|---|---|
| Software | US$239.88 (Pro) to US$299.88 (Studio), prepaid | US$0, MIT licence |
| AI | Included in Studio, or US$4.99/mo added to Pro | US$0 on SoCLaaS |

**Saving: US$239.88 to US$299.88 per user per year**, against the prepaid annual plans.

- **The US$0 AI cost only applies at NUS.** SoCLaaS is free but rate-limited and run by NUS School of Computing. Anyone else would pay their own model provider, so quote our measured tokens per operation alongside it, from `docs/findings/c-numbers.md` once measured.
- **It isn't a full replacement.** SPEC section 3 lists what we don't do, including certified e-signatures and in-place text editing. Say so if asked.
- **The saving only applies to paying users.** Free Reader users save nothing, so don't multiply the saving by 900 million.

# Health scoring

Each category starts at 100.

| Severity | Deduction |
|---|---|
| Critical | 15 |
| High | 8 |
| Medium | 4 |
| Low | 1 |

Scores clamp to 0–100.

Overall score is a weighted average:

- Performance 15
- Accessibility 15
- SEO 15
- Security 15
- Functional 15
- Visual 15
- Technical 10

Skipped engines (toggled off in the scan form) are excluded from the overall average.

This is a QA health score, not a search ranking and not Google's PageSpeed number.

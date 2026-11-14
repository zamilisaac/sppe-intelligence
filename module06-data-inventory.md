# Module 06 (Smart Report Builder): data inventory and checks (14 Nov 2026)

Status at time of writing: design stage. Open decision then: where the dashboard reads the new data from (Drive folder "State Productivity Data" vs baked-in snapshot). Drive folder held only the productivity workbook.

## Files (28 uploads = 16 distinct datasets; repeats are byte-identical)
| File | Content | Coverage |
|---|---|---|
| gdp_state_real_supply | real GDP abs + growth_yoy by state x sector p0-p6 | 2015-2025, 16 states + Malaysia |
| wages_state | survey median/mean wages by state x sex | 2010-2025, 16 states + Malaysia |
| wages_sector | survey wages, national, 5 sectors + overall | 2010-2025 |
| wages_industry | survey wages, national, MSIC sections A-S | 2010-2025 |
| wages_education / wages_skill | survey wages, national | 2010-2025 |
| formal_wages_state | formal median wage + employees by state | monthly Jan 2022-Jun 2026, incl. Malaysia |
| formal_wages_msic | formal wages, national, sector x industry | monthly Jan 2022-Jun 2026 |
| formal_wages_band | formal employees by wage band, national | monthly Jan 2022-Jun 2026 |
| lfs_state_sex | labour force, employed, unemployed, rates by state x sex | 1982-2025, 16 states, NO Malaysia row |
| cpi_2d_state / _inflation | CPI index and inflation by state x 13 divisions + overall | monthly Jan 2010-Sep 2026, NO Malaysia row |
| hies_state | household income, expenditure, Gini, poverty | 2022, 2024, 16 states, NO Malaysia row |
| hies_state_percentile | income by percentile | 2019, 2022, 2024 |
| productivity_annual | national GDP, hours, employment, productivity for 22 sectors/sub-sectors | 2015-2025 |
| productivity_annual_p14 | national productivity for 14 sub-sectors coded special.01-14 | 2015-2025 |

## Checks run on the 11 files attached 14 Nov (all identical to project copies)
- lfs: no blanks. Years 1991 and 1994 absent for all states. Labuan and Putrajaya have 15 years only. Sum of 16 states employed 2025 = 16,580.8k (productivity file p0 employment = 16,613k; different sources, do not mix).
- cpi: complete, 12 months each year, 9 months in 2026. inflation_yoy blank for the first 11 months only (expected).
- productivity_annual: sector employment sums to p0 exactly. Sector GDP sums to less than p0 (2025: 1,713,664 vs 1,736,953); gap is the unallocated item (import duties), keep it out of sector shares or show it. gdp/employment reproduces output_employment within rounding.
- productivity_annual_p14: special.03, .06, .07 blank for 2015-2016. Codes have no names in the file; a label lookup is needed before use.
- formal_wages_band: bands sum to the formal_wages_state Malaysia employee total. Strong seasonality (Dec, Jan, Mar bonus months), so compare same month or annual averages.
- hies_state_percentile: only min/max blank for 16 rows per year.
- wages_industry/education/skill: "overall" rows agree across all three files.

## Gaps (report as "not available", never fill)
- No state x sector or state x industry wages.
- No state x sector employment.
- No national CPI or national household income (cannot be summed from states).

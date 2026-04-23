## Plan: Per-Hole Stat Breakdown & Summary in Player Profile

**TL;DR:**  
Add a detailed per-hole breakdown (score, fairway hit, GIR, putts, putt distances) to the round detail view accessible from the player profile. Add summary tallies/averages for fairways hit, GIR, putts per hole, and a breakdown of 1/2/3+ putts, both per round and (optionally) as player-level aggregates.

---

**Steps**

### Phase 1: Per-Hole Breakdown in Round Detail
1. In app/round-detail/page.tsx, after the holes grid, add a table/grid:
   - For each hole, display:
     - Score
     - Fairway hit (✓/✗)
     - GIR (✓/✗)
     - Number of putts
     - Putt distances (list)
   - Source data from round.perHoleStats and round.scores.
   - Handle missing perHoleStats gracefully.

### Phase 2: Round Summary Stats/Charts
2. In app/round-detail/page.tsx, add a summary section:
   - Tally and display:
     - Total fairways hit (count and %)
     - Total GIR (count and %)
     - Average putts per hole
     - Breakdown: number of holes with 1, 2, 3, 4+ putts
   - Use simple tallies or bar charts (if chart library is present).

### Phase 3: Player-Level Summaries (Optional)
3. In app/player/page.tsx, aggregate above stats across all rounds for the player:
   - Show averages/totals for fairways, GIR, putts, and putt breakdowns.
   - Display as summary cards or charts.

### Phase 4: UI/UX
4. Use existing card/grid styles for consistency.
5. Ensure mobile and desktop layouts are clean and readable.

---

**Relevant files**
- app/round-detail/page.tsx — Add per-hole breakdown and round summary stats.
- app/player/page.tsx — (Optional) Add player-level stat summaries.
- types/index.ts — Reference PerHoleStats and Round types.

---

**Verification**
1. Select a round from the player profile; confirm per-hole breakdown and summary stats display correctly.
2. Check for correct handling of rounds with missing perHoleStats.
3. (If implemented) Confirm player-level summaries aggregate correctly across all rounds.
4. Validate UI on both mobile and desktop.

---

**Decisions**
- Per-hole and per-round stats will be shown in round detail; player-level summaries are optional but recommended.
- No chart library assumed; use tallies or simple bar charts if possible.
- Handle missing/incomplete data gracefully.

---

**Further Considerations**
1. If you want advanced charts, consider adding a chart library (e.g., Chart.js, Recharts).
2. For large player histories, optimize aggregation logic if needed.
3. Confirm with user if player-level summaries are required now or in a future phase.

---

Let me know if you want to proceed with this plan or need adjustments!
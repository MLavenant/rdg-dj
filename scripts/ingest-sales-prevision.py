# Pull the Three Month Plan sales simulation inputs out of DJ DATA (1).xlsx
# into data/dj-sales-prevision.js. The site never reads the Downloads folder.
import datetime
import json
import sys
from openpyxl import load_workbook

SRC = sys.argv[1] if len(sys.argv) > 1 else r"c:\Users\MatthiasLavenant\Downloads\DJ DATA (1).xlsx"
OUT = r"C:\Users\MatthiasLavenant\Documents\rdg-dj-dashboard\data\dj-sales-prevision.js"

BUDGET_SHEET = "BUDGET 2027 CN"
TIER_SHEET = "DJ Tier Analysis - Casa Neos"
# Monday..Sunday columns, 0-based (Brunch M:S, Dinner V:AB, Bottle Service AF:AL).
BRUNCH = list(range(12, 19))
DINNER = list(range(21, 28))
BOTTLE = list(range(31, 38))


def num(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


def money(v):
    n = num(v)
    return round(n, 2) if n is not None else 0.0


def sheet(wb, name):
    want = name.strip().lower()
    for s in wb.sheetnames:
        if s.strip().lower() == want:
            return wb[s]
    raise KeyError(name)


def parse_budget(ws):
    weeks = {}
    for row in ws.iter_rows(max_row=120, max_col=40, values_only=True):
        label = row[1] if len(row) > 1 else None
        if not isinstance(label, str) or not label.strip().lower().startswith("week "):
            continue
        try:
            week = int(label.strip().split()[1])
        except (IndexError, ValueError):
            continue
        weeks[str(week)] = {
            "brunch": [money(row[c]) for c in BRUNCH],
            "dinner": [money(row[c]) for c in DINNER],
            "bs": [money(row[c]) for c in BOTTLE],
        }
    return weeks


def parse_tiers(ws):
    rows = list(ws.iter_rows(max_row=60, max_col=60, values_only=True))
    overall = {}
    order = []
    for r in rows[5:18]:
        label = r[1]
        if not isinstance(label, str) or not label.startswith("$"):
            continue
        order.append(label)
        overall[label] = {
            "sat": num(r[2]), "sun": num(r[3]),
            "satN": num(r[5]) or 0, "sunN": num(r[6]) or 0,
        }
    head = None
    for i, r in enumerate(rows):
        if any(isinstance(v, datetime.datetime) for v in r):
            head = i
            break
    monthly = {}
    if head is not None:
        cols = [(j, v.month) for j, v in enumerate(rows[head]) if isinstance(v, datetime.datetime)]
        for r in rows[head + 2:head + 2 + len(order) + 2]:
            label = r[1]
            if label not in overall:
                continue
            per = {}
            for j, month in cols:
                per[str(month)] = {
                    "sat": num(r[j]), "sun": num(r[j + 1]),
                    "satN": num(r[j + 2]) or 0, "sunN": num(r[j + 3]) or 0,
                }
            monthly[label] = per
    return {"order": order, "overall": overall, "monthly": monthly}


def main():
    wb = load_workbook(SRC, read_only=True, data_only=True)
    weeks = parse_budget(sheet(wb, BUDGET_SHEET))
    tiers = parse_tiers(sheet(wb, TIER_SHEET))
    payload = {
        "source": SRC.split("\\")[-1],
        "budgetSheet": BUDGET_SHEET,
        "tierSheet": TIER_SHEET,
        "venues": {"Casa Neos Beach Club": {"weeks": weeks, "tiers": tiers}},
    }
    text = "window.DJ_SALES_PREVISION=" + json.dumps(payload, separators=(",", ":")) + ";\n"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    w44 = weeks.get("44")
    print("weeks", len(weeks), "tiers", len(tiers["order"]), "months", len(next(iter(tiers["monthly"].values()), {})))
    print("week 44", w44)
    print("wrote", OUT, len(text))


if __name__ == "__main__":
    main()

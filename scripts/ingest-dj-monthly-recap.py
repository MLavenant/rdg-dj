# Pull Monthly Recap numbers out of DJ DATA.xlsx into data/dj-monthly-recap.js.
# The site never reads the Downloads folder.
import datetime
import json
import re
from openpyxl import load_workbook

SRC = r"c:\Users\MatthiasLavenant\Downloads\DJ DATA (2).xlsx"
OUT = r"C:\Users\MatthiasLavenant\Documents\rdg-dj-dashboard\data\dj-monthly-recap.js"

PL_SHEETS = [
    ("2026 Casa P&L", "Casa Neos Beach Club", "2026"),
    ("2025 Casa P&L", "Casa Neos Beach Club", "2025"),
    ("2026 Casa Lounge P&L", "Casa Neos Lounge", "2026"),
    ("2026 Mila MM P&L", "MILA Lounge", "2026"),
    ("2025 MILA MM P&L", "MILA Lounge", "2025"),
]
SALES_SHEETS = [
    ("2026 CASA NEOS SALES", "Casa Neos Beach Club"),
    ("2025 CASA NEOS SALES", "Casa Neos Beach Club"),
    ("2026 CN Lounge Sales", "Casa Neos Lounge"),
    ("2025 CN Lounge Sales", "Casa Neos Lounge"),
    ("2026 MILA II MM CLUB", "MILA Lounge"),
    ("2025 MILA II MM CLUB", "MILA Lounge"),
]
MINI_SHEETS = [
    ("Mini P&L Casa Neos", "Casa Neos Beach Club"),
    ("Mini P&L Simulator MILA", "MILA Lounge"),
    ("Mini P&L Simulator CN Lounge", "Casa Neos Lounge"),
]
LABELS = {
    "Casa Neos Beach Club": "Casa Neos Beach Club",
    "Casa Neos Lounge": "Casa Neos Lounge",
    "MILA Lounge": "MM Club at Mila",
}


def sheets_named(wb, name):
    want = name.strip().lower()
    return [wb[s] for s in wb.sheetnames if s.strip().lower() == want]


def sheet_by_name(wb, name, last=False):
    hits = sheets_named(wb, name)
    if not hits:
        raise KeyError(name)
    # A few 2025 sales tabs share a name with an earlier summary tab.
    return hits[-1] if last else hits[0]


def num(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


def rnd(v, places=2):
    if v is None:
        return None
    return round(float(v), places)


def period_headers(ws):
    headers = {}
    ending = None
    for row in ws.iter_rows(max_row=8, max_col=80, values_only=True):
        for j, v in enumerate(row):
            if isinstance(v, str) and v.lower().startswith("period ending"):
                ending = v
            if isinstance(v, str):
                m = re.search(r"(?:Period|PTD)\s*(\d+)", v, re.I)
                if m:
                    headers[int(m.group(1))] = j
        if headers:
            break
    return headers, ending


def label_rows(ws):
    rows = {}
    for i, row in enumerate(ws.iter_rows(max_row=360, max_col=1, values_only=True), 1):
        a = row[0]
        if a is None:
            continue
        key = str(a).strip()
        rows.setdefault(key, []).append(i)
    return rows


def row_values(ws, r, headers):
    out = {}
    for period, col in headers.items():
        vals = None
        # read just that row's amount and the next cell (percent)
        for row in ws.iter_rows(min_row=r, max_row=r, max_col=col + 2, values_only=True):
            vals = row
        if not vals:
            continue
        amount = num(vals[col]) if col < len(vals) else None
        pct = num(vals[col + 1]) if col + 1 < len(vals) else None
        if amount is None and pct is None:
            continue
        out[period] = (amount, pct)
    return out


def pick_total_sales(ws, rows, headers):
    best = None
    best_n = -1
    for r in rows.get("Total Sales", []):
        got = row_values(ws, r, headers)
        n = sum(1 for a, _p in got.values() if a is not None)
        if n > best_n:
            best, best_n = got, n
    return best or {}


def pick_label(ws, rows, headers, pred):
    for key, rs in rows.items():
        if pred(key):
            got = row_values(ws, rs[0], headers)
            if got:
                return got
    return {}


def parse_pl(ws):
    headers, ending = period_headers(ws)
    rows = label_rows(ws)
    sales = pick_total_sales(ws, rows, headers)
    live = pick_label(ws, rows, headers, lambda k: "6750" in k)
    net = pick_label(ws, rows, headers, lambda k: k.strip().lower() == "net profit")
    periods = {}
    for p in sorted(set(list(sales) + list(live) + list(net))):
        s_amt, _s_pct = sales.get(p, (None, None))
        l_amt, l_pct = live.get(p, (None, None))
        n_amt, n_pct = net.get(p, (None, None))
        if l_pct is None and s_amt and l_amt is not None:
            l_pct = l_amt / s_amt
        if n_pct is None and s_amt and n_amt is not None:
            n_pct = n_amt / s_amt
        periods[str(p)] = {
            "sales": rnd(s_amt),
            "live": rnd(l_amt),
            "livePct": rnd(l_pct, 6),
            "net": rnd(n_amt),
            "netPct": rnd(n_pct, 6),
        }
    return periods, ending


def as_date(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    if isinstance(v, str):
        s = v.strip()[:10]
        try:
            return datetime.date.fromisoformat(s)
        except ValueError:
            return None
    return None


def parse_sales(ws):
    # Day total is the COMBINED block (MILA AW:BD, Casa/Lounge AN:AU).
    # AW/AN is the week total. The next seven columns are Mon-Sun.
    # The first MON on the sheet is one department, not the day total.
    rows = list(ws.iter_rows(max_row=220, max_col=80, values_only=True))
    header_i = None
    start_i = 1
    combined_i = None
    for i, row in enumerate(rows[:8]):
        labels = [str(c).strip().upper() if isinstance(c, str) else "" for c in row]
        if "COMBINED" in labels:
            combined_i = labels.index("COMBINED")
        if header_i is None and "START" in labels and "MON" in labels:
            header_i = i
            start_i = labels.index("START")
    days = {}
    if header_i is None or combined_i is None:
        return days
    mon_i = combined_i + 1
    for row in rows[header_i + 1:]:
        a = row[0] if row else None
        if not isinstance(a, str) or not a.strip().lower().startswith("week"):
            continue
        start_d = as_date(row[start_i] if start_i < len(row) else None)
        if not start_d:
            continue
        monday = start_d - datetime.timedelta(days=start_d.weekday())
        for offset in range(7):
            cell = row[mon_i + offset] if mon_i + offset < len(row) else None
            val = num(cell)
            if val is None:
                continue
            key = (monday + datetime.timedelta(days=offset)).isoformat()
            days[key] = rnd(val)
    return days


def col_letter(n):
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def strip_ref(formula):
    return re.sub(r"\$", "", str(formula or "")).replace(" ", "").upper()


def sum_range(formula):
    m = re.match(r"^=SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$", strip_ref(formula))
    if not m or m.group(1) != m.group(3):
        return None
    return int(m.group(2)), int(m.group(4))


def simple_ref(formula):
    m = re.match(r"^=([A-Z]+)(\d+)$", strip_ref(formula))
    if not m:
        return None
    return m.group(1), int(m.group(2))


def find_amount_col(ws_f, total_row):
    for col in range(2, 16):
        f = ws_f.cell(total_row, col).value
        if isinstance(f, str) and strip_ref(f).startswith("=SUM("):
            return col
    return 4


def find_row(ws_f, label, limit=140):
    want = label.strip().lower()
    for r in range(1, limit + 1):
        b = ws_f.cell(r, 2).value
        if isinstance(b, str) and b.strip().lower() == want:
            return r
    return None


def signed_terms(formula):
    body = strip_ref(formula)
    if not body.startswith("="):
        return []
    return [(sign or "+", int(row)) for sign, _col, row in re.findall(r"([+-]?)([A-Z]+)(\d+)", body[1:])]


def parse_model(ws_f, ws_v):
    total_row = find_row(ws_f, "Total Sales")
    live_row = find_row(ws_f, "Live Entertainment")
    ebitda_row = find_row(ws_f, "EBITDA")
    if not (total_row and live_row and ebitda_row):
        raise RuntimeError("Mini P&L missing Total Sales, Live Entertainment, or EBITDA")
    col = find_amount_col(ws_f, total_row)
    sales_ref = col_letter(col) + str(total_row)
    base_sales = num(ws_v.cell(total_row, col).value)
    base_live = num(ws_v.cell(live_row, col).value) or 0
    base_ebitda = num(ws_v.cell(ebitda_row, col).value)
    live_formula = ws_f.cell(live_row, col).value
    live_rows = {live_row}
    ref = simple_ref(live_formula)
    if ref and ref[0] == col_letter(col):
        live_rows.add(ref[1])

    def leaves(row, seen):
        if row in seen or row in live_rows:
            return []
        seen.add(row)
        formula = ws_f.cell(row, col).value
        span = sum_range(formula)
        if span:
            out = []
            for r in range(span[0], span[1] + 1):
                out.extend(leaves(r, seen))
            return out
        amount = num(ws_v.cell(row, col).value) or 0
        f = strip_ref(formula)
        variable = sales_ref in f and "SUM(" not in f
        return [{"amount": amount, "variable": variable}]

    def add_cost(row, variable, fixed, seen):
        for leaf in leaves(row, seen):
            if leaf["variable"]:
                variable += leaf["amount"]
            else:
                fixed += leaf["amount"]
        return variable, fixed

    terms = signed_terms(ws_f.cell(ebitda_row, col).value)
    if not terms:
        raise RuntimeError("Cannot read EBITDA formula")
    variable = 0.0
    fixed = 0.0
    seen = set()
    # Gross profit is sales minus COGS. Sales is the 1.0; only the minus terms are costs.
    gp_row = terms[0][1]
    for sign, row in signed_terms(ws_f.cell(gp_row, col).value):
        if sign == "-":
            variable, fixed = add_cost(row, variable, fixed, seen)
    for sign, row in terms[1:]:
        if sign == "-":
            variable, fixed = add_cost(row, variable, fixed, seen)
        elif sign == "+":
            # A plus inside EBITDA would be income. Treat its leaves as negative cost.
            for leaf in leaves(row, seen):
                if leaf["variable"]:
                    variable -= leaf["amount"]
                else:
                    fixed -= leaf["amount"]
    if not base_sales:
        raise RuntimeError("Mini P&L total sales is empty")
    contrib = 1 - (variable / base_sales)
    # One live-entertainment plug. The Casa sheet also types the fee into the
    # cell Live Entertainment points at, and the total adds both. We count it once.
    check = base_sales * contrib - fixed - base_live
    return {
        "contrib": rnd(contrib, 8),
        "fixed": rnd(fixed, 2),
        "baseSales": rnd(base_sales),
        "baseLive": rnd(base_live),
        "baseEbitda": rnd(base_ebitda),
        "checkEbitda": rnd(check),
    }


def main():
    print("loading values")
    wb_v = load_workbook(SRC, read_only=True, data_only=True)
    print("loading formulas")
    wb_f = load_workbook(SRC, data_only=False)
    venues = {}
    for key, label in LABELS.items():
        venues[key] = {"label": label, "pl": {}, "daily": {}, "model": None}

    for sheet, venue, year in PL_SHEETS:
        periods, ending = parse_pl(sheet_by_name(wb_v, sheet))
        venues[venue]["pl"][year] = periods
        venues[venue]["periodEnding"] = ending
        p10 = periods.get("10")
        print(sheet, "periods", sorted(periods, key=lambda x: int(x)), "P10", p10)

    for sheet, venue in SALES_SHEETS:
        days = parse_sales(sheet_by_name(wb_v, sheet, last=True))
        venues[venue]["daily"].update(days)
        print(sheet, "days", len(days))

    for sheet, venue in MINI_SHEETS:
        model = parse_model(sheet_by_name(wb_f, sheet), sheet_by_name(wb_v, sheet))
        venues[venue]["model"] = model
        print(sheet, "model", model)

    payload = {
        "source": "DJ DATA (2).xlsx",
        "venues": venues,
    }
    text = "window.DJ_MONTHLY_RECAP=" + json.dumps(payload, separators=(",", ":")) + ";\n"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote", OUT, "bytes", len(text))


if __name__ == "__main__":
    main()

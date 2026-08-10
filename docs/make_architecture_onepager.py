"""Generate executive-style RDG DJ Dashboard architecture one-pager PDF."""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white

out = Path(__file__).with_name("RDG-DJ-Dashboard-Architecture-One-Pager.pdf")

W, H = letter
c = canvas.Canvas(str(out), pagesize=letter)

navy = HexColor("#0f2744")
ink = HexColor("#1c2b3a")
muted = HexColor("#5a6a7a")
rule = HexColor("#c8d0d8")
soft = HexColor("#f4f6f8")
white_c = white
accent = HexColor("#1e4d7b")
teal = HexColor("#1a5c54")
steel = HexColor("#3d4f5f")

c.setFillColor(white_c)
c.rect(0, 0, W, H, fill=1, stroke=0)

# Masthead (no confidential)
c.setStrokeColor(navy)
c.setLineWidth(2.5)
c.line(36, H - 24, W - 36, H - 24)

c.setFillColor(navy)
c.setFont("Helvetica-Bold", 17)
c.drawString(36, H - 46, "RDG DJ Dashboard")
c.setFont("Helvetica", 7.5)
c.setFillColor(muted)
c.drawString(36, H - 58, "Executive briefing  |  Overview, purpose, delivery, and architecture")
c.setFillColor(muted)
c.setFont("Helvetica", 7)
c.drawRightString(W - 36, H - 50, "Riviera Dining Group")

c.setStrokeColor(rule)
c.setLineWidth(0.6)
c.line(36, H - 68, W - 36, H - 68)


def wrap(text, font, size, max_w):
    c.setFont(font, size)
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if c.stringWidth(t, font, size) <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# OVERVIEW
ov_top = H - 80
c.setFillColor(navy)
c.setFont("Helvetica-Bold", 8)
c.drawString(36, ov_top, "OVERVIEW")
c.setFillColor(muted)
c.setFont("Helvetica-Oblique", 7)
c.drawString(92, ov_top, "Host · server · data layer")

c.setFillColor(soft)
c.setStrokeColor(rule)
c.setLineWidth(0.5)
c.roundRect(36, ov_top - 42, W - 72, 36, 3, fill=1, stroke=1)

overview = (
    "The application is a static front end hosted on GitHub Pages (no dedicated app server); "
    "the browser is the client, and Firebase Realtime Database is the live data / sync layer, "
    "with Firebase Storage for files and GitHub Actions supplying scheduled integrations (FourVenues, Toast)."
)
ov_lines = wrap(overview, "Helvetica", 7.5, W - 96)
c.setFillColor(ink)
yy = ov_top - 18
for ln in ov_lines[:3]:
    c.drawString(46, yy, ln)
    yy -= 10

# WHY / HOW / WHERE
col_top = ov_top - 58
col_h = 92
gap = 14
col_w = (W - 72 - 2 * gap) / 3

sections = [
    (
        "01",
        "WHY",
        "Business purpose",
        "One operating view for guest-DJ nights across Casa Neos Beach Club, MILA, and Casa Neos Lounge — fees, bottle-service vs target, ROI, schedule, and AP — so programming and finance share a single source of truth.",
    ),
    (
        "02",
        "HOW",
        "Delivery approach",
        "Built in Cursor as a lightweight HTML/CSS/JS app (no build pipeline). Baseline schedule is in-repo; live edits sync via Firebase. Ship by push to GitHub main; Pages publishes continuously from the IDE workflow.",
    ),
    (
        "03",
        "WHERE",
        "Environment & testing",
        "Live test surface: mlavenant.github.io/rdg-dj. Source: MLavenant/rdg-dj (main). Data: Firebase project rdg-dj-dashboard. Integrations refresh on a morning GitHub Actions schedule.",
    ),
]

for i, (num, label, subtitle, body) in enumerate(sections):
    x = 36 + i * (col_w + gap)
    bar = navy if i == 0 else (teal if i == 1 else steel)
    c.setFillColor(bar)
    c.rect(x, col_top - col_h, 3, col_h, fill=1, stroke=0)

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 12, col_top - 12, num + "  " + label)
    c.setFillColor(muted)
    c.setFont("Helvetica-Oblique", 7)
    c.drawString(x + 12, col_top - 24, subtitle)

    c.setStrokeColor(rule)
    c.setLineWidth(0.5)
    c.line(x + 12, col_top - 30, x + col_w - 4, col_top - 30)

    lines = wrap(body, "Helvetica", 7.2, col_w - 18)
    c.setFillColor(ink)
    yy = col_top - 44
    for ln in lines[:5]:
        c.drawString(x + 12, yy, ln)
        yy -= 9.5

# ARCHITECTURE — true top-to-bottom stack
arch_y = col_top - col_h - 18
c.setFillColor(navy)
c.setFont("Helvetica-Bold", 10)
c.drawString(36, arch_y, "ARCHITECTURE")
c.setFillColor(muted)
c.setFont("Helvetica", 7.5)
c.drawString(120, arch_y + 1, "Top to bottom — from change to live data")

c.setStrokeColor(navy)
c.setLineWidth(1)
c.line(36, arch_y - 6, W - 36, arch_y - 6)

frame_top = arch_y - 12
frame_bot = 54
frame_h = frame_top - frame_bot
c.setFillColor(soft)
c.setStrokeColor(rule)
c.setLineWidth(0.6)
c.rect(36, frame_bot, W - 72, frame_h, fill=1, stroke=1)

# Vertical stack layers (top → bottom)
# Leave room for side labels + connectors
layers = [
    {
        "title": "1  DEVELOPMENT",
        "sub": "Cursor IDE  ·  edit HTML / CSS / JS on local PC",
        "detail": "Working copy: Documents/rdg-dj-dashboard",
        "border": navy,
    },
    {
        "title": "2  SOURCE CONTROL",
        "sub": "Git push → GitHub repository  MLavenant/rdg-dj  (main)",
        "detail": "Code of record for the application",
        "border": navy,
    },
    {
        "title": "3  HOST (WEB)",
        "sub": "GitHub Pages publishes static site  ·  no dedicated application server",
        "detail": "https://mlavenant.github.io/rdg-dj/",
        "border": accent,
    },
    {
        "title": "4  CLIENT",
        "sub": "Browser loads the dashboard  ·  Calendar, Accounting, ROI, Forecast",
        "detail": "End users interact here (live test environment)",
        "border": accent,
    },
    {
        "title": "5  DATA LAYER",
        "sub": "Firebase Realtime Database (rdg/) + Storage  ·  project: rdg-dj-dashboard",
        "detail": "Live edits sync here  ·  everyone sees the same data",
        "border": teal,
    },
    {
        "title": "6  INTEGRATIONS",
        "sub": "GitHub Actions (scheduled) → FourVenues events  ·  Toast bottle-service sales",
        "detail": "Feeds write into Firebase / Pages on a morning cadence",
        "border": teal,
    },
]

n = len(layers)
pad_x = 70
layer_w = W - 72 - pad_x - 20
avail = frame_h - 20
gap_v = 4
layer_h = (avail - (n - 1) * gap_v) / n
y_cursor = frame_top - 10 - layer_h

def draw_layer(x, y, w, h, layer):
    c.setFillColor(white_c)
    c.setStrokeColor(layer["border"])
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 3, fill=1, stroke=1)
    # left accent
    c.setFillColor(layer["border"])
    c.rect(x, y, 4, h, fill=1, stroke=0)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x + 12, y + h - 12, layer["title"])
    c.setFillColor(ink)
    c.setFont("Helvetica", 6.5)
    c.drawString(x + 12, y + h - 23, layer["sub"])
    c.setFillColor(muted)
    c.setFont("Helvetica", 6)
    c.drawString(x + 12, y + 5, layer["detail"])

def v_connector(cx, y_top, y_bot):
    """Arrow pointing down from y_top to y_bot."""
    c.setStrokeColor(steel)
    c.setFillColor(steel)
    c.setLineWidth(1)
    c.line(cx, y_top, cx, y_bot + 3)
    c.line(cx, y_bot + 3, cx - 2.5, y_bot + 7)
    c.line(cx, y_bot + 3, cx + 2.5, y_bot + 7)

# Side column: flow labels
c.setFillColor(muted)
c.setFont("Helvetica-Bold", 5.5)
c.saveState()
# vertical text for BUILD vs RUNTIME
c.setFillColor(accent)
c.setFont("Helvetica-Bold", 6)
c.drawCentredString(52, frame_top - 55, "BUILD")
c.setFillColor(teal)
c.drawCentredString(52, frame_bot + 70, "RUNTIME")
c.restoreState()

cx_arrow = pad_x + 36 + layer_w / 2  # unused center; use left of boxes
box_x = 36 + pad_x - 20

ys = []
for i, layer in enumerate(layers):
    y = frame_top - 10 - (i + 1) * layer_h - i * gap_v
    ys.append(y)
    draw_layer(box_x, y, layer_w, layer_h, layer)
    if i < n - 1:
        # small down arrow between layers, centered under box
        mid_x = box_x + layer_w / 2
        top = y
        bot = y - gap_v
        # connectors sit in the gap; gap is small so draw on left gutter
        gx = box_x - 12
        c.setStrokeColor(steel)
        c.setLineWidth(1)
        c.line(gx, y + layer_h * 0.15, gx, y - gap_v - layer_h * 0.05)
        # arrow head at bottom of connector pointing to next
        ay = y - gap_v - layer_h * 0.05
        c.line(gx, ay, gx - 2.2, ay + 4)
        c.line(gx, ay, gx + 2.2, ay + 4)

# Flow captions on left of connectors
flow_labels = ["push", "publish", "serve", "sync", "ingest"]
for i, lab in enumerate(flow_labels):
    if i >= n - 1:
        break
    y = ys[i]
    c.setFillColor(muted)
    c.setFont("Helvetica", 5)
    c.drawRightString(box_x - 16, y - 1, lab)

# Footer
c.setStrokeColor(navy)
c.setLineWidth(1.2)
c.line(36, 42, W - 36, 42)
c.setFillColor(muted)
c.setFont("Helvetica", 6.5)
c.drawString(36, 28, "Riviera Dining Group  ·  Guest DJ & Bottle Service operations")
c.drawString(36, 16, "Live:  https://mlavenant.github.io/rdg-dj/")
c.setFillColor(navy)
c.setFont("Helvetica-Bold", 6.5)
c.drawRightString(W - 36, 22, "Architecture one-pager")

c.showPage()
c.save()
print(out)
print("bytes", out.stat().st_size)

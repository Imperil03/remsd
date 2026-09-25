import json
import os
import sys
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Image
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader
import pypdfium2 as pdfium

data_file, output, logo, work = map(Path, sys.argv[1:])
data = json.loads(data_file.read_text(encoding="utf-8"))
font_dir = Path(os.environ.get("CONTACTS_FONT_DIR", "C:/Windows/Fonts"))
pdfmetrics.registerFont(TTFont("Card", str(font_dir / "arial.ttf")))
pdfmetrics.registerFont(TTFont("CardBold", str(font_dir / "arialbd.ttf")))
navy = colors.HexColor("#0b1220")
muted = colors.HexColor("#4a5a6c")
line = colors.HexColor("#dce4ec")
text_style = ParagraphStyle("text", fontName="Card", fontSize=9, leading=12, textColor=navy)
label_style = ParagraphStyle("label", parent=text_style, textColor=muted, fontSize=8.3, leading=11)
title_style = ParagraphStyle("title", fontName="CardBold", fontSize=23, leading=28, textColor=navy)
bank_style = ParagraphStyle("bank", fontName="CardBold", fontSize=9.5, leading=13, textColor=navy, spaceAfter=8)
p = lambda text, style=text_style: Paragraph(escape(str(text)).replace("\n", "<br/>"), style)

def rows_table(rows, widths, compact=False):
    table = Table([[p(label, label_style), p(value)] for label, value in rows], colWidths=widths, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 14), ("RIGHTPADDING", (1, 0), (1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 7 if compact else 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7 if compact else 8),
        ("LINEBELOW", (0, 0), (-1, -1), .5, line)
    ]))
    return table

doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=42, leftMargin=42, topMargin=35, bottomMargin=32,
                        title="Реквизиты РемСД", author="РемСД", subject="Карточка предприятия ООО РЕМСД")
logo_image = Image(str(logo), width=55, height=70, kind="proportional")
header = Table([[logo_image, p("Реквизиты РемСД", title_style)]], colWidths=[80, 431])
header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("LINEBELOW", (0, 0), (-1, -1), 2, colors.HexColor("#f5a21a")), ("BOTTOMPADDING", (0, 0), (-1, -1), 15)]))
story = [header, Spacer(1, 13), rows_table(data["rows"], [147, 364]), Spacer(1, 22)]
banks = []
for bank in data["banks"]:
    banks.append([p(bank["name"], bank_style), rows_table(bank["rows"], [83, 155], True)])
bank_grid = Table([[banks[0], banks[1]]], colWidths=[264, 247])
bank_grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 9)]))
story.extend([bank_grid, Spacer(1, 22), p(f'{data["phone"]}  ·  {data["email"]}  ·  remsd.ru')])
doc.build(story)
reader = PdfReader(str(output))
assert len(reader.pages) == 1, "Карточка должна помещаться на одной странице"
text = reader.pages[0].extract_text()
for rows in [data["rows"], *[bank["rows"] for bank in data["banks"]]]:
    for label, value in rows:
        if str(value).isdigit():
            assert str(value) in text, f"Missing numeric value: {label}"
pdf = pdfium.PdfDocument(str(output))
pdf[0].render(scale=1.6).to_pil().save(str(work / "preview.png"))
(work / "extracted.txt").write_text(text, encoding="utf-8")
print("PDF: one page, numeric fields verified, preview rendered")

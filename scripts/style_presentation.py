#!/usr/bin/env python3
"""Apply the OpsDesk visual system to a Pandoc-generated PowerPoint deck.

The repository intentionally keeps the deck source in Markdown. Pandoc creates
the semantic slide structure, and this small OOXML pass applies a repeatable
visual treatment without requiring a PowerPoint installation or credentials.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ET.register_namespace("p", P_NS)
ET.register_namespace("a", A_NS)
ET.register_namespace("r", R_NS)

EMU_PER_INCH = 914400
SLIDE_WIDTH = 10 * EMU_PER_INCH
SLIDE_HEIGHT = 7.5 * EMU_PER_INCH

NAVY = "0B1220"
SLATE = "334155"
MUTED = "64748B"
PAPER = "F8FAFC"
CYAN = "06B6D4"
TEAL = "14B8A6"
AMBER = "F59E0B"
VIOLET = "8B5CF6"
GREEN = "22C55E"
WHITE = "FFFFFF"


def q(local: str, namespace: str = P_NS) -> str:
    return f"{{{namespace}}}{local}"


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def first(parent: ET.Element, local: str) -> ET.Element | None:
    return next((child for child in parent if local_name(child.tag) == local), None)


def child(parent: ET.Element, local: str, namespace: str = A_NS) -> ET.Element:
    found = first(parent, local)
    return found if found is not None else ET.SubElement(parent, q(local, namespace))


def set_solid_fill(parent: ET.Element, color: str, namespace: str = A_NS) -> None:
    for node in list(parent):
        if local_name(node.tag) in {"solidFill", "gradFill", "noFill", "pattFill"}:
            parent.remove(node)
    fill = ET.SubElement(parent, q("solidFill", namespace))
    ET.SubElement(fill, q("srgbClr", A_NS), {"val": color})


def set_line(parent: ET.Element, color: str | None = None, width: int = 9525) -> None:
    line = first(parent, "ln")
    if line is None:
        line = ET.SubElement(parent, q("ln", A_NS))
    line.set("w", str(width))
    for node in list(line):
        if local_name(node.tag) in {"solidFill", "noFill", "gradFill", "pattFill"}:
            line.remove(node)
    if color:
        fill = ET.SubElement(line, q("solidFill", A_NS))
        ET.SubElement(fill, q("srgbClr", A_NS), {"val": color})
    else:
        ET.SubElement(line, q("noFill", A_NS))


def set_background(c_sld: ET.Element, color: str) -> None:
    existing = first(c_sld, "bg")
    if existing is not None:
        c_sld.remove(existing)
    bg = ET.Element(q("bg", P_NS))
    bg_pr = ET.SubElement(bg, q("bgPr", A_NS))
    set_solid_fill(bg_pr, color)
    ET.SubElement(bg_pr, q("effectLst", A_NS))
    c_sld.insert(0, bg)


def set_font(rpr: ET.Element, family: str = "Aptos", size: int | None = None, bold: bool | None = None) -> None:
    latin = first(rpr, "latin")
    if latin is None:
        latin = ET.SubElement(rpr, q("latin", A_NS))
    latin.set("typeface", family)
    if size is not None:
        rpr.set("sz", str(size))
    if bold is not None:
        rpr.set("b", "1" if bold else "0")


def set_text_color(rpr: ET.Element, color: str) -> None:
    set_solid_fill(rpr, color)


def style_text_shape(shape: ET.Element, color: str, size: int, family: str = "Aptos", bold: bool = False) -> None:
    tx_body = first(shape, "txBody")
    if tx_body is None:
        return
    body_pr = first(tx_body, "bodyPr")
    if body_pr is not None:
        body_pr.set("wrap", "square")
        body_pr.set("anchor", "t")
        body_pr.set("lIns", "91440")
        body_pr.set("rIns", "91440")
        body_pr.set("tIns", "45720")
        body_pr.set("bIns", "45720")
    for node in tx_body.iter():
        if local_name(node.tag) not in {"rPr", "endParaRPr", "defRPr"}:
            continue
        set_font(node, family, size, bold if local_name(node.tag) == "rPr" else None)
        set_text_color(node, color)
    lst_style = first(tx_body, "lstStyle")
    if lst_style is not None:
        for level in ("lvl1pPr", "lvl2pPr", "lvl3pPr"):
            lvl = first(lst_style, level)
            if lvl is None:
                lvl = ET.SubElement(lst_style, q(level, A_NS))
            def_rpr = first(lvl, "defRPr")
            if def_rpr is None:
                def_rpr = ET.SubElement(lvl, q("defRPr", A_NS))
            set_font(def_rpr, family, size)
            set_text_color(def_rpr, color)


def shape_id(sp_tree: ET.Element) -> int:
    values = []
    for node in sp_tree.iter(q("cNvPr")):
        try:
            values.append(int(node.get("id", "0")))
        except ValueError:
            pass
    return max(values or [1]) + 1


def add_shape(
    sp_tree: ET.Element,
    name: str,
    x: int,
    y: int,
    width: int,
    height: int,
    fill: str | None = None,
    line: str | None = None,
    geometry: str = "rect",
    text: str | None = None,
    text_color: str = WHITE,
    text_size: int = 900,
    text_align: str = "l",
) -> ET.Element:
    sp = ET.Element(q("sp", P_NS))
    nv = ET.SubElement(sp, q("nvSpPr", P_NS))
    identifier = shape_id(sp_tree)
    ET.SubElement(nv, q("cNvPr", P_NS), {"id": str(identifier), "name": name})
    ET.SubElement(nv, q("cNvSpPr", P_NS), {"txBox": "1" if text else "0"})
    ET.SubElement(nv, q("nvPr", P_NS))
    sp_pr = ET.SubElement(sp, q("spPr", P_NS))
    xfrm = ET.SubElement(sp_pr, q("xfrm", A_NS))
    ET.SubElement(xfrm, q("off", A_NS), {"x": str(x), "y": str(y)})
    ET.SubElement(xfrm, q("ext", A_NS), {"cx": str(width), "cy": str(height)})
    geom = ET.SubElement(sp_pr, q("prstGeom", A_NS), {"prst": geometry})
    ET.SubElement(geom, q("avLst", A_NS))
    if fill:
        set_solid_fill(sp_pr, fill)
    else:
        ET.SubElement(sp_pr, q("noFill", A_NS))
    set_line(sp_pr, line)
    tx = ET.SubElement(sp, q("txBody", P_NS))
    body_pr = ET.SubElement(tx, q("bodyPr", A_NS), {"anchor": "ctr", "lIns": "45720", "rIns": "45720", "tIns": "22860", "bIns": "22860"})
    body_pr.set("wrap", "square")
    ET.SubElement(tx, q("lstStyle", A_NS))
    p = ET.SubElement(tx, q("p", A_NS))
    p_pr = ET.SubElement(p, q("pPr", A_NS), {"algn": text_align})
    if text:
        r = ET.SubElement(p, q("r", A_NS))
        rpr = ET.SubElement(r, q("rPr", A_NS), {"lang": "en-US", "sz": str(text_size)})
        set_font(rpr, "Aptos", text_size)
        set_text_color(rpr, text_color)
        ET.SubElement(r, q("t", A_NS)).text = text
    ET.SubElement(p, q("endParaRPr", A_NS), {"lang": "en-US"})
    sp_tree.append(sp)
    return sp


def update_theme(xml: bytes) -> bytes:
    root = ET.fromstring(xml)
    clr_scheme = next((n for n in root.iter() if local_name(n.tag) == "clrScheme"), None)
    colors = {
        "dk1": NAVY,
        "lt1": WHITE,
        "dk2": SLATE,
        "lt2": "E2E8F0",
        "accent1": CYAN,
        "accent2": TEAL,
        "accent3": AMBER,
        "accent4": VIOLET,
        "accent5": GREEN,
        "accent6": "F43F5E",
        "hlink": "0284C7",
        "folHlink": "7C3AED",
    }
    if clr_scheme is not None:
        for name, value in colors.items():
            node = first(clr_scheme, name)
            if node is None:
                node = ET.SubElement(clr_scheme, q(name, A_NS))
            for child_node in list(node):
                node.remove(child_node)
            ET.SubElement(node, q("srgbClr", A_NS), {"val": value})
    font_scheme = next((n for n in root.iter() if local_name(n.tag) == "fontScheme"), None)
    if font_scheme is not None:
        for section in ("majorFont", "minorFont"):
            part = first(font_scheme, section)
            if part is not None:
                latin = first(part, "latin")
                if latin is not None:
                    latin.set("typeface", "Aptos Display" if section == "majorFont" else "Aptos")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def style_slide(xml: bytes, slide_number: int, total_slides: int) -> bytes:
    root = ET.fromstring(xml)
    c_sld = first(root, "cSld")
    if c_sld is None:
        return xml
    sp_tree = first(c_sld, "spTree")
    if sp_tree is None:
        return xml
    is_title = slide_number == 1
    set_background(c_sld, NAVY if is_title else PAPER)

    title_shape = None
    subtitle_shape = None
    for shape in sp_tree.findall(q("sp")):
        nv = first(shape, "nvSpPr")
        ph = first(first(nv, "nvPr"), "ph") if nv is not None and first(nv, "nvPr") is not None else None
        ph_type = ph.get("type") if ph is not None else None
        if ph_type in {"ctrTitle", "title"}:
            title_shape = shape
        elif ph_type == "subTitle":
            subtitle_shape = shape

    if title_shape is not None:
        style_text_shape(title_shape, WHITE if is_title else NAVY, 3000 if is_title else 2500, "Aptos Display", True)
    if subtitle_shape is not None:
        style_text_shape(subtitle_shape, CYAN if is_title else SLATE, 1800, "Aptos", False)

    for shape in sp_tree.findall(q("sp")):
        nv = first(shape, "nvSpPr")
        nv_pr = first(nv, "nvPr") if nv is not None else None
        ph = first(nv_pr, "ph") if nv_pr is not None else None
        if ph is None or ph.get("type") in {"ctrTitle", "title", "subTitle"}:
            continue
        if ph.get("type") in {"dt", "ftr", "sldNum"}:
            style_text_shape(shape, "CBD5E1" if is_title else MUTED, 900, "Aptos", False)
        elif ph.get("idx") == "1":
            style_text_shape(shape, "E2E8F0" if is_title else SLATE, 1550, "Aptos", False)

    if is_title:
        add_shape(sp_tree, "Cover accent bar", 650000, 1450000, 90000, 1480000, CYAN, None, "rect")
        add_shape(sp_tree, "Cover accent dot", 7940000, 1160000, 220000, 220000, TEAL, None, "ellipse")
        add_shape(sp_tree, "Cover accent dot amber", 8290000, 1510000, 140000, 140000, AMBER, None, "ellipse")
        add_shape(sp_tree, "Cover footer", 600000, 6250000, 8200000, 360000, None, None, "rect", "OPSDESK  /  DEVSECOPS CAPSTONE  /  LIVE CLASSROOM DEPLOYMENT", "CBD5E1", 900, "l")
    else:
        add_shape(sp_tree, "Top accent", 0, 0, SLIDE_WIDTH, 76000, CYAN, None, "rect")
        add_shape(sp_tree, "Title accent", 457200, 1010000, 720000, 52000, TEAL, None, "roundRect")
        add_shape(sp_tree, "Footer rule", 457200, 6440000, 8229600, 14000, "CBD5E1", None, "rect")
        add_shape(sp_tree, "Footer label", 457200, 6490000, 5200000, 220000, None, None, "rect", "OPSDESK  /  DEVSECOPS CAPSTONE", MUTED, 850, "l")
        add_shape(sp_tree, "Footer number", 7900000, 6490000, 1450000, 220000, None, None, "rect", f"{slide_number - 1:02d}  /  {total_slides - 1:02d}", MUTED, 850, "r")

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def style_deck(source: Path, destination: Path) -> None:
    with ZipFile(source, "r") as source_zip:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with ZipFile(destination, "w", compression=ZIP_DEFLATED) as target_zip:
            slide_names = sorted(
                (name for name in source_zip.namelist() if name.startswith("ppt/slides/slide") and name.endswith(".xml")),
                key=lambda name: int(re.search(r"slide(\d+)\.xml$", name).group(1)),
            )
            total = len(slide_names)
            for name in source_zip.namelist():
                payload = source_zip.read(name)
                if name == "ppt/theme/theme1.xml":
                    payload = update_theme(payload)
                elif name in slide_names:
                    number = int(re.search(r"slide(\d+)\.xml$", name).group(1))
                    payload = style_slide(payload, number, total)
                target_zip.writestr(name, payload)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    style_deck(args.source, args.destination)


if __name__ == "__main__":
    main()

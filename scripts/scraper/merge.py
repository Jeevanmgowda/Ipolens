"""Merge NSE, BSE and GMP scrape results into a single data/ipos.json feed."""
import argparse
import datetime
import json
import os
import re
import sys

# Ensure this directory is in Python path for direct or module execution
sys.path.insert(0, os.path.dirname(__file__))

import bse
import gmp
import nse
from common import normalize_name, utcnow_iso

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_OUT = os.path.join(PROJECT_ROOT, "data", "ipos.json")
FALLBACK_OUT = os.path.join(os.path.dirname(__file__), "..", "data", "ipos.json")


def _parse_price_band(text):
    if not text:
        return None
    text = str(text).replace("Rs.", "").replace("₹", "").replace(",", "")
    parts = [p.strip() for p in text.replace(" to ", "-").split("-") if p.strip()]
    try:
        if len(parts) == 2:
            return {"min": float(parts[0]), "max": float(parts[1])}
        if len(parts) == 1:
            return {"min": float(parts[0]), "max": float(parts[0])}
    except ValueError:
        pass
    return None


def _nse_date(text):
    # e.g. "16-Sep-2026" -> "2026-09-16"
    if not text:
        return None
    try:
        return datetime.datetime.strptime(text.strip(), "%d-%b-%Y").strftime("%Y-%m-%d")
    except ValueError:
        return text.strip() if re.match(r"^\d{4}-\d{2}-\d{2}$", text.strip()) else None


def _bse_date(text):
    # e.g. "2026-09-15T00:00:00" -> "2026-09-15"
    if not text:
        return None
    return text.split("T")[0]


def _derive_ticker(name: str) -> str:
    if not name:
        return "IPO"
    clean = re.sub(r"\b(limited|ltd|private|pvt|india|holdings|services|solutions)\b\.?", "", name, flags=re.I).strip()
    words = [w for w in re.split(r"[\s\-_]+", clean) if w]
    if not words:
        return re.sub(r"[^A-Za-z0-9]", "", name).upper()[:8] or "IPO"
    if len(words) == 1:
        return re.sub(r"[^A-Za-z0-9]", "", words[0]).upper()[:10]
    w1 = re.sub(r"[^A-Za-z0-9]", "", words[0])[:6]
    w2 = re.sub(r"[^A-Za-z0-9]", "", words[1])[:4]
    return (w1 + w2).upper()


def _record():
    return {
        "symbol": None,
        "companyName": None,
        "normalizedName": None,
        "platform": None,  # "SME" | "Mainboard" | None
        "series": "EQ",
        "exchanges": set(),
        "status": None,
        "openDate": None,
        "closeDate": None,
        "listingDate": None,
        "priceBand": None,
        "lotSize": None,
        "faceValue": None,
        "issueSize": None,
        "gmp": None,
        "nse": None,
        "bse": None,
    }


def build_merged(nse_data: dict, bse_data: dict, gmp_data: dict) -> tuple[list, list]:
    by_key = {}

    def get_or_create(name):
        key = normalize_name(name)
        if not key:
            return None, None
        if key not in by_key:
            rec = _record()
            rec["companyName"] = name.strip() if name else ""
            rec["normalizedName"] = key
            by_key[key] = rec
        return key, by_key[key]

    # NSE Upcoming Issues
    for row in nse_data.get("upcoming", []):
        name = row.get("companyName") or row.get("company")
        key, rec = get_or_create(name)
        if not rec:
            continue
        rec["exchanges"].add("NSE")
        rec["nse"] = row
        rec["symbol"] = rec["symbol"] or row.get("symbol") or row.get("issueSymbol")
        rec["openDate"] = rec["openDate"] or _nse_date(
            row.get("issueStartDate") or row.get("ipoStartDate")
        )
        rec["closeDate"] = rec["closeDate"] or _nse_date(
            row.get("issueEndDate") or row.get("ipoEndDate")
        )
        if rec["priceBand"] is None:
            rec["priceBand"] = _parse_price_band(
                row.get("issuePrice") or row.get("priceRange")
            )
        if "SME" in (row.get("series") or ""):
            rec["platform"] = "SME"
            rec["series"] = "SME"
        rec["status"] = rec["status"] or "upcoming"

    # NSE Current Issues
    for row in nse_data.get("current", []):
        name = row.get("companyName") or row.get("company")
        key, rec = get_or_create(name)
        if not rec:
            continue
        rec["exchanges"].add("NSE")
        rec["nse"] = row
        rec["symbol"] = rec["symbol"] or row.get("symbol") or row.get("issueSymbol")
        rec["status"] = "open"
        rec["openDate"] = rec["openDate"] or _nse_date(
            row.get("issueStartDate") or row.get("ipoStartDate")
        )
        rec["closeDate"] = rec["closeDate"] or _nse_date(
            row.get("issueEndDate") or row.get("ipoEndDate")
        )
        if rec["priceBand"] is None:
            rec["priceBand"] = _parse_price_band(
                row.get("issuePrice") or row.get("priceRange")
            )
        if "SME" in (row.get("series") or ""):
            rec["platform"] = "SME"
            rec["series"] = "SME"

    # NSE Past Issues (closed / listed)
    for row in nse_data.get("past", []):
        name = row.get("companyName") or row.get("company")
        key, rec = get_or_create(name)
        if not rec:
            continue
        rec["exchanges"].add("NSE")
        rec["nse"] = row
        rec["symbol"] = rec["symbol"] or row.get("symbol") or row.get("issueSymbol")
        rec["openDate"] = rec["openDate"] or _nse_date(row.get("issueStartDate"))
        rec["closeDate"] = rec["closeDate"] or _nse_date(row.get("issueEndDate"))
        rec["status"] = rec["status"] or "closed"

    # BSE Issues (flag=1 returns active, recent, and forthcoming)
    for row in bse_data.get("issues", []):
        name = row.get("Scrip_Name") or row.get("short_name")
        key, rec = get_or_create(name)
        if not rec:
            continue
        rec["exchanges"].add("BSE")
        rec["bse"] = row
        rec["symbol"] = rec["symbol"] or row.get("Security_Id") or row.get("Scrip_Cd")
        is_sme = row.get("eXCHANGE_PLATFORM") == "SME"
        rec["platform"] = rec["platform"] or ("SME" if is_sme else "Mainboard")
        if is_sme:
            rec["series"] = "SME"
        rec["openDate"] = rec["openDate"] or _bse_date(row.get("Start_Dt"))
        rec["closeDate"] = rec["closeDate"] or _bse_date(row.get("End_Dt"))
        rec["faceValue"] = rec["faceValue"] or row.get("Face_Val")
        if rec["priceBand"] is None:
            rec["priceBand"] = _parse_price_band(row.get("Price_Band"))
        if row.get("Status") == "F":
            rec["status"] = rec["status"] or "upcoming"
        elif row.get("Status") == "L":
            rec["status"] = rec["status"] or "open"

    # GMP Data
    unmatched_gmp = []
    for row in gmp_data.get("gmp", []):
        raw_name = row.get("companyName") or ""
        key = normalize_name(raw_name)
        rec = by_key.get(key)
        if rec is None:
            candidates = [k for k in by_key if k.startswith(key) or key.startswith(k)]
            rec = by_key[candidates[0]] if len(candidates) == 1 else None
        if rec is None:
            unmatched_gmp.append(raw_name)
            continue
        rec["gmp"] = row
        rec["status"] = row.get("status") or rec["status"]
        if row.get("category") == "SME":
            rec["platform"] = "SME"
            rec["series"] = "SME"
        rec["listingDate"] = rec["listingDate"] or row.get("listingDate")
        rec["issueSize"] = rec["issueSize"] or row.get("issueSize")
        rec["lotSize"] = rec["lotSize"] or row.get("lotSize")

    today_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")

    for rec in by_key.values():
        rec["exchanges"] = sorted(list(rec["exchanges"]))
        if not rec["symbol"]:
            rec["symbol"] = _derive_ticker(rec["companyName"])

        # Auto-resolve lifecycle status based on dates if ambiguous
        if not rec["status"]:
            if rec["openDate"] and today_str < rec["openDate"]:
                rec["status"] = "upcoming"
            elif rec["openDate"] and rec["closeDate"] and rec["openDate"] <= today_str <= rec["closeDate"]:
                rec["status"] = "open"
            elif rec["closeDate"] and today_str > rec["closeDate"]:
                if rec["listingDate"] and today_str >= rec["listingDate"]:
                    rec["status"] = "listed"
                else:
                    rec["status"] = "closed"
            else:
                rec["status"] = "upcoming"

    return list(by_key.values()), unmatched_gmp


def _trim(rec: dict) -> dict:
    gmp_row = rec.get("gmp")
    return {
        "symbol": rec.get("symbol") or _derive_ticker(rec["companyName"]),
        "companyName": rec["companyName"],
        "normalizedName": rec["normalizedName"],
        "platform": rec["platform"] or "Mainboard",
        "series": rec.get("series") or ("SME" if rec.get("platform") == "SME" else "EQ"),
        "exchanges": rec["exchanges"],
        "status": rec["status"] or "upcoming",
        "openDate": rec["openDate"],
        "closeDate": rec["closeDate"],
        "listingDate": rec["listingDate"],
        "priceBand": rec["priceBand"],
        "lotSize": rec["lotSize"],
        "faceValue": rec["faceValue"],
        "issueSize": rec["issueSize"],
        "gmp": gmp_row["gmp"] if gmp_row else None,
        "subscriptionTimes": gmp_row.get("subscriptionTimes") if gmp_row else None,
    }


def run(out_path: str = DEFAULT_OUT, months_back: int = 1, open_only: bool = False):
    nse_data = nse.fetch_all(months_back=months_back)
    bse_data = bse.fetch_all()
    gmp_data = gmp.fetch_all()

    ipos, _unmatched_gmp = build_merged(nse_data, bse_data, gmp_data)

    if open_only:
        ipos = [r for r in ipos if r["status"] in ("open", "upcoming")]

    ipos.sort(key=lambda r: (r["openDate"] or "9999-99-99", r["companyName"] or ""))
    trimmed = [_trim(r) for r in ipos]

    output = {
        "generatedAt": utcnow_iso(),
        "totalCount": len(trimmed),
        "summary": {
            "open": len([r for r in trimmed if r["status"] == "open"]),
            "upcoming": len([r for r in trimmed if r["status"] == "upcoming"]),
            "closed": len([r for r in trimmed if r["status"] == "closed"]),
            "listed": len([r for r in trimmed if r["status"] == "listed"]),
        },
        "ipos": trimmed,
    }

    # Safeguard: if network scrape returned 0 items due to offline/blocked environment
    # and the file already exists with items, do not overwrite valid records with empty data
    if len(trimmed) == 0 and os.path.exists(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as existing_f:
                existing_data = json.load(existing_f)
                if len(existing_data.get("ipos", [])) > 0:
                    print(f"Preserving existing data at {out_path} ({len(existing_data['ipos'])} IPOs) as new scrape returned 0 items.")
                    return existing_data
        except Exception:
            pass

    for dest in {out_path, FALLBACK_OUT}:
        try:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2, ensure_ascii=False, default=str)
        except Exception as e:
            print(f"Warning: Could not write to {dest}: {e}")

    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge NSE, BSE and GMP scraper feeds")
    parser.add_argument("--out", default=DEFAULT_OUT, help="Output JSON path")
    parser.add_argument("--months", type=int, default=1, help="Months of past issues to query from NSE")
    parser.add_argument("--open-only", action="store_true", help="Only retain open/upcoming issues")
    args = parser.parse_args()

    result = run(args.out, months_back=args.months, open_only=args.open_only)
    print(f"Wrote {args.out}: total={result.get('totalCount', len(result.get('ipos', [])))} (open={result.get('summary', {}).get('open', 0)}, upcoming={result.get('summary', {}).get('upcoming', 0)})")

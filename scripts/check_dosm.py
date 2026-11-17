"""Weekly check for new DOSM (OpenDOSM) data.  Stage 1 of the DOSM automation.

1. Auto-ingest datasets (the 15 CSVs the site is built from): downloads each one, compares
   its latest `date` with the copy in dosm/, and saves a newer file over the local copy.
2. Watchlist (scripts/watchlist.json): extra releases (Excel/PDF downloaded by hand).
   NOTIFY-ONLY: a changed fingerprint is reported, nothing is downloaded.
3. --simulate: fakes one newer month for formal_wages_state (copies the latest month's rows
   to the next month) so the whole pipeline can be tested without waiting for DOSM.
   --simulate-bad: same, but also drops the wages_median column (validation must FAIL).

Writes dosm_check.md (Markdown summary) and dosm_check.json into $DOSM_OUT (default: repo root), and sets GitHub Actions outputs:
  changed=true|false   changed_list=a,b   watch_alert=true|false   simulated=true|false
Standard library only.
"""
import argparse
import csv
import hashlib
import io
import json
import os
import sys
import urllib.request

BASE = "https://storage.dosm.gov.my"
DATASETS = {
    "gdp_state_real_supply": "gdp", "cpi_2d_state": "cpi", "cpi_2d_state_inflation": "cpi",
    "lfs_state_sex": "labour", "wages_state": "labour", "wages_sector": "labour", "wages_industry": "labour",
    "wages_skill": "labour", "wages_education": "labour", "formal_wages_state": "labour",
    "formal_wages_msic": "labour", "formal_wages_band": "labour", "productivity_annual": "labour",
    "hies_state": "hies", "hies_state_percentile": "hies",
}
SIM_DATASET = "formal_wages_state"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL = os.path.join(HERE, "dosm")
UA = {"User-Agent": "sppe-intelligence-dosm-check/1.0"}


def latest(text):
    rows = csv.DictReader(io.StringIO(text))
    dates = [r.get("date") for r in rows if r.get("date")]
    return max(dates) if dates else None


def fetch(url, method="GET", timeout=60):
    req = urllib.request.Request(url, method=method, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read() if method == "GET" else b"", {k.lower(): v for k, v in r.headers.items()}


def next_month(d):
    y, m = int(d[:4]), int(d[5:7])
    y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return "%04d-%02d-01" % (y, m)


def simulate(path, bad=False):
    """Append a fake next month to a monthly CSV (copy of the latest month). Returns (old, new) latest."""
    with open(path, encoding="utf-8", newline="") as f:
        rd = csv.DictReader(f)
        cols, rows = list(rd.fieldnames), list(rd)
    top = max(r["date"] for r in rows)
    nxt = next_month(top)
    rows += [dict(r, date=nxt) for r in rows if r["date"] == top]
    if bad:
        cols = [c for c in cols if c != "wages_median"]
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    return top, nxt


def md5(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def check_watchlist(path):
    """Return list of dicts: id, name, status (NEW|ok|not set up|error|baseline), detail."""
    if not os.path.exists(path):
        return []
    out = []
    for s in json.load(open(path, encoding="utf-8")).get("sources", []):
        item = {"id": s.get("id"), "name": s.get("name"), "url": s.get("url"), "status": "ok", "detail": ""}
        out.append(item)
        if not s.get("url"):
            item["status"], item["detail"] = "not set up", "no url in scripts/watchlist.json"
            continue
        try:
            try:
                _, h = fetch(s["url"], "HEAD", 30)
            except Exception:  # some servers refuse HEAD
                _, h = fetch(s["url"], "GET", 60)
        except Exception as e:
            item["status"], item["detail"] = "error", "could not reach (%s)" % e.__class__.__name__
            continue
        etag = (h.get("etag") or "").strip('"').replace("W/", "").strip('"')
        lm = h.get("last-modified") or ""
        fp = etag or lm
        item["fingerprint"], item["last_modified"] = fp, lm
        local = os.path.join(LOCAL, s["local"]) if s.get("local") else None
        if s.get("known"):
            same = s["known"] in (etag, lm)
            item["status"] = "ok" if same else "NEW"
            item["detail"] = "matches known fingerprint" if same else "server now %s (known %s)" % (fp, s["known"])
        elif local and os.path.exists(local) and len(etag) == 32 and all(c in "0123456789abcdef" for c in etag):
            same = md5(local) == etag
            item["status"] = "ok" if same else "NEW"
            item["detail"] = "same as dosm/%s" % s["local"] if same else "differs from dosm/%s (published %s)" % (s["local"], lm)
        else:
            item["status"] = "baseline"
            item["detail"] = "current fingerprint %s; paste it into `known` once you have this version" % (fp or "(none)")
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--simulate", action="store_true", help="fake a newer month for %s" % SIM_DATASET)
    ap.add_argument("--simulate-bad", action="store_true", help="like --simulate, and drop a required column")
    ap.add_argument("--skip-download", action="store_true", help="do not contact OpenDOSM (offline tests)")
    ap.add_argument("--watchlist", default=os.path.join(HERE, "scripts", "watchlist.json"))
    a = ap.parse_args(argv)

    lines, changed, failed, info = [], [], [], {}
    for name, folder in DATASETS.items():
        path = os.path.join(LOCAL, name + ".csv")
        old = latest(open(path, encoding="utf-8").read()) if os.path.exists(path) else None
        if a.skip_download:
            lines.append(f"| {name} | {old or '–'} | – | not checked |")
            continue
        try:
            raw, _ = fetch(f"{BASE}/{folder}/{name}.csv")
            remote = raw.decode("utf-8")
        except Exception as e:  # keep checking the others
            failed.append(name)
            lines.append(f"| {name} | {old or '–'} | – | could not download ({e.__class__.__name__}) |")
            continue
        new = latest(remote)
        if new and (old is None or new > old):
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(remote)
            changed.append(name)
            status = "**NEW**"
        else:
            status = "up to date"
        info[name] = {"old": old, "new": new}
        lines.append(f"| {name} | {old or '–'} | {new or '–'} | {status} |")

    simulated = a.simulate or a.simulate_bad
    if simulated:
        old, new = simulate(os.path.join(LOCAL, SIM_DATASET + ".csv"), bad=a.simulate_bad)
        if SIM_DATASET not in changed:
            changed.append(SIM_DATASET)
        lines = [l for l in lines if not l.startswith(f"| {SIM_DATASET} |")]
        lines.append(f"| {SIM_DATASET} | {old} | {new} | **NEW (SIMULATED{' + dropped column' if a.simulate_bad else ''})** |")

    watch = check_watchlist(a.watchlist)
    alerts = [w for w in watch if w["status"] == "NEW"]

    summary = ["# DOSM data check", ""]
    if simulated:
        summary += ["> **TEST RUN** — `%s` was given a fake extra month by `simulate_new_data`. Do not merge data from this run into main." % SIM_DATASET, ""]
    summary += ["## Auto-ingested datasets (OpenDOSM CSV)", "", "| Dataset | In repo | On OpenDOSM | Status |", "|---|---|---|---|", *lines, ""]
    summary.append(f"{len(changed)} dataset(s) have newer data: {', '.join(changed)}." if changed else "All datasets are up to date.")
    if failed:
        summary.append(f"Could not reach: {', '.join(failed)}.")
    if watch:
        summary += ["", "## Watchlist — notify only (download by hand into dosm/)", "", "| Source | Status | Detail |", "|---|---|---|"]
        summary += [f"| {w['name']} | {'**NEW**' if w['status'] == 'NEW' else w['status']} | {w['detail']} |" for w in watch]
    text = "\n".join(summary) + "\n"
    od = os.environ.get("DOSM_OUT") or HERE  # the workflow points this at $RUNNER_TEMP
    open(os.path.join(od, "dosm_check.md"), "w", encoding="utf-8").write(text)
    json.dump({"changed": changed, "failed": failed, "simulated": simulated, "watch": watch, "datasets": info},
              open(os.path.join(od, "dosm_check.json"), "w", encoding="utf-8"), indent=2)
    print(text)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")
            f.write(f"changed_list={','.join(changed)}\n")
            f.write(f"watch_alert={'true' if alerts else 'false'}\n")
            f.write(f"simulated={'true' if simulated else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

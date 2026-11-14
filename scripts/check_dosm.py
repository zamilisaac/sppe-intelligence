"""Weekly check for new DOSM (OpenDOSM) data.

Downloads each dataset the site uses, compares its latest date with the copy
in dosm/, and saves any newer file over the local copy. Writes a summary to
dosm_check.md and sets `changed=true` for GitHub Actions when something is new.
The website itself is rebuilt from these files in a separate step.
"""
import csv, io, os, sys, urllib.request

BASE = "https://storage.dosm.gov.my"
DATASETS = {
    "gdp_state_real_supply": "gdp", "cpi_2d_state": "cpi", "cpi_2d_state_inflation": "cpi",
    "lfs_state_sex": "labour", "wages_state": "labour", "wages_sector": "labour", "wages_industry": "labour",
    "wages_skill": "labour", "wages_education": "labour", "formal_wages_state": "labour",
    "formal_wages_msic": "labour", "formal_wages_band": "labour", "productivity_annual": "labour",
    "hies_state": "hies", "hies_state_percentile": "hies",
}
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL = os.path.join(HERE, "dosm")


def latest(text):
    rows = csv.DictReader(io.StringIO(text))
    dates = [r.get("date") for r in rows if r.get("date")]
    return max(dates) if dates else None


def main():
    lines, changed, failed = [], [], []
    for name, folder in DATASETS.items():
        path = os.path.join(LOCAL, name + ".csv")
        try:
            with urllib.request.urlopen(f"{BASE}/{folder}/{name}.csv", timeout=60) as r:
                remote = r.read().decode("utf-8")
        except Exception as e:  # keep checking the others
            failed.append(name); lines.append(f"| {name} | – | – | could not download ({e.__class__.__name__}) |"); continue
        new = latest(remote)
        old = latest(open(path, encoding="utf-8").read()) if os.path.exists(path) else None
        if new and (old is None or new > old):
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(remote)
            changed.append(name); status = "**NEW**"
        else:
            status = "up to date"
        lines.append(f"| {name} | {old or '–'} | {new or '–'} | {status} |")
    summary = ["# DOSM data check", "", "| Dataset | In repo | On OpenDOSM | Status |", "|---|---|---|---|", *lines, ""]
    summary.append(f"{len(changed)} dataset(s) have newer data: {', '.join(changed)}." if changed else "All datasets are up to date.")
    if failed:
        summary.append(f"Could not reach: {', '.join(failed)}.")
    open(os.path.join(HERE, "dosm_check.md"), "w", encoding="utf-8").write("\n".join(summary) + "\n")
    print("\n".join(summary))
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

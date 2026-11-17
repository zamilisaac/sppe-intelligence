"""Radar Data: persistent monitoring log for the website.

Every DOSM check (Stage 1/2) and every deploy report (Stage 3) appends what actually happened to
radar/log.json on the `radar-log` branch. The website's /api/radar function reads that file, so the
Radar Data page and the notification bell show real monitoring records (with their audit trail).

The branch never touches main: commits carry [skip ci] and the file lives outside website/, so no
site rebuild is triggered. Git history of the branch is the audit trail.

  python scripts/radar_record.py check  --check-json $RUNNER_TEMP/dosm_check.json --validation PASS --pr-url URL
  python scripts/radar_record.py deploy --sha SHA --pr 12 --cf-state success --cf-detail "..." --cf-url URL
  python scripts/radar_record.py check --check-json x.json --dry-run        (print, do not write)
"""
import argparse
import base64
import hashlib
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dosm_github as gh  # noqa: E402  (same API helper the workflows already use)

BRANCH = 'radar-log'
PATH = 'radar/log.json'
KEEP = 400
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# which part of the website each auto-ingested dataset feeds
GROUP = {
    'gdp_state_real_supply': 'gdp', 'productivity_annual': 'prod', 'wages_state': 'wage', 'wages_sector': 'wage',
    'wages_industry': 'wage', 'wages_education': 'wage', 'wages_skill': 'wage', 'formal_wages_state': 'wage',
    'formal_wages_msic': 'wage', 'formal_wages_band': 'wage', 'lfs_state_sex': 'lab', 'cpi_2d_state': 'cpi',
    'cpi_2d_state_inflation': 'cpi', 'hies_state': 'hies', 'hies_state_percentile': 'hies',
}


def now():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def empty():
    return {'schema': 1, 'about': 'Radar Data monitoring log written by scripts/radar_record.py (do not edit by hand).',
            'updated': None, 'lastCheck': None, 'datasets': {}, 'watch': [], 'events': []}


def load():
    """Return (log, sha_of_file_or_None). Creates the branch from main when it does not exist yet."""
    ref = gh.api('GET', '/git/ref/heads/%s' % BRANCH, ok404=True)
    if not ref:
        main = gh.api('GET', '/git/ref/heads/main')
        gh.api('POST', '/git/refs', {'ref': 'refs/heads/%s' % BRANCH, 'sha': main['object']['sha']})
    f = gh.api('GET', '/contents/%s?ref=%s' % (PATH, BRANCH), ok404=True)
    if not f:
        return empty(), None
    return json.loads(base64.b64decode(f['content']).decode('utf-8')), f['sha']


def save(log, sha, msg):
    log['updated'] = now()
    log['events'] = log['events'][-KEEP:]
    body = {'message': msg + ' [skip ci]', 'branch': BRANCH,
            'content': base64.b64encode((json.dumps(log, indent=1, ensure_ascii=False) + '\n').encode()).decode()}
    if sha:
        body['sha'] = sha
    gh.api('PUT', '/contents/%s' % PATH, body)


def ev(log, kind, level, bm, en, **extra):
    e = {'id': hashlib.sha1(('%s|%s|%s|%s' % (now(), kind, bm, json.dumps(extra, sort_keys=True))).encode()).hexdigest()[:12],
         'at': now(), 'type': kind, 'level': level, 'bm': bm, 'en': en, 'run': gh.run_url() or None}
    e.update({k: v for k, v in extra.items() if v not in (None, '')})
    log['events'].append(e)
    return e


def norm(p, like):
    """Match the manifest's period style: '2025-01-01' -> '2025' (annual) or '2026-06' (monthly)."""
    if not p:
        return p
    if like and len(like) == 4:
        return p[:4]
    if like and len(like) == 7:
        return p[:7]
    return p[:7] if p.endswith('-01') is False else (p[:4] if p[5:] == '01-01' else p[:7])


def cmd_check(a, log):
    chk = json.load(open(a.check_json, encoding='utf-8')) if a.check_json and os.path.exists(a.check_json) else {}
    sim = bool(chk.get('simulated'))
    tag = '[UJIAN] ' if sim else ''
    tag_en = '[TEST] ' if sim else ''
    manifest = {}
    mp = os.path.join(HERE, 'website', 'data', 'data-manifest.json')
    if os.path.exists(mp):
        manifest = json.load(open(mp, encoding='utf-8')).get('asOf', {})
    changed, failed = chk.get('changed', []), chk.get('failed', [])
    for name, info in (chk.get('datasets') or {}).items():
        d = log['datasets'].setdefault(name, {})
        like = manifest.get(name)
        info = {'old': norm(info.get('old'), like), 'new': norm(info.get('new'), like)}
        d.update({'group': GROUP.get(name), 'used': manifest.get(name) or info.get('old'), 'dosm': info.get('new'),
                  'checkedAt': now(), 'status': 'new' if name in changed else 'current'})
        if sim and name in changed:
            d['status'], d['simulated'], d['dosm'] = 'current', True, info.get('old')   # a test run never marks real data as new
        elif 'simulated' in d:
            del d['simulated']
    for name in failed:
        d = log['datasets'].setdefault(name, {'group': GROUP.get(name)})
        d.update({'checkedAt': now(), 'status': 'error'})
        ev(log, 'error', 'error', 'Gagal memuat turun %s daripada OpenDOSM.' % name, 'Could not download %s from OpenDOSM.' % name, dataset=name)
    for name in changed:
        info = (chk.get('datasets') or {}).get(name, {})
        info = {'old': norm(info.get('old'), manifest.get(name)), 'new': norm(info.get('new'), manifest.get(name))}
        ev(log, 'detected', 'test' if sim else 'new', '%sData baharu dikesan: %s (%s → %s). Pengesahan diperlukan.' % (tag, name, info.get('old') or '-', info.get('new') or '?'),
           '%sNew data detected: %s (%s → %s). Validation needed.' % (tag_en, name, info.get('old') or '-', info.get('new') or '?'), dataset=name, period=info.get('new'), simulated=sim or None)
    if a.validation:
        lvl = 'error' if a.validation == 'FAIL' else 'test' if sim else 'ok'
        ev(log, 'validated', lvl, '%sPengesahan data: %s.' % (tag, a.validation), '%sData validation: %s.' % (tag_en, a.validation), status=a.validation, simulated=sim or None)
    if a.pr_url:
        ev(log, 'pr', 'test' if sim else 'pending', '%sPull Request GitHub telah dijana dan menunggu kelulusan.' % tag,
           '%sGitHub pull request created and awaiting approval.' % tag_en, url=a.pr_url, simulated=sim or None)
        for name in changed:
            if not sim:
                log['datasets'].setdefault(name, {})['status'] = 'pending'
    elif changed and a.validation and a.validation != 'FAIL':
        ev(log, 'error', 'error', '%sData disahkan tetapi Pull Request tidak dapat dibuka.' % tag, '%sData validated but the pull request could not be opened.' % tag_en, simulated=sim or None)
    alerts = [w for w in chk.get('watch', []) if w.get('status') == 'NEW']
    log['watch'] = [{k: w.get(k) for k in ('id', 'name', 'url', 'status', 'detail')} for w in chk.get('watch', [])]
    for w in alerts:
        ev(log, 'watch', 'new', 'Keluaran DOSM berubah (muat turun manual): %s.' % w.get('name'), 'DOSM release changed (manual download): %s.' % w.get('name'), url=w.get('url'))
    log['lastCheck'] = {'at': now(), 'run': gh.run_url() or None, 'changed': changed, 'failed': failed, 'simulated': sim, 'validation': a.validation or None, 'pr': a.pr_url or None}
    ev(log, 'check', 'info', '%sSemakan DOSM selesai: %d data baharu, %d gagal dicapai.' % (tag, len(changed), len(failed)),
       '%sDOSM check finished: %d new, %d unreachable.' % (tag_en, len(changed), len(failed)), simulated=sim or None)


def cmd_deploy(a, log):
    pr = int(a.pr) if a.pr else None
    if pr:
        ev(log, 'merged', 'ok', 'Pull Request #%d telah digabungkan ke main.' % pr, 'Pull request #%d was merged into main.' % pr, pr=pr, sha=a.sha)
    ok = a.cf_state == 'success'
    ev(log, 'deployed' if ok else 'error', 'ok' if ok else 'error',
       'Penerbitan Cloudflare berjaya untuk %s. Data laman dikemas kini.' % a.sha[:7] if ok else 'Penerbitan Cloudflare %s untuk %s.' % (a.cf_state, a.sha[:7]),
       'Cloudflare deployment succeeded for %s. Site data updated.' % a.sha[:7] if ok else 'Cloudflare deployment %s for %s.' % (a.cf_state, a.sha[:7]),
       sha=a.sha, pr=pr, url=a.cf_url, detail=a.cf_detail, ref=a.ref)
    if ok and a.ref == 'main':
        mp = os.path.join(HERE, 'website', 'data', 'data-manifest.json')
        asof = json.load(open(mp, encoding='utf-8')).get('asOf', {}) if os.path.exists(mp) else {}
        for name, d in log['datasets'].items():
            if name in asof:
                d['used'] = asof[name]
                if d.get('status') in ('pending', 'new') and d.get('dosm') and asof[name] >= d['dosm']:
                    d['status'], d['updatedAt'] = 'updated', now()


def main(argv=None):
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    p = sp.add_parser('check'); p.add_argument('--check-json'); p.add_argument('--validation', default=''); p.add_argument('--pr-url', default='')
    p = sp.add_parser('deploy'); p.add_argument('--sha', required=True); p.add_argument('--pr', default=''); p.add_argument('--ref', default='')
    p.add_argument('--cf-state', default='none'); p.add_argument('--cf-detail', default=''); p.add_argument('--cf-url', default='')
    for p in sp.choices.values():
        p.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(argv)
    if a.dry_run:
        log, sha = empty(), None
    else:
        log, sha = load()
    (cmd_check if a.cmd == 'check' else cmd_deploy)(a, log)
    if a.dry_run:
        print(json.dumps(log, indent=1, ensure_ascii=False))
        return
    save(log, sha, 'Radar: %s %s' % (a.cmd, now()))
    gh.summary('Radar Data log updated on branch `%s` (%d events).' % (BRANCH, len(log['events'])))


if __name__ == '__main__':
    main()

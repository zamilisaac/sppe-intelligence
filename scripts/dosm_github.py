"""GitHub + notification helper for the DOSM workflows. Standard library only.

Uses GITHUB_TOKEN (or GH_TOKEN), GITHUB_REPOSITORY and GITHUB_API_URL from the Actions environment.

Subcommands
  issue          open, or update (no duplicates), the single open issue labelled dosm-update
  pr             open, or update, the pull request for a dosm-update/* branch and request review
  notify-extra   post to Microsoft Teams / e-mail when the optional secrets exist; skip silently otherwise
  pr-for-commit  find the merged pull request a commit belongs to
  wait-cloudflare  wait for the Cloudflare Pages check/status on a commit and report the result
  comment        comment on an issue or pull request
  close-issues   comment on and close the open dosm-update issue(s)
  record-deploy  append a deployment entry to website/data/data-manifest.json
Each subcommand writes key=value lines to $GITHUB_OUTPUT and notes to $GITHUB_STEP_SUMMARY.
"""
import argparse
import json
import os
import smtplib
import ssl
import sys
import time
import urllib.error
import urllib.request
from email.message import EmailMessage

LABEL = 'dosm-update'
OWNER_LOGIN = 'zamilisaac'


def api(method, path, body=None, ok404=False):
    base = os.environ.get('GITHUB_API_URL', 'https://api.github.com')
    repo = os.environ['GITHUB_REPOSITORY']
    url = path if path.startswith('http') else '%s/repos/%s%s' % (base, repo, path)
    tok = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'Bearer %s' % tok, 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sppe-dosm-automation'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        if ok404 and e.code == 404:
            return None
        msg = e.read().decode(errors='replace')
        raise SystemExit('GitHub API %s %s failed: %s %s' % (method, path, e.code, msg[:500]))


def out(**kw):
    p = os.environ.get('GITHUB_OUTPUT')
    for k, v in kw.items():
        print('%s=%s' % (k, v))
        if p:
            with open(p, 'a') as f:
                f.write('%s=%s\n' % (k, v))


def summary(text):
    print(text)
    p = os.environ.get('GITHUB_STEP_SUMMARY')
    if p:
        with open(p, 'a') as f:
            f.write(text + '\n')


def read(path):
    return open(path, encoding='utf-8').read() if path else ''


def ensure_label():
    if api('GET', '/labels/' + LABEL, ok404=True) is None:
        api('POST', '/labels', {'name': LABEL, 'color': 'c2185b', 'description': 'New DOSM data / DOSM automation'})


def open_issues():
    return [i for i in api('GET', '/issues?state=open&labels=%s&per_page=50' % LABEL) if 'pull_request' not in i]


def cmd_issue(a):
    ensure_label()
    body = read(a.body_file)
    mention = '@%s ' % OWNER_LOGIN
    full = '%s\n\n---\n%s please review. _Updated by the DOSM workflow run %s._\n' % (body, mention, run_url())
    found = open_issues()
    if found:
        i = found[0]
        api('PATCH', '/issues/%d' % i['number'], {'title': a.title, 'body': full})
        # a comment (not the body edit) is what sends the e-mail notification
        api('POST', '/issues/%d/comments' % i['number'], {'body': '%s%s\n\n%s' % (mention, a.comment or 'This issue was updated by a new DOSM check.', run_url())})
        summary('Updated existing issue #%d: %s' % (i['number'], i['html_url']))
    else:
        i = api('POST', '/issues', {'title': a.title, 'body': full, 'labels': [LABEL]})
        summary('Opened issue #%d: %s' % (i['number'], i['html_url']))
    out(issue_number=i['number'], issue_url=i['html_url'])


def cmd_pr(a):
    owner = os.environ['GITHUB_REPOSITORY'].split('/')[0]
    body = read(a.body_file)
    existing = api('GET', '/pulls?state=open&head=%s:%s' % (owner, a.head))
    if existing:
        pr = existing[0]
        api('PATCH', '/pulls/%d' % pr['number'], {'title': a.title, 'body': body})
        summary('Updated existing pull request #%d: %s' % (pr['number'], pr['html_url']))
    else:
        base = os.environ.get('GITHUB_API_URL', 'https://api.github.com')
        url = '%s/repos/%s/pulls' % (base, os.environ['GITHUB_REPOSITORY'])
        try:
            pr = api('POST', url, {'title': a.title, 'head': a.head, 'base': a.base, 'body': body, 'maintainer_can_modify': True})
        except SystemExit as e:
            summary('Could not open the pull request: %s\n\nMost likely cause: Settings > Actions > General > '
                    '"Allow GitHub Actions to create and approve pull requests" is off.' % e)
            out(pr_created='false')
            return 3
        summary('Opened pull request #%d: %s' % (pr['number'], pr['html_url']))
    try:
        api('POST', '/issues/%d/labels' % pr['number'], {'labels': [LABEL]})
        if a.reviewer:
            api('POST', '/pulls/%d/requested_reviewers' % pr['number'], {'reviewers': [a.reviewer]})
    except SystemExit as e:  # e.g. reviewer is the PR author; keep the PR
        summary('Note: could not add label/reviewer: %s' % e)
    out(pr_created='true', pr_number=pr['number'], pr_url=pr['html_url'])
    return 0


def cmd_notify_extra(a):
    body = read(a.body_file)
    hook = os.environ.get('TEAMS_WEBHOOK_URL', '').strip()
    if hook:
        card = {'type': 'message', 'attachments': [{'contentType': 'application/vnd.microsoft.card.adaptive', 'content': {
            '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json', 'type': 'AdaptiveCard', 'version': '1.4',
            'body': [{'type': 'TextBlock', 'size': 'Medium', 'weight': 'Bolder', 'text': a.subject, 'wrap': True},
                     {'type': 'TextBlock', 'text': (a.link or '') + '\n\n' + body[:3500], 'wrap': True}]}}]}
        try:
            req = urllib.request.Request(hook, data=json.dumps(card).encode(), headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=30).read()
            summary('Teams: message posted.')
        except Exception as e:
            summary('Teams: posting failed (%s). The GitHub issue is still the main notice.' % e.__class__.__name__)
    else:
        summary('Teams: skipped (secret TEAMS_WEBHOOK_URL not set).')
    host, user, pw, to = (os.environ.get(k, '').strip() for k in ('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO'))
    if host and user and pw and to:
        try:
            m = EmailMessage()
            m['Subject'], m['From'], m['To'] = a.subject, user, to
            m.set_content(((a.link + '\n\n') if a.link else '') + body)
            port = int(os.environ.get('SMTP_PORT') or 587)
            if port == 465:
                with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=30) as s:
                    s.login(user, pw); s.send_message(m)
            else:
                with smtplib.SMTP(host, port, timeout=30) as s:
                    s.starttls(context=ssl.create_default_context()); s.login(user, pw); s.send_message(m)
            summary('E-mail: sent to MAIL_TO.')
        except Exception as e:
            summary('E-mail: sending failed (%s). The GitHub issue is still the main notice.' % e.__class__.__name__)
    else:
        summary('E-mail: skipped (SMTP_HOST / SMTP_USER / SMTP_PASS / MAIL_TO not all set).')


def cmd_pr_for_commit(a):
    prs = api('GET', '/commits/%s/pulls' % a.sha) or []
    prs = [p for p in prs if p.get('merged_at')] or prs
    if not prs:
        out(pr_number='', pr_url='', pr_head='')
        summary('No pull request is linked to commit %s (direct push).' % a.sha[:7])
        return
    p = prs[0]
    out(pr_number=p['number'], pr_url=p['html_url'], pr_head=p['head']['ref'])


def cloudflare_state(sha):
    """Return (state, detail, url): state in success|failure|pending|none."""
    runs = (api('GET', '/commits/%s/check-runs?per_page=100' % sha) or {}).get('check_runs', [])
    for r in runs:
        app = (r.get('app') or {}).get('slug', '')
        if 'cloudflare' in app.lower() or 'cloudflare' in r.get('name', '').lower():
            if r['status'] != 'completed':
                return 'pending', '%s: %s' % (r['name'], r['status']), r.get('details_url') or r.get('html_url')
            ok = r.get('conclusion') in ('success', 'neutral', 'skipped')
            return ('success' if ok else 'failure'), '%s: %s' % (r['name'], r.get('conclusion')), r.get('details_url') or r.get('html_url')
    st = (api('GET', '/commits/%s/status' % sha) or {}).get('statuses', [])
    for s in st:
        if 'cloudflare' in s.get('context', '').lower():
            m = {'success': 'success', 'failure': 'failure', 'error': 'failure'}.get(s['state'], 'pending')
            return m, '%s: %s' % (s['context'], s['state']), s.get('target_url')
    return 'none', 'no Cloudflare Pages check or status on this commit yet', ''


def cmd_wait_cloudflare(a):
    end = time.time() + a.timeout
    state, detail, url = 'none', '', ''
    while True:
        state, detail, url = cloudflare_state(a.sha)
        print('%s  %s' % (time.strftime('%H:%M:%S'), detail))
        if state in ('success', 'failure') or time.time() > end:
            break
        time.sleep(a.interval)
    if state not in ('success', 'failure'):
        state = 'timeout' if state == 'pending' else 'not-found'
    summary('Cloudflare Pages for %s: **%s** (%s) %s' % (a.sha[:7], state, detail, url or ''))
    out(cf_state=state, cf_detail=detail.replace('\n', ' '), cf_url=url or '')


def cmd_comment(a):
    api('POST', '/issues/%s/comments' % a.number, {'body': read(a.body_file)})
    summary('Commented on #%s.' % a.number)


def cmd_close_issues(a):
    body = read(a.body_file)
    closed = []
    for i in open_issues():
        api('POST', '/issues/%d/comments' % i['number'], {'body': body})
        api('PATCH', '/issues/%d' % i['number'], {'state': 'closed', 'state_reason': 'completed'})
        closed.append('#%d' % i['number'])
    summary('Closed dosm-update issue(s): %s' % (', '.join(closed) or 'none open'))
    out(closed=','.join(closed))


def cmd_record_deploy(a):
    """Append a deployment entry to website/data/data-manifest.json (file only; the workflow commits it)."""
    if not os.path.exists(a.manifest):
        summary('No %s yet; deployment not recorded.' % a.manifest)
        return
    m = json.load(open(a.manifest, encoding='utf-8'))
    deps = m.setdefault('deployments', [])
    if any(d.get('sha') == a.sha for d in deps):
        summary('Deployment %s already recorded.' % a.sha[:7])
        return
    deps.append({'sha': a.sha, 'ref': a.ref, 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                 'pr': int(a.pr) if a.pr else None, 'cloudflare': a.cf_state, 'asOf': m.get('asOf', {})})
    m['deployments'] = deps[-50:]  # keep the file small
    with open(a.manifest, 'w', encoding='utf-8') as f:
        f.write(json.dumps(m, indent=2, ensure_ascii=False) + '\n')
    summary('Recorded deployment %s (Cloudflare: %s) in %s.' % (a.sha[:7], a.cf_state, a.manifest))


def run_url():
    s, r, i = (os.environ.get(k) for k in ('GITHUB_SERVER_URL', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID'))
    return '%s/%s/actions/runs/%s' % (s, r, i) if s and r and i else ''


def main(argv=None):
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    p = sp.add_parser('issue'); p.add_argument('--title', required=True); p.add_argument('--body-file', required=True); p.add_argument('--comment')
    p = sp.add_parser('pr'); p.add_argument('--head', required=True); p.add_argument('--base', default='main'); p.add_argument('--title', required=True); p.add_argument('--body-file', required=True); p.add_argument('--reviewer', default=OWNER_LOGIN)
    p = sp.add_parser('notify-extra'); p.add_argument('--subject', required=True); p.add_argument('--body-file', required=True); p.add_argument('--link')
    p = sp.add_parser('pr-for-commit'); p.add_argument('--sha', required=True)
    p = sp.add_parser('wait-cloudflare'); p.add_argument('--sha', required=True); p.add_argument('--timeout', type=int, default=1200); p.add_argument('--interval', type=int, default=30)
    p = sp.add_parser('comment'); p.add_argument('--number', required=True); p.add_argument('--body-file', required=True)
    p = sp.add_parser('close-issues'); p.add_argument('--body-file', required=True)
    p = sp.add_parser('record-deploy'); p.add_argument('--sha', required=True); p.add_argument('--ref', default=''); p.add_argument('--pr', default=''); p.add_argument('--cf-state', required=True); p.add_argument('--manifest', default='website/data/data-manifest.json')
    a = ap.parse_args(argv)
    return {'issue': cmd_issue, 'pr': cmd_pr, 'notify-extra': cmd_notify_extra, 'pr-for-commit': cmd_pr_for_commit,
            'wait-cloudflare': cmd_wait_cloudflare, 'comment': cmd_comment, 'close-issues': cmd_close_issues,
            'record-deploy': cmd_record_deploy}[a.cmd](a) or 0


if __name__ == '__main__':
    sys.exit(main())

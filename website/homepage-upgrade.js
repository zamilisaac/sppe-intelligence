/*
 * SPPE Intelligence - Homepage refinements
 * Scope: #pg-home topic cards, home data coverage, homepage footer only.
 * Install in website/index.html before </body>:
 * <script src="./homepage-upgrade.js" defer></script>
 */
(function () {
  'use strict';

  var HOME_ID = 'pg-home';
  var BM_FOOTER = 'Sumber: Jabatan Perangkaan Malaysia (DOSM), disediakan oleh Perbadanan Produktiviti Malaysia.';
  var EN_FOOTER = 'Source: Department of Statistics Malaysia (DOSM), prepared by Malaysia Productivity Corporation.';
  var previousFooter = null;
  var footerObserver = null;
  var homeObserver = null;
  var pending = false;
  var cssId = 'sppe-homepage-refinement-css';

  var icons = [
    '<rect x="3" y="11" width="4" height="10" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/>',
    '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M6 6V4h12"/><rect x="14" y="12" width="7" height="6" rx="1"/>',
    '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2M16 14a5 5 0 0 1 5.5 5v1"/>',
    '<rect x="2" y="3" width="20" height="16" rx="2"/><path d="M7 22h10M12 19v3M6 15v-3m4 3V9m4 6V7m4 8v-5"/>',
    '<path d="M6 2h9l5 5v15H6zM15 2v6h5M9 12h8M9 16h8M9 20h5"/>'
  ];

  function isEnglish() {
    var home = document.getElementById(HOME_ID);
    var title = home && home.querySelector('.topic-section-header .sec-t, .xgrid + .sec-t');
    if (title && /Explore by topic/i.test(title.textContent)) return true;
    var lang = document.querySelector('[aria-pressed="true"][data-lang]');
    if (lang) return /en/i.test(lang.getAttribute('data-lang') || '');
    return document.documentElement.lang.toLowerCase().startsWith('en');
  }

  function addStyles() {
    if (document.getElementById(cssId)) return;
    var css = `
/* Refined topics: scoped to homepage only */
#pg-home .topic-section-header{display:flex;align-items:center;flex-wrap:wrap;gap:14px 22px;margin:13px 0 14px}
#pg-home .topic-section-header .sec-t{margin:0;position:relative;padding-left:17px;font-size:clamp(20px,1.5vw,25px);line-height:1.3;letter-spacing:-.02em}
#pg-home .topic-section-header .sec-t::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:4px;border-radius:3px;background:var(--red)}
#pg-home .topic-section-desc{color:var(--muted);border-left:1px solid var(--line);padding-left:18px;line-height:1.4;font-size:13.5px;max-width:68ch}
#pg-home .xgrid{gap:14px}
#pg-home .xcard.topic-card--refined{position:relative;display:flex;flex-direction:column;gap:12px;min-height:155px;padding:17px 18px 14px;border:1px solid var(--line);border-radius:19px;box-shadow:0 5px 18px rgba(31,25,27,.055);background:var(--surface);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;overflow:hidden}
#pg-home .xcard.topic-card--refined:hover{transform:translateY(-3px);box-shadow:0 11px 27px rgba(31,25,27,.11);border-color:var(--red)}
#pg-home .xcard.topic-card--refined:focus-visible{outline:3px solid var(--red);outline-offset:3px}
#pg-home .topic-card-main{display:flex;gap:12px;align-items:flex-start;min-width:0}
#pg-home .topic-card-icon{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border-radius:12px;background:var(--red-soft);color:var(--red)}
#pg-home .topic-card-icon svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#pg-home .topic-card-content{flex:1;min-width:0}
#pg-home .topic-card-heading{display:flex;align-items:center;gap:8px;min-width:0}
#pg-home .topic-card-heading .x-n{flex:0 0 22px;width:22px;height:22px;font-size:11px;background:var(--soft);color:var(--ink)}
#pg-home .topic-card-heading h3{font-size:clamp(14px,1.06vw,17px);line-height:1.28;letter-spacing:-.02em;min-width:0}
#pg-home .topic-card-content p{display:block;color:var(--muted);font-size:12.5px;line-height:1.42;margin-top:5px;overflow-wrap:anywhere}
#pg-home .xcard.topic-card--refined .x-f{display:flex;align-items:center;gap:10px;min-width:0;margin-top:auto;padding-top:11px;border-top:1px solid var(--line)}
#pg-home .topic-card--refined .x-f>span{min-width:0;flex:0 1 auto}
#pg-home .topic-card--refined .x-f b{font-size:clamp(18px,1.42vw,23px);font-weight:800;line-height:1.15;white-space:normal;overflow-wrap:anywhere;letter-spacing:-.03em}
#pg-home .topic-card--refined .x-f>small{color:var(--muted);border-left:1px solid var(--line);padding-left:11px;font-size:12px;line-height:1.35;min-width:0;flex:1}
#pg-home .topic-card--refined .x-f i{font-size:19px;font-weight:700;display:grid;place-items:center;flex:0 0 30px;width:30px;height:30px;margin-left:auto;border-radius:50%;color:var(--red);background:var(--red-soft);transition:transform .18s ease}
#pg-home .topic-card--refined:hover .x-f i{transform:translateX(2px)}
#pg-home .xcard.topic-card--refined.x-red{background:linear-gradient(125deg,#df101b 0%,#ee1723 66%,#c80817 100%);color:#fff;border-color:transparent}
#pg-home .xcard.x-red.topic-card--refined:hover{border-color:#b90012}
#pg-home .x-red .topic-card-icon{color:#fff;background:rgba(255,255,255,.19)}
#pg-home .x-red .topic-card-heading .x-n{color:#fff;background:rgba(255,255,255,.19)}
#pg-home .x-red .topic-card-content p,#pg-home .x-red .x-f>small{color:#fff;opacity:.92}
#pg-home .xcard.x-red.topic-card--refined .x-f{border-top-color:rgba(255,255,255,.4)}
#pg-home .x-red .x-f>small{border-left-color:rgba(255,255,255,.42)}
#pg-home .x-red .x-f i{background:#fff;color:#d81120}
@media(max-width:1080px){#pg-home .xgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:680px){#pg-home .xgrid{grid-template-columns:1fr}#pg-home .topic-section-desc{border-left:0;padding-left:17px}#pg-home .xcard.topic-card--refined{min-height:0;padding:16px}#pg-home .topic-card-content p{font-size:13px}#pg-home .topic-card-heading h3{font-size:16px}}
@media(prefers-reduced-motion:reduce){#pg-home .topic-card--refined,#pg-home .topic-card--refined .x-f i{transition:none!important}}
`;
    var style = document.createElement('style');
    style.id = cssId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function refineTopics(home) {
    var grid = home.querySelector('.xgrid');
    if (!grid) return;
    var section = grid.closest('section');
    if (!section) return;
    var heading = section.querySelector('.sec-t');
    if (heading && !section.querySelector('.topic-section-header')) {
      var header = document.createElement('div');
      header.className = 'topic-section-header';
      var desc = document.createElement('p');
      desc.className = 'topic-section-desc';
      desc.textContent = /Explore by topic/i.test(heading.textContent)
        ? 'Explore economic and productivity themes to view analysis, comparisons and key trends.'
        : 'Teroka topik ekonomi dan produktiviti mengikut tema untuk melihat analitik, perbandingan dan trend utama.';
      heading.before(header);
      header.append(heading, desc);
    }

    Array.from(grid.querySelectorAll(':scope > .xcard')).forEach(function (card, i) {
      if (card.classList.contains('topic-card--refined')) return;
      var number = card.querySelector('.x-n');
      var title = card.querySelector('h3');
      var description = card.querySelector('p');
      var foot = card.querySelector('.x-f');
      if (!number || !title || !description || !foot) return;
      var first = document.createElement('div');
      first.className = 'topic-card-main';
      var ico = document.createElement('span');
      ico.className = 'topic-card-icon';
      ico.setAttribute('aria-hidden', 'true');
      ico.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[i] || icons[0]) + '</svg>';
      var content = document.createElement('div');
      content.className = 'topic-card-content';
      var titleRow = document.createElement('div');
      titleRow.className = 'topic-card-heading';
      titleRow.append(number, title);
      content.append(titleRow, description);
      first.append(ico, content);
      card.insertBefore(first, foot);
      var value = foot.querySelector('span');
      var small = value && value.querySelector('small');
      if (small) foot.insertBefore(small, foot.querySelector('i'));
      card.classList.add('topic-card--refined');
    });
  }

  function removeHomeCoverage(home) {
    // Identify the card by its own heading, so nothing in the Methodology page is affected.
    Array.from(home.querySelectorAll('article.card')).forEach(function (card) {
      var h2 = card.querySelector(':scope > .card-h h2');
      if (h2 && /^(Liputan data|Data coverage)\s*$/i.test(h2.textContent.trim())) card.remove();
    });
  }

  function refineFooter(home) {
    var foot = document.getElementById('foot-text');
    var others = document.getElementById('other-files');
    if (!foot) return;
    var visibleHome = !home.hidden;
    var desired = isEnglish() ? EN_FOOTER : BM_FOOTER;
    if (visibleHome) {
      if (foot.textContent !== BM_FOOTER && foot.textContent !== EN_FOOTER) previousFooter = foot.textContent;
      if (foot.textContent !== desired) foot.textContent = desired;
      if (others && !others.hidden) others.hidden = true;
    } else {
      if ((foot.textContent === BM_FOOTER || foot.textContent === EN_FOOTER) && previousFooter !== null) {
        foot.textContent = previousFooter;
      }
      if (others && others.hidden) others.hidden = false;
    }
  }

  function apply() {
    var home = document.getElementById(HOME_ID);
    if (!home) return;
    addStyles();
    refineTopics(home);
    removeHomeCoverage(home);
    refineFooter(home);
  }

  function queueApply() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; apply(); });
  }

  function start() {
    var home = document.getElementById(HOME_ID);
    if (!home) return;
    apply();
    if (!homeObserver) {
      homeObserver = new MutationObserver(queueApply);
      homeObserver.observe(home, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    }
    var foot = document.getElementById('foot-text');
    if (foot && !footerObserver) {
      footerObserver = new MutationObserver(queueApply);
      footerObserver.observe(foot, { childList: true, subtree: true, characterData: true });
    }
    window.addEventListener('hashchange', queueApply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

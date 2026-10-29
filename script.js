/* ============================================================
   个人主页交互脚本（原生 JS，无依赖）
   包含：导航状态 / 阅读进度 / 移动端菜单 / 当前板块高亮 /
        滚动淡入 / 证书放大查看 / 复制联系方式 / 回到顶部
   ============================================================ */

(function () {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------
     1. 滚动：导航条状态 + 阅读进度 + 回到顶部
     ---------------------------------------------------------- */
  const navbar   = $('#navbar');
  const toTop    = $('#toTop');
  const progress = $('#navProgress');

  function onScroll() {
    const y   = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    navbar.classList.toggle('scrolled', y > 10);
    toTop.classList.toggle('show', y > 560);

    if (progress) {
      progress.style.width = (max > 0 ? Math.min(y / max, 1) * 100 : 0) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ----------------------------------------------------------
     2. 移动端汉堡菜单
     ---------------------------------------------------------- */
  const navToggle = $('#navToggle');
  const navLinks  = $('#navLinks');

  function closeMenu() {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });

  $$('.nav-link').forEach(link => link.addEventListener('click', closeMenu));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  document.addEventListener('click', e => {
    if (!navLinks.classList.contains('open')) return;
    if (navLinks.contains(e.target) || navToggle.contains(e.target)) return;
    closeMenu();
  });

  /* ----------------------------------------------------------
     3. 当前板块高亮
     ---------------------------------------------------------- */
  const sections = $$('main section[id]');
  const linkMap  = new Map();
  $$('.nav-link').forEach(a => linkMap.set(a.getAttribute('href').slice(1), a));

  function highlightNav() {
    const line = window.scrollY + window.innerHeight * 0.32;
    let current = '';

    sections.forEach(sec => {
      if (sec.offsetTop <= line) current = sec.id;
    });

    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 4) {
      current = sections[sections.length - 1].id;
    }

    linkMap.forEach((link, id) => link.classList.toggle('active', id === current));
  }
  window.addEventListener('scroll', highlightNav, { passive: true });
  window.addEventListener('resize', highlightNav);
  highlightNav();

  /* ----------------------------------------------------------
     4. 滚动淡入（同组元素依次出现）
     ---------------------------------------------------------- */
  ['.skill-groups', '.project-list', '.cert-grid', '.contact-grid'].forEach(sel => {
    $$(sel).forEach(group => {
      $$('.reveal', group).forEach((el, i) => {
        el.style.transitionDelay = (i * 70) + 'ms';
      });
    });
  });

  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  $$('.reveal').forEach(el => revealObserver.observe(el));

  /* ----------------------------------------------------------
     5. 证书放大查看
     ---------------------------------------------------------- */
  const lb      = $('#lightbox');
  const lbImg   = $('#lbImg');
  const lbTitle = $('#lbTitle');
  const lbNote  = $('#lbNote');
  const lbClose = $('#lbClose');
  const lbPrev  = $('#lbPrev');
  const lbNext  = $('#lbNext');
  const cards   = $$('.cert-card');

  if (lb && cards.length) {
    let index = 0;
    let lastFocused = null;

    function render(i) {
      index = (i + cards.length) % cards.length;
      const card = cards[index];

      lbImg.src = card.dataset.full;
      lbImg.alt = card.dataset.title || '';
      lbTitle.textContent = card.dataset.title || '';
      lbNote.textContent  = card.dataset.note || '';
    }

    function open(i, trigger) {
      lastFocused = trigger || document.activeElement;
      render(i);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => lb.classList.add('show'));
      lbClose.focus();
    }

    function close() {
      lb.classList.remove('show');
      document.body.style.overflow = '';

      // 只认灯箱自己的 opacity 过渡 —— 子元素的 hover 过渡也会冒泡到 lb
      const done = e => {
        if (e && (e.target !== lb || e.propertyName !== 'opacity')) return;
        lb.hidden = true;
        lbImg.removeAttribute('src');
        lb.removeEventListener('transitionend', done);
      };
      if (reduceMotion) done();
      else lb.addEventListener('transitionend', done);

      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    cards.forEach((card, i) => {
      card.addEventListener('click', () => open(i, card));
    });

    lbClose.addEventListener('click', close);
    lbPrev.addEventListener('click', e => { e.stopPropagation(); render(index - 1); });
    lbNext.addEventListener('click', e => { e.stopPropagation(); render(index + 1); });

    // 点背景关闭，点图片本身不关闭
    lb.addEventListener('click', e => { if (e.target === lb) close(); });

    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape')     { e.preventDefault(); close(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); render(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); render(index + 1); }
    });
  }

  /* ----------------------------------------------------------
     6. 复制联系方式
     navigator.clipboard 在 file:// 下可能不可用，带 execCommand 兜底
     ---------------------------------------------------------- */
  const toast = $('#toast');
  let toastTimer = null;

  function showToast(msg, isError) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.toggle('err', !!isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  $$('.ci-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy || '';
      let ok = false;

      if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); ok = true; }
        catch (_) { ok = false; }
      }
      if (!ok) ok = legacyCopy(text);

      if (ok) {
        btn.classList.add('done');
        const original = btn.textContent;
        btn.textContent = '已复制';
        setTimeout(() => {
          btn.classList.remove('done');
          btn.textContent = original;
        }, 1800);
        showToast('已复制：' + text);
      } else {
        showToast('复制失败，请手动选中复制', true);
      }
    });
  });

  /* ----------------------------------------------------------
     7. 回到顶部
     ---------------------------------------------------------- */
  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ----------------------------------------------------------
     8. 页脚年份
     ---------------------------------------------------------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ----------------------------------------------------------
     9. 平滑滚动兜底（老浏览器）
     ---------------------------------------------------------- */
  if (!('scrollBehavior' in document.documentElement.style)) {
    $$('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.getElementById(a.getAttribute('href').slice(1));
        if (!target) return;
        e.preventDefault();
        window.scrollTo(0, target.offsetTop - 68);
      });
    });
  }

})();

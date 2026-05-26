/* ============================================================
   ТОНКО-КРЕПКО  ·  Landing JS
   Сейчас: измерение хедера + мобильное меню. Дальше: таймер, аккордеон, Stripe.
   ============================================================ */

(() => {
  'use strict';

  // ---- Реальная высота хедера → CSS-переменная --header-h
  // Нужно, чтобы Hero мог занять ровно (100vh - header) и маркиза прижалась к низу
  // экрана без появления скролла. Пересчёт на resize и после загрузки шрифтов.
  const header = document.querySelector('.site-header');

  const setHeaderH = () => {
    if (!header) return;
    const h = header.offsetHeight;
    document.documentElement.style.setProperty('--header-h', `${h}px`);
  };

  setHeaderH();
  window.addEventListener('resize', setHeaderH);
  window.addEventListener('load', setHeaderH);
  // шрифты могут догрузиться позже — пересчитываем
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(setHeaderH);
  }


  // ---- Mobile nav toggle (заглушка, меню сделаем при адаптиве)
  const toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      // TODO: открывать мобильное меню (сделаем при добавлении остальных секций)
    });
  }


  // ---- Smooth scroll для якорей (на случай старых браузеров)
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (id.length > 1) {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });


  // ---- Scroll-triggered fade-up
  // Любой элемент с классом .fade-up подхватывается; стаггер задаётся
  // через --i в инлайн-стиле (CSS считает delay = i * 70ms).
  const fadeEls = document.querySelectorAll('.fade-up');

  if ('IntersectionObserver' in window && fadeEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -60px 0px',
    });

    fadeEls.forEach(el => io.observe(el));
  } else {
    // Старый браузер или нет IO — показываем сразу, без анимации
    fadeEls.forEach(el => el.classList.add('in-view'));
  }


  // ---- Countdown timer до повышения цены
  // Цель: 25 мая 2026, 23:59 по лиссабонскому летнему времени (+01:00 WEST).
  // Дата вшита в data-target атрибут .countdown-clock — при изменении даты
  // правим только HTML, JS трогать не надо.
  const clock = document.querySelector('.countdown-clock');

  if (clock) {
    const targetISO = clock.getAttribute('data-target');
    const targetMs = new Date(targetISO).getTime();

    const nums = {
      days:    clock.querySelector('[data-unit="days"]'),
      hours:   clock.querySelector('[data-unit="hours"]'),
      minutes: clock.querySelector('[data-unit="minutes"]'),
      seconds: clock.querySelector('[data-unit="seconds"]'),
    };

    const pad = (n) => String(n).padStart(2, '0');

    const tick = () => {
      const diff = targetMs - Date.now();

      if (diff <= 0) {
        // Время вышло — обнуляем и помечаем контейнер для возможной стилизации
        nums.days.textContent = '00';
        nums.hours.textContent = '00';
        nums.minutes.textContent = '00';
        nums.seconds.textContent = '00';
        clock.classList.add('countdown-clock--expired');
        clearInterval(interval);
        return;
      }

      const days    = Math.floor(diff / 86400000);
      const hours   = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000)  / 60000);
      const seconds = Math.floor((diff % 60000)    / 1000);

      nums.days.textContent    = pad(days);
      nums.hours.textContent   = pad(hours);
      nums.minutes.textContent = pad(minutes);
      nums.seconds.textContent = pad(seconds);
    };

    tick();
    const interval = setInterval(tick, 1000);
  }


  // ---- Кнопки выбора тарифа
  // Каждая кнопка несёт data-tier="basic|standard|vip".
  // POST на /api/checkout.php → получаем URL → редирект на Stripe Checkout
  // (или на thank-you в mock-режиме).
  const tierButtons = document.querySelectorAll('.tier-cta');

  tierButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const tier = btn.dataset.tier;
      if (!tier) return;

      // Защита от двойных кликов
      if (btn.classList.contains('is-loading')) return;
      btn.classList.add('is-loading');
      const originalText = btn.querySelector('span').textContent;
      btn.querySelector('span').textContent = 'Открываем оплату…';

      try {
        const response = await fetch('/api/checkout.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data.url) {
          throw new Error('No checkout URL returned');
        }

        // Редирект на Stripe Checkout (или thank-you в mock-режиме)
        window.location.href = data.url;

      } catch (err) {
        console.error('[checkout] failed:', err);
        btn.classList.remove('is-loading');
        btn.querySelector('span').textContent = originalText;
        alert('Не удалось открыть оплату. Попробуйте ещё раз или напишите нам в Telegram.');
      }
    });
  });


  // ---- FAQ-аккордеон
  // Несколько вопросов могут быть открыты одновременно (так удобнее читать).
  // Анимация высоты через scrollHeight → max-height с фоллбэком в "auto"
  // после завершения анимации, чтобы контент не обрезался на длинных ответах.
  const faqTriggers = document.querySelectorAll('.faq-trigger');

  faqTriggers.forEach(trigger => {
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!panel) return;

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        // Закрываем: фиксируем текущую высоту → 0
        panel.style.maxHeight = panel.scrollHeight + 'px';
        // форсируем reflow, чтобы анимация запустилась с конкретного значения
        panel.offsetHeight;
        panel.style.maxHeight = '0px';
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        // Открываем: ставим scrollHeight, после транзишена снимаем ограничение,
        // чтобы контент перестроился, если изменится размер окна.
        panel.style.maxHeight = panel.scrollHeight + 'px';
        trigger.setAttribute('aria-expanded', 'true');

        const onEnd = (e) => {
          if (e.propertyName !== 'max-height') return;
          panel.style.maxHeight = 'none';
          panel.removeEventListener('transitionend', onEnd);
        };
        panel.addEventListener('transitionend', onEnd);
      }
    });
  });


  // ---- Cookie banner
  // Показываем при первом визите, скрываем после клика "Понятно".
  // Согласие храним в localStorage — баннер больше не появится.
  // Только технические cookies — поэтому отказ не предусмотрен (нечего отключать).
  const banner = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('cookie-banner-accept');
  const COOKIE_CONSENT_KEY = 'tk_cookie_consent_v1';

  if (banner && acceptBtn) {
    const hasConsent = (() => {
      try {
        return localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted';
      } catch (e) {
        // localStorage может быть недоступен (приватный режим, отказ от cookies на уровне браузера)
        return false;
      }
    })();

    if (!hasConsent) {
      banner.hidden = false;
      // Чуть задерживаем show чтобы баннер красиво въехал
      requestAnimationFrame(() => {
        requestAnimationFrame(() => banner.classList.add('is-visible'));
      });
    }

    acceptBtn.addEventListener('click', () => {
      try {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      } catch (e) { /* приватный режим — баннер не сохранится, появится снова */ }

      banner.classList.remove('is-visible');
      setTimeout(() => { banner.hidden = true; }, 360);
    });
  }

})();

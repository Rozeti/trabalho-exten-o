// Smooth scroll para âncoras internas
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

// Botão “voltar ao topo”
const backToTopButton = document.createElement('button');
backToTopButton.innerText = '↑';
backToTopButton.id = 'backToTop';
backToTopButton.classList.add('back-to-top');
backToTopButton.style.display = 'none';
document.body.appendChild(backToTopButton);

window.addEventListener('scroll', () => {
  backToTopButton.style.display = window.scrollY > 300 ? 'flex' : 'none';
});

backToTopButton.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Carrossel de depoimentos + loop contínuo
document.addEventListener('DOMContentLoaded', () => {
  const carrossel   = document.querySelector('.carrossel');
  const wrapper     = document.querySelector('.carrossel-wrapper');
  const items       = Array.from(document.querySelectorAll('.testimonial'));
  const prevBtn     = document.querySelector('.carrossel-btn.prev');
  const nextBtn     = document.querySelector('.carrossel-btn.next');
  const indicadores = document.querySelector('.carrossel-indicadores');

  let currentIndex = 0, visible = 3, animating = false, autoScroll;

  function updateVisible() {
    visible = window.innerWidth <= 768 ? 1 : window.innerWidth <= 992 ? 2 : 3;
    const width = 100 / visible;
    items.forEach(el => el.style.flex = `0 0 ${width}%`);
  }

  function addClones() {
    const count = visible * 2;
    for (let i = 0; i < count; i++) {
      const clone = items[i % items.length].cloneNode(true);
      clone.classList.add('clone');
      carrossel.appendChild(clone);
    }
  }

  function createIndicators() {
    indicadores.innerHTML = '';
    const pages = Math.ceil(items.length / visible);
    for (let i = 0; i < pages; i++) {
      const ind = document.createElement('div');
      ind.classList.add('carrossel-indicador');
      if (i === 0) ind.classList.add('active');
      ind.addEventListener('click', () => goTo(i));
      indicadores.appendChild(ind);
    }
  }

  function goTo(page) {
    currentIndex = page * visible;
    slide();
  }

  function slide() {
    if (animating) return;
    animating = true;
    const widthPct = 100 / visible;
    carrossel.style.transition = 'transform 0.5s ease-in-out';
    carrossel.style.transform  = `translateX(-${currentIndex * widthPct}%)`;
    updateIndicators();
    setTimeout(() => {
      checkLoop(); animating = false;
    }, 500);
  }

  function updateIndicators() {
    const inds = Array.from(document.querySelectorAll('.carrossel-indicador'));
    const page = Math.floor((currentIndex % items.length) / visible);
    inds.forEach((el, i) => el.classList.toggle('active', i === page));
  }

  function checkLoop() {
    const total = items.length;
    if (currentIndex >= total) {
      currentIndex %= total;
      carrossel.style.transition = 'none';
      const widthPct = 100 / visible;
      carrossel.style.transform  = `translateX(-${currentIndex * widthPct}%)`;
      setTimeout(() => {
        carrossel.style.transition = 'transform 0.5s ease-in-out';
      }, 50);
    }
  }

  function autoPlay() {
    autoScroll = setInterval(() => { currentIndex++; slide(); }, 5000);
  }

  prevBtn.addEventListener('click', () => { if (!animating) { currentIndex--; slide(); } });
  nextBtn.addEventListener('click', () => { if (!animating) { currentIndex++; slide(); } });
  wrapper.addEventListener('mouseenter', () => clearInterval(autoScroll));
  wrapper.addEventListener('mouseleave', autoPlay);
  window.addEventListener('resize', () => {
    const old = visible;
    updateVisible();
    if (old !== visible) {
      currentIndex = Math.min(currentIndex, items.length - 1);
      slide();
    }
  });

  // Inicialização
  updateVisible();
  addClones();
  createIndicators();
  slide();
  autoPlay();

  // FAQ acordeão
  document.querySelectorAll('.faq-item').forEach(item => {
    const q      = item.querySelector('.faq-question');
    const a      = item.querySelector('.faq-answer');
    const inner  = item.querySelector('.faq-answer-inner');
    const toggle = item.querySelector('.faq-toggle');
    a.style.maxHeight    = '0';
    toggle.textContent   = '+';

    q.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item.active').forEach(o => {
        o.classList.remove('active');
        o.querySelector('.faq-answer').style.maxHeight = '0';
        o.querySelector('.faq-toggle').textContent     = '+';
      });
      if (!isActive) {
        item.classList.add('active');
        a.style.maxHeight  = inner.scrollHeight + 'px';
        toggle.textContent = '×';
      }
    });
  });
});

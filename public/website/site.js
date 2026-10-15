/* Independent marketing-page state; never uses editor storage or document APIs. */
(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const media = matchMedia('(prefers-color-scheme: dark)');
  let preferred;
  try { preferred = localStorage.getItem('deck-studio-website-theme'); } catch {}
  function setTheme(theme) {
    root.classList.add('theme-changing');
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} appearance`);
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.querySelector('use').setAttribute('href', dark ? '#sun' : '#moon');
    document.querySelector('[data-dark-shot]').media = dark ? 'all' : 'not all';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#141a17' : '#faf9f5';
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-changing')));
  }
  setTheme(preferred === 'dark' || preferred === 'light' ? preferred : media.matches ? 'dark' : 'light');
  themeButton.addEventListener('click', () => {
    preferred = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(preferred);
    try { localStorage.setItem('deck-studio-website-theme', preferred); } catch {}
  });
  media.addEventListener('change', () => { if (!preferred) setTheme(media.matches ? 'dark' : 'light'); });
  const header = document.querySelector('.nav');
  const editorSlot = document.querySelector('.nav-editor-slot');
  const heroAction = document.querySelector('.hero-copy .button.primary');
  let editorVisible;
  let headerFramePending = false;
  function updateHeaderAction() {
    headerFramePending = false;
    const visible = heroAction.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom;
    if (visible === editorVisible) return;
    editorVisible = visible;
    root.classList.toggle('nav-cta-visible', visible);
    editorSlot.inert = !visible;
    editorSlot.setAttribute('aria-hidden', String(!visible));
    if (!visible && editorSlot.contains(document.activeElement)) heroAction.focus({preventScroll: true});
  }
  function scheduleHeaderAction() {
    if (headerFramePending) return;
    headerFramePending = true;
    requestAnimationFrame(updateHeaderAction);
  }
  updateHeaderAction();
  addEventListener('scroll', scheduleHeaderAction, {passive: true});
  addEventListener('resize', scheduleHeaderAction);
  document.fonts.ready.then(scheduleHeaderAction);

  const menu = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  function setMenu(open) {
    navigation.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menu.querySelector('use').setAttribute('href', open ? '#close' : '#menu');
    if (open) navigation.querySelector('a').focus();
  }
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  navigation.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;
    const wasOpen = menu.getAttribute('aria-expanded') === 'true';
    setMenu(false);
    if (wasOpen && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      const section = link.hash && link.origin === location.origin && link.pathname === location.pathname ? document.querySelector(link.hash) : null;
      const heading = section?.querySelector('h2');
      if (heading) {
        e.preventDefault();
        if (location.hash !== link.hash) history.pushState(null, '', link.hash);
        section.scrollIntoView({block: 'start'});
        heading.tabIndex = -1;
        heading.focus({preventScroll: true});
      }
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } });
  matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  const collections = {
    portfolio: {title:'Portfolio / Editorial',description:'24 slides · Context, research, craft and reflection.',alt:'Current Editorial portfolio cover with original paper artwork and clear editable typography.',file:'editorial'},
    review: {title:'Project review / Studio',description:'24 slides · Evidence, options, decisions and the next iteration.',alt:'Current Studio project review cover with a review illustration and decision-focused agenda.',file:'studio'},
    minimal: {title:'Minimalist / A clear idea',description:'24 slides · Space, structure, and only what matters.',alt:'Current Minimalist template with neutral typography, generous whitespace and editable content.',file:'minimalist'},
    proposal: {title:'Design proposal / Monograph',description:'24 slides · Direction, scope, rationale and delivery.',alt:'Current Monograph proposal cover with an original material study and editable typography.',file:'monograph'},
    pitch: {title:'Product pitch / Signal',description:'24 slides · Problem, product, traction and the ask.',alt:'Current Signal pitch cover with cobalt glass artwork on a dark canvas.',file:'signal'},
    report: {title:'Data report / Ledger',description:'24 slides · Results, comparisons, interpretation and priorities.',alt:'Current Ledger report cover with readable type and an editable results chart.',file:'ledger'},
  };
  const tabs = [...document.querySelectorAll('[data-template]')];
  function chooseTemplate(tab) {
    const name = tab.dataset.template, collection = collections[name];
    tabs.forEach(t => {const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
    const image = document.querySelector('#template-image');
    image.src = `assets/${name}.jpg?v=20261015-latest`; image.alt = collection.alt;
    document.querySelector('#template-panel').setAttribute('aria-labelledby',tab.id);
    document.querySelector('#template-title').textContent=collection.title;
    document.querySelector('#template-description').textContent=collection.description;
    document.querySelector('#template-download').href=`assets/${collection.file}.deck.json?v=20261015-latest`;
    document.querySelector('#template-download').setAttribute('aria-label', `Get the starter deck: ${collection.title}`);
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click',()=>chooseTemplate(tab));
    tab.addEventListener('keydown',e=>{
      let next;
      if(e.key==='ArrowRight')next=(i+1)%tabs.length;
      if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;
      if(e.key==='ArrowDown' && matchMedia('(min-width:761px)').matches)next=(i+1)%tabs.length;
      if(e.key==='ArrowUp' && matchMedia('(min-width:761px)').matches)next=(i+tabs.length-1)%tabs.length;
      if(e.key==='Home')next=0;
      if(e.key==='End')next=tabs.length-1;
      if(next!==undefined){e.preventDefault();chooseTemplate(tabs[next]);tabs[next].focus();}
    });
  });
  const templateLayout=matchMedia('(min-width:761px)');
  const orientTemplates=()=>document.querySelector('.template-picker').setAttribute('aria-orientation',templateLayout.matches?'vertical':'horizontal');
  orientTemplates();templateLayout.addEventListener('change',orientTemplates);
  if ('IntersectionObserver' in window) {
    root.classList.add('js-ready');
    const observer = new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('seen');observer.unobserve(entry.target)}}),{threshold:.08});
    document.querySelectorAll('.reveal').forEach(section=>observer.observe(section));
  }
})();

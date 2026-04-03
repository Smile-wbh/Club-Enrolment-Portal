 (function(){
  if(window.__chatWidgetLoaded) return;
  window.__chatWidgetLoaded = true;
  const KEYS = {
    messages: 'chat_messages_v1',
    templates: 'chat_templates_v1',
    userId: 'chat_user_id_v1'
  };
  const defaultTemplates = [
    { id: 't1', title:'Course Advice', keywords:['course','recommend','suitable','beginner'], reply:'If this is your first time, start with a beginner course and check the time and available seats. Tell me your interest area if you want a tailored suggestion.', active:true },
    { id: 't2', title:'Booking Process', keywords:['book','booking','sign up','how to book'], reply:'Open the course details page and click Book Now. After logging in, the booking will appear in the course bookings list in the user dashboard.', active:true },
    { id: 't3', title:'Time and Location', keywords:['time','location','schedule','class'], reply:'Each course includes its own schedule and location details. Open the course card to view the full arrangement.', active:true }
  ];
  const quickQuestions = [
    'Which course should I choose?',
    'How is the class schedule arranged?',
    'Where can I find my booking after I reserve?'
  ];
  const GREETING_MESSAGE = 'Hello, I am the course support assistant. Tell me which course or question you would like help with.';
  const FALLBACK_REPLY = 'We received your question and will reply as soon as possible. You can also check the course details and support pages first.';
  const LEGACY_TEXT_MAP = {
    '\u4f60\u597d\uff0c\u6211\u662f\u8bfe\u7a0b\u54a8\u8be2\u52a9\u624b\u3002\u8bf7\u544a\u8bc9\u6211\u4f60\u60f3\u4e86\u89e3\u7684\u8bfe\u7a0b\u6216\u95ee\u9898\u3002': GREETING_MESSAGE,
    '\u5df2\u6536\u5230\u4f60\u7684\u95ee\u9898\uff0c\u6211\u4eec\u4f1a\u5c3d\u5feb\u56de\u590d\uff0c\u4e5f\u53ef\u4ee5\u5148\u67e5\u770b\u8bfe\u7a0b\u8be6\u60c5\u4e0e\u54a8\u8be2\u9875\u9762\u3002': FALLBACK_REPLY,
    '\u5982\u679c\u662f\u7b2c\u4e00\u6b21\u4f53\u9a8c\uff0c\u5efa\u8bae\u4ece\u5165\u95e8\u8bfe\u7a0b\u5f00\u59cb\uff0c\u5173\u6ce8\u8bfe\u7a0b\u65f6\u95f4\u4e0e\u540d\u989d\u3002\u4e5f\u53ef\u4ee5\u544a\u8bc9\u6211\u4f60\u7684\u5174\u8da3\u65b9\u5411\uff0c\u6211\u5e2e\u4f60\u63a8\u8350\u3002': defaultTemplates[0].reply,
    '\u70b9\u51fb\u8bfe\u7a0b\u8be6\u60c5\u91cc\u7684\u201c\u7acb\u5373\u9884\u7ea6\u201d\uff0c\u767b\u5f55\u540e\u4f1a\u4fdd\u5b58\u5230\u4e2a\u4eba\u4e2d\u5fc3\u7684\u6559\u5b66\u9884\u7ea6\u5217\u8868\u3002': defaultTemplates[1].reply,
    '\u6bcf\u95e8\u8bfe\u7a0b\u90fd\u6709\u65f6\u95f4\u8868\u4e0e\u5730\u70b9\u4fe1\u606f\uff0c\u70b9\u51fb\u8bfe\u7a0b\u5361\u7247\u5373\u53ef\u67e5\u770b\u5b8c\u6574\u5b89\u6392\u3002': defaultTemplates[2].reply
  };
  const defaultTemplateMap = defaultTemplates.reduce((acc, tpl)=>{
    acc[tpl.id] = tpl;
    return acc;
  }, {});
  function readSession(){
    const tryLoad = (store)=>{
      try{
        const raw = store.getItem('user_session_v1');
        const s = raw ? JSON.parse(raw) : null;
        return (s && s.email) ? String(s.email).trim() : '';
      }catch(e){ return ''; }
    };
    return tryLoad(localStorage) || tryLoad(sessionStorage) || '';
  }
  function isBusinessCacheDisabled(){
    const service = window.clubLocalDataMigration || null;
    const email = readSession();
    return !!(service && typeof service.isBusinessCacheDisabled === 'function' && service.isBusinessCacheDisabled(email));
  }
  function getUserId(){
    const email = readSession();
    if(email) return 'user:' + email;
    let uid = localStorage.getItem(KEYS.userId);
    if(!uid){
      uid = 'guest-' + Date.now() + '-' + Math.random().toString(36).slice(2,7);
      localStorage.setItem(KEYS.userId, uid);
    }
    return uid;
  }
  function safeParse(key, fallback){
    if(key === KEYS.messages && isBusinessCacheDisabled()) return fallback;
    try{
      const raw = localStorage.getItem(key);
      if(raw === null || raw === undefined || raw === '') return fallback;
      return JSON.parse(raw);
    }catch(e){ return fallback; }
  }
  function save(key, value){
    if(key === KEYS.messages && isBusinessCacheDisabled()) return;
    localStorage.setItem(key, JSON.stringify(value));
  }
  function escapeHtml(str){
    return String(str || '').replace(/[&<>"']/g, (m)=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[m]));
  }
  function hasCjk(value){
    return /[\u4E00-\u9FFF]/.test(String(value || ''));
  }
  const state = {
    userId: getUserId(),
    messages: [],
    templates: []
  };
  function loadTemplates(){
    let templates = safeParse(KEYS.templates, []);
    if(!Array.isArray(templates) || templates.length === 0){
      templates = defaultTemplates.slice();
      save(KEYS.templates, templates);
      return templates;
    }
    let changed = false;
    templates = templates.map((tpl, index)=>{
      const fallback = defaultTemplateMap[tpl && tpl.id] || defaultTemplates[index] || null;
      if(!tpl || !fallback) return tpl;
      const keywords = Array.isArray(tpl.keywords) ? tpl.keywords : String(tpl.keywords || '').split(/[,\uFF0C]/);
      const needsMigration = hasCjk(tpl.title) || hasCjk(tpl.reply) || keywords.some(hasCjk);
      if(!needsMigration) return tpl;
      changed = true;
      return Object.assign({}, fallback, { active: tpl.active !== false });
    });
    if(changed) save(KEYS.templates, templates);
    return templates;
  }
  function loadMessages(){
    const all = safeParse(KEYS.messages, []);
    if(!Array.isArray(all)) return [];
    let changed = false;
    const migrated = all.map((msg)=>{
      if(!msg || typeof msg !== 'object') return msg;
      const text = String(msg.text || '').trim();
      const nextText = LEGACY_TEXT_MAP[text];
      if(!nextText) return msg;
      changed = true;
      return Object.assign({}, msg, { text: nextText });
    });
    if(changed) save(KEYS.messages, migrated);
    return migrated;
  }
  function addMessage(role, text){
    const msg = {
      id: String(Date.now()) + Math.random().toString(36).slice(2,6),
      role,
      text: String(text || '').trim(),
      userId: state.userId,
      userEmail: readSession() || '',
      createdAt: new Date().toLocaleString()
    };
    state.messages.push(msg);
    save(KEYS.messages, state.messages);
    renderMessages();
    return msg;
  }
  function matchTemplate(text){
    const t = String(text || '').toLowerCase();
    for(const tpl of state.templates){
      if(tpl && tpl.active === false) continue;
      const keys = Array.isArray(tpl.keywords) ? tpl.keywords : String(tpl.keywords || '').split(/[,\uFF0C]/);
      for(const key of keys){
        const k = String(key || '').trim().toLowerCase();
        if(k && t.includes(k)) return tpl.reply || '';
      }
    }
    return FALLBACK_REPLY;
  }
  function ensureGreeting(){
    const hasAny = state.messages.some(m => m.userId === state.userId);
    if(!hasAny){
      addMessage('bot', GREETING_MESSAGE);
    }
  }
  function renderMessages(){
    const body = document.querySelector('.chat-body');
    if(!body) return;
    const list = state.messages.filter(m => m.userId === state.userId);
    const html = list.map(m => {
      const cls = m.role === 'user' ? 'user' : (m.role === 'admin' ? 'admin' : 'bot');
      return '<div class="chat-bubble '+cls+'"><div>'+escapeHtml(m.text)+'</div><div class="chat-bubble-meta">'+escapeHtml(m.createdAt)+'</div></div>';
    }).join('');
    body.innerHTML = '<div class="chat-date">'+new Date().toLocaleDateString()+'</div>' + html;
    body.scrollTop = body.scrollHeight;
  }
  function renderQuick(){
    const quick = document.querySelector('.chat-quick');
    if(!quick) return;
    const buttons = quickQuestions.map(q => '<button type="button" data-q="'+escapeHtml(q)+'">'+escapeHtml(q)+'</button>').join('');
    quick.innerHTML = buttons;
    quick.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        sendMessage(btn.getAttribute('data-q'));
      });
    });
  }
  function sendMessage(text){
    const t = String(text || '').trim();
    if(!t) return;
    addMessage('user', t);
    const reply = matchTemplate(t);
    setTimeout(()=>{ addMessage('bot', reply); }, 600);
  }
  function setupUI(){
    const wrap = document.createElement('div');
    wrap.className = 'chat-widget';
    wrap.innerHTML = ''+
      '<button class="chat-toggle" type="button"><span>💬</span>Chat with Us</button>'+
      '<div class="chat-panel">'+
        '<div class="chat-header">'+
          '<div><div class="chat-header-title">Club Enrollment Portal</div><div class="chat-header-sub">Usually replies within a few minutes</div></div>'+
          '<button class="chat-close" type="button">×</button>'+
        '</div>'+
        '<div class="chat-body"></div>'+
        '<div class="chat-quick"></div>'+
        '<div class="chat-input">'+
          '<div class="chat-input-box">'+
            '<input type="text" placeholder="Type your question...">'+
            '<button type="button">Send</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(wrap);
    const toggle = wrap.querySelector('.chat-toggle');
    const panel = wrap.querySelector('.chat-panel');
    const close = wrap.querySelector('.chat-close');
    toggle.addEventListener('click', ()=>{
      panel.classList.toggle('open');
      if(panel.classList.contains('open')) renderMessages();
    });
    close.addEventListener('click', ()=> panel.classList.remove('open'));
    const input = wrap.querySelector('.chat-input-box input');
    const sendBtn = wrap.querySelector('.chat-input-box button');
    sendBtn.addEventListener('click', ()=>{
      sendMessage(input.value);
      input.value = '';
      input.focus();
    });
    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        sendBtn.click();
      }
    });
  }
  function init(){
    state.templates = loadTemplates();
    state.messages = loadMessages();
    setupUI();
    ensureGreeting();
    renderMessages();
    renderQuick();
    window.addEventListener('storage', (e)=>{
      if(e && e.key === KEYS.messages){
        state.messages = loadMessages();
        renderMessages();
      }
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
 })();

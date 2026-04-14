(function () {
  if (window.portalDialogs && window.portalDialogs.__initialized) return;

  var nativeAlert = typeof window.alert === 'function' ? window.alert.bind(window) : function () {};
  var nativeConfirm = typeof window.confirm === 'function' ? window.confirm.bind(window) : function () { return false; };
  var nativePrompt = typeof window.prompt === 'function' ? window.prompt.bind(window) : function () { return null; };

  var dialogState = {
    queue: [],
    active: null,
    root: null,
    panel: null,
    previousFocus: null,
    keyHandler: null
  };

  function text(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function ensureStyles() {
    if (document.getElementById('portalInlineDialogStyles')) return;
    var style = document.createElement('style');
    style.id = 'portalInlineDialogStyles';
    style.textContent = [
      '.portal-inline-dialog-root{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;z-index:2147483000;background:rgba(10,24,45,.28);backdrop-filter:blur(6px);}',
      '.portal-inline-dialog-root[hidden]{display:none !important;}',
      '.portal-inline-dialog{width:min(560px,calc(100vw - 32px));background:#fff;border:1px solid rgba(44,94,168,.14);border-radius:28px;box-shadow:0 26px 80px rgba(23,52,96,.22);padding:22px 22px 20px;color:#243852;position:relative;overflow:hidden;}',
      '.portal-inline-dialog--wide{width:min(720px,calc(100vw - 32px));}',
      '.portal-inline-dialog::before{content:"";position:absolute;inset:0 0 auto 0;height:140px;background:linear-gradient(135deg,rgba(62,123,215,.11),rgba(120,194,255,.05));pointer-events:none;}',
      '.portal-inline-dialog__inner{position:relative;z-index:1;}',
      '.portal-inline-dialog__head{display:grid;grid-template-columns:minmax(72px,max-content) minmax(0,1fr) minmax(72px,max-content);align-items:center;gap:14px;margin-bottom:18px;}',
      '.portal-inline-dialog__head--title-only{grid-template-columns:minmax(0,1fr);}',
      '.portal-inline-dialog__esc,.portal-inline-dialog__head-spacer{min-width:72px;}',
      '.portal-inline-dialog__esc{height:38px;border:1px solid rgba(57,114,205,.22);border-radius:999px;background:#eef4ff;color:#2f5fa8;font-weight:800;font-size:13px;letter-spacing:.08em;cursor:pointer;transition:transform .18s ease,background .18s ease,border-color .18s ease;}',
      '.portal-inline-dialog__esc:hover{background:#e2edff;border-color:rgba(57,114,205,.34);transform:translateY(-1px);}',
      '.portal-inline-dialog__title{flex:1;margin:0;text-align:center;font-size:22px;line-height:1.2;color:#274b80;font-weight:800;}',
      '.portal-inline-dialog__head--title-only .portal-inline-dialog__title{font-size:clamp(18px,3vw,22px);letter-spacing:-.01em;white-space:nowrap;}',
      '.portal-inline-dialog__message{margin:0;font-size:18px;line-height:1.72;color:#304764;white-space:pre-line;}',
      '.portal-inline-dialog__body{display:grid;gap:16px;}',
      '.portal-inline-dialog__field-wrap{display:grid;gap:10px;margin-top:2px;}',
      '.portal-inline-dialog__field-label{font-size:14px;font-weight:700;color:#5b6f8e;}',
      '.portal-inline-dialog__field{width:100%;min-height:56px;padding:16px 18px;border-radius:18px;border:1px solid rgba(57,114,205,.22);background:#f8fbff;color:#233754;font-size:16px;line-height:1.5;outline:none;box-sizing:border-box;transition:border-color .18s ease,box-shadow .18s ease;}',
      '.portal-inline-dialog__field:focus{border-color:#3972cd;box-shadow:0 0 0 4px rgba(57,114,205,.12);}',
      '.portal-inline-dialog__field[readonly]{background:#f2f6fd;color:#46648d;}',
      '.portal-inline-dialog__helper{margin:0;font-size:13px;line-height:1.6;color:#6d7f99;}',
      '.portal-inline-dialog__actions{display:flex;justify-content:flex-end;gap:12px;margin-top:8px;flex-wrap:wrap;}',
      '.portal-inline-dialog__btn{min-width:116px;min-height:52px;padding:0 22px;border-radius:18px;border:1px solid rgba(57,114,205,.2);font-size:18px;font-weight:800;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,border-color .18s ease;}',
      '.portal-inline-dialog__btn:hover{transform:translateY(-1px);}',
      '.portal-inline-dialog__btn--secondary{background:#fff;color:#2f5fa8;}',
      '.portal-inline-dialog__btn--secondary:hover{background:#f4f8ff;border-color:rgba(57,114,205,.32);}',
      '.portal-inline-dialog__btn--primary{background:linear-gradient(135deg,#2d62b0,#1a5fcb);color:#fff;border-color:transparent;box-shadow:0 12px 28px rgba(30,88,182,.26);}',
      '.portal-inline-dialog__btn--primary:hover{box-shadow:0 16px 32px rgba(30,88,182,.3);}',
      '.portal-inline-dialog__btn--danger{background:linear-gradient(135deg,#df5d5d,#b82828);color:#fff;border-color:transparent;box-shadow:0 12px 28px rgba(184,40,40,.24);}',
      '.portal-inline-dialog__btn--danger:hover{box-shadow:0 16px 32px rgba(184,40,40,.3);}',
      '.portal-inline-dialog-open{overflow:hidden;}',
      '@media (max-width:640px){.portal-inline-dialog-root{padding:16px;align-items:flex-end;}.portal-inline-dialog{width:min(100%,560px);border-radius:24px;padding:18px 18px 18px;}.portal-inline-dialog--wide{width:min(100%,720px);}.portal-inline-dialog__title{font-size:20px;}.portal-inline-dialog__message{font-size:17px;}.portal-inline-dialog__btn{flex:1 1 0;min-width:0;}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureRoot() {
    if (dialogState.root) return dialogState.root;
    var root = document.createElement('div');
    root.className = 'portal-inline-dialog-root';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.addEventListener('click', function (event) {
      if (event.target !== root) return;
      dismissActiveDialog();
    });
    (document.body || document.documentElement).appendChild(root);
    dialogState.root = root;
    return root;
  }

  function removeChildren(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function focusField(field, selectAll) {
    if (!field || typeof field.focus !== 'function') return;
    window.requestAnimationFrame(function () {
      field.focus();
      if (selectAll && typeof field.select === 'function') {
        field.select();
      }
    });
  }

  function settleActiveDialog(result) {
    if (!dialogState.active) return;
    var activeItem = dialogState.active;
    dialogState.active = null;

    if (dialogState.keyHandler) {
      document.removeEventListener('keydown', dialogState.keyHandler, true);
      dialogState.keyHandler = null;
    }

    if (dialogState.root) {
      dialogState.root.hidden = true;
      dialogState.root.setAttribute('aria-hidden', 'true');
      removeChildren(dialogState.root);
    }
    document.body && document.body.classList.remove('portal-inline-dialog-open');

    if (dialogState.previousFocus && typeof dialogState.previousFocus.focus === 'function') {
      try {
        dialogState.previousFocus.focus();
      } catch (error) {}
    }
    dialogState.previousFocus = null;

    activeItem.resolve(result);
    showNextDialog();
  }

  function dismissActiveDialog() {
    if (!dialogState.active) return;
    var kind = dialogState.active.kind;
    if (kind === 'confirm') {
      settleActiveDialog(false);
      return;
    }
    if (kind === 'prompt') {
      settleActiveDialog(null);
      return;
    }
    settleActiveDialog(undefined);
  }

  function defaultTitle(kind, options) {
    if (options && options.title) return text(options.title);
    if (kind === 'confirm') return 'Please Confirm';
    if (kind === 'prompt') return 'Input Needed';
    return 'Notice';
  }

  function createButton(label, className, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text(label);
    button.addEventListener('click', onClick);
    return button;
  }

  function renderDialog(item) {
    ensureStyles();
    var root = ensureRoot();
    removeChildren(root);

    dialogState.previousFocus = document.activeElement;
    document.body && document.body.classList.add('portal-inline-dialog-open');
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');

    var panel = document.createElement('div');
    panel.className = 'portal-inline-dialog';
    if (item.options && item.options.wide) {
      panel.classList.add('portal-inline-dialog--wide');
    }
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', defaultTitle(item.kind, item.options));

    var inner = document.createElement('div');
    inner.className = 'portal-inline-dialog__inner';

    var head = document.createElement('div');
    head.className = 'portal-inline-dialog__head';

    var hideHeaderClose = !!(item.options && item.options.hideHeaderClose);
    var escButton = null;
    if (!hideHeaderClose) {
      escButton = createButton('ESC', 'portal-inline-dialog__esc', function () {
        dismissActiveDialog();
      });
      escButton.setAttribute('aria-label', 'Close dialog');
    }

    var title = document.createElement('h2');
    title.className = 'portal-inline-dialog__title';
    title.textContent = defaultTitle(item.kind, item.options);

    var spacer = document.createElement('span');
    spacer.className = 'portal-inline-dialog__head-spacer';
    spacer.setAttribute('aria-hidden', 'true');

    var headerDismissButton = null;
    if (!hideHeaderClose && item.options && item.options.headerDismissText) {
      headerDismissButton = createButton(text(item.options.headerDismissText), 'portal-inline-dialog__esc', function () {
        dismissActiveDialog();
      });
      headerDismissButton.setAttribute(
        'aria-label',
        text(item.options.headerDismissAriaLabel || item.options.headerDismissText || 'Close dialog')
      );
    }

    if (hideHeaderClose) {
      head.classList.add('portal-inline-dialog__head--title-only');
      head.appendChild(title);
    } else {
      head.appendChild(escButton || spacer.cloneNode(false));
      head.appendChild(title);
      head.appendChild(headerDismissButton || spacer);
    }

    var body = document.createElement('div');
    body.className = 'portal-inline-dialog__body';

    var message = document.createElement('p');
    message.className = 'portal-inline-dialog__message';
    message.textContent = text(item.message);
    body.appendChild(message);

    var field = null;
    if (item.kind === 'prompt') {
      var fieldWrap = document.createElement('div');
      fieldWrap.className = 'portal-inline-dialog__field-wrap';

      if (item.options && item.options.fieldLabel) {
        var fieldLabel = document.createElement('label');
        fieldLabel.className = 'portal-inline-dialog__field-label';
        fieldLabel.textContent = text(item.options.fieldLabel);
        fieldWrap.appendChild(fieldLabel);
      }

      field = document.createElement(item.options && item.options.multiline ? 'textarea' : 'input');
      field.className = 'portal-inline-dialog__field';
      if (field.tagName === 'INPUT') {
        field.type = 'text';
      } else {
        field.rows = Number(item.options && item.options.rows) > 0 ? Number(item.options.rows) : 3;
      }
      field.value = text(item.value);
      if (item.options && item.options.placeholder) {
        field.placeholder = text(item.options.placeholder);
      }
      if (item.options && item.options.readOnly) {
        field.readOnly = true;
      }
      fieldWrap.appendChild(field);

      if (item.options && item.options.helperText) {
        var helper = document.createElement('p');
        helper.className = 'portal-inline-dialog__helper';
        helper.textContent = text(item.options.helperText);
        fieldWrap.appendChild(helper);
      }

      body.appendChild(fieldWrap);
    }

    var actions = document.createElement('div');
    actions.className = 'portal-inline-dialog__actions';

    var showCancel = item.kind === 'confirm' || item.kind === 'prompt';
    if (item.kind === 'prompt' && item.options && item.options.showCancel === false) {
      showCancel = false;
    }

    if (showCancel) {
      actions.appendChild(createButton(
        item.options && item.options.cancelText ? item.options.cancelText : 'Cancel',
        'portal-inline-dialog__btn portal-inline-dialog__btn--secondary',
        function () {
          dismissActiveDialog();
        }
      ));
    }

    var confirmButtonClass = 'portal-inline-dialog__btn ';
    confirmButtonClass += item.options && item.options.confirmVariant === 'danger'
      ? 'portal-inline-dialog__btn--danger'
      : 'portal-inline-dialog__btn--primary';
    var confirmButton = createButton(
      item.options && item.options.confirmText ? item.options.confirmText : 'OK',
      confirmButtonClass,
      function () {
        if (item.kind === 'confirm') {
          settleActiveDialog(true);
          return;
        }
        if (item.kind === 'prompt') {
          settleActiveDialog(field ? field.value : '');
          return;
        }
        settleActiveDialog(undefined);
      }
    );
    confirmButton.setAttribute('data-portal-primary', 'true');
    actions.appendChild(confirmButton);

    body.appendChild(actions);
    inner.appendChild(head);
    inner.appendChild(body);
    panel.appendChild(inner);
    root.appendChild(panel);

    dialogState.panel = panel;
    dialogState.keyHandler = function (event) {
      if (!dialogState.active) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissActiveDialog();
        return;
      }
      if (event.key === 'Enter' && dialogState.active.kind === 'prompt' && field && event.target === field && !field.readOnly) {
        if (field.tagName === 'TEXTAREA' && event.shiftKey) return;
        event.preventDefault();
        settleActiveDialog(field.value);
      }
    };
    document.addEventListener('keydown', dialogState.keyHandler, true);

    if (field) {
      focusField(field, !(item.options && item.options.readOnly) || !!(item.options && item.options.selectOnOpen));
    } else {
      focusField(actions.querySelector('[data-portal-primary="true"]'), false);
    }
  }

  function showNextDialog() {
    if (dialogState.active || !dialogState.queue.length) return;
    dialogState.active = dialogState.queue.shift();
    renderDialog(dialogState.active);
  }

  function enqueue(kind, message, value, options) {
    if (!document || !document.createElement) {
      if (kind === 'confirm') return Promise.resolve(nativeConfirm(text(message)));
      if (kind === 'prompt') return Promise.resolve(nativePrompt(text(message), text(value)));
      nativeAlert(text(message));
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      dialogState.queue.push({
        kind: kind,
        message: text(message),
        value: value,
        options: options && typeof options === 'object' ? options : {},
        resolve: resolve
      });
      showNextDialog();
    });
  }

  var api = {
    __initialized: true,
    alert: function (message, options) {
      return enqueue('alert', message, '', options);
    },
    confirm: function (message, options) {
      return enqueue('confirm', message, '', options);
    },
    prompt: function (message, defaultValue, options) {
      return enqueue('prompt', message, defaultValue, options);
    },
    copy: function (title, value, options) {
      var nextOptions = Object.assign({
        title: title || 'Copy',
        confirmText: 'Done',
        readOnly: true,
        showCancel: false,
        selectOnOpen: true,
        helperText: 'Select the text above and copy it manually if needed.'
      }, options || {});
      return enqueue('prompt', nextOptions.message || 'Select the content below.', value, nextOptions);
    },
    nativeAlert: nativeAlert,
    nativeConfirm: nativeConfirm,
    nativePrompt: nativePrompt
  };

  window.portalDialogs = api;
  window.portalAlert = api.alert;
  window.portalConfirm = api.confirm;
  window.portalPrompt = api.prompt;
  window.portalCopyDialog = api.copy;
  window.alert = function (message) {
    api.alert(message);
  };
})();

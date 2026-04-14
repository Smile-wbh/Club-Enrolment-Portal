(function (window, document) {
  if (window.membershipJoinDialog && window.membershipJoinDialog.__initialized) return;

  var dialogState = {
    root: null,
    activeTarget: '',
    previousFocus: null,
    keyHandler: null
  };

  var dialogCopy = {
    title: 'Join Membership',
    lead: 'Become a member and enjoy a better booking experience.',
    intro: 'You will receive a weekly coupon code, and by entering a valid code during booking, you can <strong>waive the Platform Service Fee</strong> and then enjoy an <strong>extra £2 discount</strong> on clubs and courses.',
    benefits: [
      'Weekly coupon code',
      'Platform Service Fee waived',
      'Extra £2 discount',
      'Valid for club and course bookings'
    ],
    price: '£20 <small>/ month</small>',
    cancelText: 'Cancel',
    continueText: 'Continue to Payment'
  };

  function text(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function buildDialog() {
    if (dialogState.root) return dialogState.root;

    var root = document.createElement('div');
    root.className = 'membership-join-dialog-root';
    root.hidden = true;
    root.innerHTML = [
      '<div class="membership-join-dialog" role="dialog" aria-modal="true" aria-labelledby="membershipJoinDialogTitle">',
      '  <div class="membership-join-dialog__head">',
      '    <button class="membership-join-dialog__close" type="button" aria-label="Close">×</button>',
      '    <h2 class="membership-join-dialog__title" id="membershipJoinDialogTitle"></h2>',
      '  </div>',
      '  <div class="membership-join-dialog__body">',
      '    <p class="membership-join-dialog__lead"></p>',
      '    <p class="membership-join-dialog__intro"></p>',
      '    <ul class="membership-join-dialog__benefits"></ul>',
      '  </div>',
      '  <div class="membership-join-dialog__price"></div>',
      '  <div class="membership-join-dialog__actions">',
      '    <button class="membership-join-dialog__btn membership-join-dialog__btn--secondary" type="button" data-membership-dialog-cancel></button>',
      '    <button class="membership-join-dialog__btn membership-join-dialog__btn--primary" type="button" data-membership-dialog-continue></button>',
      '  </div>',
      '</div>'
    ].join('');

    root.addEventListener('click', function (event) {
      if (event.target === root) closeDialog();
    });

    root.querySelector('.membership-join-dialog__close').addEventListener('click', closeDialog);
    root.querySelector('[data-membership-dialog-cancel]').addEventListener('click', closeDialog);
    root.querySelector('[data-membership-dialog-continue]').addEventListener('click', function () {
      var target = text(dialogState.activeTarget || 'membership-payment.html');
      closeDialog();
      if (target) {
        window.location.href = target;
      }
    });

    (document.body || document.documentElement).appendChild(root);
    dialogState.root = root;
    renderDialog();
    return root;
  }

  function renderDialog() {
    var root = buildDialog();
    root.querySelector('.membership-join-dialog__title').textContent = dialogCopy.title;
    root.querySelector('.membership-join-dialog__lead').textContent = dialogCopy.lead;
    root.querySelector('.membership-join-dialog__intro').innerHTML = dialogCopy.intro;
    root.querySelector('.membership-join-dialog__price').innerHTML = dialogCopy.price;
    root.querySelector('[data-membership-dialog-cancel]').textContent = dialogCopy.cancelText;
    root.querySelector('[data-membership-dialog-continue]').textContent = dialogCopy.continueText;

    var list = root.querySelector('.membership-join-dialog__benefits');
    list.innerHTML = '';
    dialogCopy.benefits.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = text(item);
      list.appendChild(li);
    });
  }

  function attachKeyHandler() {
    if (dialogState.keyHandler) return;
    dialogState.keyHandler = function (event) {
      if (!dialogState.root || dialogState.root.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
      }
    };
    document.addEventListener('keydown', dialogState.keyHandler, true);
  }

  function detachKeyHandler() {
    if (!dialogState.keyHandler) return;
    document.removeEventListener('keydown', dialogState.keyHandler, true);
    dialogState.keyHandler = null;
  }

  function openDialog(targetHref, trigger) {
    var root = buildDialog();
    dialogState.activeTarget = text(targetHref || 'membership-payment.html');
    dialogState.previousFocus = trigger || document.activeElement;
    root.hidden = false;
    document.body.classList.add('membership-join-dialog-open');
    attachKeyHandler();
    window.requestAnimationFrame(function () {
      var continueButton = root.querySelector('[data-membership-dialog-continue]');
      if (continueButton && typeof continueButton.focus === 'function') {
        continueButton.focus();
      }
    });
  }

  function closeDialog() {
    if (!dialogState.root) return;
    dialogState.root.hidden = true;
    dialogState.activeTarget = '';
    document.body.classList.remove('membership-join-dialog-open');
    detachKeyHandler();
    if (dialogState.previousFocus && typeof dialogState.previousFocus.focus === 'function') {
      try {
        dialogState.previousFocus.focus();
      } catch (error) {}
    }
    dialogState.previousFocus = null;
  }

  function handleTriggerClick(event) {
    var trigger = event.target.closest('[data-membership-join-trigger]');
    if (!trigger) return;
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    openDialog(trigger.getAttribute('data-membership-dialog-target') || trigger.getAttribute('href'), trigger);
  }

  function init() {
    buildDialog();
    document.addEventListener('click', handleTriggerClick);
  }

  window.membershipJoinDialog = {
    __initialized: true,
    open: openDialog,
    close: closeDialog
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window, document);

(function () {
  if (window.PSPWidget) {
    return;
  }

  var script = document.currentScript;
  if (!script) {
    console.error('[PSPWidget] cannot resolve script element');
    return;
  }

  var urlObj;
  try {
    if (typeof URL === 'undefined') {
      throw new Error('URL constructor missing');
    }
    urlObj = new URL(script.src);
  } catch (e) {
    console.error('[PSPWidget] failed to parse script URL');
    return;
  }

  var origin = urlObj.origin;
  var protocol = urlObj.protocol;
  var hostname = urlObj.hostname;

  var isAllowed = false;
  if (protocol === 'https:') {
    isAllowed = true;
  } else if (protocol === 'http:') {
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    console.error('[PSPWidget] refusing to load over insecure origin: ' + origin);
    return;
  }

  var widgetId = script.getAttribute('data-widget-id') || '';
  var rawTheme = script.getAttribute('data-theme') || 'light';
  var theme = rawTheme === 'dark' ? 'dark' : 'light';
  var rawPosition = script.getAttribute('data-position') || 'bottom-right';
  var position = rawPosition === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  var base = origin;

  var launcherEl = null;
  var panelEl = null;
  var iframeEl = null;
  var stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    if (document.getElementById('pspw-styles')) {
      stylesInjected = true;
      return;
    }

    var css =
      '.pspw-launcher {\n' +
      '  position: fixed;\n' +
      '  bottom: 20px;\n' +
      '  width: 56px;\n' +
      '  height: 56px;\n' +
      '  border-radius: 50%;\n' +
      '  background-color: #2563eb;\n' +
      '  color: #ffffff;\n' +
      '  border: none;\n' +
      '  cursor: pointer;\n' +
      '  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);\n' +
      '  z-index: 999999;\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: center;\n' +
      '  transition: transform 0.2s ease, background-color 0.2s ease;\n' +
      '  padding: 0;\n' +
      '}\n' +
      '.pspw-launcher:hover {\n' +
      '  background-color: #1d4ed8;\n' +
      '  transform: scale(1.05);\n' +
      '}\n' +
      '.pspw-launcher:active {\n' +
      '  transform: scale(0.95);\n' +
      '}\n' +
      '.pspw-panel {\n' +
      '  position: fixed;\n' +
      '  width: 380px;\n' +
      '  height: 640px;\n' +
      '  max-width: calc(100vw - 40px);\n' +
      '  max-height: calc(100vh - 40px);\n' +
      '  bottom: 88px;\n' +
      '  z-index: 999999;\n' +
      '  border-radius: 12px;\n' +
      '  overflow: hidden;\n' +
      '  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);\n' +
      '  background-color: #ffffff;\n' +
      '  display: flex;\n' +
      '  flex-direction: column;\n' +
      '}\n' +
      '.pspw-hidden {\n' +
      '  display: none !important;\n' +
      '}\n' +
      '.pspw-header {\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: space-between;\n' +
      '  padding: 12px 16px;\n' +
      '  background-color: #ffffff;\n' +
      '  color: #1e293b;\n' +
      '  border-bottom: 1px solid #e2e8f0;\n' +
      '}\n' +
      '.pspw-title {\n' +
      '  font-size: 16px;\n' +
      '  font-weight: 600;\n' +
      '  margin: 0;\n' +
      '  font-family: system-ui, -apple-system, sans-serif;\n' +
      '}\n' +
      '.pspw-close {\n' +
      '  background: transparent;\n' +
      '  border: none;\n' +
      '  color: #64748b;\n' +
      '  cursor: pointer;\n' +
      '  font-size: 24px;\n' +
      '  line-height: 1;\n' +
      '  padding: 4px;\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: center;\n' +
      '  transition: color 0.2s;\n' +
      '}\n' +
      '.pspw-close:hover {\n' +
      '  color: #0f172a;\n' +
      '}\n' +
      '.pspw-iframe {\n' +
      '  flex: 1;\n' +
      '  border: 0;\n' +
      '  width: 100%;\n' +
      '  height: 100%;\n' +
      '}\n' +
      '.pspw-pos-right {\n' +
      '  right: 20px;\n' +
      '}\n' +
      '.pspw-pos-left {\n' +
      '  left: 20px;\n' +
      '}\n' +
      '@media (max-width: 480px) {\n' +
      '  .pspw-panel {\n' +
      '    top: 0 !important;\n' +
      '    left: 0 !important;\n' +
      '    right: 0 !important;\n' +
      '    bottom: 0 !important;\n' +
      '    width: 100% !important;\n' +
      '    height: 100% !important;\n' +
      '    max-width: none !important;\n' +
      '    max-height: none !important;\n' +
      '    border-radius: 0 !important;\n' +
      '  }\n' +
      '}';

    if (theme === 'dark') {
      css += '\n.pspw-dark {\n' +
        '  background-color: #1f2937 !important;\n' +
        '  color: #f3f4f6 !important;\n' +
        '  border-color: #374151 !important;\n' +
        '}\n' +
        '.pspw-dark .pspw-header {\n' +
        '  background-color: #1f2937 !important;\n' +
        '  color: #f3f4f6 !important;\n' +
        '  border-bottom-color: #374151 !important;\n' +
        '}\n' +
        '.pspw-dark .pspw-close {\n' +
        '  color: #9ca3af !important;\n' +
        '}\n' +
        '.pspw-dark .pspw-close:hover {\n' +
        '  color: #ffffff !important;\n' +
        '}';
    }

    var styleEl = document.createElement('style');
    styleEl.id = 'pspw-styles';
    styleEl.type = 'text/css';
    if (styleEl.styleSheet) {
      styleEl.styleSheet.cssText = css;
    } else {
      styleEl.appendChild(document.createTextNode(css));
    }
    document.head.appendChild(styleEl);
    stylesInjected = true;
  }

  function ensurePanel() {
    if (panelEl) return;

    panelEl = document.createElement('div');
    panelEl.className = 'pspw-panel pspw-hidden';
    if (theme === 'dark') {
      panelEl.className += ' pspw-dark';
    }
    if (position === 'bottom-left') {
      panelEl.className += ' pspw-pos-left';
    } else {
      panelEl.className += ' pspw-pos-right';
    }
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', 'Trợ lý thủ tục hành chính');

    var headerEl = document.createElement('div');
    headerEl.className = 'pspw-header';

    var titleEl = document.createElement('div');
    titleEl.className = 'pspw-title';
    titleEl.appendChild(document.createTextNode('Trợ lý thủ tục hành chính'));

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'pspw-close';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.appendChild(document.createTextNode('×'));
    closeBtn.onclick = closePanel;

    headerEl.appendChild(titleEl);
    headerEl.appendChild(closeBtn);
    panelEl.appendChild(headerEl);

    iframeEl = document.createElement('iframe');
    iframeEl.className = 'pspw-iframe';
    iframeEl.setAttribute('title', 'Trợ lý thủ tục hành chính');
    iframeEl.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    iframeEl.setAttribute('referrerpolicy', 'no-referrer');
    iframeEl.referrerPolicy = 'no-referrer';

    var srcUrl = base + '/chat?embed=1';
    if (widgetId) {
      srcUrl += '&widgetId=' + encodeURIComponent(widgetId);
    }
    iframeEl.src = srcUrl;

    panelEl.appendChild(iframeEl);
    document.body.appendChild(panelEl);
  }

  function openPanel() {
    if (!document.body) return;
    injectStyles();
    ensurePanel();
    panelEl.classList.remove('pspw-hidden');
    if (launcherEl) {
      launcherEl.setAttribute('aria-expanded', 'true');
    }
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.classList.add('pspw-hidden');
    if (launcherEl) {
      launcherEl.setAttribute('aria-expanded', 'false');
    }
  }

  function togglePanel() {
    if (!panelEl || panelEl.classList.contains('pspw-hidden')) {
      openPanel();
    } else {
      closePanel();
    }
  }

  function bootstrap() {
    injectStyles();

    launcherEl = document.createElement('button');
    launcherEl.type = 'button';
    launcherEl.className = 'pspw-launcher';
    if (theme === 'dark') {
      launcherEl.className += ' pspw-dark';
    }
    if (position === 'bottom-left') {
      launcherEl.className += ' pspw-pos-left';
    } else {
      launcherEl.className += ' pspw-pos-right';
    }
    launcherEl.setAttribute('aria-label', 'Mở trợ lý thủ tục hành chính');
    launcherEl.setAttribute('aria-expanded', 'false');

    var iconSpan = document.createElement('span');
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.appendChild(document.createTextNode('💬'));
    launcherEl.appendChild(iconSpan);

    launcherEl.onclick = togglePanel;

    document.body.appendChild(launcherEl);
  }

  if (document.body) {
    bootstrap();
  } else {
    document.addEventListener('DOMContentLoaded', bootstrap);
  }

  window.PSPWidget = {
    open: openPanel,
    close: closePanel
  };
})();
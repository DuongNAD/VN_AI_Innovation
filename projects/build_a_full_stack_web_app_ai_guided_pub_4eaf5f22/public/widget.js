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
      '  bottom: 24px;\n' +
      '  width: 60px;\n' +
      '  height: 60px;\n' +
      '  border-radius: 50%;\n' +
      '  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);\n' +
      '  color: #ffffff;\n' +
      '  border: none;\n' +
      '  cursor: pointer;\n' +
      '  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);\n' +
      '  z-index: 999999;\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: center;\n' +
      '  transition: transform 0.2s ease, box-shadow 0.2s ease;\n' +
      '  padding: 0;\n' +
      '  font-size: 28px;\n' +
      '}\n' +
      '.pspw-launcher:hover {\n' +
      '  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);\n' +
      '  transform: scale(1.1);\n' +
      '  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);\n' +
      '}\n' +
      '.pspw-launcher:active {\n' +
      '  transform: scale(0.95);\n' +
      '}\n' +
      '.pspw-panel {\n' +
      '  position: fixed;\n' +
      '  width: 400px;\n' +
      '  height: 650px;\n' +
      '  max-width: calc(100vw - 32px);\n' +
      '  max-height: calc(100vh - 120px);\n' +
      '  bottom: 100px;\n' +
      '  z-index: 999998;\n' +
      '  border-radius: 16px;\n' +
      '  overflow: hidden;\n' +
      '  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);\n' +
      '  background-color: #0f172a;\n' +
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
      '  padding: 16px 20px;\n' +
      '  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);\n' +
      '  color: #ffffff;\n' +
      '  border-bottom: none;\n' +
      '}\n' +
      '.pspw-title {\n' +
      '  font-size: 16px;\n' +
      '  font-weight: 600;\n' +
      '  margin: 0;\n' +
      '  font-family: system-ui, -apple-system, sans-serif;\n' +
      '  color: #ffffff;\n' +
      '}\n' +
      '.pspw-close {\n' +
      '  background: rgba(255, 255, 255, 0.2);\n' +
      '  border: none;\n' +
      '  color: #ffffff;\n' +
      '  cursor: pointer;\n' +
      '  font-size: 24px;\n' +
      '  line-height: 1;\n' +
      '  padding: 8px 12px;\n' +
      '  border-radius: 8px;\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: center;\n' +
      '  transition: background 0.2s;\n' +
      '}\n' +
      '.pspw-close:hover {\n' +
      '  background: rgba(255, 255, 255, 0.3);\n' +
      '}\n' +
      '.pspw-iframe {\n' +
      '  flex: 1;\n' +
      '  border: 0;\n' +
      '  width: 100%;\n' +
      '  height: 100%;\n' +
      '}\n' +
      '.pspw-pos-right {\n' +
      '  right: 24px;\n' +
      '}\n' +
      '.pspw-pos-left {\n' +
      '  left: 24px;\n' +
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
      '  .pspw-launcher {\n' +
      '    bottom: 16px;\n' +
      '    right: 16px;\n' +
      '    left: auto;\n' +
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

    var srcUrl = base + '/user/chat?embed=1';
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
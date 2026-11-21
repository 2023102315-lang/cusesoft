  (function () {
  try {
    var t = localStorage.getItem('cusesoft_theme_v1');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
      if (t === 'light') {
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.setAttribute('content', '#f7f5fc');
      }
    }
  } catch (e) {}
})();

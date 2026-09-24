/* Tag-/Nachtmodus: früh geladen, damit die Seite nicht aufblitzt. */
(function () {
  var saved = null;
  try { saved = localStorage.getItem('bsn_theme'); } catch (e) {}
  if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);

  function current() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paint() {
    var dark = current() === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.querySelector('.tt-label').textContent = dark ? 'Nachtmodus' : 'Tagesmodus';
      b.querySelector('.tt-sun').hidden = dark;
      b.querySelector('.tt-moon').hidden = !dark;
      b.setAttribute('aria-pressed', dark ? 'true' : 'false');
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('bsn_theme', next); } catch (e) {}
        paint();
      });
    });
    paint();
  });
})();

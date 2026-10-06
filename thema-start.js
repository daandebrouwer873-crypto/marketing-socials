// Zet de gekozen weergave vóór de eerste weergave, zodat er niets knippert.
(function () {
  var thema = 'donker';
  try { thema = localStorage.getItem('pellens-marketing-thema') || 'donker'; } catch (fout) { /* privémodus */ void fout; }
  if (thema !== 'licht' && thema !== 'groen') thema = 'donker';
  document.documentElement.setAttribute('data-thema', thema);
}());

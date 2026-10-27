(function () {
  'use strict'
  const shell = document.querySelector('.course-shell')
  if (!shell) return
  const tools = document.createElement('div')
  tools.className = 'practice-tools'
  tools.innerHTML = '<button type="button" id="practice-toggle" aria-controls="practice-preview" aria-expanded="false">Vis Vibb</button><a href="workspace.html" target="_blank" rel="noopener">App og kode i ny fane</a>'
  const panel = document.createElement('section')
  panel.id = 'practice-preview'
  panel.hidden = true
  panel.setAttribute('aria-labelledby', 'practice-title')
  panel.innerHTML = '<div class="practice-preview-heading"><h2 id="practice-title">Vibb · øvingskopi</h2><button type="button" id="practice-close">Lukk appen</button></div><p>Prøv et humør og se hva som skjer. Dette er egne øvingsdata.</p><p id="practice-load-status" role="status">Laster Vibb …</p><iframe id="practice-frame" title="Vibb – øvingskopi ved siden av øvelsen" referrerpolicy="no-referrer"></iframe>'
  const toolbar = shell.querySelector('.studio-toolbar')
  toolbar.after(tools, panel)
  const toggle = tools.querySelector('button')
  const frame = panel.querySelector('iframe')
  frame.addEventListener('load', function () {
    let loaded = false
    try { loaded = Boolean(frame.contentDocument.querySelector('#root')) } catch {}
    panel.querySelector('#practice-load-status').textContent = loaded ? '' : 'Kunne ikke laste Vibb. Last siden på nytt, eller logg inn igjen via Admin.'
    panel.querySelector('#practice-load-status').hidden = loaded
  })
  tools.querySelector('a').addEventListener('click', function () {
    const context = window.VIBB_STUDIO?.tutorContext()
    const url = new URL('workspace.html', document.baseURI)
    const file = context?.file || window.VIBB_CORE.lesson().files[0]
    if (file) url.searchParams.set('file', file)
    this.href = url.href
  })
  function closePreview(restoreFocus) {
    panel.hidden = true
    document.body.classList.remove('practice-open')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.textContent = 'Vis Vibb'
    if (restoreFocus) toggle.focus()
  }
  toggle.addEventListener('click', function () {
    if (!panel.hidden) { closePreview(false); return }
    const tutorClose = document.querySelector('#tutor-close')
    if (document.body.classList.contains('tutor-open') && tutorClose) tutorClose.click()
    if (!frame.getAttribute('src')) frame.src = 'app/'
    panel.hidden = false
    document.body.classList.add('practice-open')
    toggle.setAttribute('aria-expanded', 'true')
    toggle.textContent = 'Skjul Vibb'
  })
  panel.querySelector('button').addEventListener('click', function () { closePreview(true) })
  new MutationObserver(function () {
    if (document.body.classList.contains('tutor-open') && !panel.hidden) closePreview(false)
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] })
})()

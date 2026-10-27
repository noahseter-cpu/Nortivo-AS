(function () {
  'use strict'
  const sources = window.VIBB_COURSE.sources
  const metadata = window.VIBB_EXAM.fileMap
  const picker = document.querySelector('#workspace-file')
  const reader = document.querySelector('#workspace-code')
  const info = document.querySelector('#workspace-file-info')
  const result = document.querySelector('#workspace-search-result')
  const frame = document.querySelector('#workspace-app')
  document.querySelector('.skip-link').href = location.pathname + location.search + '#workspace-main'
  const routes = { 'Register.jsx': '', 'History.jsx': 'history', 'About.jsx': 'about' }
  let currentFile = 'Header.jsx'
  const requestedFile = new URLSearchParams(location.search).get('file')
  if (requestedFile && Object.hasOwn(sources, requestedFile)) currentFile = requestedFile
  if (requestedFile && Object.hasOwn(routes, currentFile)) frame.src = 'app/' + routes[currentFile]
  let markedLine = 0
  frame.addEventListener('load', function () {
    const status = document.querySelector('#workspace-app-status')
    let loaded = false
    try { loaded = Boolean(frame.contentDocument.querySelector('#root')) } catch {}
    status.hidden = loaded
    if (!loaded) status.textContent = 'Kunne ikke laste Vibb. Last siden på nytt, eller logg inn igjen via Admin.'
  })

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
    })
  }
  function colorLine(line) {
    const tokens = /("[^"\n]*"|'[^'\n]*'|\/\/.*$|\b(?:import|from|export|default|function|return|const|let|if|else|async|await|try|catch|throw|new|true|false)\b)/g
    let output = '', position = 0, match
    while ((match = tokens.exec(line))) {
      output += escapeText(line.slice(position, match.index))
      const type = match[0].startsWith('//') ? 'tok-comment' : /^["']/.test(match[0]) ? 'tok-string' : 'tok-keyword'
      output += '<span class="' + type + '">' + escapeText(match[0]) + '</span>'
      position = match.index + match[0].length
    }
    return output + escapeText(line.slice(position))
  }
  function filePath(file) {
    if (/^(index\.html|package\.json|tests\/|docs\/)/.test(file)) return file
    return 'src/' + file
  }
  function showFile() {
    picker.value = currentFile
    reader.innerHTML = sources[currentFile].split('\n').map(function (line, index) {
      return '<div class="code-line' + (markedLine === index + 1 ? ' marked' : '') + '"><span class="line-number">' + (index + 1) + '</span><code>' + colorLine(line || ' ') + '</code></div>'
    }).join('')
    reader.setAttribute('aria-label', 'Kildekode: ' + filePath(currentFile))
    const file = metadata.find(function (entry) { return entry.file === currentFile })
    info.innerHTML = '<p>' + escapeText(file?.role || (currentFile === 'Help.jsx' ? 'Kursmal for en ny side.' : 'Lesekopi fra prosjektet.')) + '</p>'
    if (Object.hasOwn(routes, currentFile)) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = 'Vis denne siden i Vibb'
      button.addEventListener('click', function () {
        const status = document.querySelector('#workspace-app-status')
        status.textContent = 'Laster Vibb …'
        status.hidden = false
        frame.src = 'app/' + routes[currentFile]
      })
      info.append(button)
    }
    const hit = reader.querySelector('.marked')
    if (hit) reader.scrollTop = hit.offsetTop - reader.offsetTop - 65
    else reader.scrollTop = 0
  }
  for (const file of Object.keys(sources)) {
    const option = document.createElement('option')
    option.value = file
    option.textContent = filePath(file)
    picker.append(option)
  }
  picker.addEventListener('change', function () {
    currentFile = picker.value
    markedLine = 0
    result.textContent = ''
    document.querySelector('#workspace-search').value = ''
    showFile()
  })
  document.querySelector('#workspace-search-form').addEventListener('submit', function (event) {
    event.preventDefault()
    const query = document.querySelector('#workspace-search').value.trim().toLowerCase()
    if (!query) { result.textContent = 'Skriv et ord eller navn først.'; return }
    const lines = sources[currentFile].split('\n')
    let index = lines.findIndex(function (line, index) { return index >= markedLine && line.toLowerCase().includes(query) })
    if (index < 0) index = lines.findIndex(function (line) { return line.toLowerCase().includes(query) })
    markedLine = index + 1
    result.textContent = index < 0 ? 'Ingen treff i denne filen. Prøv et kortere navn.' : 'Treff på linje ' + markedLine + '. Trykk Finn for neste treff.'
    showFile()
  })
  document.querySelectorAll('[data-layout]').forEach(function (button) {
    if (button.tagName !== 'BUTTON') return
    button.addEventListener('click', function () {
      document.querySelector('.workspace-columns').dataset.layout = button.dataset.layout
      document.querySelectorAll('.workspace-modes button').forEach(function (choice) { choice.setAttribute('aria-pressed', String(choice === button)) })
    })
  })
  showFile()
})()

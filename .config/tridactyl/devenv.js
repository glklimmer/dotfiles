(() => {
  const m = location.pathname.match(/^\/(.+?)\/-\/merge_requests\/(\d+)/)
  if (!m) { alert('Not a merge request page'); return }
  const x = new content.XMLHttpRequest()
  x.open('GET', '/api/v4/projects/' + encodeURIComponent(m[1]) + '/merge_requests/' + m[2], false)
  x.send()
  if (x.status != 200) { alert('API ' + x.status); return }
  const s = JSON.parse(x.responseText).source_branch
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n << 24
    for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04C11DB7 : c << 1
    t[n] = c >>> 0
  }
  const b = new TextEncoder().encode(s)
  let crc = 0
  for (let i = 0; i < b.length; i++) crc = ((crc << 8) ^ t[((crc >>> 24) ^ b[i]) & 255]) >>> 0
  for (let l = b.length; l; l >>>= 8) crc = ((crc << 8) ^ t[((crc >>> 24) ^ (l & 255)) & 255]) >>> 0
  crc = (~crc) >>> 0
  const d = s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-/, '').replace(/-$/, '').slice(0, 24)
  const u = 'http://' + d + '.localhost:' + (3101 + crc - Math.floor(crc / 999) * 999)
  tri.excmds.tabopen(u)
})()

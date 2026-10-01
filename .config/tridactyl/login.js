(() => {
  const password = JS_ARGS.slice(1).join(' ')
  const set = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  set(document.querySelector('input[type="text"]'), 'denteo_admin')
  set(document.querySelector('input[type="password"]'), password)
})()

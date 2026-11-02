export function evidenceView() {
  const el = document.createElement('section');
  el.innerHTML = '<header class="page-head"><h1>Evidence</h1><p class="lede">Measured results appear here once the evaluation has run.</p></header>';
  return { el, destroy() {} };
}

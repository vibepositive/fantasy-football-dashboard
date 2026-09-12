(() => {
  function closeAll(except = null) {
    document.querySelectorAll('.trade-v2-tooltip.is-open').forEach(el => {
      if (el !== except) el.classList.remove('is-open');
    });
  }

  document.addEventListener('click', event => {
    const tip = event.target.closest('.trade-v2-tooltip');
    if (tip) {
      event.preventDefault();
      event.stopPropagation();
      const open = !tip.classList.contains('is-open');
      closeAll(tip);
      tip.classList.toggle('is-open', open);
      return;
    }
    closeAll();
  });

  document.addEventListener('keydown', event => {
    const tip = event.target.closest?.('.trade-v2-tooltip');
    if (!tip) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const open = !tip.classList.contains('is-open');
      closeAll(tip);
      tip.classList.toggle('is-open', open);
    }
    if (event.key === 'Escape') closeAll();
  });
})();

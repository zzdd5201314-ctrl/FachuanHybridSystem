(function () {
  function syncReminderPanel(root) {
    const checkbox = root.querySelector('#id_enable_reminder');
    const panel = root.querySelector('[data-reminder-fields]');
    if (!checkbox || !panel) {
      return;
    }

    const inputs = panel.querySelectorAll('input, select, textarea');
    const enabled = Boolean(checkbox.checked);

    panel.hidden = !enabled;
    panel.classList.toggle('is-collapsed', !enabled);

    inputs.forEach((input) => {
      input.disabled = !enabled;
    });
  }

  function syncArchivePanel(root, expanded) {
    const button = root.querySelector('[data-archive-toggle]');
    const panel = root.querySelector('[data-archive-fields]');
    if (!button || !panel) {
      return;
    }

    const openLabel = button.dataset.labelOpen || '查看归档说明';
    const closeLabel = button.dataset.labelClose || '收起归档说明';

    panel.hidden = !expanded;
    panel.classList.toggle('is-collapsed', !expanded);
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.textContent = expanded ? closeLabel : openLabel;
  }

  function initCaseLogForm(root) {
    const checkbox = root.querySelector('#id_enable_reminder');
    const archiveButton = root.querySelector('[data-archive-toggle]');

    if (checkbox) {
      checkbox.addEventListener('change', function () {
        syncReminderPanel(root);
      });

      syncReminderPanel(root);
    }

    if (archiveButton) {
      archiveButton.addEventListener('click', function () {
        const expanded = archiveButton.getAttribute('aria-expanded') === 'true';
        syncArchivePanel(root, !expanded);
      });

      syncArchivePanel(root, false);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-case-log-form]').forEach(function (root) {
      initCaseLogForm(root);
    });
  });
})();

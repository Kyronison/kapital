import { updateSettings, useSettings } from '../settings.js';

/** Подсказки и режим отчёта выбираются перед партией или уровнем, а не в отдельном разделе. */
export function LearningOptions() {
  const settings = useSettings();
  return (
    <fieldset className="learning">
      <label className="toggle">
        <input type="checkbox" checked={settings.hints} onChange={(e) => updateSettings({ hints: e.target.checked, seenHints: e.target.checked ? [] : settings.seenHints })} />
        <span><strong>Подсказки во время игры</strong><small className="muted">Наставник объясняет, что происходит, в первый раз.</small></span>
      </label>
      <div className="report-mode" role="radiogroup" aria-label="Финансовый отчёт">
        <span>Финансовый отчёт</span>
        <label className={settings.fillReport ? '' : 'checked'}>
          <input type="radio" name="report" checked={!settings.fillReport} onChange={() => updateSettings({ fillReport: false })} />
          заполняется сам
        </label>
        <label className={settings.fillReport ? 'checked' : ''}>
          <input type="radio" name="report" checked={settings.fillReport} onChange={() => updateSettings({ fillReport: true })} />
          заполняю сам
        </label>
      </div>
    </fieldset>
  );
}

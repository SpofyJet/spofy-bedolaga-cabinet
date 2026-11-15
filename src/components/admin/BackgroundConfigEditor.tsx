import { useTranslation } from 'react-i18next';
import { BackgroundPreview } from '@/components/backgrounds/BackgroundPreview';
import type { AnimationConfig } from '@/components/backgrounds/types';
import { Toggle } from './Toggle';

interface BackgroundConfigEditorProps {
  value: AnimationConfig;
  onChange: (config: AnimationConfig) => void;
}

/** Настройка фона «чернила»: включить и выбрать яркость. Эффект один — выбирать тип не из чего. */
export function BackgroundConfigEditor({ value: config, onChange }: BackgroundConfigEditorProps) {
  const { t } = useTranslation();
  const enabled = config.enabled && config.type !== 'none';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-dark-100">{t('admin.backgrounds.title')}</h3>
          <p className="text-sm text-dark-400">{t('admin.backgrounds.description')}</p>
        </div>
        <Toggle
          checked={enabled}
          aria-label={t('admin.backgrounds.title')}
          onChange={() => onChange({ ...config, type: 'ink', enabled: !enabled })}
        />
      </div>

      {enabled && (
        <>
          <div>
            <span className="mb-2 block text-sm font-medium text-dark-300">
              {t('admin.backgrounds.preview')}
            </span>
            <BackgroundPreview enabled opacity={config.opacity} className="h-48" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-3xl bg-dark-900/70 p-4">
            <label htmlFor="ink-intensity" className="min-w-0 text-sm text-dark-300">
              {t('admin.backgrounds.intensity')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="ink-intensity"
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={config.opacity}
                onChange={(e) => onChange({ ...config, opacity: parseFloat(e.target.value) })}
                className="w-28 accent-accent-500"
              />
              <span className="w-12 text-right text-[13px] tabular-nums text-dark-400">
                {Math.round(config.opacity * 100)}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

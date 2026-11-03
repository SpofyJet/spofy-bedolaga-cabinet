import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useStorySeries } from './registry';
import { useStoryRead } from './useStoryRead';
import { StoryViewer } from './StoryViewer';

import './stories.css';

/**
 * Лента обложек сторис: иконка серии, короткий заголовок, кольцо в цвет серии,
 * пока серия не просмотрена. Порядок постоянный — нужная серия всегда на том же
 * месте, просмотренные просто становятся спокойнее.
 */
export function StoryRail() {
  const { t } = useTranslation();
  const { isRead } = useStoryRead();
  const series = useStorySeries();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (series.length === 0) return null;

  return (
    <>
      <div className="story-rail" role="list" aria-label={t('stories.sectionTitle')}>
        {series.map(({ meta, coverTitle }, index) => {
          const read = isRead(meta.id);
          const Icon = meta.icon;
          return (
            <button
              key={meta.id}
              type="button"
              role="listitem"
              className={`story-cover${read ? ' story-cover-read' : ''}`}
              style={{ '--story-accent': meta.accent } as React.CSSProperties}
              onClick={() => setOpenIndex(index)}
              aria-label={coverTitle}
            >
              <span className="story-cover-icon" aria-hidden>
                <Icon />
              </span>
              <span className="story-cover-title">{coverTitle}</span>
            </button>
          );
        })}
      </div>

      {openIndex !== null && (
        <StoryViewer initialIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}

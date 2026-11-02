import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { STORY_SERIES } from './registry';
import { useStoryRead } from './useStoryRead';
import { StoryViewer } from './StoryViewer';

import './stories.css';

/**
 * Горизонтальная лента обложек сторис. Обложки — сгенерированный 3D-стеклянный
 * арт серии (полнокровное изображение + скрим для заголовка). Первая серия
 * (featured) — с акцентным кольцом.
 */
export function StoryRail() {
  const { t } = useTranslation();
  const { isRead } = useStoryRead();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (STORY_SERIES.length === 0) return null;

  return (
    <>
      <div className="story-rail" role="list" aria-label={t('stories.sectionTitle')}>
        {STORY_SERIES.map((meta, index) => {
          const coverTitle = t(`stories.series.${meta.id}.coverTitle`);
          const read = isRead(meta.id);
          return (
            <button
              key={meta.id}
              type="button"
              role="listitem"
              className={`story-cover${meta.featured ? ' story-cover-featured' : ''}`}
              style={{
                background: `linear-gradient(160deg, ${meta.palette.from}, ${meta.palette.to})`,
              }}
              onClick={() => setOpenIndex(index)}
              aria-label={coverTitle}
            >
              <img className="story-cover-img" src={meta.coverImage} alt="" aria-hidden />
              {!read && (
                <span
                  className={`story-badge${meta.featured ? ' story-badge-label' : ''}`}
                  aria-hidden
                />
              )}
              <span className="story-cover-index font-mono" aria-hidden>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="story-cover-title font-display">{coverTitle}</span>
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

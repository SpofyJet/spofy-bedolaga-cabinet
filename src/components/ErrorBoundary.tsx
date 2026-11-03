import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PiWarningCircleDuotone } from 'react-icons/pi';
import i18n from '../i18n';
import { safeSession } from '../utils/safeStorage';

const tr = (key: string, fallback: string) => i18n.t(key, { defaultValue: fallback });

const PRIMARY_BUTTON =
  'inline-flex h-12 items-center justify-center rounded-2xl bg-accent-500 px-6 text-[15px] font-semibold text-on-accent transition-colors hover:bg-accent-600 active:scale-[0.98]';

function ErrorIcon() {
  return (
    <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-500/10 text-error-400">
      <PiWarningCircleDuotone className="h-7 w-7" />
    </span>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  level?: 'app' | 'page' | 'widget';
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('ChunkLoadError') ||
    error.name === 'ChunkLoadError'
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);

    // Auto-reload on chunk load failures (stale deploy)
    if (isChunkLoadError(error)) {
      const reloadKey = 'chunk_reload_ts';
      const lastReload = Number(safeSession.getItem(reloadKey) || '0');
      const now = Date.now();
      // Prevent reload loop — only auto-reload once per 30 seconds
      // См. App.tsx lazyWithRetry: без переживающей reload метки перезагрузка
      // зациклится, поэтому перезагружаемся только если метка реально легла.
      if (now - lastReload > 30_000 && safeSession.setItem(reloadKey, String(now))) {
        window.location.reload();
        return;
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { level = 'page' } = this.props;
    const isChunk = this.state.error ? isChunkLoadError(this.state.error) : false;

    if (level === 'app') {
      return (
        <div className="min-h-viewport flex items-center justify-center bg-dark-950 p-4">
          <div className="w-full max-w-md rounded-3xl bg-dark-900/70 p-6 text-center ring-1 ring-inset ring-dark-800/80">
            <ErrorIcon />
            <h1 className="mb-2 text-xl font-bold text-dark-50">
              {tr('errors.boundary.title', 'Что-то пошло не так')}
            </h1>
            <p className="mb-6 text-[15px] text-dark-400">
              {tr('errors.boundary.appText', 'Произошла ошибка. Перезагрузите страницу.')}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={PRIMARY_BUTTON}
            >
              {tr('errors.boundary.reload', 'Перезагрузить')}
            </button>
          </div>
        </div>
      );
    }

    if (level === 'widget') {
      return (
        <div className="rounded-2xl bg-error-500/10 p-4 text-center ring-1 ring-inset ring-error-500/25">
          <p className="text-sm text-error-400">
            {tr('errors.boundary.widget', 'Не удалось загрузить этот блок')}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-2 text-sm font-semibold text-accent-400 hover:text-accent-300"
          >
            {tr('errors.boundary.retry', 'Повторить')}
          </button>
        </div>
      );
    }

    // level === 'page' (default)
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-dark-900/70 p-6 text-center ring-1 ring-inset ring-dark-800/80">
          <ErrorIcon />
          <h1 className="mb-2 text-xl font-bold text-dark-50">
            {tr('errors.boundary.title', 'Что-то пошло не так')}
          </h1>
          <p className="mb-6 text-sm text-dark-400">
            {isChunk
              ? tr('errors.boundary.updated', 'Приложение обновилось. Перезагружаем…')
              : this.state.error?.message || tr('errors.boundary.pageText', 'Произошла ошибка')}
          </p>
          <button type="button" onClick={() => window.location.reload()} className={PRIMARY_BUTTON}>
            {isChunk
              ? tr('errors.boundary.reload', 'Перезагрузить')
              : tr('errors.boundary.retry', 'Повторить')}
          </button>
        </div>
      </div>
    );
  }
}

import type { LocaleDict, SupportedLocale } from '../../api/landings';
import { cn } from '../../lib/utils';

interface LocalizedInputProps {
  value: LocaleDict;
  onChange: (value: LocaleDict) => void;
  locale: SupportedLocale;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  id?: string;
  className?: string;
}

/**
 * An input (or textarea) that edits a single locale key within a LocaleDict.
 * Shows `value[locale]` and updates the dict immutably on change.
 */
export function LocalizedInput({
  value,
  onChange,
  locale,
  placeholder,
  multiline = false,
  rows = 2,
  maxLength,
  id,
  className,
}: LocalizedInputProps) {
  const currentValue = value[locale] ?? '';

  const handleChange = (newText: string) => {
    onChange({ ...value, [locale]: newText });
  };

  const inputClasses = cn(
    'w-full rounded-lg border border-dark-700 bg-dark-800 px-3 py-2 text-sm text-dark-100 outline-none focus:border-accent-500',
    className,
  );

  if (multiline) {
    return (
      <textarea
        id={id}
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={inputClasses}
      />
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={inputClasses}
    />
  );
}

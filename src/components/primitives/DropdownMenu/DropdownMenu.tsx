import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from 'react';
import { DotIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { dropdown, dropdownTransition } from '../../motion/transitions';

export { RadioGroup as DropdownMenuRadioGroup } from '@radix-ui/react-dropdown-menu';

// Root + Trigger
//
// Radix открывает меню уже на pointerdown, и касание тоже считается. В ряду чипов,
// который листают пальцем, любой свайп раскрывал бы фильтр. Для касания открываем
// по click (он не приходит, если палец поехал). Мышь и клавиатура — как у Radix.
// Click без pointerdown (VoiceOver, программный) Radix не открывает вовсе — открываем мы.

const TouchToggleContext = createContext<(() => void) | null>(null);

export type DropdownMenuProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>;

export function DropdownMenu({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  return (
    <TouchToggleContext.Provider value={toggle}>
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </TouchToggleContext.Provider>
  );
}

export type DropdownMenuTriggerProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Trigger
>;

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ onPointerDown, onPointerLeave, onClick, ...props }, ref) => {
    const toggle = useContext(TouchToggleContext);
    const pointerRef = useRef<'mouse' | 'touch' | null>(null);
    return (
      <DropdownMenuPrimitive.Trigger
        ref={ref}
        {...props}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          pointerRef.current = event.pointerType === 'mouse' ? 'mouse' : 'touch';
          // defaultPrevented выключает обработчик Radix — откроем сами по click.
          if (pointerRef.current === 'touch') event.preventDefault();
        }}
        // Нажали и увели указатель (или правая кнопка) — click не придёт; не держим «мышь»,
        // иначе следующий click без указателя (экранный диктор) проглотится.
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          pointerRef.current = null;
        }}
        onClick={(event) => {
          onClick?.(event);
          const pointer = pointerRef.current;
          pointerRef.current = null;
          // Мышь уже открыла меню на нажатии; касание и click без указателя — открываем здесь.
          if (pointer === 'mouse' || event.defaultPrevented) return;
          toggle?.();
        }}
      />
    );
  },
);

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

// Content
export type DropdownMenuContentProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  // children — внутрь motion.div: при asChild Radix отдаёт свои props ребёнку, и пункты,
  // оставленные в {...props}, перетирались бы пустым <motion.div/> — меню открывалось пустым.
  ({ className, sideOffset = 4, children, ...props }, ref) => {
    const { haptic } = usePlatform();

    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cn(
            'z-50 min-w-[8rem] overflow-hidden',
            // Непрозрачный фон: полупрозрачный пропускал текст страницы сквозь пункты
            // (backdrop-blur есть не во всех WebView).
            'rounded-xl bg-dark-900',
            'p-1 text-dark-100',
            className,
          )}
          onCloseAutoFocus={() => haptic.impact('light')}
          asChild
          {...props}
        >
          <motion.div
            variants={dropdown}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={dropdownTransition}
          >
            {children}
          </motion.div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    );
  },
);

DropdownMenuContent.displayName = 'DropdownMenuContent';

// Item
export interface DropdownMenuItemProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
  destructive?: boolean;
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, inset, destructive, ...props }, ref) => {
    const { haptic } = usePlatform();

    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex cursor-pointer select-none items-center gap-2 rounded-linear px-2 py-2',
          'text-sm outline-none transition-colors duration-150',
          destructive
            ? 'text-error-400 focus:bg-error-500/10 focus:text-error-300'
            : 'text-dark-200 focus:bg-dark-800/80 focus:text-dark-100',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          inset && 'pl-8',
          className,
        )}
        onClick={() => haptic.impact('light')}
        {...props}
      />
    );
  },
);

DropdownMenuItem.displayName = 'DropdownMenuItem';

// RadioItem
export type DropdownMenuRadioItemProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.RadioItem
>;

export const DropdownMenuRadioItem = forwardRef<HTMLDivElement, DropdownMenuRadioItemProps>(
  ({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-linear py-2 pl-8 pr-2',
        'text-sm text-dark-200 outline-none transition-colors duration-150',
        'focus:bg-dark-800/80 focus:text-dark-100',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <DotIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  ),
);

DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

// Label
export interface DropdownMenuLabelProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> {
  inset?: boolean;
}

export const DropdownMenuLabel = forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn('px-2 py-1.5 text-xs font-medium text-dark-400', inset && 'pl-8', className)}
      {...props}
    />
  ),
);

DropdownMenuLabel.displayName = 'DropdownMenuLabel';

// Separator
export type DropdownMenuSeparatorProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Separator
>;

export const DropdownMenuSeparator = forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(
  ({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-dark-700/50', className)}
      {...props}
    />
  ),
);

DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  // Base styles
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-accent-500 text-on-accent',
          // Верхний блик — кнопка выглядит объёмной, а не плоской заливкой.
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.25)]',
          'hover:bg-accent-600',
          'active:bg-accent-700 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]',
          'shadow-linear-sm hover:shadow-linear',
        ],
        secondary: [
          'bg-dark-800/80 text-dark-100',
          'border border-dark-700/50',
          'hover:bg-dark-700/80 hover:border-dark-600/50',
          'active:bg-dark-800',
        ],
        ghost: ['text-dark-300', 'hover:text-dark-100 hover:bg-dark-800/50', 'active:bg-dark-800'],
        destructive: [
          'bg-error-500/10 text-error-400',
          'border border-error-500/20',
          'hover:bg-error-500/20 hover:border-error-500/30',
          'active:bg-error-500/30',
        ],
        outline: [
          'border border-dark-700/50 text-dark-200',
          'hover:bg-dark-800/50 hover:border-dark-600/50 hover:text-dark-100',
          'active:bg-dark-800',
        ],
        link: [
          'text-accent-400',
          'hover:text-accent-300 hover:underline',
          'active:text-accent-500',
        ],
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-linear',
        md: 'h-10 px-4 text-sm rounded-linear',
        lg: 'h-12 px-6 text-base rounded-linear-lg',
        icon: 'h-10 w-10 rounded-linear',
        'icon-sm': 'h-8 w-8 rounded-linear',
        'icon-lg': 'h-12 w-12 rounded-linear-lg',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

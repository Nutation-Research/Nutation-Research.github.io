import { type HTMLAttributes, forwardRef } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'raised' | 'inset' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/** Paper cards: hairline border, whisper of shadow — no bevels, no glass. */
const variantStyles = {
  raised: 'bg-card border border-line shadow-[0_1px_2px_rgba(28,25,23,0.04)]',
  inset: 'bg-card border border-line shadow-[0_1px_2px_rgba(28,25,23,0.04)]',
  flat: 'bg-paper',
};

const paddingStyles = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ variant = 'raised', padding = 'md', children, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={[
        'rounded-xl',
        variantStyles[variant],
        paddingStyles[padding],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
);
Panel.displayName = 'Panel';

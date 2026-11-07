import type { ReactNode } from 'react';

export function Banner({
  tone = 'danger',
  children,
  action,
}: {
  tone?: 'danger' | 'warning' | 'info';
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`banner banner-${tone}`}>
      <span>{children}</span>
      {action}
    </div>
  );
}

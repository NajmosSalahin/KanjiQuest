import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/cn.js';

/** Tabs — Radix primitives, styled with the vermillion active underline (§7.8/§7.9). */
export function Tabs({ value, onValueChange, children, className, ...props }) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={cn('flex flex-col gap-4', className)}
      {...props}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabsList({ children, className, ...props }) {
  return (
    <TabsPrimitive.List
      className={cn('flex gap-5 border-b border-line-subtle', className)}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ children, className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px border-b-2 border-transparent pb-2 text-sm font-medium text-ink-secondary',
        'transition-colors duration-fast ease-out hover:text-ink-primary',
        'data-[state=active]:border-vermillion data-[state=active]:text-ink-primary',
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ children, className, ...props }) {
  return (
    <TabsPrimitive.Content className={cn('focus-visible:outline-none', className)} {...props}>
      {children}
    </TabsPrimitive.Content>
  );
}

import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

export function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root className={cn(className)} {...props} />;
}

export function TabsList({ className, ...props }) {
  return <TabsPrimitive.List className={cn('inline-flex items-center justify-center text-muted-foreground', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content className={cn('mt-2 focus-visible:outline-none', className)} {...props} />;
}
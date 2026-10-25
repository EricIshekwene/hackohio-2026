import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-3', className)} {...props} />;
}

// Segmented control: the active tab is a white chip that slides on the grey track.
function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List data-slot="tabs-list" className={cn('relative z-0 flex rounded-[10px] bg-fill p-[3px]', className)} {...props}>
      {children}
      <TabsPrimitive.Indicator className="absolute top-[3px] left-0 -z-10 h-[calc(100%-6px)] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-sm bg-surface shadow-tab transition-[translate,width] duration-200 ease-out" />
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm text-foot font-medium text-ink-2 outline-none transition-colors data-[active]:text-ink focus-visible:outline-2 focus-visible:outline-brand',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn('enter outline-none', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

declare module 'react-grid-layout' {
  import * as React from 'react';

  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
    static?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
  }

  export type Layouts = { [P: string]: Layout[] };

  export interface ResponsiveProps {
    className?: string;
    breakpoints?: { [P: string]: number };
    cols?: { [P: string]: number };
    layouts?: Layouts;
    width?: number;
    rowHeight?: number;
    draggableHandle?: string;
    compactType?: 'horizontal' | 'vertical' | null;
    isDraggable?: boolean;
    isResizable?: boolean;
    margin?: [number, number];
    containerPadding?: [number, number];
    onLayoutChange?: (currentLayout: Layout[], allLayouts: Layouts) => void;
    onDragStart?: (...args: unknown[]) => void;
    onDrag?: (...args: unknown[]) => void;
    onDragStop?: (...args: unknown[]) => void;
    onResizeStart?: (...args: unknown[]) => void;
    onResize?: (...args: unknown[]) => void;
    onResizeStop?: (...args: unknown[]) => void;
    children?: React.ReactNode;
  }

  export class Responsive extends React.Component<ResponsiveProps> {}

  export function WidthProvider<P extends object>(
    component: React.ComponentType<P>
  ): React.ComponentType<Omit<P, 'width'>>;
}

declare module 'react-grid-layout/css/styles.css' {
  const content: string;
  export default content;
}

declare module 'react-resizable/css/styles.css' {
  const content: string;
  export default content;
}

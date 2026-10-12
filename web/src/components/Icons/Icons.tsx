import type { SVGProps } from 'react';

/** Small stroke icons, 16px grid, currentColor. */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const IconExpand = () => (
  <Icon>
    <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
  </Icon>
);
export const IconCollapse = () => (
  <Icon>
    <path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" />
  </Icon>
);
export const IconPrimary = () => (
  <Icon>
    <rect x="2" y="2.5" width="8" height="11" rx="1" />
    <path d="M12.5 2.5h1.5M12.5 8h1.5M12.5 13.5h1.5" />
  </Icon>
);
export const IconReload = () => (
  <Icon>
    <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5" />
  </Icon>
);
export const IconLayout = () => (
  <Icon>
    <rect x="2" y="2.5" width="12" height="11" rx="1" />
    <path d="M9 2.5v11M9 8h5" />
  </Icon>
);
/** pulse line: video diagnostics */
export const IconDebug = () => (
  <Icon>
    <path d="M1.5 8.5h3l1.5-4 2.5 8 1.5-4h4.5" />
  </Icon>
);
export const IconFullscreen = () => (
  <Icon>
    <path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3" />
  </Icon>
);
export const IconChevron = () => (
  <Icon>
    <path d="M4.5 6.5 8 10l3.5-3.5" />
  </Icon>
);
export const IconClose = () => (
  <Icon>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);
export const IconUp = () => (
  <Icon>
    <path d="M4.5 9.5 8 6l3.5 3.5" />
  </Icon>
);
export const IconDown = () => (
  <Icon>
    <path d="M4.5 6.5 8 10l3.5-3.5" />
  </Icon>
);
export const IconTrash = () => (
  <Icon>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
  </Icon>
);

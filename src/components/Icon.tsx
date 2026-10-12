import React, { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'note'
  | 'folderNote'
  | 'search'
  | 'more'
  | 'plus'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronUp'
  | 'sort'
  | 'sortAsc'
  | 'shuffle'
  | 'prev'
  | 'next'
  | 'play'
  | 'pause'
  | 'repeat'
  | 'repeatOne'
  | 'heart'
  | 'heartFilled'
  | 'queue'
  | 'volume'
  | 'equalizer'
  | 'timer'
  | 'person'
  | 'disc'
  | 'close'
  | 'check'
  | 'trash'
  | 'edit'
  | 'share'
  | 'info'
  | 'playNext'
  | 'addQueue'
  | 'drag'
  | 'settings'
  | 'playlistAdd'
  | 'eyeOff'
  | 'clock'
  | 'speed'
  | 'folder';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

function IconImpl({ name, size = 24, color = '#000', strokeWidth = 1.7 }: Props) {
  const s = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const f = { fill: color };
  let body: React.ReactNode = null;
  switch (name) {
    case 'note':
      body = (
        <>
          <Path {...s} d="M10 17.3V4.2c0-.5.4-.9.9-.8 3.3.4 5.6 2.9 5.6 6v.6" />
          <Circle {...s} cx={7.2} cy={17.5} r={2.8} />
        </>
      );
      break;
    case 'folderNote':
      body = (
        <>
          <Path {...s} d="M8.5 14.2V5.3c0-.4.3-.7.7-.6 2.3.3 3.9 2 3.9 4.2v.3" />
          <Circle {...s} cx={6.6} cy={14.2} r={2} />
          <Path {...s} d="M12.5 13.4h3l1.1 1.3h3.4c.6 0 1 .4 1 1V20c0 .6-.4 1-1 1h-7.5c-.6 0-1-.4-1-1v-5.6c0-.6.4-1 1-1z" />
        </>
      );
      break;
    case 'folder':
      body = <Path {...s} d="M3.5 6.8c0-.8.7-1.5 1.5-1.5h4.3l2 2.2H19c.8 0 1.5.7 1.5 1.5v8.7c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5z" />;
      break;
    case 'search':
      body = (
        <>
          <Circle {...s} cx={10.8} cy={10.8} r={6.6} />
          <Path {...s} d="M15.6 15.6l4.6 4.6" />
        </>
      );
      break;
    case 'more':
      body = (
        <>
          <Circle {...f} cx={12} cy={5.2} r={1.6} />
          <Circle {...f} cx={12} cy={12} r={1.6} />
          <Circle {...f} cx={12} cy={18.8} r={1.6} />
        </>
      );
      break;
    case 'plus':
      body = <Path {...s} d="M12 4.5v15M4.5 12h15" />;
      break;
    case 'chevronDown':
      body = <Path {...s} d="M4.5 8.5l7.5 7.5 7.5-7.5" />;
      break;
    case 'chevronUp':
      body = <Path {...s} d="M4.5 15.5l7.5-7.5 7.5 7.5" />;
      break;
    case 'chevronLeft':
      body = <Path {...s} d="M15.5 4.5L8 12l7.5 7.5" />;
      break;
    case 'chevronRight':
      body = <Path {...s} d="M8.5 4.5L16 12l-7.5 7.5" />;
      break;
    case 'sort':
      body = (
        <>
          <Path {...s} d="M5.5 4v15.5M2.8 16.8l2.7 2.7 2.7-2.7" />
          <Path {...s} d="M11 5.5h9.5M11 11h6.5M11 16.5h3.5" />
        </>
      );
      break;
    case 'sortAsc':
      body = (
        <>
          <Path {...s} d="M5.5 20V4.5M2.8 7.2l2.7-2.7 2.7 2.7" />
          <Path {...s} d="M11 5.5h3.5M11 11h6.5M11 16.5h9.5" />
        </>
      );
      break;
    case 'shuffle':
      body = (
        <>
          <Path {...s} d="M3.5 7h2.6c1.4 0 2.6.7 3.4 1.8l4.9 6.6c.8 1.1 2.1 1.8 3.4 1.8h2.7" />
          <Path {...s} d="M3.5 17.2h2.6c1.4 0 2.6-.7 3.4-1.8l.8-1.1M13.6 9.8l.8-1.1C15.2 7.7 16.5 7 17.8 7h2.7" />
          <Path {...s} d="M18 4.5L20.5 7 18 9.5M18 14.7l2.5 2.5-2.5 2.5" />
        </>
      );
      break;
    case 'prev':
      body = (
        <>
          <Rect {...f} x={4.2} y={5.4} width={2.4} height={13.2} rx={1.1} />
          <Path {...f} d="M13 7.1v9.8c0 .9-1 1.4-1.7.9l-5.3-4c-.6-.5-.6-1.3 0-1.8l5.3-4c.7-.5 1.7 0 1.7.9z" />
          <Path {...f} d="M20.4 7.1v9.8c0 .9-1 1.4-1.7.9l-5.3-4c-.6-.5-.6-1.3 0-1.8l5.3-4c.7-.5 1.7 0 1.7.9z" />
        </>
      );
      break;
    case 'next':
      body = (
        <>
          <Rect {...f} x={17.4} y={5.4} width={2.4} height={13.2} rx={1.1} />
          <Path {...f} d="M11 7.1v9.8c0 .9 1 1.4 1.7.9l5.3-4c.6-.5.6-1.3 0-1.8l-5.3-4c-.7-.5-1.7 0-1.7.9z" />
          <Path {...f} d="M3.6 7.1v9.8c0 .9 1 1.4 1.7.9l5.3-4c.6-.5.6-1.3 0-1.8l-5.3-4c-.7-.5-1.7 0-1.7.9z" />
        </>
      );
      break;
    case 'play':
      body = <Path {...f} d="M7 5.2v13.6c0 1 1.1 1.6 2 1.1l11-6.8c.8-.5.8-1.7 0-2.2L9 4.1c-.9-.5-2 .1-2 1.1z" />;
      break;
    case 'pause':
      body = (
        <>
          <Rect {...f} x={5.8} y={4.2} width={4} height={15.6} rx={2} />
          <Rect {...f} x={14.2} y={4.2} width={4} height={15.6} rx={2} />
        </>
      );
      break;
    case 'repeat':
      body = (
        <>
          <Path {...s} d="M4.5 11.2V9.5c0-1.7 1.3-3 3-3h12M16.8 3.8l2.7 2.7-2.7 2.7" />
          <Path {...s} d="M19.5 12.8v1.7c0 1.7-1.3 3-3 3h-12M7.2 20.2l-2.7-2.7 2.7-2.7" />
        </>
      );
      break;
    case 'repeatOne':
      body = (
        <>
          <Path {...s} d="M4.5 11.2V9.5c0-1.7 1.3-3 3-3h12M16.8 3.8l2.7 2.7-2.7 2.7" />
          <Path {...s} d="M19.5 12.8v1.7c0 1.7-1.3 3-3 3h-12M7.2 20.2l-2.7-2.7 2.7-2.7" />
          <Path {...s} strokeWidth={strokeWidth * 0.9} d="M11 10.6l1.4-1v5" />
        </>
      );
      break;
    case 'heart':
      body = <Path {...s} d="M12 19.6s-7.6-4.6-7.6-10A4.3 4.3 0 0112 6.9a4.3 4.3 0 017.6 2.7c0 5.4-7.6 10-7.6 10z" />;
      break;
    case 'heartFilled':
      body = <Path fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" d="M12 19.6s-7.6-4.6-7.6-10A4.3 4.3 0 0112 6.9a4.3 4.3 0 017.6 2.7c0 5.4-7.6 10-7.6 10z" />;
      break;
    case 'queue':
      body = (
        <>
          <Path {...s} d="M4 5.5h14M4 10.5h10M4 15.5h5.5" />
          <Path {...s} d="M15.8 18.2v-6.4c2.1.1 3.7 1.4 3.7 3.2" />
          <Circle {...f} cx={13.8} cy={18.4} r={2.3} />
        </>
      );
      break;
    case 'volume':
      body = (
        <>
          <Path {...s} d="M4 9.4v5.2c0 .5.4.9.9.9h2.6l4.3 3.6c.6.5 1.5.1 1.5-.7V5.6c0-.8-.9-1.2-1.5-.7L7.5 8.5H4.9c-.5 0-.9.4-.9.9z" />
          <Path {...s} d="M16.3 9.2c.8.8 1.2 1.8 1.2 2.8s-.4 2-1.2 2.8M18.9 6.6c1.4 1.4 2.2 3.3 2.2 5.4s-.8 4-2.2 5.4" />
        </>
      );
      break;
    case 'equalizer':
      body = <Path {...s} d="M4.5 9v10M8.2 4.5V19M11.9 11.5V19M15.6 7V19M19.3 13v6" />;
      break;
    case 'timer':
      body = (
        <>
          <Path {...s} d="M19.6 14.4A8 8 0 019.6 4.4a8 8 0 1010 10z" />
          <Path {...s} d="M15.5 4.5h3l-3 3.5h3" />
        </>
      );
      break;
    case 'person':
      body = (
        <>
          <Circle {...s} cx={12} cy={8.4} r={3.6} />
          <Path {...s} d="M5 19.5c.8-3.4 3.6-5.4 7-5.4s6.2 2 7 5.4" />
        </>
      );
      break;
    case 'disc':
      body = (
        <>
          <Circle {...s} cx={12} cy={12} r={8} />
          <Circle {...s} cx={12} cy={12} r={2.4} />
        </>
      );
      break;
    case 'close':
      body = <Path {...s} d="M6 6l12 12M18 6L6 18" />;
      break;
    case 'check':
      body = <Path {...s} d="M4.8 12.6l4.6 4.6 9.8-10" />;
      break;
    case 'trash':
      body = <Path {...s} d="M4.5 6.5h15M9.5 6.5V5c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v1.5M6.5 6.5l.9 12.1c.1.8.7 1.4 1.5 1.4h6.2c.8 0 1.4-.6 1.5-1.4l.9-12.1" />;
      break;
    case 'edit':
      body = <Path {...s} d="M14.8 5.6l3.6 3.6M4.5 19.5l.7-4 10.6-10.6c.8-.8 2-.8 2.7 0l.9.9c.8.8.8 2 0 2.7L8.8 19.1z" />;
      break;
    case 'share':
      body = (
        <>
          <Circle {...s} cx={17.5} cy={5.8} r={2.3} />
          <Circle {...s} cx={6.5} cy={12} r={2.3} />
          <Circle {...s} cx={17.5} cy={18.2} r={2.3} />
          <Path {...s} d="M8.5 10.9l7-3.9M8.5 13.1l7 3.9" />
        </>
      );
      break;
    case 'info':
      body = (
        <>
          <Circle {...s} cx={12} cy={12} r={8.3} />
          <Path {...s} d="M12 11v5.2" />
          <Circle {...f} cx={12} cy={7.9} r={1.1} />
        </>
      );
      break;
    case 'playNext':
      body = (
        <>
          <Path {...s} d="M4 6h10M4 11h7M4 16h5" />
          <Path {...f} d="M14 12.4v6.2c0 .6.7 1 1.2.7l4.8-3.1c.5-.3.5-1.1 0-1.4l-4.8-3.1c-.5-.3-1.2.1-1.2.7z" />
        </>
      );
      break;
    case 'addQueue':
      body = <Path {...s} d="M4 6h12M4 11h12M4 16h7M17 13.5v6M14 16.5h6" />;
      break;
    case 'playlistAdd':
      body = <Path {...s} d="M4 6h12M4 11h12M4 16h7M17 13.5v6M14 16.5h6" />;
      break;
    case 'drag':
      body = <Path {...s} d="M5 9h14M5 15h14" />;
      break;
    case 'settings':
      body = (
        <>
          <Circle {...s} cx={12} cy={12} r={2.8} />
          <Path {...s} d="M12 3.5l1.5 2.2 2.6-.6.6 2.6 2.2 1.5-1.3 2.3 1.3 2.3-2.2 1.5-.6 2.6-2.6-.6L12 20.5l-1.5-2.2-2.6.6-.6-2.6-2.2-1.5 1.3-2.3-1.3-2.3 2.2-1.5.6-2.6 2.6.6z" />
        </>
      );
      break;
    case 'eyeOff':
      body = (
        <>
          <Path {...s} d="M3.5 12s3-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3 5.5-8.5 5.5S3.5 12 3.5 12z" />
          <Circle {...s} cx={12} cy={12} r={2.5} />
          <Path {...s} d="M4.5 4.5l15 15" />
        </>
      );
      break;
    case 'clock':
      body = (
        <>
          <Circle {...s} cx={12} cy={12} r={8.3} />
          <Path {...s} d="M12 7.5V12l3 2" />
        </>
      );
      break;
    case 'speed':
      body = (
        <>
          <Path {...s} d="M4.6 16.5a8 8 0 1114.8 0" />
          <Path {...s} d="M12 13.5l3.5-4" />
          <Circle {...f} cx={12} cy={13.5} r={1.4} />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}

export const Icon = memo(IconImpl);

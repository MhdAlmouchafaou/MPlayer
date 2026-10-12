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
  | 'folder'
  | 'video'
  | 'film'
  | 'doc'
  | 'grid'
  | 'list'
  | 'lock'
  | 'unlock'
  | 'rotate'
  | 'pip'
  | 'camera'
  | 'aspect'
  | 'subtitles'
  | 'audioTrack'
  | 'loop'
  | 'frameBack'
  | 'frameFwd'
  | 'bookmark'
  | 'bookmarkFilled'
  | 'mirror'
  | 'sun'
  | 'headphones'
  | 'replay10'
  | 'forward10'
  | 'fileOpen'
  | 'history'
  | 'zoomIn'
  | 'page'
  | 'moon'
  | 'sepia'
  | 'hd'
  | 'checkCircle'
  | 'spark'
  | 'tune'
  | 'eye';

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
    case 'video':
      body = (
        <>
          <Rect {...s} x={3.2} y={5.5} width={13} height={13} rx={3} />
          <Path {...s} d="M16.2 10.2l3.6-2.3c.5-.3 1.2 0 1.2.7v6.8c0 .6-.7 1-1.2.7l-3.6-2.3" />
        </>
      );
      break;
    case 'film':
      body = (
        <>
          <Rect {...s} x={3.5} y={4} width={17} height={16} rx={3} />
          <Path {...s} d="M7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4" />
        </>
      );
      break;
    case 'doc':
      body = (
        <>
          <Path {...s} d="M14 3.5H7.5c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V8z" />
          <Path {...s} d="M14 3.5V8h4.5M8.8 12.5h6.4M8.8 16h4.4" />
        </>
      );
      break;
    case 'page':
      body = (
        <>
          <Rect {...s} x={5} y={3.5} width={14} height={17} rx={2.5} />
          <Path {...s} d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
        </>
      );
      break;
    case 'grid':
      body = (
        <>
          <Rect {...s} x={4} y={4} width={6.5} height={6.5} rx={1.8} />
          <Rect {...s} x={13.5} y={4} width={6.5} height={6.5} rx={1.8} />
          <Rect {...s} x={4} y={13.5} width={6.5} height={6.5} rx={1.8} />
          <Rect {...s} x={13.5} y={13.5} width={6.5} height={6.5} rx={1.8} />
        </>
      );
      break;
    case 'list':
      body = <Path {...s} d="M8.5 6h11.5M8.5 12h11.5M8.5 18h11.5M4 6h.5M4 12h.5M4 18h.5" />;
      break;
    case 'lock':
      body = (
        <>
          <Rect {...s} x={5} y={10.5} width={14} height={10} rx={2.5} />
          <Path {...s} d="M8 10.5V7.8a4 4 0 018 0v2.7M12 14.5v2" />
        </>
      );
      break;
    case 'unlock':
      body = (
        <>
          <Rect {...s} x={5} y={10.5} width={14} height={10} rx={2.5} />
          <Path {...s} d="M8 10.5V7.8a4 4 0 017.6-1.7M12 14.5v2" />
        </>
      );
      break;
    case 'rotate':
      body = (
        <>
          <Rect {...s} x={4.5} y={3.5} width={9} height={15} rx={2.2} />
          <Path {...s} d="M17 8.5c2.2 1.2 3.4 3.4 3.1 5.9-.3 2.4-2 4.3-4.3 5" />
          <Path {...s} d="M15.6 21.2l.4-2-1.9-.8" />
        </>
      );
      break;
    case 'pip':
      body = (
        <>
          <Rect {...s} x={3} y={5} width={18} height={14} rx={2.8} />
          <Rect {...f} x={11.5} y={11.5} width={7} height={5} rx={1.2} />
        </>
      );
      break;
    case 'camera':
      body = (
        <>
          <Path {...s} d="M4 8.5c0-1.1.9-2 2-2h2l1.4-2h5.2l1.4 2h2c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z" />
          <Circle {...s} cx={12} cy={12.8} r={3.5} />
        </>
      );
      break;
    case 'aspect':
      body = (
        <>
          <Rect {...s} x={3} y={5} width={18} height={14} rx={2.8} />
          <Path {...s} d="M7 12.5V9h3.5M17 11.5V15h-3.5" />
        </>
      );
      break;
    case 'subtitles':
      body = (
        <>
          <Rect {...s} x={3} y={5} width={18} height={14} rx={2.8} />
          <Path {...s} d="M6.8 13h3.5M12.6 13h4.6M6.8 16h6.4M15.4 16h1.8" />
        </>
      );
      break;
    case 'audioTrack':
      body = (
        <>
          <Path {...s} d="M9.5 17V6.2c0-.5.4-.8.9-.8l7.6-1.3c.5-.1.9.3.9.8V15" />
          <Circle {...s} cx={7.3} cy={17} r={2.3} />
          <Circle {...s} cx={16.6} cy={15} r={2.3} />
        </>
      );
      break;
    case 'loop':
      body = (
        <>
          <Path {...s} d="M5.5 6v12M18.5 6v12" />
          <Path {...s} d="M8.5 12h7M13 9.5l2.5 2.5-2.5 2.5" />
        </>
      );
      break;
    case 'frameBack':
      body = (
        <>
          <Path {...s} d="M14.5 7l-5 5 5 5" />
          <Path {...s} d="M18.5 7v10M5.5 7v10" />
        </>
      );
      break;
    case 'frameFwd':
      body = (
        <>
          <Path {...s} d="M9.5 7l5 5-5 5" />
          <Path {...s} d="M5.5 7v10M18.5 7v10" />
        </>
      );
      break;
    case 'bookmark':
      body = <Path {...s} d="M7 4.5h10c.6 0 1 .4 1 1v14.3c0 .4-.5.7-.8.4L12 16.6l-5.2 3.6c-.3.3-.8 0-.8-.4V5.5c0-.6.4-1 1-1z" />;
      break;
    case 'bookmarkFilled':
      body = <Path fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" d="M7 4.5h10c.6 0 1 .4 1 1v14.3c0 .4-.5.7-.8.4L12 16.6l-5.2 3.6c-.3.3-.8 0-.8-.4V5.5c0-.6.4-1 1-1z" />;
      break;
    case 'mirror':
      body = (
        <>
          <Path {...s} d="M12 3.5v17" strokeDasharray="2 2.2" />
          <Path {...s} d="M9 7L4 17h5zM15 7l5 10h-5z" />
        </>
      );
      break;
    case 'sun':
      body = (
        <>
          <Circle {...s} cx={12} cy={12} r={4} />
          <Path {...s} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        </>
      );
      break;
    case 'headphones':
      body = (
        <>
          <Path {...s} d="M4 15v-3a8 8 0 0116 0v3" />
          <Rect {...s} x={3.5} y={13.5} width={4.5} height={7} rx={2} />
          <Rect {...s} x={16} y={13.5} width={4.5} height={7} rx={2} />
        </>
      );
      break;
    case 'replay10':
      body = (
        <>
          <Path {...s} d="M5.2 8.5A8 8 0 1112 20" />
          <Path {...s} d="M4.5 4.5v4h4" />
        </>
      );
      break;
    case 'forward10':
      body = (
        <>
          <Path {...s} d="M18.8 8.5A8 8 0 1012 20" />
          <Path {...s} d="M19.5 4.5v4h-4" />
        </>
      );
      break;
    case 'fileOpen':
      body = (
        <>
          <Path {...s} d="M3.5 7c0-.8.7-1.5 1.5-1.5h4.3l2 2.2H19c.8 0 1.5.7 1.5 1.5v8.3c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5z" />
          <Path {...s} d="M12 11v5M9.8 13.2L12 11l2.2 2.2" />
        </>
      );
      break;
    case 'history':
      body = (
        <>
          <Path {...s} d="M4.5 12a7.5 7.5 0 102.2-5.3L4.5 9" />
          <Path {...s} d="M4.5 4.8V9h4.2M12 8v4.3l2.8 1.7" />
        </>
      );
      break;
    case 'zoomIn':
      body = (
        <>
          <Circle {...s} cx={10.8} cy={10.8} r={6.6} />
          <Path {...s} d="M15.6 15.6l4.6 4.6M10.8 8v5.6M8 10.8h5.6" />
        </>
      );
      break;
    case 'moon':
      body = <Path {...s} d="M19.5 14.6A8 8 0 019.4 4.5a8 8 0 1010.1 10.1z" />;
      break;
    case 'sepia':
      body = (
        <>
          <Circle {...s} cx={12} cy={12} r={8} />
          <Path {...f} d="M12 4a8 8 0 010 16z" />
        </>
      );
      break;
    case 'hd':
      body = (
        <>
          <Rect {...s} x={3} y={5.5} width={18} height={13} rx={2.8} />
          <Path {...s} d="M7 9.5v5M10 9.5v5M7 12h3M13.2 9.5v5h1.6a2.5 2.5 0 000-5z" />
        </>
      );
      break;
    case 'checkCircle':
      body = (
        <>
          <Circle {...s} cx={12} cy={12} r={8.3} />
          <Path {...s} d="M8.3 12.3l2.5 2.5 5-5.2" />
        </>
      );
      break;
    case 'spark':
      body = <Path {...s} d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />;
      break;
    case 'tune':
      body = (
        <>
          <Path {...s} d="M4 7h9M17 7h3M4 17h3M11 17h9" />
          <Circle {...s} cx={15} cy={7} r={2} />
          <Circle {...s} cx={9} cy={17} r={2} />
        </>
      );
      break;
    case 'eye':
      body = (
        <>
          <Path {...s} d="M3.5 12s3-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3 5.5-8.5 5.5S3.5 12 3.5 12z" />
          <Circle {...s} cx={12} cy={12} r={2.5} />
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

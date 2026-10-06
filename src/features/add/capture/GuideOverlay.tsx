import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { HANGER_PATH } from '@/components/illustrations/Glyphs';
import { Text } from '@/components/ui';
import { useTheme, withAlpha } from '@/theme/ThemeProvider';

export type GuideMode = 'hanger' | 'flat';

/** Garment outlines from the prototype's shape library (100 × 120 viewBox). */
const COAT =
  'M33 8L45 4L50 24L55 4L67 8L82 16Q88 20 89 28L95 92Q95 96 91 96L85 96Q82 96 82 92L77 46L80 114Q80 117 77 117L23 117Q20 117 20 114L23 46L18 92Q18 96 15 96L9 96Q5 96 5 92L11 28Q12 20 18 16Z';
const TEE =
  'M32 10L42 6Q50 14 58 6L68 10L90 24Q93 26 92 29L84 44Q83 46 80 45L74 41L74 112Q74 115 71 115L29 115Q26 115 26 112L26 41L20 45Q17 46 16 44L8 29Q7 26 10 24Z';

function Bracket({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const { colors } = useTheme();
  const top = corner === 'tl' || corner === 'tr';
  const left = corner === 'tl' || corner === 'bl';
  const style: ViewStyle = {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: withAlpha(colors.ink, 0.85),
    ...(top ? { top: 18, borderTopWidth: 3 } : { bottom: 18, borderBottomWidth: 3 }),
    ...(left ? { left: 18, borderLeftWidth: 3 } : { right: 18, borderRightWidth: 3 }),
    ...(corner === 'tl' && { borderTopLeftRadius: 12 }),
    ...(corner === 'tr' && { borderTopRightRadius: 12 }),
    ...(corner === 'bl' && { borderBottomLeftRadius: 12 }),
    ...(corner === 'br' && { borderBottomRightRadius: 12 }),
  };
  return <View pointerEvents="none" style={style} />;
}

/**
 * The framing guide over the camera: a dashed garment outline (on a hanger,
 * or laid flat), corner brackets and a hint.
 */
export function GuideOverlay({ mode, width, height }: { mode: GuideMode; width: number; height: number }) {
  const { colors } = useTheme();
  const outlineW = Math.min(width * 0.62, height * 0.5);
  const outlineH = outlineW * 1.2;
  const stroke = withAlpha(colors.ink, 0.72);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        {mode === 'hanger' ? (
          <Svg width={outlineW * 0.56} height={outlineW * 0.28} viewBox="0 0 60 30" style={{ marginBottom: -4 }}>
            <Path d={HANGER_PATH} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
        ) : null}
        <Svg width={outlineW} height={outlineH} viewBox="0 0 100 120">
          <Path
            d={mode === 'hanger' ? COAT : TEE}
            fill={withAlpha(colors.ink, 0.06)}
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Bracket corner="tl" />
      <Bracket corner="tr" />
      <Bracket corner="bl" />
      <Bracket corner="br" />
      <View className="absolute left-0 right-0 top-[22px] items-center">
        <View
          className="h-8 justify-center rounded-pill px-3.5"
          style={{ backgroundColor: withAlpha(colors.shadow, 0.42) }}
        >
          <Text variant="bodySm" weight="semibold" style={{ fontSize: 13 }}>
            {mode === 'hanger' ? 'Fit the piece inside the outline' : 'Lay it flat and fill the outline'}
          </Text>
        </View>
      </View>
    </View>
  );
}

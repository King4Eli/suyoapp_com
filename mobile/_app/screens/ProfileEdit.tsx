import React, {
  useState,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import RNFS from 'react-native-fs';
import {
  Loaderx,
  bottomsheet_renderBackdrop,
  bottomsheet_renderHandle,
  bottomsheet_renderBackground,
} from '../funcs/functions_stateful';
import { ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import IIcon from 'react-native-vector-icons/Ionicons';
import MIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { namer, __CONFIG__, SOCIAL_PLATFORMS, styles } from '../funcs/static';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  _http_request,
  cacheStorage,
  help,
  mediaHandler,
  uploadHandler,
} from '../funcs/functions';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Toastx } from '../funcs/customNotification';
import LinearGradient from '../funcs/customGradient';
import { useTheme, ThemeColors } from '../funcs/theme';
import { useUnits, formatHeight, UnitSystem } from '../funcs/units';

// ─── Constants ───────────────────────────────────────────────────────────────
const GAP = 5;
const MAX_PHOTOS = 6;
export const MAX_PROMPTS = 3;
export const MAX_INTERESTS = 15;

// user_bio_height is stored in centimetres.
// Height is stored in cm; imperial shows both so the cm value stays visible.
const heightLabel = (cm: string | null | undefined, unit: UnitSystem) => {
  const primary = formatHeight(cm, unit);
  if (!primary || unit === 'metric') return primary;
  return `${primary} (${Number(cm)} cm)`;
};
const heightOptions = (unit: UnitSystem) =>
  Array.from({ length: 81 }, (_, i) => {
    const cm = String(140 + i);
    return { id: cm, label: heightLabel(cm, unit) as string };
  });

// ─── Types ───────────────────────────────────────────────────────────────────
interface PhotoItem {
  p?: string;
  uri?: string;
  local?: boolean;
  w?: number;
  h?: number;
}

interface CellDim {
  w: number;
  h: number;
  x: number;
  y: number;
}

export type PromptEntry = { id_ai: number; question: string; answer: string };
export type InterestEntry = { id_ai: number; interested_in: string };

function socialHandleFromUrl(platform: string, url: string): string {
  const meta = SOCIAL_PLATFORMS.find(p => p.key === platform);
  if (!meta || !url.startsWith(meta.baseUrl)) return url;
  return url.slice(meta.baseUrl.length);
}

function socialUrlFromHandle(platform: string, handle: string): string {
  const trimmed = handle.trim().replace(/^@/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const meta = SOCIAL_PLATFORMS.find(p => p.key === platform);
  return meta ? meta.baseUrl + trimmed : trimmed;
}

type PickerOption = {
  id: string;
  label: string;
};

type PickerSection = {
  title: string;
  options: PickerOption[];
};

type PickerSheetConfig = {
  title: string;
  subtitle?: string;
  selectedId?: string | null;
  sections: PickerSection[];
  // Single choice: called with the tapped option, then the sheet closes.
  onSelect?: (id: string) => void;
  // Long lists open fully expanded; everything else opens at the small snap point
  expanded?: boolean;
  // A search box above the options (long lists, e.g. languages)
  searchable?: boolean;
  // Multiple choice: taps toggle, "Done" calls onDone with the picked ids.
  multiple?: {
    selectedIds: string[];
    max: number;
    onDone: (ids: string[]) => void;
  };
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────
// Most languages a profile lists (the API enforces the same limit).
const MAX_LANGUAGES = 10;

/**
 * Saved languages as codes for the picker. Profiles store gn_language_variant
 * codes; older ones may hold names typed into the old free-text field, which
 * are matched to a code by name (unknown ones are dropped on the next save).
 */
function languageCodesFrom(
  saved: unknown,
  languageMap: Record<string, string> | undefined,
): string[] {
  const list = Array.isArray(saved) ? saved : [];
  const byName = new Map(
    Object.entries(languageMap ?? {}).map(([code, name]) => [
      String(name).toLowerCase(),
      code,
    ]),
  );
  const codes = list
    .map(item => {
      const text = String(item ?? '').trim();
      return /^\d+$/.test(text) ? text : byName.get(text.toLowerCase());
    })
    .filter((code): code is string => !!code && !!languageMap?.[code]);
  return [...new Set(codes)].slice(0, MAX_LANGUAGES);
}

function getCellDims(containerWidth: number): CellDim[] {
  const colW = (containerWidth - GAP) / 2;
  const smallH = colW * 0.65;
  const bigH = smallH * 2 + GAP;
  const bottomH = smallH;
  const thirdColW = (containerWidth - GAP * 2) / 3;
  return [
    { w: colW, h: bigH, x: 0, y: 0 },
    { w: colW, h: smallH, x: colW + GAP, y: 0 },
    { w: colW, h: smallH, x: colW + GAP, y: smallH + GAP },
    { w: thirdColW, h: bottomH, x: 0, y: bigH + GAP },
    { w: thirdColW, h: bottomH, x: thirdColW + GAP, y: bigH + GAP },
    { w: thirdColW, h: bottomH, x: (thirdColW + GAP) * 2, y: bigH + GAP },
  ];
}

function isEmptySlot(img: PhotoItem): boolean {
  return !img?.p && !img?.uri;
}

function getFileExtension(path: string): string {
  const cleaned = path.split('?')[0].split('#')[0];
  const parts = cleaned.split('.');
  if (parts.length < 2) return 'jpg';
  const ext = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext || 'jpg';
}

function getMimeTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ─── Photo grid (drag to reorder) ─────────────────────────────────────────────
// Photos are always packed at the front (slot 0 is the main photo) and empty
// slots only add. Hold a photo to lift it; while it moves, the others slide to
// where they'd end up if it were dropped there -- a move, not a swap. Hit-testing
// runs on the UI thread and only calls into JS when the hovered slot changes.

const LIFT_DELAY_MS = 220;
const SLIDE_SPRING = { damping: 20, stiffness: 220, mass: 0.8 };

/** `arr` with the item at `from` moved to `to`; the ones in between shift over. */
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Filled photos only, in order -- the grid never has gaps. */
function compactImages(images: PhotoItem[]): PhotoItem[] {
  return (images ?? [])
    .filter(img => img && !isEmptySlot(img))
    .slice(0, MAX_PHOTOS);
}

interface DraggablePhotoProps {
  photoIndex: number;
  cell: CellDim;
  cells: CellDim[];
  filledCount: number;
  imageUri: string;
  isMain: boolean;
  onPress: (index: number) => void;
  onRemove: (index: number) => void;
  onLift: (index: number) => void;
  onHover: (index: number, slot: number) => void;
  onDrop: (index: number) => void;
  colors: ThemeColors;
  photoStyles: any;
}

const DraggablePhoto = React.memo(
  ({
    photoIndex,
    cell,
    cells,
    filledCount,
    imageUri,
    isMain,
    onPress,
    onRemove,
    onLift,
    onHover,
    onDrop,
    colors,
    photoStyles,
  }: DraggablePhotoProps) => {
    // Position/size live in shared values so reordering animates on the UI thread
    const posX = useSharedValue(cell.x);
    const posY = useSharedValue(cell.y);
    const width = useSharedValue(cell.w);
    const height = useSharedValue(cell.h);
    const target = useSharedValue(cell);
    const start = useSharedValue({ x: 0, y: 0 });
    const lifted = useSharedValue(false);
    const hover = useSharedValue(-1);
    const scale = useSharedValue(1);

    // Slide to a new slot when the order (or preview order) changes. The lifted
    // photo stays under the finger and settles on drop instead.
    useEffect(() => {
      target.value = cell;
      if (lifted.value) return;
      posX.value = withSpring(cell.x, SLIDE_SPRING);
      posY.value = withSpring(cell.y, SLIDE_SPRING);
      width.value = withSpring(cell.w, SLIDE_SPRING);
      height.value = withSpring(cell.h, SLIDE_SPRING);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cell.x, cell.y, cell.w, cell.h]);

    // Stable across renders: hovering re-renders the lifted photo mid-gesture
    const gesture = useMemo(
      () =>
        Gesture.Pan()
          .activateAfterLongPress(LIFT_DELAY_MS)
          .onStart(() => {
            lifted.value = true;
            hover.value = photoIndex;
            start.value = { x: posX.value, y: posY.value };
            scale.value = withSpring(1.05, SLIDE_SPRING);
            runOnJS(onLift)(photoIndex);
          })
          .onUpdate(e => {
            posX.value = start.value.x + e.translationX;
            posY.value = start.value.y + e.translationY;
            const cx = posX.value + width.value / 2;
            const cy = posY.value + height.value / 2;
            let hit = -1;
            for (let i = 0; i < cells.length; i++) {
              const c = cells[i];
              if (
                cx >= c.x &&
                cx <= c.x + c.w &&
                cy >= c.y &&
                cy <= c.y + c.h
              ) {
                hit = i;
                break;
              }
            }
            if (hit === -1) return;
            // past the last photo = "move to the end"
            const slot = Math.min(hit, filledCount - 1);
            if (slot !== hover.value) {
              hover.value = slot;
              runOnJS(onHover)(photoIndex, slot);
            }
          })
          .onFinalize(() => {
            if (!lifted.value) return;
            lifted.value = false;
            scale.value = withSpring(1, SLIDE_SPRING);
            posX.value = withSpring(target.value.x, SLIDE_SPRING);
            posY.value = withSpring(target.value.y, SLIDE_SPRING);
            width.value = withSpring(target.value.w, SLIDE_SPRING);
            height.value = withSpring(target.value.h, SLIDE_SPRING);
            runOnJS(onDrop)(photoIndex);
          }),
      // shared values are stable refs
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [photoIndex, cells, filledCount, onLift, onHover, onDrop],
    );

    const animStyle = useAnimatedStyle(() => ({
      left: posX.value,
      top: posY.value,
      width: width.value,
      height: height.value,
      transform: [{ scale: scale.value }],
      zIndex: lifted.value ? 100 : 1,
      shadowOpacity: lifted.value ? 0.35 : 0,
      elevation: lifted.value ? 12 : 0,
    }));

    return (
      <Animated.View style={[photoStyles.wrapper, animStyle]}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={{ flex: 1 }}>
            <Pressable
              style={photoStyles.cell}
              onPress={() => onPress(photoIndex)}
              accessibilityLabel={`Photo ${
                photoIndex + 1
              }. Tap to replace, hold and drag to reorder.`}
            >
              <Image
                source={{ uri: imageUri }}
                style={photoStyles.img}
                resizeMode="cover"
              />
              <Pressable
                style={photoStyles.removeBtn}
                onPress={() => onRemove(photoIndex)}
                hitSlop={6}
                accessibilityLabel={`Remove photo ${photoIndex + 1}`}
              >
                <View style={photoStyles.removeBtnInner}>
                  <IIcon name="close" size={12} color={colors.danger} />
                </View>
              </Pressable>
              <View style={photoStyles.dragHandle} pointerEvents="none">
                {[...Array(6)].map((_, i) => (
                  <View key={i} style={photoStyles.dragDot} />
                ))}
              </View>
              {isMain && (
                <View style={photoStyles.mainBadge}>
                  <MIcons name="star" size={10} color="#fff" />
                  <Text style={photoStyles.mainBadgeText}>Main</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    );
  },
);

function createPhotoStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 14,
    },
    cell: {
      flex: 1,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    },
    emptyCell: {
      position: 'absolute',
      borderRadius: 18,
      borderWidth: 1.4,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    img: { width: '100%', height: '100%' },
    removeBtn: {
      position: 'absolute',
      top: 5,
      right: 5,
      zIndex: 10,
    },
    removeBtnInner: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },
    dragHandle: {
      position: 'absolute',
      bottom: 6,
      right: 6,
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 14,
      gap: 2.5,
      opacity: 0.65,
    },
    dragDot: {
      width: 3.5,
      height: 3.5,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
    mainBadge: {
      position: 'absolute',
      bottom: 7,
      left: 7,
      backgroundColor: 'rgba(15,23,42,0.68)',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    mainBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  });
}

interface PhotoGridProps {
  images: PhotoItem[];
  containerWidth: number;
  getImageUri: (index: number) => string;
  onPress: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onDragActiveChange: (active: boolean) => void;
  onLayout: (width: number) => void;
  colors: ThemeColors;
  photoStyles: any;
}

const PhotoGrid = React.memo(
  ({
    images,
    containerWidth,
    getImageUri,
    onPress,
    onAdd,
    onRemove,
    onReorder,
    onDragActiveChange,
    onLayout,
    colors,
    photoStyles,
  }: PhotoGridProps) => {
    const cells = useMemo(
      () => (containerWidth > 0 ? getCellDims(containerWidth) : []),
      [containerWidth],
    );
    // The photo being dragged and the slot it's over; drives the preview order
    const [drag, setDrag] = useState<{ from: number; over: number } | null>(
      null,
    );
    const dragRef = useRef(drag);
    dragRef.current = drag;

    const onLift = useCallback(
      (index: number) => {
        setDrag({ from: index, over: index });
        onDragActiveChange(true);
      },
      [onDragActiveChange],
    );
    const onHover = useCallback((index: number, slot: number) => {
      setDrag(prev =>
        prev && prev.from === index ? { from: index, over: slot } : prev,
      );
    }, []);
    const onDrop = useCallback(
      (index: number) => {
        const current = dragRef.current;
        setDrag(null);
        onDragActiveChange(false);
        if (current && current.from === index && current.over !== index) {
          onReorder(index, current.over);
        }
      },
      [onReorder, onDragActiveChange],
    );
    // A press that ends a drag isn't a tap
    const onPhotoPress = useCallback(
      (index: number) => {
        if (dragRef.current) return;
        onPress(index);
      },
      [onPress],
    );

    if (containerWidth === 0) {
      return (
        <View
          onLayout={e => onLayout(e.nativeEvent.layout.width)}
          style={{ width: '100%', height: 10 }}
        />
      );
    }

    const total = cells[0].h + GAP + cells[3].h;
    const filled = compactImages(images);
    const filledCount = filled.length;

    // slotOf[i] = where photo i shows right now (its preview spot while dragging)
    const order = filled.map((_, i) => i);
    const previewOrder = drag ? moveItem(order, drag.from, drag.over) : order;
    const slotOf: number[] = [];
    previewOrder.forEach((photoIndex, slot) => {
      slotOf[photoIndex] = slot;
    });

    return (
      <View
        onLayout={e => {
          const w = Math.floor(e.nativeEvent.layout.width);
          if (w !== containerWidth) onLayout(w);
        }}
        style={{ width: '100%', height: total }}
      >
        {cells.slice(filledCount).map((cell, i) => (
          <Pressable
            key={`empty-${filledCount + i}`}
            style={[
              photoStyles.emptyCell,
              { left: cell.x, top: cell.y, width: cell.w, height: cell.h },
            ]}
            onPress={onAdd}
            accessibilityLabel="Add a photo"
          >
            <IIcon name="add" size={26} color={colors.textTertiary} />
          </Pressable>
        ))}
        {filled.map((image, i) => (
          <DraggablePhoto
            // keyed by the photo, not the slot, so it keeps its identity as it moves
            key={image.p ?? image.uri ?? `photo-${i}`}
            photoIndex={i}
            cell={cells[slotOf[i]]}
            cells={cells}
            filledCount={filledCount}
            imageUri={getImageUri(i)}
            isMain={slotOf[i] === 0}
            onPress={onPhotoPress}
            onRemove={onRemove}
            onLift={onLift}
            onHover={onHover}
            onDrop={onDrop}
            colors={colors}
            photoStyles={photoStyles}
          />
        ))}
      </View>
    );
  },
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

// Profile-completeness checklist items (api global/profileCompleteness.js) that
// open this screen at a specific spot via route.params.focusSection.
type FocusSection =
  | 'photos'
  | 'about'
  | 'basics'
  | 'work'
  | 'background'
  | 'prompts'
  | 'interests';

export function Screen_editprofile({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  const { colors } = useTheme();
  const { unit } = useUnits();
  const photoStyles = useMemo(() => createPhotoStyles(colors), [colors]);
  const pgStyles = useMemo(() => createPgStyles(colors), [colors]);

  const [_getProfile, setProfile] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);
  // y of each focusable section inside the scroll content (formStack offset + own y)
  const formStackY = useRef(0);
  const sectionY = useRef<Partial<Record<FocusSection, number>>>({});
  const trackSection = (key: FocusSection) => (e: any) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const focusHandled = useRef(false);
  const __MAPPER = cacheStorage.CONFIG.get()?.mapper;

  const imageDomain = __MAPPER?.img_domain ?? '';

  // ── Religion options (gn_religion_variant) ───────────────────────────────
  const [religionOptions, setReligionOptions] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await _http_request({
          customApiUrl:
            __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/getReligions',
          reqType: 'POST',
        });
        if (mounted && Array.isArray(response?.religions)) {
          const options: Record<string, string> = {};
          for (const r of response.religions)
            options[String(r.id_ai)] = r.label;
          setReligionOptions(options);
        }
      } catch (error) {
        console.error('Error loading religions:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const [getProfileEdit, setProfileEdit] = useState({
    images: [] as PhotoItem[],

    // Basic info
    id: null as string | null,
    fullname: '',
    age: null as number | null,
    about: '',
    city: '',

    // Preferences/Attributes
    gender: null as string | null,
    relationshipgoal: null as string | null,
    children: null as string | null,
    smoking: null as string | null,
    drinking: null as string | null,
    pets: null as string | null,
    highEducation: null as string | null,
    ethnicity: null as string | null,
    religion: null as string | null,
    politicalview: null as string | null,

    height: null as string | null,

    // Text fields
    hometown: '',
    schoolattended: '',
    jobrole: '',
    company: '',
    // gn_language_variant codes (__MAPPER.bio_language), picked from a list
    languages: [] as string[],
  });

  // ── Profile state ──────────────────────────────────────────────────────
  const [getPrompts, setPrompts] = useState<PromptEntry[]>([]);
  const [getInterests, setInterests] = useState<InterestEntry[]>([]);
  const [getSocialHandles, setSocialHandles] = useState<Record<string, string>>(
    {},
  );
  const [promptErrors, setPromptErrors] = useState<Record<number, string>>({});

  // Opened from the completeness checklist: once the profile has loaded, go
  // straight to what's missing -- the prompts/interests editor, or the section.
  const focusSection: FocusSection | undefined = route?.params?.focusSection;
  useEffect(() => {
    if (!focusSection || !_getProfile || focusHandled.current) return;
    focusHandled.current = true;
    setTimeout(() => {
      if (focusSection === 'prompts') {
        navigation.navigate(namer.navigation.editProfilePrompts, {
          existingPrompts: getPrompts,
          onSave: (updated: PromptEntry[]) => setPrompts(updated),
        });
      } else if (focusSection === 'interests') {
        navigation.navigate(namer.navigation.editProfileInterests, {
          existingInterests: getInterests,
          onSave: (updated: InterestEntry[]) => setInterests(updated),
        });
      } else {
        const y = sectionY.current[focusSection];
        if (y != null) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, formStackY.current + y - 12),
            animated: true,
          });
        }
      }
    }, 400);
  }, [focusSection, _getProfile, getPrompts, getInterests, navigation]);

  // profile
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await cacheStorage.getCurrentUserProfile();

        if (mounted && profile) {
          setProfile(profile);
          setProfileEdit({
            // Photos
            images: compactImages(profile?.profile?.images ?? []),

            // Basic info
            id: profile?.profile?.id ?? null,
            fullname: profile?.profile?.fullname ?? '',
            age: profile?.profile?.dob ?? null,
            about: profile?.bio?.about ?? '',
            city: profile?.profile?.location?.city ?? '',

            // Preferences/Attributes
            gender: profile?.bio?.gender ?? null,
            relationshipgoal: profile?.bio?.relationshipgoal ?? null,
            children: profile?.bio?.children ?? null,
            smoking: profile?.bio?.smoking ?? null,
            drinking: profile?.bio?.drinking ?? null,
            pets:
              typeof profile?.bio?.haspet === 'boolean'
                ? profile.bio.haspet
                  ? '1'
                  : '0'
                : null,
            highEducation:
              profile?.bio?.education != null
                ? String(profile.bio.education)
                : null,
            ethnicity: profile?.bio?.ethnicity ?? null,
            religion: profile?.bio?.religion ?? null,
            politicalview: profile?.bio?.politicalview ?? null,

            height:
              profile?.bio?.height != null ? String(profile.bio.height) : null,

            // Text fields
            hometown: profile?.bio?.hometown ?? '',
            schoolattended: profile?.bio?.school ?? '',
            jobrole: profile?.bio?.jobrole ?? '',
            company: profile?.bio?.company ?? '',
            languages: languageCodesFrom(
              profile?.bio?.language,
              cacheStorage.CONFIG.get()?.mapper?.bio_language,
            ),
          });
          setPrompts(
            Array.isArray(profile?.bio?.prompts) ? profile.bio.prompts : [],
          );
          setInterests(
            Array.isArray(profile?.bio?.interests)
              ? profile.bio.interests.flatMap(
                  (group: any) => group?.items ?? [],
                )
              : [],
          );
          const handles: Record<string, string> = {};
          (Array.isArray(profile?.bio?.socialLinks)
            ? profile.bio.socialLinks
            : []
          ).forEach((link: any) => {
            if (link?.platform && link?.url)
              handles[link.platform] = socialHandleFromUrl(
                link.platform,
                link.url,
              );
          });
          setSocialHandles(handles);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        if (mounted) {
          setProfile(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);
  const updateProfileEdit = useCallback(
    (
      updates:
        | Partial<typeof getProfileEdit>
        | ((prev: typeof getProfileEdit) => Partial<typeof getProfileEdit>),
    ) => {
      setProfileEdit(prev => ({
        ...prev,
        ...(typeof updates === 'function' ? updates(prev) : updates),
      }));
    },
    [],
  );

  // ── Drag state ─────────────────────────────────────────────────────────
  const [containerWidth, setContainerWidth] = useState(0);
  // page scrolling is off while a photo is being dragged
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  // ── Bottom sheet refs ───────────────────────────────────────────────────
  const pickerSheet_ref = useRef<BottomSheet>(null);
  const [pickerSheet, setPickerSheet] = useState<PickerSheetConfig | null>(
    null,
  );
  const pickerSnapPoints = useMemo(() => ['45%', '80%'], []);
  // Multiple-choice picker: what's ticked so far, and the search text
  const [pickerPicked, setPickerPicked] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const safeInsets = useSafeAreaInsets();

  // ── Header ─────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
      headerTitle: () => <Text style={pgStyles.headerTitle}>Edit Profile</Text>,
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {getProfileEdit.id && (
            <Pressable
              style={pgStyles.previewBtn}
              onPress={() =>
                navigation.push(namer.navigation.peoplesOnePerson, {
                  getOnePersonId: getProfileEdit.id,
                  alreadyLiked: true,
                  previewProfile: true,
                })
              }
            >
              <Text style={pgStyles.previewBtnText}>Preview</Text>
            </Pressable>
          )}
          <Pressable style={[pgStyles.saveBtn]} onPress={handleSaveProfile}>
            <Text style={pgStyles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
      ),
    });
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  const getImageUri = useCallback(
    (index: number): string => {
      const target = getProfileEdit?.images?.[index];
      if (!target) return '';
      const path = target?.p ?? target?.uri ?? '';
      const isLocal =
        target?.local ||
        path.startsWith('file:') ||
        path.startsWith('content:');

      return isLocal ? path : String(imageDomain + path);
    },
    [getProfileEdit?.images, imageDomain],
  );

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    // A prompt with a question but no answer is silently dropped by the backend
    // (pushProfile.js filters out blank answers) -- catch it here instead so the
    // user sees exactly which prompt needs fixing rather than a generic failure.
    const emptyAnswerIndex = getPrompts.findIndex(
      p => !p?.answer || !p.answer.trim(),
    );
    if (emptyAnswerIndex !== -1) {
      setPromptErrors({
        [emptyAnswerIndex]: 'Answer this prompt or remove it.',
      });
      Toastx.show({
        type: 'error',
        message: 'One of your prompts needs an answer.',
      });
      return;
    }

    Loaderx.show();
    try {
      const orderedImageMeta = compactImages(getProfileEdit?.images)
        .map((img, index) => {
          const path = img?.p ?? img?.uri ?? '';
          if (!path) return null;
          return {
            p: path,
            w: img?.w ?? null,
            h: img?.h ?? null,
            o: index,
          };
        })
        .filter(Boolean);

      const response = await _http_request({
        reqType: 'POST',
        customApiUrl: __CONFIG__.HTTPS_API_DOMAIN + '/api/core/v1/pushProfile',
        bodyArray: {
          prof_about: getProfileEdit?.about,
          prof_smoking: getProfileEdit?.smoking,
          prof_drinking: getProfileEdit?.drinking,
          prof_children: getProfileEdit?.children,
          prof_ethnicity: getProfileEdit?.ethnicity,
          prof_pet: getProfileEdit?.pets,
          prof_religion: getProfileEdit?.religion,
          prof_highesteducation: getProfileEdit?.highEducation,
          prof_relationshipgoal: getProfileEdit?.relationshipgoal,
          prof_languages: JSON.stringify(
            (getProfileEdit?.languages ?? []).map(Number),
          ),
          prof_gender: getProfileEdit?.gender,
          prof_hometown: getProfileEdit?.hometown,
          prof_schoolattended: getProfileEdit?.schoolattended,
          prof_jobrole: getProfileEdit?.jobrole,
          prof_company: getProfileEdit?.company,
          prof_height: getProfileEdit?.height,
          prof_political: getProfileEdit?.politicalview,
          prof_prompts: JSON.stringify(
            (getPrompts ?? []).map(p => ({ id_ai: p.id_ai, answer: p.answer })),
          ),
          prof_interests: JSON.stringify(
            (getInterests ?? []).map(i => i.id_ai),
          ),
          prof_social_links: JSON.stringify(
            SOCIAL_PLATFORMS.map(p => ({
              platform: p.key,
              url: socialUrlFromHandle(p.key, getSocialHandles[p.key] ?? ''),
            })).filter(link => link.url),
          ),
          prof_images_meta: JSON.stringify(orderedImageMeta),
        },
      });
      if (response?.code === 200) {
        Toastx.show({
          type: 'success',
          message: response?.userpreferences?.message ?? 'Profile updated!',
        });
        await cacheStorage.getCurrentUserProfile(true);
        // await sleep(2000);
        // cacheStorage.getCurrentUserProfile(true);
        Loaderx.hide();
        navigation.goBack();
      } else {
        Toastx.show({
          type: 'error',
          message:
            response?.userpreferences?.message ?? 'Error updating profile!',
        });
      }
    } catch (error: any) {
      Toastx.show({
        type: 'error',
        message: error?.message ?? 'Unable to save profile.',
      });
    } finally {
      Loaderx.hide();
    }
  };

  // ── Photo actions ──────────────────────────────────────────────────────
  const handlePress = useCallback(
    async (index: number) => {
      const media = await mediaHandler.handleSelectFromGallery({
        mediaType: 'photo',
        selectionLimit: 1,
      });
      if (!media || media.length === 0) return;
      const asset = media[0];
      const localPath = asset?.uri ?? '';
      if (!localPath) return;

      Loaderx.show();
      try {
        const ext = getFileExtension(localPath);
        const presigned = await uploadHandler.requestPresignedURL_Upload(
          ext,
          'profile-media',
        );
        const uploadFilePath = localPath.startsWith('file://')
          ? localPath.replace('file://', '')
          : localPath;
        const contentType = getMimeTypeFromExt(ext);

        const uploadResult = await RNFS.uploadFiles({
          toUrl: presigned.uploadUrl,
          files: [
            {
              name: 'file',
              filename: `profile_${Date.now()}_${index}.${ext}`,
              filepath: uploadFilePath,
              filetype: contentType,
            },
          ],
          method: presigned.method || 'PUT',
          headers: uploadHandler.uploadHeaders(presigned, contentType),
          binaryStreamOnly: true,
        }).promise;

        if (uploadResult.statusCode < 200 || uploadResult.statusCode >= 300) {
          throw new Error('Profile image upload failed.');
        }

        const uploadedPath = uploadHandler.resolveObjectPath(presigned);
        // console.log(uploadedPath);
        updateProfileEdit(prev => {
          // replacing an existing photo keeps its spot; a new one goes after the
          // last photo (the grid never has gaps)
          const updated = compactImages(prev.images);
          const at = Math.min(index, updated.length);
          if (at === updated.length) updated.push({});
          updated[at] = {
            ...updated[at],
            p: uploadedPath,
            uri: uploadedPath,
            local: false,
            w: asset.width,
            h: asset.height,
          };
          return {
            images: updated.slice(0, MAX_PHOTOS),
          };
        });
      } catch (error: any) {
        Toastx.show({
          type: 'error',
          message: error?.message ?? 'Unable to upload profile image.',
        });
      } finally {
        Loaderx.hide();
      }
    },
    [updateProfileEdit],
  );

  const handleRemoveImage = useCallback(
    (index: number) => {
      updateProfileEdit(prev => ({
        images: compactImages(prev.images).filter((_, i) => i !== index),
      }));
    },
    [updateProfileEdit],
  );

  // The grid already animated the photos into place during the drag
  const handleReorderImages = useCallback(
    (from: number, to: number) => {
      updateProfileEdit(prev => ({
        images: moveItem(compactImages(prev.images), from, to),
      }));
    },
    [updateProfileEdit],
  );

  const handleAddImage = useCallback(() => {
    handlePress(compactImages(getProfileEdit.images).length);
  }, [handlePress, getProfileEdit.images]);

  const handleGridLayout = useCallback((w: number) => {
    setContainerWidth(w);
  }, []);

  // ── Prompt helpers ─────────────────────────────────────────────────────
  const removePrompt = useCallback((index: number) => {
    setPrompts(prev => prev.filter((_, i) => i !== index));
    setPromptErrors(prev => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([key, message]) => {
        const keyIndex = Number(key);
        if (keyIndex === index) return;
        next[keyIndex > index ? keyIndex - 1 : keyIndex] = message;
      });
      return next;
    });
  }, []);

  // ── Interest helpers ───────────────────────────────────────────────────
  const removeInterest = useCallback((id_ai: number) => {
    setInterests(prev => prev.filter(v => v.id_ai !== id_ai));
  }, []);

  // ── Radio builder ──────────────────────────────────────────────────────
  const buildOptions = (
    map: Record<string, string> | undefined,
  ): PickerOption[] =>
    Object.entries(map ?? {}).map(([key, value]) => ({
      id: key,
      label: value as string,
    }));

  const openPicker = useCallback((config: PickerSheetConfig) => {
    setPickerPicked(config.multiple?.selectedIds ?? []);
    setPickerQuery('');
    setPickerSheet(config);
  }, []);

  const closePicker = useCallback(() => {
    pickerSheet_ref.current?.close();
    setPickerSheet(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <SafeAreaView style={[pgStyles.screen, {}]} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 1 : 0}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            scrollEnabled={!isDraggingPhoto}
            contentContainerStyle={styles.conainerScrollView}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={pgStyles.formStack}
              onLayout={e => {
                formStackY.current = e.nativeEvent.layout.y;
              }}
            >
              {/* ── Photo Grid ───────────────────────────────── */}
              <View
                style={pgStyles.sectionCard}
                onLayout={trackSection('photos')}
              >
                <View style={pgStyles.sectionHeader}>
                  <View style={pgStyles.sectionIcon}>
                    <MIcons
                      name="image-multiple-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pgStyles.sectionLabel}>Profile Photos</Text>
                    <Text style={pgStyles.sectionHint}>
                      Tap to replace. Hold and drag to reorder.
                    </Text>
                  </View>
                </View>

                <PhotoGrid
                  images={getProfileEdit.images}
                  containerWidth={containerWidth}
                  getImageUri={getImageUri}
                  onPress={handlePress}
                  onRemove={handleRemoveImage}
                  onAdd={handleAddImage}
                  onReorder={handleReorderImages}
                  onDragActiveChange={setIsDraggingPhoto}
                  onLayout={handleGridLayout}
                  colors={colors}
                  photoStyles={photoStyles}
                />
              </View>

              {/* ── Vibes Banner ──────────────────────────────── */}
              <LinearGradient
                colors={[colors.primary, '#f27a9c']}
                style={pgStyles.bannerCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={pgStyles.bannerRow}>
                  <View style={{ gap: 6, flex: 1 }}>
                    <View style={pgStyles.bannerBadge}>
                      <MIcons
                        name="heart-multiple-outline"
                        color={colors.primary}
                        size={14}
                      />
                      <Text style={pgStyles.bannerBadgeText}>
                        Vibes &amp; Energy
                      </Text>
                    </View>
                    <Text style={pgStyles.bannerTitle}>
                      Show your best self today
                    </Text>
                    <Text style={pgStyles.bannerSubtitle}>
                      Update a prompt and write a bio to make it easy for others
                      to start a conversation with you.
                    </Text>
                  </View>
                  <MIcons
                    name="flower-tulip-outline"
                    size={78}
                    color="rgba(255,255,255,0.75)"
                  />
                </View>
              </LinearGradient>

              {/* ── Full Name (locked) ───────────────────────── */}
              <View style={pgStyles.formField}>
                <View style={pgStyles.inputHeader}>
                  <Text style={pgStyles.fieldLabel}>Full Name</Text>
                  <IIcon
                    name="lock-closed"
                    size={15}
                    color={colors.textTertiary}
                  />
                </View>
                <TextInput
                  style={[pgStyles.textInput, pgStyles.readOnlyInput]}
                  value={getProfileEdit.fullname}
                  readOnly
                />
              </View>

              {/* ── Age (locked) ─────────────────────────────── */}
              <View style={pgStyles.formField}>
                <View style={pgStyles.inputHeader}>
                  <Text style={pgStyles.fieldLabel}>Age</Text>
                  <IIcon
                    name="lock-closed"
                    size={15}
                    color={colors.textTertiary}
                  />
                </View>
                <TextInput
                  style={[pgStyles.textInput, pgStyles.readOnlyInput]}
                  value={
                    help.getageFromDOB(getProfileEdit?.age?.toString() ?? '') ??
                    '—'
                  }
                  readOnly
                />
              </View>

              {/* ── About ────────────────────────────────────── */}
              <View style={pgStyles.formField} onLayout={trackSection('about')}>
                <View style={pgStyles.inputHeader}>
                  <Text style={pgStyles.fieldLabel}>About you</Text>
                  <IIcon
                    name="create-outline"
                    size={17}
                    color={colors.textSecondary}
                  />
                </View>
                <TextInput
                  style={[pgStyles.textInput, pgStyles.textArea]}
                  multiline
                  numberOfLines={8}
                  value={getProfileEdit.about}
                  onChangeText={e => updateProfileEdit({ about: e })}
                  placeholder="Write something about yourself…"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={400}
                />
                <Text style={pgStyles.charCounter}>
                  {getProfileEdit.about?.length ?? 0}/400 characters
                </Text>
              </View>

              <FormGroup
                onLayout={trackSection('basics')}
                title="Core Details"
                hint="These help people understand who you are looking for."
                pgStyles={pgStyles}
              >
                <PickerField
                  label="Intentions"
                  value={
                    __MAPPER?.bio_intent?.[
                      getProfileEdit.relationshipgoal ?? ''
                    ]
                  }
                  icon="heart-outline"
                  onPress={() =>
                    openPicker({
                      title: 'What are your intentions?',
                      selectedId: getProfileEdit.relationshipgoal,
                      sections: [
                        {
                          title: 'Dating goals',
                          options: buildOptions(__MAPPER?.bio_intent),
                        },
                      ],
                      onSelect: id =>
                        updateProfileEdit({ relationshipgoal: id }),
                    })
                  }
                  colors={colors}
                  pgStyles={pgStyles}
                />
                <PickerField
                  label="Gender"
                  value={__MAPPER?.bio_gender?.[getProfileEdit.gender ?? '']}
                  icon="account-outline"
                  onPress={() =>
                    openPicker({
                      title: 'What is your gender?',
                      selectedId: getProfileEdit.gender,
                      sections: [
                        {
                          title: 'Gender',
                          options: buildOptions(__MAPPER?.bio_gender),
                        },
                      ],
                      onSelect: id => updateProfileEdit({ gender: id }),
                    })
                  }
                  colors={colors}
                  pgStyles={pgStyles}
                />
                <PickerField
                  label="Height"
                  value={heightLabel(getProfileEdit.height, unit)}
                  icon="human-male-height"
                  onPress={() =>
                    openPicker({
                      expanded: true,
                      title: 'How tall are you?',
                      selectedId: getProfileEdit.height,
                      sections: [
                        { title: 'Height', options: heightOptions(unit) },
                      ],
                      onSelect: id => updateProfileEdit({ height: id }),
                    })
                  }
                  colors={colors}
                  pgStyles={pgStyles}
                />
              </FormGroup>

              {/* ── Interests ────────────────────────────────── */}
              <View style={pgStyles.formField}>
                <Pressable
                  style={{ gap: 8 }}
                  onPress={() =>
                    navigation.navigate(namer.navigation.editProfileInterests, {
                      existingInterests: getInterests,
                      onSave: (updated: InterestEntry[]) =>
                        setInterests(updated),
                    })
                  }
                >
                  <View style={pgStyles.inputHeader}>
                    <Text style={pgStyles.fieldLabel}>
                      Interests
                      <Text style={pgStyles.countBadge}>
                        {' '}
                        {getInterests.length}/{MAX_INTERESTS}
                      </Text>
                    </Text>
                    <MIcons
                      name="cursor-default-click-outline"
                      size={17}
                      color={colors.textSecondary}
                    />
                  </View>

                  {getInterests.length === 0 ? (
                    <Text style={pgStyles.placeholder}>
                      Tap to select your interests
                    </Text>
                  ) : (
                    <View style={pgStyles.chipRow}>
                      {getInterests.map(interest => (
                        <View key={interest.id_ai} style={pgStyles.chip}>
                          <Text style={pgStyles.chipText}>
                            {interest.interested_in}
                          </Text>
                          <Pressable
                            hitSlop={6}
                            onPress={() => removeInterest(interest.id_ai)}
                            style={pgStyles.chipRemove}
                          >
                            <Text style={pgStyles.chipRemoveText}>×</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              </View>

              <FormGroup
                title="Social Links"
                hint="Only VIP members can open these on your profile."
                pgStyles={pgStyles}
              >
                {SOCIAL_PLATFORMS.map(platform => (
                  <View key={platform.key} style={pgStyles.inlineField}>
                    <View style={pgStyles.pickerFieldIcon}>
                      <IIcon
                        name={platform.icon}
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={pgStyles.fieldLabel}>{platform.label}</Text>
                      <TextInput
                        style={pgStyles.inlineInput}
                        value={getSocialHandles[platform.key] ?? ''}
                        onChangeText={text =>
                          setSocialHandles(prev => ({
                            ...prev,
                            [platform.key]: text,
                          }))
                        }
                        placeholder="username"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="none"
                        maxLength={200}
                      />
                    </View>
                  </View>
                ))}
              </FormGroup>

              <FormGroup
                onLayout={trackSection('work')}
                title="Background"
                hint="A few real-world details for better context."
                pgStyles={pgStyles}
              >
                <PickerField
                  label="Location"
                  value={getProfileEdit.city}
                  icon="map-marker-outline"
                  onPress={() =>
                    navigation.navigate(namer.navigation.editLocation, {
                      onPrimaryChange: (city: string) =>
                        updateProfileEdit({ city }),
                    })
                  }
                  colors={colors}
                  pgStyles={pgStyles}
                />
                <InlineTextField
                  label="Hometown"
                  value={getProfileEdit.hometown}
                  icon="home-heart"
                  placeholder="Where are you from?"
                  maxLength={45}
                  onChangeText={text => updateProfileEdit({ hometown: text })}
                  colors={colors}
                  pgStyles={pgStyles}
                />
                <PickerField
                  label="Highest Education"
                  value={
                    __MAPPER?.bio_education?.[
                      getProfileEdit.highEducation ?? ''
                    ]
                  }
                  icon="school-outline"
                  onPress={() =>
                    openPicker({
                      expanded: true,
                      title: 'Highest education achieved?',
                      selectedId: getProfileEdit.highEducation,
                      sections: [
                        {
                          title: 'Education',
                          options: buildOptions(__MAPPER?.bio_education),
                        },
                      ],
                      onSelect: id => updateProfileEdit({ highEducation: id }),
                    })
                  }
                  colors={colors}
                  pgStyles={pgStyles}
                />
                <PickerField
                  label="Languages"
                  value={getProfileEdit.languages
                    .map(code => __MAPPER?.bio_language?.[code])
                    .filter(Boolean)
                    .join(', ')}
                  icon="translate"
                  onPress={() =>
                    openPicker({
                      expanded: true,
                      searchable: true,
                      title: 'Languages you speak',
                      subtitle: `Pick up to ${MAX_LANGUAGES}`,
                      sections: [
                        {
                          title: 'Languages',
                          options: buildOptions(__MAPPER?.bio_language).sort(
                            (a, b) => a.label.localeCompare(b.label),
                          ),
                        },
                      ],
                      multiple: {
                        selectedIds: getProfileEdit.languages,
                        max: MAX_LANGUAGES,
                        onDone: ids => updateProfileEdit({ languages: ids }),
                      },
                    })
                  }
                  colors={colors}
                  pgStyles={pgStyles}
                />
                <InlineTextField
                  label="School Attended"
                  value={getProfileEdit.schoolattended}
                  icon="school"
                  placeholder="What school did you attend?"
                  maxLength={45}
                  onChangeText={text =>
                    updateProfileEdit({ schoolattended: text })
                  }
                  colors={colors}
                  pgStyles={pgStyles}
                />
                <InlineTextField
                  label="Job Title"
                  value={getProfileEdit.jobrole}
                  icon="briefcase-outline"
                  placeholder="What do you do?"
                  maxLength={20}
                  onChangeText={text => updateProfileEdit({ jobrole: text })}
                  colors={colors}
                  pgStyles={pgStyles}
                />
                <InlineTextField
                  label="Company"
                  value={getProfileEdit.company}
                  icon="office-building-outline"
                  placeholder="Where do you work?"
                  maxLength={30}
                  onChangeText={text => updateProfileEdit({ company: text })}
                  colors={colors}
                  pgStyles={pgStyles}
                />
              </FormGroup>

              {/* ── Prompts ──────────────────────────────────── */}
              <View style={pgStyles.formField}>
                <Text style={pgStyles.fieldLabel}>
                  Prompts
                  <Text style={pgStyles.countBadge}>
                    {' '}
                    {getPrompts.length}/{MAX_PROMPTS}
                  </Text>
                </Text>

                {getPrompts.map((item, index) => (
                  <View key={item.id_ai} style={pgStyles.promptCard}>
                    <Pressable
                      style={pgStyles.promptRemove}
                      onPress={() => removePrompt(index)}
                      hitSlop={6}
                    >
                      <IIcon
                        name="close-circle"
                        size={20}
                        color={colors.danger}
                      />
                    </Pressable>
                    <Text style={pgStyles.promptQuestion}>
                      {item?.question}
                    </Text>
                    <TextInput
                      style={[
                        pgStyles.textInput,
                        pgStyles.promptAnswer,
                        promptErrors[index] && pgStyles.inputError,
                      ]}
                      value={item?.answer}
                      placeholder={item?.question}
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      maxLength={140}
                      onChangeText={text => {
                        setPrompts(prev => {
                          const updated = [...prev];
                          updated[index] = { ...updated[index], answer: text };
                          return updated;
                        });
                        if (promptErrors[index]) {
                          setPromptErrors(prev => {
                            const next = { ...prev };
                            delete next[index];
                            return next;
                          });
                        }
                      }}
                    />
                    {promptErrors[index] && (
                      <Text style={pgStyles.fieldError}>
                        {promptErrors[index]}
                      </Text>
                    )}
                  </View>
                ))}

                {getPrompts.length < MAX_PROMPTS && (
                  <Pressable
                    style={pgStyles.addPromptBtn}
                    onPress={() =>
                      navigation.navigate(namer.navigation.editProfilePrompts, {
                        existingPrompts: getPrompts,
                        onSave: (updated: PromptEntry[]) => setPrompts(updated),
                      })
                    }
                  >
                    <MIcons
                      name="plus-circle-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={pgStyles.addPromptText}>Add a Prompt</Text>
                  </Pressable>
                )}
              </View>

              <FormGroup
                title="Lifestyle"
                hint="Optional details that make matching more thoughtful."
                pgStyles={pgStyles}
              >
                {[
                  {
                    label: 'Children',
                    title: 'Do you have children?',
                    icon: 'human-male-child',
                    map: __MAPPER?.bio_children,
                    state: getProfileEdit.children,
                    set: (id: string) => updateProfileEdit({ children: id }),
                  },
                  {
                    label: 'Smoking',
                    title: 'Do you smoke?',
                    icon: 'smoking-off',
                    map: __MAPPER?.bio_smoking,
                    state: getProfileEdit.smoking,
                    set: (id: string) => updateProfileEdit({ smoking: id }),
                  },
                  {
                    label: 'Drinking',
                    title: 'Do you drink?',
                    icon: 'glass-cocktail',
                    map: __MAPPER?.bio_drinking,
                    state: getProfileEdit.drinking,
                    set: (id: string) => updateProfileEdit({ drinking: id }),
                  },
                  {
                    label: 'Pets',
                    title: 'Do you have a pet?',
                    icon: 'paw-outline',
                    map: __MAPPER?.bio_pets,
                    state: getProfileEdit.pets,
                    set: (id: string) => updateProfileEdit({ pets: id }),
                  },
                ].map(({ label, title, icon, map, state, set }) => (
                  <PickerField
                    key={title}
                    label={label}
                    value={(map as Record<string, string>)?.[state ?? '']}
                    icon={icon}
                    onPress={() =>
                      openPicker({
                        title,
                        selectedId: state,
                        sections: [
                          {
                            title: 'Lifestyle',
                            options: buildOptions(
                              map as Record<string, string>,
                            ),
                          },
                        ],
                        onSelect: set,
                      })
                    }
                    colors={colors}
                    pgStyles={pgStyles}
                  />
                ))}
              </FormGroup>

              <FormGroup
                onLayout={trackSection('background')}
                title="Identity"
                hint="Share as much or as little as feels right."
                pgStyles={pgStyles}
              >
                {[
                  {
                    label: 'Religion',
                    title: 'What is your religion?',
                    icon: 'hands-pray',
                    map: religionOptions,
                    state: getProfileEdit.religion,
                    set: (id: string) => updateProfileEdit({ religion: id }),
                  },
                  {
                    label: 'Ethnicity',
                    title: 'What is your ethnicity?',
                    icon: 'account-group-outline',
                    map: __MAPPER?.bio_ethnicity,
                    state: getProfileEdit.ethnicity,
                    set: (id: string) => updateProfileEdit({ ethnicity: id }),
                  },
                  {
                    label: 'Political Views',
                    title: 'Political views?',
                    icon: 'scale-balance',
                    map: __MAPPER?.bio_politicalview,
                    state: getProfileEdit.politicalview,
                    set: (id: string) =>
                      updateProfileEdit({ politicalview: id }),
                  },
                ].map(({ label, title, icon, map, state, set }) => (
                  <PickerField
                    key={title}
                    label={label}
                    value={(map as Record<string, string>)?.[state ?? '']}
                    icon={icon}
                    onPress={() =>
                      openPicker({
                        expanded: true,
                        title,
                        selectedId: state,
                        sections: [
                          {
                            title: 'Identity',
                            options: buildOptions(
                              map as Record<string, string>,
                            ),
                          },
                        ],
                        onSelect: set,
                      })
                    }
                    colors={colors}
                    pgStyles={pgStyles}
                  />
                ))}
              </FormGroup>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {pickerSheet && (
        <BottomSheet
          backgroundComponent={bottomsheet_renderBackground}
          ref={pickerSheet_ref}
          index={pickerSheet.expanded ? pickerSnapPoints.length - 1 : 0}
          enablePanDownToClose
          snapPoints={pickerSnapPoints}
          enableDynamicSizing={false}
          backdropComponent={bottomsheet_renderBackdrop}
          handleComponent={bottomsheet_renderHandle}
          onClose={() => setPickerSheet(null)}
        >
          <View style={pgStyles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={pgStyles.sheetTitle}>{pickerSheet.title}</Text>
              {!!pickerSheet.subtitle && (
                <Text style={pgStyles.sectionHint}>
                  {pickerSheet.multiple
                    ? `${pickerSheet.subtitle} · ${pickerPicked.length} selected`
                    : pickerSheet.subtitle}
                </Text>
              )}
            </View>
            {pickerSheet.multiple && (
              <TouchableOpacity
                style={pgStyles.pickerDoneButton}
                activeOpacity={0.82}
                onPress={() => {
                  pickerSheet.multiple?.onDone(pickerPicked);
                  closePicker();
                }}
              >
                <Text style={pgStyles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
          {pickerSheet.searchable && (
            <BottomSheetTextInput
              style={pgStyles.pickerSearch}
              placeholder="Search"
              placeholderTextColor={colors.textTertiary}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          )}
          <BottomSheetScrollView
            contentContainerStyle={pgStyles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {pickerSheet.sections.map(section => (
              <View key={section.title} style={pgStyles.pickerSectionCard}>
                <Text style={pgStyles.pickerSectionTitle}>{section.title}</Text>
                <View style={pgStyles.pickerOptions}>
                  {section.options
                    .filter(option =>
                      option.label
                        .toLowerCase()
                        .includes(pickerQuery.trim().toLowerCase()),
                    )
                    .map(option => {
                      const multiple = pickerSheet.multiple;
                      const selected = multiple
                        ? pickerPicked.includes(option.id)
                        : String(pickerSheet.selectedId ?? '') === option.id;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            pgStyles.pickerOption,
                            selected && pgStyles.pickerOptionSelected,
                          ]}
                          activeOpacity={0.82}
                          onPress={() => {
                            if (multiple) {
                              if (selected) {
                                setPickerPicked(ids =>
                                  ids.filter(id => id !== option.id),
                                );
                              } else if (pickerPicked.length < multiple.max) {
                                setPickerPicked(ids => [...ids, option.id]);
                              }
                              return;
                            }
                            pickerSheet.onSelect?.(option.id);
                            closePicker();
                          }}
                        >
                          <Text
                            style={[
                              pgStyles.pickerOptionText,
                              selected && pgStyles.pickerOptionTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                          {selected && (
                            <IIcon
                              name="checkmark-circle"
                              size={20}
                              color={colors.primary}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </View>
            ))}
          </BottomSheetScrollView>
          {/* Keeps the scroll area above the home indicator / nav bar */}
          <View style={{ height: safeInsets.bottom }} />
        </BottomSheet>
      )}
    </>
  );
}

const FormGroup = ({
  title,
  hint,
  children,
  pgStyles,
  onLayout,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  pgStyles: any;
  onLayout?: (e: any) => void;
}) => (
  <View style={pgStyles.groupCard} onLayout={onLayout}>
    <View style={pgStyles.groupHeader}>
      <Text style={pgStyles.groupTitle}>{title}</Text>
      {!!hint && <Text style={pgStyles.groupHint}>{hint}</Text>}
    </View>
    <View style={pgStyles.groupFields}>{children}</View>
  </View>
);

const PickerField = ({
  label,
  value,
  icon,
  onPress,
  colors,
  pgStyles,
}: {
  label: string;
  value?: string | null;
  icon: string;
  onPress: () => void;
  colors: ThemeColors;
  pgStyles: any;
}) => (
  <Pressable style={pgStyles.pickerField} onPress={onPress}>
    <View style={pgStyles.pickerFieldIcon}>
      <MIcons name={icon} size={18} color={colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={pgStyles.fieldLabel}>{label}</Text>
      <Text
        style={[
          pgStyles.pickerFieldValue,
          !value && pgStyles.pickerFieldPlaceholder,
        ]}
      >
        {value || 'Choose an option'}
      </Text>
    </View>
    <MIcons name="chevron-right" size={22} color={colors.textTertiary} />
  </Pressable>
);

const InlineTextField = ({
  label,
  value,
  icon,
  placeholder,
  maxLength,
  onChangeText,
  colors,
  pgStyles,
}: {
  label: string;
  value: string;
  icon: string;
  placeholder: string;
  maxLength?: number;
  onChangeText: (text: string) => void;
  colors: ThemeColors;
  pgStyles: any;
}) => (
  <View style={pgStyles.inlineField}>
    <View style={pgStyles.pickerFieldIcon}>
      <MIcons name={icon} size={18} color={colors.primary} />
    </View>
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={pgStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={pgStyles.inlineInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        maxLength={maxLength}
      />
    </View>
  </View>
);

// ─── Page-level styles ────────────────────────────────────────────────────────
function createPgStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      paddingHorizontal: 0,
    },
    formStack: {
      gap: 14,
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
    },
    previewBtn: {
      minHeight: 36,
      justifyContent: 'center',
      borderRadius: 999,
      paddingHorizontal: 12,
      backgroundColor: colors.backgroundSecondary,
    },
    previewBtnText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '800',
    },
    saveBtn: {
      minHeight: 36,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 3,
    },
    saveBtnText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 14,
    },

    sectionCard: {
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 3,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.text,
      textTransform: 'uppercase',
    },
    sectionHint: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '700',
      marginTop: 2,
    },

    bannerCard: {
      borderRadius: 22,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 3,
    },
    bannerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    bannerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      alignSelf: 'flex-start',
      gap: 5,
    },
    bannerBadgeText: { color: colors.primary, fontWeight: '900', fontSize: 12 },
    bannerTitle: {
      fontSize: 21,
      color: '#fff',
      fontWeight: '900',
      marginTop: 2,
    },
    bannerSubtitle: {
      color: '#ffe7ef',
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },

    formField: {
      borderRadius: 18,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.045,
      shadowRadius: 16,
      elevation: 2,
    },
    groupCard: {
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.045,
      shadowRadius: 16,
      elevation: 2,
    },
    groupHeader: {
      gap: 3,
    },
    groupTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    groupHint: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
    },
    groupFields: {
      gap: 10,
    },
    pickerField: {
      minHeight: 62,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pickerFieldIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerFieldValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 3,
      textTransform: 'capitalize',
    },
    pickerFieldPlaceholder: {
      color: colors.textTertiary,
    },
    inlineField: {
      minHeight: 62,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    inlineFieldValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 3,
    },
    inlineInput: {
      minHeight: 34,
      borderRadius: 0,
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    inputHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 1,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    textInput: {
      minHeight: 44,
      borderRadius: 14,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      paddingHorizontal: 12,
      paddingVertical: 10,
      textTransform: 'none',
    },
    textArea: {
      minHeight: 156,
      paddingTop: 12,
      lineHeight: 21,
      textAlignVertical: 'top',
    },
    readOnlyInput: {
      color: colors.textSecondary,
      backgroundColor: colors.backgroundSecondary,
    },
    inputError: {
      borderColor: colors.error,
    },
    fieldError: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '700',
    },
    charCounter: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: 'right',
      fontWeight: '700',
    },
    placeholder: {
      color: colors.textTertiary,
      fontSize: 14,
      paddingHorizontal: 4,
      paddingVertical: 6,
      fontWeight: '700',
    },

    countBadge: { color: colors.textTertiary, fontSize: 12, fontWeight: '800' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '800' },
    chipTextSelected: { color: '#fff', fontWeight: '900' },
    chipRemove: { marginLeft: 2 },
    chipRemoveText: {
      fontSize: 16,
      color: colors.textTertiary,
      lineHeight: 16,
    },

    promptCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 9,
      position: 'relative',
      backgroundColor: colors.backgroundSecondary,
    },
    promptRemove: { position: 'absolute', top: 8, right: 8, zIndex: 10 },
    promptQuestion: {
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      color: colors.textSecondary,
      paddingRight: 28,
    },
    promptAnswer: {
      minHeight: 92,
      backgroundColor: colors.surface,
      textAlignVertical: 'top',
      lineHeight: 20,
      paddingTop: 12,
    },

    addPromptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      minHeight: 48,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
    addPromptText: { fontSize: 14, fontWeight: '900', color: colors.primary },

    pickerDoneButton: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    pickerDoneText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    pickerSearch: {
      marginHorizontal: 18,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      fontSize: 15,
    },
    sheetHeader: {
      paddingHorizontal: 18,
      paddingTop: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    sheetScrollContent: {
      paddingHorizontal: 18,
      gap: 10,
      paddingBottom: 22,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: colors.text,
      marginBottom: 4,
    },
    promptSheetCard: {
      gap: 10,
      paddingTop: 4,
    },
    promptPickerCard: {
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 10,
    },
    promptSheetInput: {
      minHeight: 120,
      backgroundColor: colors.backgroundSecondary,
      textAlignVertical: 'top',
      lineHeight: 20,
      paddingTop: 12,
    },
    sheetSaveBtn: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      minHeight: 42,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetSaveBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

    interestCategory: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 10,
    },
    interestCategoryTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    pickerSectionCard: {
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 10,
    },
    pickerSectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    pickerOptions: {
      gap: 8,
    },
    pickerOption: {
      minHeight: 50,
      borderRadius: 15,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    pickerOptionSelected: {
      backgroundColor: colors.backgroundSecondary,
      borderColor: colors.border,
    },
    pickerOptionText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    pickerOptionTextSelected: {
      color: colors.primary,
    },
  });
}

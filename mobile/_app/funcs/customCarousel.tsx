import {
  forwardRef,
  useEffect,
  useState,
  useRef,
  useImperativeHandle,
} from 'react';
import {
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  View,
} from 'react-native';
import { useContentWidth } from './responsive';

export interface CarouselRef {
  goToNext: () => void;
  goToPrevious: () => void;
  goToPage: (index: number) => void;
  getCurrentIndex: () => number;
}

interface ControlledCarouselProps {
  pages: React.ReactElement[];
  initialPage?: number;
  onPageChange?: (index: number) => void;
}

export const ControlledCarousel = forwardRef<
  CarouselRef,
  ControlledCarouselProps
>(({ pages, initialPage = 0, onPageChange }, ref) => {
  const [currentIndex, setCurrentIndex] = useState(initialPage);
  const flatListRef = useRef<FlatList>(null);
  // Measured on layout; the content width is only the first guess
  const fallbackWidth = useContentWidth();
  const [pageWidth, setPageWidth] = useState(fallbackWidth);

  // After a resize (rotation, split screen) stay on the same page
  useEffect(() => {
    flatListRef.current?.scrollToOffset({
      offset: currentIndex * pageWidth,
      animated: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth]);

  useImperativeHandle(ref, () => ({
    goToNext: () => {
      const nextIndex = Math.min(currentIndex + 1, pages.length - 1);
      goToPage(nextIndex);
    },
    goToPrevious: () => {
      const prevIndex = Math.max(currentIndex - 1, 0);
      goToPage(prevIndex);
    },
    goToPage: (index: number) => {
      goToPage(index);
    },
    getCurrentIndex: () => currentIndex,
  }));

  const goToPage = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / pageWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      onPageChange?.(newIndex);
    }
  };

  return (
    <View
      style={{ flex: 1 }}
      onLayout={e => {
        const width = Math.round(e.nativeEvent.layout.width);
        if (width > 0 && width !== pageWidth) setPageWidth(width);
      }}
    >
      <FlatList
        ref={flatListRef}
        data={pages}
        keyExtractor={(_, index) => `page-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToAlignment="center"
        initialScrollIndex={initialPage}
        getItemLayout={(_, index) => ({
          length: pageWidth,
          offset: pageWidth * index,
          index,
        })}
        extraData={pageWidth}
        renderItem={({ item, index }) => (
          <View style={{ width: pageWidth, flex: 1 }} key={index}>
            {item}
          </View>
        )}
      />
    </View>
  );
});

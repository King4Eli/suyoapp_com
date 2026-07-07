import React, {   useRef,   useMemo } from 'react'; 
import { View, Text,    Button } from 'react-native';
  

import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';



export   function Zz_nofilee({ route, navigation }: { route: any, navigation: any }) {


    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['25%', '60%'], []);






    return (
        <View style={{ flex: 1 }}>
            {/* your screen content */}
      <Button title="Open" onPress={() => sheetRef.current?.expand()} />

            <BottomSheet
                ref={sheetRef}
                index={1}
                snapPoints={snapPoints}
                enablePanDownToClose
                style={{ zIndex: 1000 }}
            >
                <BottomSheetView style={{padding:23}}>
          <Text>Awesome 🎉</Text>
        </BottomSheetView>
            </BottomSheet>
        </View>

    );
}

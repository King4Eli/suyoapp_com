import { useState, useRef } from "react";
import { TextStyle, Animated, LayoutAnimation, View, TouchableOpacity, Text } from "react-native";
import IIcon from 'react-native-vector-icons/Ionicons';
import { styles } from "./static";

export const AccordionItem = ({ title, titleStyle, subtitle, Content }: { title: string, titleStyle?: TextStyle | TextStyle[], subtitle: string, Content: React.ComponentType }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !isCollapsed;
    setIsCollapsed(next);
    Animated.timing(rotateAnim, { toValue: next ? 0 : 1, duration: 180, useNativeDriver: true }).start();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  return (
    <View style={[styles.editprofile_inputborder, {
      padding: 12,
      borderRadius: 12,
      borderColor: '#e5e7eb',
      backgroundColor: '#f9fafc'
    }]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.82} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={titleStyle ? titleStyle : {textTransform:"capitalize", fontSize: 16, fontWeight: '700', color: '#111827' }}>{title}</Text>
          {subtitle && <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2,textTransform:"capitalize", }}>{subtitle}</Text>}
        </View>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <IIcon name="chevron-down-outline" size={18} color="#4F8EF7" />
        </Animated.View>
      </TouchableOpacity>
      {!isCollapsed && (
        <View style={{ marginTop: 14 }}>
          <Content />
        </View>
      )}
    </View>
  );
};
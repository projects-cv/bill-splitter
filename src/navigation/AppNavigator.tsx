import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import CameraScreen from '../screens/CameraScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ItemAssignmentScreen from '../screens/ItemAssignmentScreen';
import SummaryScreen from '../screens/SummaryScreen';

import { Colors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerShadowVisible: false, // Removes the border on iOS/Android
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
          options={{ title: 'My Receipts', headerShown: false }} 
        />
        <Stack.Screen 
          name="Camera" 
          component={CameraScreen} 
          options={{ title: 'Scan Receipt', headerTransparent: true, headerTintColor: '#fff' }} 
        />
        <Stack.Screen 
          name="Friends" 
          component={FriendsScreen} 
          options={{ title: 'Who is paying?' }} 
        />
        <Stack.Screen 
          name="ItemAssignment" 
          component={ItemAssignmentScreen} 
          options={{ title: 'Split Items' }} 
        />
        <Stack.Screen 
          name="Summary" 
          component={SummaryScreen} 
          options={{ title: 'Summary' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

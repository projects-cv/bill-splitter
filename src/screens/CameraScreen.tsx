import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { Camera as CameraIcon, Image as ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useReceipt } from '../store/ReceiptContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'>;
};

// Mock OCR Data Extraction function
const mockExtractData = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: Math.random().toString(36).substring(7),
        storeName: 'The Mock Restaurant',
        date: new Date().toLocaleDateString(),
        subtotal: 82.50,
        tax: 7.25,
        fees: 15.00, // Tip
        total: 104.75,
        items: [
          { id: 'i1', name: 'Cheeseburger', price: 14.50, assignedTo: [] },
          { id: 'i2', name: 'Margherita Pizza', price: 18.00, assignedTo: [] },
          { id: 'i3', name: 'Craft Beer', price: 8.00, assignedTo: [] },
          { id: 'i4', name: 'Diet Coke', price: 3.50, assignedTo: [] },
          { id: 'i5', name: 'Ribeye Steak', price: 38.50, assignedTo: [] },
        ],
        participants: []
      });
    }, 2500); // Simulate network/processing delay
  });
};

export default function CameraScreen({ navigation }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { setReceipt } = useReceipt();

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takePicture = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error taking picture', error);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setIsProcessing(true);
    // In a real app, upload `uri` to your OCR API
    const extractedData: any = await mockExtractData();
    setReceipt(extractedData);
    setIsProcessing(false);
    
    // Navigate to next screen
    navigation.replace('Friends', { receiptId: extractedData.id });
  };

  if (hasPermission === null) {
    return <View style={styles.container} />;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {image ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
          {isProcessing && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.processingText}>Analyzing receipt...</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.cameraPlaceholder}>
          <CameraIcon stroke={Colors.textLight} size={64} style={{ marginBottom: 24 }} />
          <Text style={styles.placeholderText}>Position receipt in frame</Text>
          <View style={styles.frameGuidance} />
        </View>
      )}

      {!isProcessing && !image && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
            <ImageIcon stroke="#fff" size={28} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.captureButtonOuter} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <View style={styles.spacer} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: Colors.textLight,
    fontSize: 18,
    fontWeight: '500',
  },
  frameGuidance: {
    position: 'absolute',
    width: '80%',
    height: '60%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 120,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captureButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  galleryButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    width: 56,
  },
  imageContainer: {
    flex: 1,
  },
  image: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
});

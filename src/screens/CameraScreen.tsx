import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { Colors } from '../theme/colors';
import { Camera as CameraIcon, Image as ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useReceipt } from '../store/ReceiptContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'>;
};

const extractReceiptData = async (uri: string, base64Data?: string | null) => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.');
  }

  try {
    let base64Image = base64Data;

    if (!base64Image) {
      if (Platform.OS === 'web') {
        // Fallback for web if base64 from picker is missing
        const response = await fetch(uri);
        const blob = await response.blob();
        base64Image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]); // remove data:image/...;base64,
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        base64Image = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    }

    const prompt = `
      Extract the receipt data into JSON format. Include:
      - storeName (string)
      - date (string)
      - subtotal (number)
      - tax (number)
      - fees (number, e.g., tip)
      - total (number)
      - items (array of objects with 'id' as a unique string, 'name', 'price', and 'assignedTo' as an empty array).
      If you can't find a value, use 0 for numbers or empty string for text.
      Only output valid JSON without any markdown formatting or code blocks.
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } }
          ]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      try {
        const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const modelsData = await modelsRes.json();
        if (modelsData.models) {
          const names = modelsData.models
            .map((m: any) => m.name.replace('models/', ''))
            .join(', ');
          throw new Error(`${data.error.message}\n\nAvailable Models:\n${names}`);
        }
      } catch (e) {
        // Ignore errors from the models endpoint and fall through
      }
      throw new Error(data.error.message || 'Error from Gemini API');
    }

    let jsonString = data.candidates[0].content.parts[0].text.trim();
    // Remove markdown code blocks if the model still includes them
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsedData = JSON.parse(jsonString);
    parsedData.id = Math.random().toString(36).substring(7);
    parsedData.participants = [];

    // Ensure all items have an assignedTo array and a unique ID
    if (parsedData.items && Array.isArray(parsedData.items)) {
      parsedData.items = parsedData.items.map((item: any, idx: number) => ({
        ...item,
        id: item.id || `item-${idx}-${Math.random().toString(36).substring(7)}`,
        assignedTo: item.assignedTo || []
      }));
    }

    return parsedData;
  } catch (error) {
    console.error('Error extracting receipt:', error);
    throw error;
  }
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
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        processImage(result.assets[0].uri, result.assets[0].base64);
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
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      processImage(result.assets[0].uri, result.assets[0].base64);
    }
  };

  const processImage = async (uri: string, base64Data?: string | null) => {
    setIsProcessing(true);
    try {
      const extractedData: any = await extractReceiptData(uri, base64Data);
      setReceipt(extractedData);
      setIsProcessing(false);

      // Navigate to next screen
      navigation.replace('Friends', { receiptId: extractedData.id });
    } catch (error: any) {
      setIsProcessing(false);
      setImage(null);
      Alert.alert('Error', error.message || 'Failed to read receipt. Please try again.');
    }
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

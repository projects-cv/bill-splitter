import { createWorker } from 'tesseract.js';
import { parseReceiptText } from './receiptParser';
import { Receipt } from '../types';

/**
 * Traditional (Non-LLM) Optical Character Recognition (OCR) Service
 * Uses Tesseract OCR engine to extract raw text from image pixels,
 * followed by deterministic regex pattern matching to build receipt items.
 */
export async function performTraditionalOCR(imageUri: string, base64Data?: string | null): Promise<Receipt> {
  let worker;
  try {
    // Determine image source (data URI or file path)
    let imageSource = imageUri;
    if (base64Data && !base64Data.startsWith('data:')) {
      imageSource = `data:image/jpeg;base64,${base64Data}`;
    }

    // Initialize Tesseract OCR worker (English language recognition)
    worker = await createWorker('eng');
    
    // Perform optical character recognition on image pixels
    const ret = await worker.recognize(imageSource);
    const rawText = ret.data.text;

    await worker.terminate();

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('No readable text found on receipt. Please ensure receipt is well-lit and legible.');
    }

    // Parse extracted text into structured receipt schema using regex heuristics
    return parseReceiptText(rawText);
  } catch (error: any) {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        // ignore cleanup error
      }
    }
    console.error('OCR Processing Error:', error);
    throw new Error(error.message || 'Failed to scan receipt with OCR.');
  }
}

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, X, CheckCircle, AlertTriangle } from "lucide-react";

interface PaymentProofUploadProps {
  transactionId: string;
  onUploadComplete: () => void;
}

// File signature (magic bytes) validation
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF)
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_DIMENSION = 2048; // Max width/height after compression

async function validateFileSignature(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const signatures = FILE_SIGNATURES[file.type];
  if (!signatures) return false;

  return signatures.some(sig =>
    sig.every((byte, index) => bytes[index] === byte)
  );
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Scale down if too large
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      // Convert to JPEG at 85% quality for compression
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function generateSafeFilename(): string {
  return `${crypto.randomUUID()}.jpg`;
}

export function PaymentProofUpload({ transactionId, onUploadComplete }: PaymentProofUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = async (file: File) => {
    setValidationError(null);

    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError("Only images are allowed (JPEG, PNG, WebP)");
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setValidationError(`File too large. Maximum size is 1 MB (yours: ${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      return;
    }

    // Validate file signature (magic bytes)
    const isValidSignature = await validateFileSignature(file);
    if (!isValidSignature) {
      setValidationError("Invalid file. The file doesn't appear to be a valid image.");
      return;
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setSelectedFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await validateAndSetFile(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("No file selected");
      return;
    }

    setUploading(true);
    setValidationError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // 1. Client-Side Compression (Defense in Depth)
      let fileToUpload = selectedFile;
      try {
        const compressedBlob = await compressImage(selectedFile);
        // If compression worked and reduced size, use it.
        if (compressedBlob.size < selectedFile.size) {
          fileToUpload = new File([compressedBlob], selectedFile.name, { type: 'image/jpeg' });
        }
      } catch (err) {
        console.warn("Compression failed, attempting upload of original", err);
      }

      // 2. Upload via Secure Edge Function
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-payment-proof`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // 3. Create Record in Database
      // The Edge Function returned the secure path
      const { path, fullPath } = result;
      // We need to parse filename from path usually "userId/filename"
      const fileName = path.split('/').pop() || generateSafeFilename();

      const { error: proofError } = await supabase
        .from('payment_proofs')
        .insert({
          user_id: session.user.id,
          transaction_id: transactionId,
          file_path: path,
          file_name: fileName,
          file_size: fileToUpload.size,
          mime_type: fileToUpload.type,
          status: 'pending'
        });

      if (proofError) throw proofError;

      setUploadComplete(true);
      toast.success("Payment proof uploaded securely!", {
        description: "Your payment will be reviewed by our team within 24 hours",
        duration: 5000,
      });

      setTimeout(() => {
        onUploadComplete();
      }, 2000);

    } catch (error: any) {
      console.error("Error uploading payment proof:", error);
      setValidationError(error.message || "Upload failed. Please try again.");
      toast.error("Upload failed", {
        description: error.message || "Please try again or contact support"
      });
    } finally {
      setUploading(false);
    }
  };

  if (uploadComplete) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle className="w-16 h-16 text-primary" />
          <div>
            <h3 className="text-xl font-bold mb-2">Upload Complete!</h3>
            <p className="text-sm text-muted-foreground">
              Your payment proof has been submitted for review. You'll be notified once it's approved.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-bold mb-2">Upload Payment Proof</h3>
        <p className="text-sm text-muted-foreground">
          Please upload a screenshot showing your payment confirmation
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="payment-proof" className="text-sm font-medium">
          Select Image (Max 1 MB)
        </Label>
        <Input
          ref={fileInputRef}
          id="payment-proof"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={uploading}
          className={validationError ? "border-destructive" : ""}
        />

        {validationError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {preview && selectedFile && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Preview:</p>
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Payment proof preview"
              className="max-w-full max-h-48 rounded-lg border"
            />
            <Button
              size="sm"
              variant="destructive"
              onClick={clearFile}
              disabled={uploading}
              className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedFile.name} • {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={uploading || !selectedFile || !!validationError}
        className="w-full"
      >
        {uploading ? (
          <>
            <Upload className="w-4 h-4 mr-2 animate-pulse" />
            Uploading & Compressing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload Payment Proof
          </>
        )}
      </Button>

      <Card className="p-3 bg-muted/30 border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="w-4 h-4" />
          <span>Only images accepted: JPEG, PNG, WebP (max 1 MB)</span>
        </div>
      </Card>
    </Card>
  );
}

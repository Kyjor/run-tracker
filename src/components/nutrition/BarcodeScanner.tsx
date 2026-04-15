import { useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BarcodeScanner({ isOpen, onClose }: BarcodeScannerProps) {
  useEffect(() => {
    if (isOpen) {
      console.info('Barcode scanner is temporarily disabled.');
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan Barcode">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-2">
          Barcode scanning is temporarily unavailable.
        </p>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}


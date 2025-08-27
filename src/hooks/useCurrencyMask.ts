import { useState, useCallback } from 'react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
};

const unformatCurrency = (maskedValue: string) => {
  const numericValue = maskedValue
    .replace(/[^\d,]/g, '') // Remove everything except digits and comma
    .replace(',', '.'); // Replace comma with dot for parseFloat
  
  return parseFloat(numericValue) || 0;
};

export const useCurrencyMask = (initialValue: number = 0) => {
  const [value, setValue] = useState(initialValue);
  const [maskedValue, setMaskedValue] = useState(formatCurrency(initialValue));

  const handleChange = useCallback((inputValue: string) => {
    // Allow user to clear the field completely
    if (inputValue === '') {
      setValue(0);
      setMaskedValue('R$ 0,00');
      return;
    }
    
    // Remove all non-numeric characters except comma
    const cleanValue = inputValue.replace(/[^\d,]/g, '');
    
    // Prevent multiple commas and ensure format
    const parts = cleanValue.split(',');
    let processedValue = parts[0];
    if (parts.length > 1) {
      // Only keep first two decimal places
      processedValue += ',' + parts[1].substring(0, 2);
    }
    
    // Convert to number (treating comma as decimal separator)
    const numericValue = parseFloat(processedValue.replace(',', '.')) || 0;
    
    setValue(numericValue);
    setMaskedValue(formatCurrency(numericValue));
  }, []);

  return {
    value,
    maskedValue,
    handleChange,
    formatCurrency,
    unformatCurrency,
    setValue: (newValue: number) => {
      setValue(newValue);
      setMaskedValue(formatCurrency(newValue));
    }
  };
};

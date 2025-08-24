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
    // Remove all non-numeric characters except comma and dots
    const cleanValue = inputValue.replace(/[^\d,]/g, '');
    
    // Convert to number (treating comma as decimal separator)
    const numericValue = parseFloat(cleanValue.replace(',', '.')) || 0;
    
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

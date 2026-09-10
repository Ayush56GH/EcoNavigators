"use client";

import React from 'react';

interface AuthCheckboxProps {
  id: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: React.ReactNode;
}

export const AuthCheckbox: React.FC<AuthCheckboxProps> = ({ id, name, checked, onChange, label }) => {
  return (
    <div className="terms-label">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="terms-checkbox"
      />
      <span>{label}</span>
    </div>
  );
};

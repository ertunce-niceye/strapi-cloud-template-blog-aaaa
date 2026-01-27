import React, { useState } from 'react';
import { Box, Typography, Grid, GridItem } from '@strapi/design-system';
import { Field, FieldLabel, FieldHint } from '@strapi/design-system';
import styled from 'styled-components';

const PRESET_PALETTES = [
    {
        id: 'default',
        name: 'Default Blue',
        colors: ['#1d4ed8', '#1e40af', '#3b82f6', '#071a3a'],
        palette: {
            primary: '#1d4ed8',
            primaryDark: '#1e3a8a',
            primaryLight: '#3b82f6',
            secondary: '#0ea5e9',
            accent: '#06b6d4',
            background: '#ffffff',
            backgroundGradientFrom: '#1e40af',
            backgroundGradientVia: '#1d4ed8',
            backgroundGradientTo: '#071a3a',
            cardBackground: 'rgba(0, 0, 0, 0.05)',
            cardOverlay: 'rgba(0, 0, 0, 0.05)',
            textPrimary: '#ffffff',
            textSecondary: 'rgba(255, 255, 255, 0.85)',
            border: 'rgba(255, 255, 255, 0.2)',
        }
    },
    {
        id: 'modern',
        name: 'Modern Purple',
        colors: ['#6366f1', '#4f46e5', '#8b5cf6', '#ec4899'],
        palette: {
            primary: '#6366f1',
            primaryDark: '#4f46e5',
            primaryLight: '#818cf8',
            secondary: '#8b5cf6',
            accent: '#ec4899',
            background: '#ffffff',
            backgroundGradientFrom: '#4f46e5',
            backgroundGradientVia: '#7c3aed',
            backgroundGradientTo: '#2e1065',
            cardBackground: 'rgba(99, 102, 241, 0.1)',
            cardOverlay: 'rgba(139, 92, 246, 0.05)',
            textPrimary: '#ffffff',
            textSecondary: 'rgba(255, 255, 255, 0.9)',
            border: 'rgba(255, 255, 255, 0.25)',
        }
    },
    {
        id: 'classic',
        name: 'Classic Slate',
        colors: ['#0f172a', '#334155', '#475569', '#94a3b8'],
        palette: {
            primary: '#0f172a',
            primaryDark: '#020617',
            primaryLight: '#334155',
            secondary: '#475569',
            accent: '#94a3b8',
            background: '#ffffff',
            backgroundGradientFrom: '#1e293b',
            backgroundGradientVia: '#334155',
            backgroundGradientTo: '#0f172a',
            cardBackground: 'rgba(15, 23, 42, 0.08)',
            cardOverlay: 'rgba(0, 0, 0, 0.03)',
            textPrimary: '#ffffff',
            textSecondary: 'rgba(255, 255, 255, 0.8)',
            border: 'rgba(255, 255, 255, 0.15)',
        }
    },
    {
        id: 'minimal',
        name: 'Minimal Zinc',
        colors: ['#18181b', '#3f3f46', '#71717a', '#a1a1aa'],
        palette: {
            primary: '#18181b',
            primaryDark: '#09090b',
            primaryLight: '#3f3f46',
            secondary: '#71717a',
            accent: '#a1a1aa',
            background: '#ffffff',
            backgroundGradientFrom: '#27272a',
            backgroundGradientVia: '#3f3f46',
            backgroundGradientTo: '#18181b',
            cardBackground: 'rgba(24, 24, 27, 0.06)',
            cardOverlay: 'rgba(0, 0, 0, 0.02)',
            textPrimary: '#ffffff',
            textSecondary: 'rgba(255, 255, 255, 0.75)',
            border: 'rgba(255, 255, 255, 0.12)',
        }
    },
    {
        id: 'corporate',
        name: 'Corporate Sky',
        colors: ['#0369a1', '#075985', '#0284c7', '#06b6d4'],
        palette: {
            primary: '#0369a1',
            primaryDark: '#075985',
            primaryLight: '#0284c7',
            secondary: '#0891b2',
            accent: '#06b6d4',
            background: '#ffffff',
            backgroundGradientFrom: '#075985',
            backgroundGradientVia: '#0369a1',
            backgroundGradientTo: '#164e63',
            cardBackground: 'rgba(3, 105, 161, 0.08)',
            cardOverlay: 'rgba(8, 145, 178, 0.04)',
            textPrimary: '#ffffff',
            textSecondary: 'rgba(255, 255, 255, 0.85)',
            border: 'rgba(255, 255, 255, 0.18)',
        }
    },
];

const PaletteCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid ${props => props.$selected ? '#4945ff' : '#dcdce4'};
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;

  &:hover {
    border-color: #4945ff;
    box-shadow: 0 2px 8px rgba(73, 69, 255, 0.1);
  }

  &:focus {
    outline: none;
    border-color: #4945ff;
    box-shadow: 0 0 0 3px rgba(73, 69, 255, 0.1);
  }
`;

const ColorSwatches = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  width: 100%;
`;

const ColorSwatch = styled.div`
  width: 100%;
  height: 32px;
  border-radius: 4px;
  background-color: ${props => props.$color};
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

const PaletteName = styled.div`
  font-size: 13px;
  font-weight: ${props => props.$selected ? '600' : '500'};
  color: ${props => props.$selected ? '#4945ff' : '#32324d'};
  text-align: center;
`;

const ColorPaletteSelector = ({ name, value, onChange, required, hint, label }) => {
    const [selectedPalette, setSelectedPalette] = useState(() => {
        if (!value) return null;
        // Find matching preset by comparing palette data
        const preset = PRESET_PALETTES.find(p => p.id === value?.id ||
            JSON.stringify(p.palette) === JSON.stringify(value));
        return preset?.id || null;
    });

    const handleSelectPalette = (paletteId) => {
        setSelectedPalette(paletteId);
        const palette = PRESET_PALETTES.find(p => p.id === paletteId);
        if (palette) {
            onChange({ target: { name, value: palette.palette } });
        }
    };

    return (
        <Field name={name} required={required}>
            <FieldLabel>{label || 'Color Palette'}</FieldLabel>
            <Box paddingTop={2}>
                <Grid gap={4}>
                    {PRESET_PALETTES.map((palette) => (
                        <GridItem key={palette.id} col={4} s={6} xs={12}>
                            <PaletteCard
                                type="button"
                                $selected={selectedPalette === palette.id}
                                onClick={() => handleSelectPalette(palette.id)}
                            >
                                <ColorSwatches>
                                    {palette.colors.map((color, idx) => (
                                        <ColorSwatch key={idx} $color={color} />
                                    ))}
                                </ColorSwatches>
                                <PaletteName $selected={selectedPalette === palette.id}>
                                    {palette.name}
                                </PaletteName>
                            </PaletteCard>
                        </GridItem>
                    ))}
                </Grid>
            </Box>
            {hint && <FieldHint>{hint}</FieldHint>}
        </Field>
    );
};

export default ColorPaletteSelector;

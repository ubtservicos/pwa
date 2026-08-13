import { useState, useRef, useEffect } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { searchAddresses } from '../lib/geoService';

interface Props {
    value: string;
    onChange: (value: string, coords?: { lat: number; lng: number }) => void;
    placeholder?: string;
    dark?: boolean;
}

export function AddressSearch({ value, onChange, placeholder = 'Digite o endereço', dark = true }: Props) {
    const [suggestions, setSuggestions] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    const handleInput = (v: string) => {
        onChange(v);
        clearTimeout(debounceRef.current);
        if (v.length < 3) { setSuggestions([]); setOpen(false); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            const results = await searchAddresses(v);
            setSuggestions(results);
            setOpen(results.length > 0);
            setLoading(false);
        }, 400); // debounce de 400ms para não sobrecarregar o Nominatim
    };

    // Estilo adaptativo dark/light
    const inputStyle: React.CSSProperties = {
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        fontFamily: 'DM Sans', fontSize: 14,
        color: dark ? '#FFFFFF' : '#0B1B3E',
    };
    const containerStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: 10, height: 48,
        padding: '0 14px', borderRadius: 12,
        background: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.10)' : '#D8DBE5'}`,
        position: 'relative',
    };
    const dropdownStyle: React.CSSProperties = {
        position: 'absolute', top: 52, left: 0, right: 0, zIndex: 1000,
        background: dark ? '#18181B' : '#FFFFFF',
        border: `1px solid ${dark ? '#27272A' : '#D8DBE5'}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={containerStyle}>
                <MapPin size={16} color="#0DB87E" style={{ flexShrink: 0 }} />
                <input
                    value={value}
                    onChange={e => handleInput(e.target.value)}
                    placeholder={placeholder}
                    style={inputStyle}
                />
                {loading && <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #0DB87E', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
                {value && !loading && (
                    <X size={16} color={dark ? 'rgba(255,255,255,0.40)' : '#9399AD'} style={{ cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => { onChange(''); setSuggestions([]); setOpen(false); }} />
                )}
            </div>
            {open && (
                <div style={dropdownStyle}>
                    {suggestions.map((s, i) => (
                        <div key={i} onClick={() => { onChange(s.label, { lat: s.lat, lng: s.lng }); setOpen(false); }}
                            style={{
                                padding: '12px 16px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#EFF0F3'}` : 'none',
                                display: 'flex', gap: 10, alignItems: 'flex-start'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : '#F7F8FA')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <MapPin size={14} color={dark ? 'rgba(255,255,255,0.35)' : '#9399AD'} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: dark ? 'white' : '#0B1B3E', lineHeight: 1.4 }}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
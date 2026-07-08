import { supabase } from './supabase';

// Helper to geocode a record from ceps_ubatuba via Nominatim and cache coordinates in the database
const geocodeDbRecord = async (
    cep: string,
    logradouro: string,
    bairro: string
): Promise<{ lat: number; lng: number } | null> => {
    try {
        // 1. Try searching by CEP first (most precise)
        let encoded = encodeURIComponent(`${cep}, Brasil`);
        let res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
            {
                headers: {
                    'Accept-Language': 'pt-BR',
                    'User-Agent': 'UBT-App/1.0 (ubt.servicos@gmail.com)',
                }
            }
        );
        let data = await res.json();
        
        let lat = data[0] ? parseFloat(data[0].lat) : null;
        let lng = data[0] ? parseFloat(data[0].lon) : null;
        
        // 2. If CEP search fails, fall back to street name + neighborhood + Ubatuba, SP
        if (!lat || !lng) {
            encoded = encodeURIComponent(`${logradouro}, ${bairro}, Ubatuba, SP, Brasil`);
            res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
                {
                    headers: {
                        'Accept-Language': 'pt-BR',
                        'User-Agent': 'UBT-App/1.0 (ubt.servicos@gmail.com)',
                    }
                }
            );
            data = await res.json();
            if (data[0]) {
                lat = parseFloat(data[0].lat);
                lng = parseFloat(data[0].lon);
            }
        }
        
        if (lat && lng) {
            // Update cache in database asynchronously
            supabase.from('ceps_ubatuba')
                .update({ lat, lng })
                .eq('cep', cep)
                .then(({ error }) => {
                    if (error) console.error('Error updating cached coordinates:', error.message);
                });
            return { lat, lng };
        }
        return null;
    } catch (e) {
        console.error('Error geocoding database record:', e);
        return null;
    }
};

// Geocoding direto — converte endereço em coordenadas
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number; label: string } | null> => {
    try {
        // 1. Try to extract CEP from the address string (e.g. 11685-472)
        const cepMatch = address.match(/(\d{5}-\d{3})/);
        if (cepMatch) {
            const cep = cepMatch[1];
            const { data: dbItem, error } = await supabase
                .from('ceps_ubatuba')
                .select('*')
                .eq('cep', cep)
                .maybeSingle();
                
            if (!error && dbItem) {
                const label = `${dbItem.logradouro}, ${dbItem.bairro}, Ubatuba - CEP ${dbItem.cep}`;
                if (dbItem.lat && dbItem.lng) {
                    return { lat: Number(dbItem.lat), lng: Number(dbItem.lng), label };
                } else {
                    const coords = await geocodeDbRecord(dbItem.cep, dbItem.logradouro, dbItem.bairro);
                    if (coords) {
                        return { lat: coords.lat, lng: coords.lng, label };
                    }
                }
            }
        }
        
        // 2. Try to find a match by street name in our DB (extract prefix before number or comma)
        const streetPart = address.split(',')[0].replace(/\d+/g, '').trim();
        if (streetPart.length >= 3) {
            const { data: dbItems, error } = await supabase
                .from('ceps_ubatuba')
                .select('*')
                .ilike('logradouro', `%${streetPart}%`)
                .limit(1);
                
            if (!error && dbItems && dbItems.length > 0) {
                const dbItem = dbItems[0];
                const label = `${dbItem.logradouro}, ${dbItem.bairro}, Ubatuba - CEP ${dbItem.cep}`;
                if (dbItem.lat && dbItem.lng) {
                    return { lat: Number(dbItem.lat), lng: Number(dbItem.lng), label };
                } else {
                    const coords = await geocodeDbRecord(dbItem.cep, dbItem.logradouro, dbItem.bairro);
                    if (coords) {
                        return { lat: coords.lat, lng: coords.lng, label };
                    }
                }
            }
        }

        // Fallback to external Nominatim lookup
        const encoded = encodeURIComponent(address + ', Ubatuba, SP, Brasil');
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
            {
                headers: {
                    'Accept-Language': 'pt-BR',
                    'User-Agent': 'UBT-App/1.0 (ubt.servicos@gmail.com)',
                }
            }
        );
        const data = await res.json();
        if (!data.length) return null;
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
    } catch { return null; }
};

// Geocoding reverso — converte coordenadas em endereço
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
        // Optimize: Check if we have a cached CEP within ~150 meters (delta: 0.0015 degrees)
        const delta = 0.0015;
        const { data: closeItems, error } = await supabase
            .from('ceps_ubatuba')
            .select('*')
            .gte('lat', lat - delta)
            .lte('lat', lat + delta)
            .gte('lng', lng - delta)
            .lte('lng', lng + delta)
            .not('lat', 'is', null);
            
        if (!error && closeItems && closeItems.length > 0) {
            let closestItem = null;
            let minDistanceSq = Infinity;
            
            for (const item of closeItems) {
                const itemLat = Number(item.lat);
                const itemLng = Number(item.lng);
                const distanceSq = Math.pow(itemLat - lat, 2) + Math.pow(itemLng - lng, 2);
                if (distanceSq < minDistanceSq) {
                    minDistanceSq = distanceSq;
                    closestItem = item;
                }
            }
            
            // 0.000002 degrees squared is roughly 150m
            if (closestItem && minDistanceSq < 0.000002) {
                return `${closestItem.logradouro}, ${closestItem.bairro}, Ubatuba - CEP ${closestItem.cep}`;
            }
        }

        // Fallback to external Nominatim lookup
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            {
                headers: {
                    'Accept-Language': 'pt-BR',
                    'User-Agent': 'UBT-App/1.0 (ubt.servicos@gmail.com)',
                }
            }
        );
        const data = await res.json();
        return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
};

// Autocomplete de endereços (usado nos campos de busca)
export const searchAddresses = async (query: string): Promise<Array<{ label: string; lat: number; lng: number }>> => {
    if (query.length < 3) return [];
    try {
        const cleanQuery = query.replace(/[^\d]/g, '');
        let dbQuery = supabase.from('ceps_ubatuba').select('*');
        
        if (cleanQuery.length >= 5 && /^\d+$/.test(cleanQuery)) {
            if (cleanQuery.length === 8) {
                const formattedCep = `${cleanQuery.slice(0, 5)}-${cleanQuery.slice(5)}`;
                dbQuery = dbQuery.eq('cep', formattedCep);
            } else {
                dbQuery = dbQuery.ilike('cep', `%${cleanQuery}%`);
            }
        } else {
            dbQuery = dbQuery.ilike('logradouro', `%${query}%`);
        }
        
        const { data: dbItems, error } = await dbQuery.limit(5);
        if (error) console.error('Database search error:', error.message);
        
        const results: Array<{ label: string; lat: number; lng: number }> = [];
        
        if (dbItems && dbItems.length > 0) {
            for (const item of dbItems) {
                const label = `${item.logradouro}, ${item.bairro}, Ubatuba - CEP ${item.cep}`;
                if (item.lat && item.lng) {
                    results.push({
                        label,
                        lat: Number(item.lat),
                        lng: Number(item.lng)
                    });
                } else {
                    const coords = await geocodeDbRecord(item.cep, item.logradouro, item.bairro);
                    if (coords) {
                        results.push({
                            label,
                            lat: coords.lat,
                            lng: coords.lng
                        });
                    } else {
                        // Default to Ubatuba center coordinate if geocoding fails
                        results.push({
                            label,
                            lat: -23.4339,
                            lng: -45.0711
                        });
                    }
                }
            }
        }
        
        // If we have fewer than 5 results from the database, supplement them using external Nominatim
        if (results.length < 5) {
            const encoded = encodeURIComponent(query + ', Ubatuba');
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=${5 - results.length}&countrycodes=br`,
                {
                    headers: {
                        'Accept-Language': 'pt-BR',
                        'User-Agent': 'UBT-App/1.0 (ubt.servicos@gmail.com)',
                    }
                }
            );
            const nominatimData = await res.json();
            for (const d of nominatimData) {
                const label = d.display_name;
                if (!results.some(r => r.label === label)) {
                    results.push({
                        label,
                        lat: parseFloat(d.lat),
                        lng: parseFloat(d.lon),
                    });
                }
            }
        }
        
        return results;
    } catch { return []; }
};

// Calcular distância e tempo estimado via OSRM (gratuito, sem chave)
export const getRouteInfo = async (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
): Promise<{ distanceKm: number; durationMin: number; polyline: [number, number][] } | null> => {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.routes?.length) return null;
        const route = data.routes[0];
        return {
            distanceKm: +(route.distance / 1000).toFixed(2),
            durationMin: Math.ceil(route.duration / 60),
            polyline: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        };
    } catch { return null; }
};
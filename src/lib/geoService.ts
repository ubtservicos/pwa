import { supabase } from './supabase';

// Chaves de API para os provedores pagos (obtidas das variáveis de ambiente do Vite)
const MAPBOX_KEY = import.meta.env.VITE_MAPBOX_API_KEY || '';
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Cache em memória local para tempo de resposta instantâneo (< 1ms)
const localCache = new Map<string, { lat: number; lng: number; label: string; provider: string }>();

// Carregar cache inicial do localStorage para persistência de sessão
try {
    const savedCache = localStorage.getItem('ubt_endereco_cache_local');
    if (savedCache) {
        const parsed = JSON.parse(savedCache);
        Object.entries(parsed).forEach(([key, val]: [string, any]) => {
            localCache.set(key, val);
        });
    }
} catch (e) {
    console.warn('Erro ao carregar cache local do localStorage:', e);
}

// Salvar cache no localStorage de forma segura
const saveLocalCache = () => {
    try {
        const obj = Object.fromEntries(localCache.entries());
        localStorage.setItem('ubt_endereco_cache_local', JSON.stringify(obj));
    } catch (e) {
        console.warn('Erro ao salvar cache local no localStorage:', e);
    }
};

// =========================================================================
// FUNÇÃO DE NORMALIZAÇÃO DE ENDEREÇO
// =========================================================================
export const normalizeAddress = (address: string): string => {
    if (!address) return '';
    return address
        .toLowerCase()
        // 1. Remover acentos e diacríticos
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // 2. Remover pontuação e normalizar espaços
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        // 3. Padronizar abreviações comuns
        .replace(/\br\b|\brua\b/gi, 'rua')
        .replace(/\bav\b|\bavenida\b/gi, 'avenida')
        .replace(/\bpca\b|\bpraca\b/gi, 'praca')
        .replace(/\brod\b|\brodovia\b/gi, 'rodovia')
        .replace(/\btrav\b|\btravessa\b/gi, 'travessa')
        .replace(/\bal\b|\balameda\b/gi, 'alameda')
        .replace(/\bjd\b|\bjardim\b/gi, 'jardim');
};

// =========================================================================
// SISTEMA DE REGISTRO DE MÉTRICAS NO BANCO
// =========================================================================
const logMetric = async (
    metricType: 'cache_hit' | 'fallback_usage' | 'avg_time' | 'error' | 'not_found',
    query: string,
    normalizedQuery: string,
    provider?: string,
    responseTimeMs?: number,
    errorMessage?: string
) => {
    try {
        await supabase.from('geocoding_metrics').insert({
            metric_type: metricType,
            query,
            normalized_query: normalizedQuery,
            provider,
            response_time_ms: responseTimeMs,
            error_message: errorMessage
        });
    } catch (e) {
        console.error('Erro ao registrar métrica de geocodificação:', e);
    }
};

// Helper para salvar um resultado de geocodificação no cache persistente (DB e Local)
const saveToPersistentCache = async (
    query: string,
    normalizedQuery: string,
    lat: number,
    lng: number,
    provider: string,
    confidence: number = 1.0
) => {
    try {
        // 1. Salvar no cache em memória e localStorage
        localCache.set(normalizedQuery, { lat, lng, label: query, provider });
        saveLocalCache();

        // 2. Salvar no cache remoto do Supabase
        await supabase.from('endereco_cache').insert({
            query,
            normalized_query: normalizedQuery,
            latitude: lat,
            longitude: lng,
            provider,
            confidence
        });
    } catch (e) {
        console.error('Erro ao persistir no cache:', e);
    }
};

// Helper to geocode via OpenStreetMap Nominatim
const geocodeNominatim = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    const encoded = encodeURIComponent(query + ', Ubatuba, SP, Brasil');
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
    if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
};

// Helper to geocode via Mapbox Geocoding API
const geocodeMapbox = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    if (!MAPBOX_KEY) return null;
    const encoded = encodeURIComponent(query + ', Ubatuba, SP, Brasil');
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_KEY}&limit=1&country=br&proximity=-45.0711,-23.4339`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return { lat, lng };
    }
    return null;
};

// Helper to geocode via Google Maps Geocoding API
const geocodeGoogle = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    if (!GOOGLE_KEY) return null;
    const encoded = encodeURIComponent(query + ', Ubatuba, SP, Brasil');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_KEY}&language=pt-BR`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.status === 'OK' && data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng };
    }
    return null;
};

// =========================================================================
// GEOCODING DIRETO HÍBRIDO (Endereço -> Coordenadas)
// =========================================================================
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number; label: string } | null> => {
    if (!address || address.trim().length < 3) return null;
    const startTime = Date.now();
    const normalized = normalizeAddress(address);

    try {
        // -------------------------------------------------------------
        // PASSO 0: Verificar no Cache Local (Memória / localStorage)
        // -------------------------------------------------------------
        if (localCache.has(normalized)) {
            const cached = localCache.get(normalized)!;
            const elapsed = Date.now() - startTime;
            // Registrar métrica de hit de cache
            logMetric('cache_hit', address, normalized, cached.provider, elapsed);
            logMetric('avg_time', address, normalized, cached.provider, elapsed);
            return { lat: cached.lat, lng: cached.lng, label: cached.label };
        }

        // -------------------------------------------------------------
        // PASSO 1: Verificar no Cache Remoto (Supabase endereco_cache)
        // -------------------------------------------------------------
        const { data: remoteCache, error: remoteErr } = await supabase
            .from('endereco_cache')
            .select('*')
            .or(`query.eq."${address}",normalized_query.eq."${normalized}"`)
            .limit(1)
            .maybeSingle();

        if (!remoteErr && remoteCache) {
            const elapsed = Date.now() - startTime;
            // Atualizar cache local
            localCache.set(normalized, {
                lat: Number(remoteCache.latitude),
                lng: Number(remoteCache.longitude),
                label: remoteCache.query,
                provider: remoteCache.provider
            });
            saveLocalCache();

            logMetric('cache_hit', address, normalized, remoteCache.provider, elapsed);
            logMetric('avg_time', address, normalized, remoteCache.provider, elapsed);
            return {
                lat: Number(remoteCache.latitude),
                lng: Number(remoteCache.longitude),
                label: remoteCache.query
            };
        }

        // -------------------------------------------------------------
        // PROVEDOR 1: Tabela Local ceps_ubatuba (Supabase)
        // -------------------------------------------------------------
        const cepMatch = address.match(/(\d{5}-?\d{3})/);
        if (cepMatch) {
            const rawCep = cepMatch[1];
            const formattedCep = rawCep.includes('-') ? rawCep : `${rawCep.slice(0, 5)}-${rawCep.slice(5)}`;
            const { data: dbItem, error } = await supabase
                .from('ceps_ubatuba')
                .select('*')
                .eq('cep', formattedCep)
                .maybeSingle();

            if (!error && dbItem) {
                const label = `${dbItem.logradouro}, ${dbItem.bairro}, Ubatuba - CEP ${dbItem.cep}`;
                if (dbItem.lat && dbItem.lng) {
                    const elapsed = Date.now() - startTime;
                    await saveToPersistentCache(label, normalized, Number(dbItem.lat), Number(dbItem.lng), 'cache_cep');
                    logMetric('fallback_usage', address, normalized, 'cache_cep', elapsed);
                    logMetric('avg_time', address, normalized, 'cache_cep', elapsed);
                    return { lat: Number(dbItem.lat), lng: Number(dbItem.lng), label };
                } else {
                    // Geocodificar o registro sem coordenadas e atualizar a tabela ceps_ubatuba
                    const coords = await geocodeNominatim(label) || 
                                   (MAPBOX_KEY ? await geocodeMapbox(label) : null) || 
                                   (GOOGLE_KEY ? await geocodeGoogle(label) : null);
                    if (coords) {
                        const elapsed = Date.now() - startTime;
                        await supabase.from('ceps_ubatuba').update({ lat: coords.lat, lng: coords.lng }).eq('cep', dbItem.cep);
                        await saveToPersistentCache(label, normalized, coords.lat, coords.lng, 'cache_cep');
                        logMetric('fallback_usage', address, normalized, 'cache_cep', elapsed);
                        logMetric('avg_time', address, normalized, 'cache_cep', elapsed);
                        return { lat: coords.lat, lng: coords.lng, label };
                    }
                }
            }
        }

        // Buscar por correspondência textual de rua no banco local ceps_ubatuba
        const streetPart = address.split(',')[0].replace(/\d+/g, '').trim();
        if (streetPart.length >= 3) {
            const { data: dbItems, error: dbStreetErr } = await supabase
                .from('ceps_ubatuba')
                .select('*')
                .ilike('logradouro', `%${streetPart}%`)
                .limit(1);

            if (!dbStreetErr && dbItems && dbItems.length > 0) {
                const dbItem = dbItems[0];
                const label = `${dbItem.logradouro}, ${dbItem.bairro}, Ubatuba - CEP ${dbItem.cep}`;
                if (dbItem.lat && dbItem.lng) {
                    const elapsed = Date.now() - startTime;
                    await saveToPersistentCache(label, normalized, Number(dbItem.lat), Number(dbItem.lng), 'cache_cep');
                    logMetric('fallback_usage', address, normalized, 'cache_cep', elapsed);
                    logMetric('avg_time', address, normalized, 'cache_cep', elapsed);
                    return { lat: Number(dbItem.lat), lng: Number(dbItem.lng), label };
                }
            }
        }

        // -------------------------------------------------------------
        // PROVEDOR 2: OpenStreetMap Nominatim (Gratuito)
        // -------------------------------------------------------------
        try {
            const coords = await geocodeNominatim(address);
            if (coords) {
                const elapsed = Date.now() - startTime;
                await saveToPersistentCache(address, normalized, coords.lat, coords.lng, 'nominatim', 0.8);
                logMetric('fallback_usage', address, normalized, 'nominatim', elapsed);
                logMetric('avg_time', address, normalized, 'nominatim', elapsed);
                return { lat: coords.lat, lng: coords.lng, label: address };
            }
        } catch (err: any) {
            logMetric('error', address, normalized, 'nominatim', Date.now() - startTime, err.message);
        }

        // -------------------------------------------------------------
        // PROVEDOR 3: Mapbox Geocoding (Pago/Limite Gratuito)
        // -------------------------------------------------------------
        if (MAPBOX_KEY) {
            try {
                const coords = await geocodeMapbox(address);
                if (coords) {
                    const elapsed = Date.now() - startTime;
                    await saveToPersistentCache(address, normalized, coords.lat, coords.lng, 'mapbox', 0.9);
                    logMetric('fallback_usage', address, normalized, 'mapbox', elapsed);
                    logMetric('avg_time', address, normalized, 'mapbox', elapsed);
                    return { lat: coords.lat, lng: coords.lng, label: address };
                }
            } catch (err: any) {
                logMetric('error', address, normalized, 'mapbox', Date.now() - startTime, err.message);
            }
        }

        // -------------------------------------------------------------
        // PROVEDOR 4: Google Maps Geocoding (Pago)
        // -------------------------------------------------------------
        if (GOOGLE_KEY) {
            try {
                const coords = await geocodeGoogle(address);
                if (coords) {
                    const elapsed = Date.now() - startTime;
                    await saveToPersistentCache(address, normalized, coords.lat, coords.lng, 'google', 0.95);
                    logMetric('fallback_usage', address, normalized, 'google', elapsed);
                    logMetric('avg_time', address, normalized, 'google', elapsed);
                    return { lat: coords.lat, lng: coords.lng, label: address };
                }
            } catch (err: any) {
                logMetric('error', address, normalized, 'google', Date.now() - startTime, err.message);
            }
        }

        // Registro de endereço não encontrado após todos os fallbacks
        const elapsedTotal = Date.now() - startTime;
        logMetric('not_found', address, normalized, 'all_providers', elapsedTotal);
        logMetric('avg_time', address, normalized, 'all_providers', elapsedTotal);
        return null;

    } catch (e: any) {
        logMetric('error', address, normalized, 'system', Date.now() - startTime, e.message);
        return null;
    }
};

// =========================================================================
// GEOCODING REVERSO HÍBRIDO (Coordenadas -> Endereço)
// =========================================================================
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
        const startTime = Date.now();
        // 1. Procurar nas redondezas no banco local (~150m de margem)
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

            if (closestItem && minDistanceSq < 0.000002) { // aprox 150 metros
                const label = `${closestItem.logradouro}, ${closestItem.bairro}, Ubatuba - CEP ${closestItem.cep}`;
                logMetric('cache_hit', `${lat},${lng}`, 'reverse_geocode', 'cache_cep', Date.now() - startTime);
                return label;
            }
        }

        // 2. Nominatim Reverse Lookup (Gratuito)
        try {
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
            if (data && data.display_name) {
                logMetric('fallback_usage', `${lat},${lng}`, 'reverse_geocode', 'nominatim', Date.now() - startTime);
                return data.display_name;
            }
        } catch (nominatimErr) {
            // Tenta Mapbox / Google se Nominatim falhar
            if (MAPBOX_KEY) {
                const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_KEY}&limit=1`);
                const data = await res.json();
                if (data && data.features && data.features.length > 0) {
                    return data.features[0].place_name;
                }
            }
            if (GOOGLE_KEY) {
                const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}&language=pt-BR`);
                const data = await res.json();
                if (data && data.status === 'OK' && data.results && data.results.length > 0) {
                    return data.results[0].formatted_address;
                }
            }
        }

        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
};

// =========================================================================
// AUTOCOMPLETE DE ENDEREÇOS COM FALLBACK E CACHE
// =========================================================================
export const searchAddresses = async (query: string): Promise<Array<{ label: string; lat: number; lng: number }>> => {
    if (!query || query.trim().length < 3) return [];
    const normalized = normalizeAddress(query);

    try {
        const results: Array<{ label: string; lat: number; lng: number; score?: number }> = [];

        // 1. Procurar no Cache Remoto endereco_cache (combinação parcial)
        const { data: cacheMatches, error: cacheErr } = await supabase
            .from('endereco_cache')
            .select('*')
            .ilike('normalized_query', `%${normalized}%`)
            .limit(5);

        if (!cacheErr && cacheMatches && cacheMatches.length > 0) {
            cacheMatches.forEach(item => {
                results.push({
                    label: item.query,
                    lat: Number(item.latitude),
                    lng: Number(item.longitude),
                    score: 100
                });
            });
        }

        // 2. Procurar no Banco de Dados ceps_ubatuba
        if (results.length < 5) {
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

            const { data: dbItems, error: dbErr } = await dbQuery.limit(5 - results.length);
            if (!dbErr && dbItems && dbItems.length > 0) {
                dbItems.forEach(item => {
                    const label = `${item.logradouro}, ${item.bairro}, Ubatuba - CEP ${item.cep}`;
                    if (!results.some(r => r.label === label)) {
                        results.push({
                            label,
                            lat: item.lat ? Number(item.lat) : -23.4339, // Default centro Ubatuba
                            lng: item.lng ? Number(item.lng) : -45.0711,
                            score: 90
                        });
                    }
                });
            }
        }

        // 3. Fallback Externo (OpenStreetMap Nominatim / Mapbox / Google)
        if (results.length < 5) {
            // Tenta Nominatim
            try {
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
                if (nominatimData && nominatimData.length > 0) {
                    nominatimData.forEach((d: any) => {
                        const label = d.display_name;
                        if (!results.some(r => r.label === label)) {
                            results.push({
                                label,
                                lat: parseFloat(d.lat),
                                lng: parseFloat(d.lon),
                                score: 80
                            });
                        }
                    });
                }
            } catch (err) {
                // Tenta Mapbox se Nominatim falhar
                if (MAPBOX_KEY && results.length < 5) {
                    const encoded = encodeURIComponent(query + ', Ubatuba, SP, Brasil');
                    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_KEY}&limit=${5 - results.length}&country=br&proximity=-45.0711,-23.4339`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data && data.features) {
                        data.features.forEach((feat: any) => {
                            const [lng, lat] = feat.center;
                            if (!results.some(r => r.lat === lat && r.lng === lng)) {
                                results.push({
                                    label: feat.place_name,
                                    lat,
                                    lng,
                                    score: 75
                                });
                            }
                        });
                    }
                }
            }
        }

        return results.map(r => ({ label: r.label, lat: r.lat, lng: r.lng }));
    } catch {
        return [];
    }
};

// =========================================================================
// CALCULAR DISTÂNCIA E TEMPO ESTIMADO (OSRM)
// =========================================================================
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